import React, { useState, useEffect, useCallback, type ReactElement } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

import { Badge, LoadingSpinner } from '../components/common';
import MiniChart from '../components/dashboard/MiniChart';
import { fetchPositions, fetchRecommendations, fetchPredictions, fetchCandidates, authFetch, placeManualOrder } from '../services/api';

import type { RecommendationData, PredictionData, CandidateData } from '../services/api';

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
}

interface StockNews {
  title: string;
  source: string;
  publishedAt: string;
  symbol?: string;
}

interface PositionWithSignal {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  signal: 'hold' | 'sell' | 'add';
  signalReason: string;
}

function Strategy(): ReactElement {
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);
  const [positions, setPositions] = useState<PositionWithSignal[]>([]);
  const [news, setNews] = useState<StockNews[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [stockDetails, setStockDetails] = useState<Record<string, { name: string; description: string; sector: string; marketCap: number }>>({});
  const [selectedOutlook, setSelectedOutlook] = useState<RecommendationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shortCount, setShortCount] = useState(0);
  const [longCount, setLongCount] = useState(0);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [totalPredictedProfit, setTotalPredictedProfit] = useState(0);
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [orderingSymbol, setOrderingSymbol] = useState<string | null>(null);
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

  const handleManualBuy = async (symbol: string, quantity: number): Promise<void> => {
    if (quantity < 1) return;
    setOrderingSymbol(symbol);
    setOrderMessage(null);
    try {
      await placeManualOrder({ symbol, side: 'BUY', quantity, orderType: 'MKT' });
      setOrderMessage(`BUY ${quantity} ${symbol} — order placed`);
      loadData();
    } catch {
      setOrderMessage(`Failed to buy ${symbol}`);
    } finally {
      setOrderingSymbol(null);
      setTimeout(() => setOrderMessage(null), 5000);
    }
  };

  const handleManualSell = async (symbol: string, quantity: number): Promise<void> => {
    if (quantity < 1) return;
    setOrderingSymbol(symbol);
    setOrderMessage(null);
    try {
      await placeManualOrder({ symbol, side: 'SELL', quantity, orderType: 'MKT' });
      setOrderMessage(`SELL ${quantity} ${symbol} — order placed`);
      loadData();
    } catch {
      setOrderMessage(`Failed to sell ${symbol}`);
    } finally {
      setOrderingSymbol(null);
      setTimeout(() => setOrderMessage(null), 5000);
    }
  };

  const loadData = useCallback(async (): Promise<void> => {
    try {
      // Step 1: Load recommendations + positions (fast, no Polygon calls)
      const [recs, posResult] = await Promise.all([
        fetchRecommendations().catch(() => [] as RecommendationData[]),
        fetchPositions().catch(() => []) as Promise<IbkrPosition[]>,
      ]);

      setRecommendations(recs);

      const shorts = recs.filter((r) => r.holdType === 'short' || !r.strategy?.toLowerCase().startsWith('long')).length;
      const longs = recs.filter((r) => r.holdType === 'long' || r.strategy?.toLowerCase().startsWith('long')).length;
      setShortCount(shorts);
      setLongCount(longs);

      // Map positions
      if (Array.isArray(posResult)) {
        const mapped: PositionWithSignal[] = posResult.map((p) => {
          const pnlPercent = p.avgPrice > 0 ? ((p.mktPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
          let signal: 'hold' | 'sell' | 'add' = 'hold';
          let signalReason = 'Maintaining position — no action needed';

          if (pnlPercent <= -15) {
            signal = 'sell';
            signalReason = `Down ${Math.abs(pnlPercent).toFixed(1)}% — stop loss triggered. Consider selling to protect capital.`;
          } else if (pnlPercent >= 20) {
            signal = 'sell';
            signalReason = `Up ${pnlPercent.toFixed(1)}% — consider taking profits before pullback.`;
          } else if (pnlPercent <= -5) {
            signal = 'hold';
            signalReason = `Down ${Math.abs(pnlPercent).toFixed(1)}% — watching closely. Will sell if drops to -15%.`;
          } else if (pnlPercent >= 5) {
            signal = 'hold';
            signalReason = `Up ${pnlPercent.toFixed(1)}% — looking good. Holding for higher target.`;
          } else if (pnlPercent >= 0) {
            signal = 'add';
            signalReason = `Slightly up — consider adding to position if thesis still valid.`;
          }

          const sellRec = recs.find((r) => r.symbol === p.ticker && r.action === 'SELL');
          if (sellRec) {
            signal = 'sell';
            signalReason = `Agent recommends selling: ${sellRec.reasoning.substring(0, 100)}...`;
          }

          return {
            symbol: p.ticker,
            shares: p.position,
            avgPrice: p.avgPrice,
            currentPrice: p.mktPrice,
            pnl: p.unrealizedPnl,
            pnlPercent,
            signal,
            signalReason,
          };
        });
        setPositions(mapped);
      }
    } catch { /* no data */ }
    finally { setIsLoading(false); }

    // Step 2: Load predictions + candidates
    try {
      const [predResult, candidateResult] = await Promise.all([
        fetchPredictions().catch(() => ({ data: [], totalPredictedProfit: 0 })),
        fetchCandidates().catch(() => []),
      ]);
      setPredictions(predResult.data);
      setTotalPredictedProfit(predResult.totalPredictedProfit);
      setCandidates(candidateResult);
    } catch { /* skip */ }

    // Step 3: Load prices + details in background (won't block page)
    try {
      const recs = await fetchRecommendations().catch(() => [] as RecommendationData[]);
      const uniqueSymbols = Array.from(new Set(recs.map((r) => r.symbol).filter(Boolean)));

      // Fetch all prices in parallel
      const priceMap: Record<string, number> = {};
      const pricePromises = uniqueSymbols.map(async (sym) => {
        try {
          const priceRes = await authFetch(`/market/${sym}/price`);
          const priceData = await priceRes.json();
          if (priceData.data?.price) {
            priceMap[sym] = priceData.data.price;
          }
        } catch { /* skip */ }
      });
      await Promise.all(pricePromises);
      setPrices(priceMap);

      // Fetch details one at a time (rate limited)
      const detailsMap: Record<string, { name: string; description: string; sector: string; marketCap: number }> = {};
      for (const sym of uniqueSymbols.slice(0, 5)) {
        try {
          const detailRes = await authFetch(`/market/${sym}/details`);
          const detailData = await detailRes.json();
          if (detailData.data) {
            detailsMap[sym] = {
              name: detailData.data.name ?? sym,
              description: detailData.data.description ?? '',
              sector: detailData.data.sector ?? '',
              marketCap: detailData.data.marketCap ?? 0,
            };
          }
        } catch { /* skip */ }
      }
      setStockDetails(detailsMap);

      // News from details we already have
      const allNews: StockNews[] = [];
      for (const sym of Object.keys(detailsMap).slice(0, 3)) {
        const detail = detailsMap[sym];
        if (detail?.description) {
          allNews.push({
            title: `${detail.name} — ${detail.description.substring(0, 150)}`,
            source: detail.sector || 'Market',
            publishedAt: new Date().toLocaleString(),
            symbol: sym,
          });
        }
      }
      setNews(allNews);
    } catch { /* background load failed, page still works */ }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  useEffect(() => {
    async function fetchCycle(): Promise<void> {
      try {
        const res = await authFetch('/engine/cycle-status');
        const data = await res.json();
        if (data.data) setCountdown(data.data.secondsUntilNext);
      } catch { /* skip */ }
    }
    fetchCycle();
    const sync = setInterval(fetchCycle, 10000);
    const tick = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => { clearInterval(sync); clearInterval(tick); };
  }, []);

  if (isLoading) return <LoadingSpinner size="lg" message="Loading strategy..." />;

  const totalRecs = shortCount + longCount;
  const shortPercent = totalRecs > 0 ? (shortCount / totalRecs) * 100 : 50;
  const longPercent = totalRecs > 0 ? (longCount / totalRecs) * 100 : 50;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Strategy & Outlook</h1>

      {/* Planned Allocation Pie Chart */}
      {recommendations.length > 0 && (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider">Planned Allocation</h2>
            {countdown > 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-tertiary dark:bg-dark-surface-tertiary">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-mono font-semibold text-text-primary dark:text-dark-text-primary">
                  Next cycle: {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                <span className="text-xs font-semibold text-primary">Analyzing...</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recommendations.filter((r) => r.action === 'BUY' && r.quantity > 0).map((r) => ({
                      name: r.symbol,
                      value: r.quantity,
                      shares: r.quantity,
                      strategy: r.strategy,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name }) => name}
                  >
                    {recommendations.filter((r) => r.action === 'BUY' && r.quantity > 0).map((_, index) => {
                      const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                      return <Cell key={index} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#f1f5f9',
                    }}
                    formatter={(_value, name) => [`${name}`, 'Stock']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Stock Details Table */}
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-6 gap-2 text-[10px] font-semibold text-text-muted dark:text-dark-text-muted uppercase pb-1 border-b border-border dark:border-dark-border">
                <span>Stock</span>
                <span>Type</span>
                <span className="text-right">Shares</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
                <span className="text-right">Sell Target</span>
              </div>
              {(() => {
                const buyRecs = [...recommendations.filter((r) => r.action === 'BUY')]
                  .sort((a, b) => {
                    if (a.quantity > 0 && b.quantity === 0) return -1;
                    if (a.quantity === 0 && b.quantity > 0) return 1;
                    return b.confidence - a.confidence;
                  });
                const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
                let totalCost = 0;
                let totalShares = 0;

                const rows = buyRecs.map((rec, index) => {
                  const isLong = rec.holdType === 'long' || rec.strategy?.toLowerCase().startsWith('long');
                  const stockPrice = prices[rec.symbol] ?? 0;
                  const cost = rec.quantity > 0 ? rec.quantity * stockPrice : 0;
                  totalCost += cost;
                  totalShares += rec.quantity;

                  return (
                    <div key={rec._id} className="grid grid-cols-6 gap-2 items-center py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span className="font-bold text-text-primary dark:text-dark-text-primary">{rec.symbol}</span>
                      </div>
                      <span className={`text-[10px] font-medium ${isLong ? 'text-profit' : 'text-warning'}`}>
                        {isLong ? 'Long' : 'Short'}
                      </span>
                      <span className="text-right text-text-primary dark:text-dark-text-primary font-medium">
                        {rec.quantity > 0 ? rec.quantity : '—'}
                      </span>
                      <span className="text-right text-text-secondary dark:text-dark-text-secondary">
                        {stockPrice > 0 ? `$${stockPrice.toFixed(2)}` : '...'}
                      </span>
                      <span className="text-right text-text-primary dark:text-dark-text-primary font-medium">
                        {rec.quantity === 0 ? 'Watch' : cost > 0 ? `$${cost.toFixed(2)}` : '...'}
                      </span>
                      <span className="text-right text-text-muted dark:text-dark-text-muted">
                        {isLong ? 'Hold' : rec.confidence >= 70 ? '+20%' : '+10%'}
                      </span>
                    </div>
                  );
                });

                return (
                  <>
                    {rows}
                    <div className="grid grid-cols-6 gap-2 items-center py-2 text-xs border-t border-border dark:border-dark-border mt-1 font-bold">
                      <span className="text-text-primary dark:text-dark-text-primary">TOTAL</span>
                      <span />
                      <span className="text-right text-text-primary dark:text-dark-text-primary">{totalShares}</span>
                      <span />
                      <span className="text-right text-primary">${totalCost.toFixed(2)}</span>
                      <span />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Balance */}
      <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-3">Portfolio Balance</h2>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1">
            <div className="flex h-4 rounded-full overflow-hidden bg-surface-tertiary dark:bg-dark-surface-tertiary">
              <div className="bg-warning transition-all" style={{ width: `${shortPercent}%` }} />
              <div className="bg-profit transition-all" style={{ width: `${longPercent}%` }} />
            </div>
          </div>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-warning" />
            <span className="text-text-secondary dark:text-dark-text-secondary">Short-Term: {shortCount} ({shortPercent.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-profit" />
            <span className="text-text-secondary dark:text-dark-text-secondary">Long-Term: {longCount} ({longPercent.toFixed(0)}%)</span>
          </div>
        </div>
        {longCount === 0 && recommendations.length > 0 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-warning-light/30 dark:bg-yellow-900/10 border border-warning/30">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              No long-term picks yet. With a $10 budget, most affordable stocks are short-term momentum plays. Long-term ETFs (SPY, QQQ) require $400+. As your portfolio grows, the agent will start recommending long-term holdings.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recommendations + Positions */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Predictions */}
          {predictions.length > 0 && (
            <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider">End of Day Prediction</h2>
                <div className={`text-lg font-bold ${totalPredictedProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {totalPredictedProfit >= 0 ? '+' : ''}${totalPredictedProfit.toFixed(2)}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-text-muted dark:text-dark-text-muted border-b border-border dark:border-dark-border">
                      <th className="text-left py-2 pr-3">Stock</th>
                      <th className="text-right py-2 px-2">Shares</th>
                      <th className="text-right py-2 px-2">Entry</th>
                      <th className="text-right py-2 px-2">Now</th>
                      <th className="text-right py-2 px-2">Predicted EOD</th>
                      <th className="text-right py-2 px-2">Current P&L</th>
                      <th className="text-right py-2 px-2">Predicted P&L</th>
                      <th className="text-center py-2 px-2">Momentum</th>
                      <th className="text-right py-2 px-2">To Target</th>
                      <th className="text-right py-2 pl-2">To Stop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.map((pred) => (
                      <tr key={pred.symbol} className="border-b border-border/30 dark:border-dark-border/30 hover:bg-surface-secondary/50 dark:hover:bg-dark-surface-tertiary/50">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary dark:text-dark-text-primary">{pred.symbol}</span>
                            {pred.rsi !== null && (
                              <span className={`text-[10px] px-1 rounded ${
                                pred.rsi < 30 ? 'bg-profit/20 text-profit' :
                                pred.rsi > 70 ? 'bg-loss/20 text-loss' :
                                'bg-dark-border/50 text-text-muted dark:text-dark-text-muted'
                              }`}>
                                RSI {pred.rsi.toFixed(0)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right py-3 px-2 text-text-primary dark:text-dark-text-primary">{pred.quantity}</td>
                        <td className="text-right py-3 px-2 text-text-muted dark:text-dark-text-muted">${pred.entryPrice.toFixed(4)}</td>
                        <td className="text-right py-3 px-2 text-text-primary dark:text-dark-text-primary font-medium">${pred.currentPrice.toFixed(4)}</td>
                        <td className={`text-right py-3 px-2 font-medium ${pred.predictedEodPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          ${pred.predictedEodPrice.toFixed(4)}
                        </td>
                        <td className={`text-right py-3 px-2 ${pred.currentPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pred.currentPnl >= 0 ? '+' : ''}${pred.currentPnl.toFixed(2)}
                          <div className="text-[10px]">({pred.currentPnlPercent.toFixed(1)}%)</div>
                        </td>
                        <td className={`text-right py-3 px-2 font-bold ${pred.predictedEodPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pred.predictedEodPnl >= 0 ? '+' : ''}${pred.predictedEodPnl.toFixed(2)}
                          <div className="text-[10px]">({pred.predictedEodPnlPercent.toFixed(1)}%)</div>
                        </td>
                        <td className="text-center py-3 px-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                            pred.momentum === 'bullish' ? 'bg-profit/20 text-profit' :
                            pred.momentum === 'bearish' ? 'bg-loss/20 text-loss' :
                            'bg-dark-border/50 text-text-muted dark:text-dark-text-muted'
                          }`}>
                            {pred.momentum}
                          </span>
                        </td>
                        <td className="text-right py-3 px-2 text-profit text-xs">
                          {pred.distanceToTarget !== null ? `${pred.distanceToTarget.toFixed(1)}%` : '—'}
                        </td>
                        <td className="text-right py-3 pl-2 text-loss text-xs">
                          {pred.distanceToStop !== null ? `${pred.distanceToStop.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 pt-3 border-t border-border dark:border-dark-border flex justify-between text-xs text-text-muted dark:text-dark-text-muted">
                <span>Based on ATR, RSI, MACD momentum — not financial advice</span>
                <span className={`font-bold ${totalPredictedProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                  Total EOD: {totalPredictedProfit >= 0 ? '+' : ''}${totalPredictedProfit.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Agent's Radar — Screened Candidates */}
          {candidates.length > 0 && (
            <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">
                Agent&apos;s Radar — {candidates.length} Stocks Scanned
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-text-muted dark:text-dark-text-muted border-b border-border dark:border-dark-border">
                      <th className="text-left py-2 pr-2">Ticker</th>
                      <th className="text-right py-2 px-2">Price</th>
                      <th className="text-right py-2 px-2">Change</th>
                      <th className="text-right py-2 px-2">Volume</th>
                      <th className="text-center py-2 px-2">RSI</th>
                      <th className="text-center py-2 px-2">Momentum</th>
                      <th className="text-right py-2 px-2">Can Buy</th>
                      <th className="text-right py-2 pl-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.ticker} className={`border-b border-border/20 dark:border-dark-border/20 ${!c.affordable ? 'opacity-40' : ''}`}>
                        <td className="py-2 pr-2 font-bold text-text-primary dark:text-dark-text-primary">{c.ticker}</td>
                        <td className="text-right py-2 px-2 text-text-primary dark:text-dark-text-primary">${c.price.toFixed(4)}</td>
                        <td className={`text-right py-2 px-2 font-medium ${c.changePct >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {c.changePct >= 0 ? '+' : ''}{c.changePct.toFixed(1)}%
                        </td>
                        <td className="text-right py-2 px-2 text-text-muted dark:text-dark-text-muted">
                          {c.volume > 1000000 ? `${(c.volume / 1000000).toFixed(1)}M` : `${(c.volume / 1000).toFixed(0)}K`}
                        </td>
                        <td className="text-center py-2 px-2">
                          {c.rsi !== null ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              c.rsi < 30 ? 'bg-profit/20 text-profit' :
                              c.rsi > 70 ? 'bg-loss/20 text-loss' :
                              'bg-dark-border/30 text-text-muted dark:text-dark-text-muted'
                            }`}>
                              {c.rsi.toFixed(0)}
                            </span>
                          ) : <span className="text-text-muted dark:text-dark-text-muted">—</span>}
                        </td>
                        <td className="text-center py-2 px-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            c.momentum === 'bullish' ? 'bg-profit/20 text-profit' :
                            c.momentum === 'bearish' ? 'bg-loss/20 text-loss' :
                            'bg-dark-border/30 text-text-muted dark:text-dark-text-muted'
                          }`}>
                            {c.momentum}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2 text-text-primary dark:text-dark-text-primary">
                          {c.affordable ? `${c.sharesBuyable} shares` : '—'}
                        </td>
                        <td className="text-right py-2 pl-2">
                          {c.affordable && c.sharesBuyable > 0 && c.momentum !== 'bearish' && (
                            <button
                              onClick={() => handleManualBuy(c.ticker, Math.min(c.sharesBuyable, Math.ceil(c.sharesBuyable / 3)))}
                              disabled={orderingSymbol === c.ticker}
                              className="px-2 py-1 text-xs font-bold rounded bg-profit/20 text-profit hover:bg-profit/30 border border-profit/30 transition-colors disabled:opacity-50"
                            >
                              {orderingSymbol === c.ticker ? '...' : 'Buy'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-[10px] text-text-muted dark:text-dark-text-muted">
                Refreshes each cycle — shows what the agent is analyzing
              </div>
            </div>
          )}

          {/* Next Moves */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Next Moves — What to Buy & When</h2>
            {orderMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${orderMessage.includes('Failed') ? 'bg-loss/20 text-loss' : 'bg-profit/20 text-profit'}`}>
                {orderMessage}
              </div>
            )}
            {recommendations.length === 0 ? (
              <p className="text-sm text-text-muted dark:text-dark-text-muted">Waiting for next analysis cycle...</p>
            ) : (
              <div className="flex flex-col gap-4">
                {[...recommendations].sort((a, b) => {
                  if (a.quantity > 0 && b.quantity === 0) return -1;
                  if (a.quantity === 0 && b.quantity > 0) return 1;
                  return b.confidence - a.confidence;
                }).map((rec) => {
                  const isLong = rec.holdType === 'long' || rec.strategy?.toLowerCase().startsWith('long');
                  const isWatch = rec.quantity === 0;
                  return (
                    <div key={rec._id} className={`p-4 rounded-lg ${isWatch ? 'bg-dark-surface-tertiary/50 dark:bg-dark-surface/50 opacity-70 border border-dashed border-dark-border' : 'bg-surface-secondary dark:bg-dark-surface-tertiary'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.action === 'BUY' ? 'buy' : rec.action === 'SELL' ? 'sell' : 'pending'}>
                            {rec.action}
                          </Badge>
                          <span className={`text-lg font-bold ${isWatch ? 'text-text-muted dark:text-dark-text-muted' : 'text-text-primary dark:text-dark-text-primary'}`}>{rec.symbol}</span>
                          {isWatch && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-dark-border/50 text-text-muted dark:text-dark-text-muted">
                              WATCHLIST
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                            isLong ? 'bg-profit/20 text-profit' : 'bg-warning/20 text-warning'
                          }`}>
                            {isLong ? 'LONG' : 'SHORT'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">{rec.quantity} shares</span>
                          <div className="text-xs text-text-muted dark:text-dark-text-muted">{rec.confidence}% confidence</div>
                        </div>
                      </div>

                      <p className="text-sm text-text-secondary dark:text-dark-text-secondary mb-2">
                        <span className="font-semibold text-primary">Why: </span>
                        {rec.reasoning}
                      </p>

                      <div className="flex items-center justify-between text-xs text-text-muted dark:text-dark-text-muted">
                        <span>{rec.strategy}</span>
                        <span>
                          {rec.action === 'BUY'
                            ? isLong ? 'Hold for months+ — steady growth' : 'Target: +10-50% in days/weeks'
                            : 'Execute when market opens'}
                        </span>
                      </div>

                      {/* Mini chart */}
                      {rec.symbol && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-border dark:border-dark-border">
                          <MiniChart symbol={rec.symbol} />
                        </div>
                      )}

                      {/* Manual trade buttons */}
                      {rec.symbol && (
                        <div className="mt-3 flex gap-2">
                          {rec.action === 'BUY' && rec.quantity > 0 && (
                            <button
                              onClick={() => handleManualBuy(rec.symbol, rec.quantity)}
                              disabled={orderingSymbol === rec.symbol}
                              className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-profit/20 text-profit hover:bg-profit/30 border border-profit/30 transition-colors disabled:opacity-50"
                            >
                              {orderingSymbol === rec.symbol ? 'Placing...' : `Buy ${rec.quantity} shares`}
                            </button>
                          )}
                          {rec.action === 'SELL' && rec.quantity > 0 && (
                            <button
                              onClick={() => handleManualSell(rec.symbol, rec.quantity)}
                              disabled={orderingSymbol === rec.symbol}
                              className="flex-1 px-3 py-2 text-sm font-bold rounded-lg bg-loss/20 text-loss hover:bg-loss/30 border border-loss/30 transition-colors disabled:opacity-50"
                            >
                              {orderingSymbol === rec.symbol ? 'Placing...' : `Sell ${rec.quantity} shares`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current Positions — Sell Signals */}
          {positions.length > 0 && (
            <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Your Positions — Hold / Sell Signals</h2>
              <div className="flex flex-col gap-3">
                {positions.map((pos) => (
                  <div key={pos.symbol} className={`p-4 rounded-lg border ${
                    pos.signal === 'sell' ? 'border-loss/30 bg-loss-light/10 dark:bg-red-900/10' :
                    pos.signal === 'add' ? 'border-profit/30 bg-profit-light/10 dark:bg-green-900/10' :
                    'border-border dark:border-dark-border bg-surface-secondary dark:bg-dark-surface-tertiary'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-text-primary dark:text-dark-text-primary">{pos.symbol}</span>
                        <span className="text-xs text-text-muted dark:text-dark-text-muted">{pos.shares} shares</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded ${
                          pos.signal === 'sell' ? 'bg-loss/20 text-loss' :
                          pos.signal === 'add' ? 'bg-profit/20 text-profit' :
                          'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-muted dark:text-dark-text-muted'
                        }`}>
                          {pos.signal === 'sell' ? 'SELL SIGNAL' : pos.signal === 'add' ? 'ADD MORE' : 'HOLD'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-text-muted dark:text-dark-text-muted">Entry: ${pos.avgPrice.toFixed(2)}</span>
                      <span className="text-text-primary dark:text-dark-text-primary font-semibold">Now: ${pos.currentPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-text-secondary dark:text-dark-text-secondary">
                      {pos.signalReason}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleManualSell(pos.symbol, pos.shares)}
                        disabled={orderingSymbol === pos.symbol}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-loss/20 text-loss hover:bg-loss/30 border border-loss/30 transition-colors disabled:opacity-50"
                      >
                        {orderingSymbol === pos.symbol ? 'Selling...' : `Sell All (${pos.shares})`}
                      </button>
                      {pos.shares > 1 && (
                        <button
                          onClick={() => handleManualSell(pos.symbol, Math.ceil(pos.shares / 2))}
                          disabled={orderingSymbol === pos.symbol}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-warning/20 text-warning hover:bg-warning/30 border border-warning/30 transition-colors disabled:opacity-50"
                        >
                          Sell Half ({Math.ceil(pos.shares / 2)})
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar: News + Future Outlook */}
        <div className="flex flex-col gap-6">

          {/* Future Outlook */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Future Outlook</h2>
            {recommendations.length === 0 ? (
              <p className="text-sm text-text-muted dark:text-dark-text-muted">No outlook yet</p>
            ) : (
              <div className="flex flex-col gap-3">
                {[...recommendations].sort((a, b) => {
                  if (a.quantity > 0 && b.quantity === 0) return -1;
                  if (a.quantity === 0 && b.quantity > 0) return 1;
                  return b.confidence - a.confidence;
                }).map((rec) => {
                  return (
                    <button
                      key={`outlook-${rec._id}`}
                      onClick={() => setSelectedOutlook(rec)}
                      className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary hover:bg-surface-tertiary dark:hover:bg-dark-border transition-colors text-left w-full"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">{rec.symbol}</span>
                        <span className={`text-xs font-semibold ${rec.confidence >= 70 ? 'text-profit' : rec.confidence >= 40 ? 'text-warning' : 'text-loss'}`}>
                          {rec.confidence}%
                        </span>
                      </div>
                      <p className="text-xs text-text-muted dark:text-dark-text-muted mb-1">
                        {rec.reasoning.substring(0, 80)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={`text-xs ${star <= Math.ceil(rec.confidence / 20) ? 'text-warning' : 'text-dark-border'}`}>
                              ★
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-primary">View details →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Outlook Modal */}
          {selectedOutlook && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOutlook(null)} />
              <div className="relative w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl shadow-xl">
                <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border dark:border-dark-border bg-surface dark:bg-dark-surface-secondary rounded-t-xl">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-text-primary dark:text-dark-text-primary">{selectedOutlook.symbol}</span>
                      <Badge variant={selectedOutlook.action === 'BUY' ? 'buy' : selectedOutlook.action === 'SELL' ? 'sell' : 'pending'}>
                        {selectedOutlook.action}
                      </Badge>
                    </div>
                    {stockDetails[selectedOutlook.symbol] && (
                      <p className="text-xs text-text-muted dark:text-dark-text-muted mt-0.5">
                        {stockDetails[selectedOutlook.symbol].name}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSelectedOutlook(null)} className="text-text-muted dark:text-dark-text-muted hover:text-text-primary dark:hover:text-dark-text-primary">
                    ✕
                  </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary text-center">
                      <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Confidence</span>
                      <span className={`text-lg font-bold ${selectedOutlook.confidence >= 70 ? 'text-profit' : selectedOutlook.confidence >= 40 ? 'text-warning' : 'text-loss'}`}>
                        {selectedOutlook.confidence}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary text-center">
                      <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Shares</span>
                      <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                        {selectedOutlook.quantity > 0 ? selectedOutlook.quantity : 'Watch'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary text-center">
                      <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Price</span>
                      <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                        {prices[selectedOutlook.symbol] ? `$${prices[selectedOutlook.symbol].toFixed(2)}` : '...'}
                      </span>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div>
                    <span className="text-xs font-semibold text-text-muted dark:text-dark-text-muted uppercase">Strategy</span>
                    <p className="text-sm text-primary font-medium mt-1">{selectedOutlook.strategy}</p>
                  </div>

                  {/* Full Reasoning */}
                  <div>
                    <span className="text-xs font-semibold text-text-muted dark:text-dark-text-muted uppercase">Agent's Reasoning</span>
                    <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1 leading-relaxed">
                      {selectedOutlook.reasoning}
                    </p>
                  </div>

                  {/* Company Info */}
                  {stockDetails[selectedOutlook.symbol] && (
                    <div>
                      <span className="text-xs font-semibold text-text-muted dark:text-dark-text-muted uppercase">Company Info</span>
                      <div className="mt-1 space-y-1">
                        <p className="text-sm font-medium text-text-primary dark:text-dark-text-primary">
                          {stockDetails[selectedOutlook.symbol].name}
                        </p>
                        {stockDetails[selectedOutlook.symbol].sector && (
                          <p className="text-xs text-text-muted dark:text-dark-text-muted">
                            Sector: {stockDetails[selectedOutlook.symbol].sector}
                          </p>
                        )}
                        {stockDetails[selectedOutlook.symbol].marketCap > 0 && (
                          <p className="text-xs text-text-muted dark:text-dark-text-muted">
                            Market Cap: ${(stockDetails[selectedOutlook.symbol].marketCap / 1000000000).toFixed(1)}B
                          </p>
                        )}
                        {stockDetails[selectedOutlook.symbol].description && (
                          <p className="text-xs text-text-secondary dark:text-dark-text-secondary mt-2 leading-relaxed">
                            {stockDetails[selectedOutlook.symbol].description}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-text-muted dark:text-dark-text-muted">
                    Analyzed: {new Date(selectedOutlook.cycleTimestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* News Feed */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Related News</h2>
            {news.length === 0 ? (
              <p className="text-sm text-text-muted dark:text-dark-text-muted">No news available</p>
            ) : (
              <div className="flex flex-col gap-3">
                {news.map((item, index) => (
                  <div key={index} className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                    {item.symbol && (
                      <span className="text-[10px] font-bold text-primary uppercase">{item.symbol}</span>
                    )}
                    <p className="text-xs text-text-secondary dark:text-dark-text-secondary mt-1">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted">{item.source}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Status */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Agent Status</h2>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted dark:text-dark-text-muted">Recommendations</span>
                <span className="font-bold text-text-primary dark:text-dark-text-primary">{recommendations.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted dark:text-dark-text-muted">Open Positions</span>
                <span className="font-bold text-text-primary dark:text-dark-text-primary">{positions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted dark:text-dark-text-muted">Short-Term Picks</span>
                <span className="font-bold text-warning">{shortCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted dark:text-dark-text-muted">Long-Term Picks</span>
                <span className="font-bold text-profit">{longCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted dark:text-dark-text-muted">Market</span>
                <span className="font-bold text-loss">Closed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Strategy;
