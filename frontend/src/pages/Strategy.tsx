import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Badge, LoadingSpinner } from '../components/common';
import MiniChart from '../components/dashboard/MiniChart';
import { fetchPositions, fetchRecommendations } from '../services/api';

import type { RecommendationData } from '../services/api';

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
  const [isLoading, setIsLoading] = useState(true);
  const [shortCount, setShortCount] = useState(0);
  const [longCount, setLongCount] = useState(0);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      // Recommendations
      const recs = await fetchRecommendations();
      setRecommendations(recs);

      const shorts = recs.filter((r) => r.holdType === 'short' || !r.strategy?.toLowerCase().startsWith('long')).length;
      const longs = recs.filter((r) => r.holdType === 'long' || r.strategy?.toLowerCase().startsWith('long')).length;
      setShortCount(shorts);
      setLongCount(longs);

      // Positions
      try {
        const pos = await fetchPositions() as IbkrPosition[];
        if (Array.isArray(pos)) {
          const mapped: PositionWithSignal[] = pos.map((p) => {
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

            // Check if any recommendation says to sell this stock
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
      } catch { /* not connected */ }

      // News
      try {
        const symbols = recs.map((r) => r.symbol).filter(Boolean);
        if (symbols.length > 0) {
          const response = await fetch(`http://localhost:4000/api/market/${symbols[0]}/details`);
          const result = await response.json();
          if (result.data) {
            // Fetch news for first 3 symbols
            const allNews: StockNews[] = [];
            for (const sym of symbols.slice(0, 3)) {
              try {
                const newsResponse = await fetch(`http://localhost:4000/api/market/${sym}/details`);
                const newsResult = await newsResponse.json();
                if (newsResult.data?.description) {
                  allNews.push({
                    title: `${newsResult.data.name} — ${newsResult.data.description.substring(0, 150)}`,
                    source: newsResult.data.exchange,
                    publishedAt: new Date().toLocaleString(),
                    symbol: sym,
                  });
                }
              } catch { /* skip */ }
            }
            setNews(allNews);
          }
        }
      } catch { /* skip */ }
    } catch { /* no data */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (isLoading) return <LoadingSpinner size="lg" message="Loading strategy..." />;

  const totalRecs = shortCount + longCount;
  const shortPercent = totalRecs > 0 ? (shortCount / totalRecs) * 100 : 50;
  const longPercent = totalRecs > 0 ? (longCount / totalRecs) * 100 : 50;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Strategy & Outlook</h1>

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
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-warning" />
            <span className="text-text-secondary dark:text-dark-text-secondary">Short-Term: {shortCount} ({shortPercent.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-profit" />
            <span className="text-text-secondary dark:text-dark-text-secondary">Long-Term: {longCount} ({longPercent.toFixed(0)}%)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recommendations + Positions */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Next Moves */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text-muted dark:text-dark-text-muted uppercase tracking-wider mb-4">Next Moves — What to Buy & When</h2>
            {recommendations.length === 0 ? (
              <p className="text-sm text-text-muted dark:text-dark-text-muted">Waiting for next analysis cycle...</p>
            ) : (
              <div className="flex flex-col gap-4">
                {recommendations.map((rec) => {
                  const isLong = rec.holdType === 'long' || rec.strategy?.toLowerCase().startsWith('long');
                  return (
                    <div key={rec._id} className="p-4 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.action === 'BUY' ? 'buy' : rec.action === 'SELL' ? 'sell' : 'pending'}>
                            {rec.action}
                          </Badge>
                          <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{rec.symbol}</span>
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
                {recommendations.map((rec) => {
                  const isLong = rec.holdType === 'long' || rec.strategy?.toLowerCase().startsWith('long');
                  return (
                    <div key={`outlook-${rec._id}`} className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">{rec.symbol}</span>
                        <span className={`text-xs font-semibold ${rec.confidence >= 70 ? 'text-profit' : rec.confidence >= 40 ? 'text-warning' : 'text-loss'}`}>
                          {rec.confidence}% confidence
                        </span>
                      </div>
                      <p className="text-xs text-text-muted dark:text-dark-text-muted mb-1">
                        {isLong
                          ? `Long-term growth expected. Hold for months. ${rec.strategy}`
                          : `Short-term play. Target: +10-50% in days. Exit on momentum loss.`}
                      </p>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={`text-xs ${star <= Math.ceil(rec.confidence / 20) ? 'text-warning' : 'text-dark-border'}`}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
