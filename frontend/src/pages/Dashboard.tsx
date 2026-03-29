import React, { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { createChart, type IChartApi, ColorType, LineSeries } from 'lightweight-charts';

import { KillSwitch } from '../components/dashboard';
import { LoadingSpinner } from '../components/common';
import {
  fetchPortfolioSummary,
  fetchRecentTrades,
  fetchPositions,
  fetchPredictions,
  authFetch,
} from '../services/api';
import { useThemeContext } from '../context/ThemeContext';
import { formatCurrency, formatPnl, formatPnlPercent } from '../utils/formatters';

import type { TradeData, PredictionData } from '../services/api';

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
  conid: number;
}

interface PortfolioData {
  totalValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  availableCash: number;
  openPositions: number;
}

interface PositionWithPnl {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
}

interface EquityPoint {
  time: string;
  value: number;
}

interface TradeMarker {
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('broker-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function Dashboard(): ReactElement {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [positions, setPositions] = useState<PositionWithPnl[]>([]);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [totalPredictedProfit, setTotalPredictedProfit] = useState(0);
  const [trades, setTrades] = useState<TradeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ibkrDown, setIbkrDown] = useState(false);
  const [winRate, setWinRate] = useState<{ wins: number; losses: number; winRate: number; totalPnl: number; streak: number; streakType: string } | null>(null);
  const { isDark } = useThemeContext();

  // Portfolio chart
  const portfolioChartRef = useRef<HTMLDivElement>(null);
  const portfolioChartInstance = useRef<IChartApi | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const stockChartRef = useRef<HTMLDivElement>(null);
  const stockChartInstance = useRef<IChartApi | null>(null);

  // Check IBKR status
  useEffect(() => {
    async function checkStatus(): Promise<void> {
      try {
        const response = await authFetch('/status');
        const result = await response.json();
        setIbkrDown(!result.data?.ibkr);
      } catch {
        setIbkrDown(true);
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load all data
  const loadData = useCallback(async (): Promise<void> => {
    try {
      const [summary, pos, recentTrades] = await Promise.all([
        fetchPortfolioSummary().catch(() => null) as Promise<Record<string, number> | null>,
        fetchPositions().catch(() => []) as Promise<IbkrPosition[]>,
        fetchRecentTrades(50).catch(() => []),
      ]);

      if (summary) {
        setPortfolio({
          totalValue: summary.netLiquidation ?? 0,
          todayPnl: (summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0),
          todayPnlPercent: summary.netLiquidation > 0
            ? (((summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0)) / summary.netLiquidation) * 100
            : 0,
          availableCash: summary.totalCashValue ?? 0,
          openPositions: Array.isArray(pos) ? pos.length : 0,
        });
      }

      if (Array.isArray(pos)) {
        const mapped: PositionWithPnl[] = pos.map((p) => ({
          symbol: p.ticker,
          shares: p.position,
          avgPrice: p.avgPrice,
          currentPrice: p.mktPrice,
          pnl: p.unrealizedPnl,
          pnlPercent: p.avgPrice > 0 ? ((p.mktPrice - p.avgPrice) / p.avgPrice) * 100 : 0,
          value: p.position * p.mktPrice,
        }));
        setPositions(mapped);
        if (mapped.length > 0 && !selectedStock) {
          setSelectedStock(mapped[0].symbol);
        }
      }

      setTrades(recentTrades);
    } catch { /* skip */ }
    finally { setIsLoading(false); }

    // Background: predictions + stats
    try {
      const [predResult, statsResult] = await Promise.all([
        fetchPredictions().catch(() => ({ data: [], totalPredictedProfit: 0 })),
        authFetch('/engine/stats').then((r) => r.json()).catch(() => ({ data: null })),
      ]);
      setPredictions(predResult.data);
      setTotalPredictedProfit(predResult.totalPredictedProfit);
      if (statsResult.data) {
        setWinRate({
          wins: statsResult.data.wins,
          losses: statsResult.data.losses,
          winRate: statsResult.data.winRate,
          totalPnl: statsResult.data.totalRealizedPnl,
          streak: statsResult.data.streakCurrent,
          streakType: statsResult.data.streakType,
        });
      }
    } catch { /* skip */ }
  }, [selectedStock]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Portfolio equity chart (lightweight-charts)
  useEffect(() => {
    if (!portfolioChartRef.current || !portfolio) return;

    if (portfolioChartInstance.current) {
      portfolioChartInstance.current.remove();
      portfolioChartInstance.current = null;
    }

    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const chart = createChart(portfolioChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: bgColor }, textColor: isDark ? '#64748b' : '#94a3b8', fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: isDark ? '#1e293b' : '#f1f5f9', style: 3 } },
      width: portfolioChartRef.current.clientWidth,
      height: 300,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
    });
    portfolioChartInstance.current = chart;

    // Build equity points from trade history
    const sortedTrades = [...trades].sort((a, b) =>
      new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
    );

    const equityPoints: Array<{ time: string; value: number }> = [];
    let runningValue = portfolio.totalValue;

    if (sortedTrades.length > 0) {
      for (const trade of sortedTrades) {
        const date = new Date(trade.executedAt).toISOString().split('T')[0];
        const pnl = trade.profitLoss ?? 0;
        runningValue += pnl;
        equityPoints.push({ time: date, value: runningValue });
      }
    }

    // Always add current value
    const today = new Date().toISOString().split('T')[0];
    if (equityPoints.length === 0 || equityPoints[equityPoints.length - 1].time !== today) {
      equityPoints.push({ time: today, value: portfolio.totalValue });
    }

    // Deduplicate by date (keep last per day)
    const byDate = new Map<string, number>();
    for (const p of equityPoints) {
      byDate.set(p.time, p.value);
    }
    const uniquePoints = Array.from(byDate.entries())
      .map(([time, value]) => ({ time, value }))
      .sort((a, b) => a.time.localeCompare(b.time));

    if (uniquePoints.length > 0) {
      const isPositive = uniquePoints[uniquePoints.length - 1].value >= uniquePoints[0].value;
      const series = chart.addSeries(LineSeries, {
        color: isPositive ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(uniquePoints as never[]);

      // Add buy/sell markers from trades
      const markers: TradeMarker[] = sortedTrades
        .filter((t) => t.price > 0)
        .map((t) => ({
          time: new Date(t.executedAt).toISOString().split('T')[0],
          position: t.action === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
          color: t.action === 'BUY' ? '#22c55e' : '#ef4444',
          shape: t.action === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
          text: `${t.action} ${t.symbol}`,
        }));

      chart.timeScale().fitContent();
    }

    const handleResize = (): void => {
      if (portfolioChartRef.current && portfolioChartInstance.current) {
        portfolioChartInstance.current.applyOptions({ width: portfolioChartRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (portfolioChartInstance.current) {
        portfolioChartInstance.current.remove();
        portfolioChartInstance.current = null;
      }
    };
  }, [portfolio, trades, isDark]);

  // Selected stock chart
  useEffect(() => {
    if (!stockChartRef.current || !selectedStock) return;

    if (stockChartInstance.current) {
      stockChartInstance.current.remove();
      stockChartInstance.current = null;
    }

    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const chart = createChart(stockChartRef.current, {
      layout: { background: { type: ColorType.Solid, color: bgColor }, textColor: isDark ? '#64748b' : '#94a3b8', fontSize: 11 },
      grid: { vertLines: { visible: false }, horzLines: { color: isDark ? '#1e293b' : '#f1f5f9', style: 3 } },
      width: stockChartRef.current.clientWidth,
      height: 250,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 0 },
    });
    stockChartInstance.current = chart;

    fetch(`http://localhost:4000/api/market/${selectedStock}/candles?days=30`, { headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((result) => {
        if (!result.data || result.data.length === 0) return;

        const points = result.data.map((bar: { time: string; close: number }) => ({
          time: bar.time,
          value: bar.close,
        }));

        const firstVal = points[0].value;
        const lastVal = points[points.length - 1].value;
        const isPositive = lastVal >= firstVal;

        const series = chart.addSeries(LineSeries, {
          color: isPositive ? '#22c55e' : '#ef4444',
          lineWidth: 2,
          priceLineVisible: true,
        });
        series.setData(points as never[]);

        // Add entry price line for this position
        const position = positions.find((p) => p.symbol === selectedStock);
        if (position) {
          series.createPriceLine({
            price: position.avgPrice,
            color: '#3b82f6',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `Entry $${position.avgPrice.toFixed(4)}`,
          });
        }

        // Add buy/sell markers for this stock
        const stockTrades = trades.filter((t) => t.symbol === selectedStock);
        const markers: TradeMarker[] = stockTrades.map((t) => ({
          time: new Date(t.executedAt).toISOString().split('T')[0],
          position: t.action === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
          color: t.action === 'BUY' ? '#22c55e' : '#ef4444',
          shape: t.action === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
          text: `${t.action} ${t.quantity}`,
        }));

        chart.timeScale().fitContent();
      })
      .catch(() => { /* skip */ });

    const handleResize = (): void => {
      if (stockChartRef.current && stockChartInstance.current) {
        stockChartInstance.current.applyOptions({ width: stockChartRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (stockChartInstance.current) {
        stockChartInstance.current.remove();
        stockChartInstance.current = null;
      }
    };
  }, [selectedStock, positions, trades, isDark]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Connecting to backend..." />;
  }

  const totalCurrentValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalEntryValue = positions.reduce((sum, p) => sum + (p.avgPrice * p.shares), 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const totalPnlPercent = totalEntryValue > 0 ? (totalPnl / totalEntryValue) * 100 : 0;
  const isOverallPositive = totalPnl >= 0;

  // Pie chart data
  const pieData = positions.map((p) => ({
    name: p.symbol,
    value: Math.abs(p.value),
    pnlPercent: p.pnlPercent,
  }));

  if (portfolio && portfolio.availableCash > 0.01) {
    pieData.push({ name: 'Cash', value: portfolio.availableCash, pnlPercent: 0 });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Connection status */}
      {ibkrDown && (
        <div className="px-3 py-2 bg-loss-light dark:bg-red-900/20 border border-loss/30 rounded-lg flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-loss animate-pulse" />
          <span className="text-xs font-medium text-red-800 dark:text-red-200">
            IBKR Gateway disconnected — log in at https://localhost:5000
          </span>
        </div>
      )}

      {/* Hero P&L Banner */}
      <div className={`rounded-xl p-6 border-2 ${isOverallPositive ? 'bg-profit/5 border-profit/30' : totalPnl === 0 ? 'bg-surface dark:bg-dark-surface-secondary border-border dark:border-dark-border' : 'bg-loss/5 border-loss/30'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Left: Overall status */}
          <div className="text-center md:text-left">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">Your Status</span>
            <div className={`text-4xl font-black mt-1 ${isOverallPositive ? 'text-profit' : totalPnl === 0 ? 'text-text-primary dark:text-dark-text-primary' : 'text-loss'}`}>
              {isOverallPositive ? 'IN PROFIT' : totalPnl === 0 ? 'NO POSITIONS' : 'IN LOSS'}
            </div>
            <div className={`text-2xl font-bold mt-1 ${isOverallPositive ? 'text-profit' : 'text-loss'}`}>
              {totalPnl !== 0 && <>{totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)} ({totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%)</>}
            </div>
          </div>

          {/* Center: Money breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Total Portfolio</span>
              <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{formatCurrency(portfolio?.totalValue ?? 0)}</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Free Cash</span>
              <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{formatCurrency(portfolio?.availableCash ?? 0)}</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Invested</span>
              <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{formatCurrency(totalEntryValue)}</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Current Value</span>
              <span className={`text-lg font-bold ${isOverallPositive ? 'text-profit' : 'text-loss'}`}>{formatCurrency(totalCurrentValue)}</span>
            </div>
          </div>

          {/* Right: Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Today P&L</span>
              <span className={`text-lg font-bold ${(portfolio?.todayPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatPnl(portfolio?.todayPnl ?? 0)}
              </span>
              <span className={`text-xs block ${(portfolio?.todayPnl ?? 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatPnlPercent(portfolio?.todayPnlPercent ?? 0)}
              </span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">EOD Predict</span>
              <span className={`text-lg font-bold ${totalPredictedProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
                {totalPredictedProfit >= 0 ? '+' : ''}${totalPredictedProfit.toFixed(2)}
              </span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Win Rate</span>
              <span className={`text-lg font-bold ${(winRate?.winRate ?? 0) >= 50 ? 'text-profit' : winRate ? 'text-loss' : 'text-text-primary dark:text-dark-text-primary'}`}>
                {winRate ? `${winRate.winRate.toFixed(0)}%` : '—'}
              </span>
              <span className="text-xs text-text-muted dark:text-dark-text-muted block">
                {winRate ? `${winRate.wins}W / ${winRate.losses}L` : ''}
              </span>
            </div>
            <div className="text-center p-3 rounded-lg bg-surface/50 dark:bg-dark-surface/50">
              <span className="text-[10px] font-semibold uppercase text-text-muted dark:text-dark-text-muted block">Positions</span>
              <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{positions.length}</span>
              {winRate && winRate.streak > 0 && (
                <span className={`text-xs block ${winRate.streakType === 'win' ? 'text-profit' : 'text-loss'}`}>
                  {winRate.streak} {winRate.streakType} streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kill switch */}
      <KillSwitch />

      {/* Main charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Portfolio equity chart — large */}
        <div className="lg:col-span-2 bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">Portfolio Value</h2>
            <div className="flex items-center gap-3 text-xs text-text-muted dark:text-dark-text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-profit inline-block" /> Buy</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-loss inline-block" /> Sell</span>
            </div>
          </div>
          <div ref={portfolioChartRef} className="w-full" style={{ minHeight: 300 }} />
        </div>

        {/* Pie chart + allocation */}
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted mb-3">Allocation</h2>
          {pieData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Value']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {pieData.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <button
                        onClick={() => item.name !== 'Cash' && setSelectedStock(item.name)}
                        className={`font-medium ${item.name !== 'Cash' ? 'hover:text-primary cursor-pointer' : ''} text-text-primary dark:text-dark-text-primary`}
                      >
                        {item.name}
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted dark:text-dark-text-muted">${item.value.toFixed(2)}</span>
                      {item.name !== 'Cash' && (
                        <span className={`font-medium ${item.pnlPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {item.pnlPercent >= 0 ? '+' : ''}{item.pnlPercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-text-muted dark:text-dark-text-muted">
              No positions yet
            </div>
          )}
        </div>
      </div>

      {/* Stock chart + positions table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Selected stock chart */}
        <div className="lg:col-span-2 bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">
              {selectedStock ?? 'Select a stock'}
            </h2>
            {positions.length > 0 && (
              <div className="flex gap-1">
                {positions.map((p) => (
                  <button
                    key={p.symbol}
                    onClick={() => setSelectedStock(p.symbol)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                      selectedStock === p.symbol
                        ? 'bg-primary text-white'
                        : 'text-text-muted dark:text-dark-text-muted hover:bg-surface-tertiary dark:hover:bg-dark-surface-tertiary'
                    }`}
                  >
                    {p.symbol}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedStock ? (
            <div ref={stockChartRef} className="w-full" style={{ minHeight: 250 }} />
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-text-muted dark:text-dark-text-muted">
              Click a stock in the allocation chart to view
            </div>
          )}
        </div>

        {/* Positions detail table */}
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted mb-3">My Positions</h2>
          {positions.length > 0 ? (
            <div className="flex flex-col gap-3">
              {positions.map((p) => (
                <button
                  key={p.symbol}
                  onClick={() => setSelectedStock(p.symbol)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selectedStock === p.symbol
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border dark:border-dark-border hover:bg-surface-secondary dark:hover:bg-dark-surface-tertiary'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-text-primary dark:text-dark-text-primary">{p.symbol}</span>
                    <span className={`text-sm font-bold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-text-muted dark:text-dark-text-muted">
                    <span>{p.shares} shares @ ${p.avgPrice.toFixed(4)}</span>
                    <span className={`font-medium ${p.pnlPercent >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-text-muted dark:text-dark-text-muted">Now: ${p.currentPrice.toFixed(4)}</span>
                    <span className="text-text-primary dark:text-dark-text-primary font-medium">${p.value.toFixed(2)}</span>
                  </div>
                </button>
              ))}
              <div className="pt-3 mt-1 border-t border-border dark:border-dark-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted dark:text-dark-text-muted">Invested</span>
                  <span className="font-medium text-text-primary dark:text-dark-text-primary">${totalEntryValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted dark:text-dark-text-muted">Current Value</span>
                  <span className="font-medium text-text-primary dark:text-dark-text-primary">${totalCurrentValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50 dark:border-dark-border/50">
                  <span className="font-bold text-text-primary dark:text-dark-text-primary">Profit / Loss</span>
                  <span className={`font-bold text-lg ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} ({totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-sm text-text-muted dark:text-dark-text-muted">
              No positions yet — agent will buy on next cycle
            </div>
          )}
        </div>
      </div>

      {/* Recent trades with buy/sell markers */}
      {trades.length > 0 && (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted mb-3">Recent Trades</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-text-muted dark:text-dark-text-muted border-b border-border dark:border-dark-border">
                  <th className="text-left py-2 pr-2">Time</th>
                  <th className="text-left py-2 px-2">Action</th>
                  <th className="text-left py-2 px-2">Stock</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Price</th>
                  <th className="text-left py-2 px-2">Strategy</th>
                  <th className="text-right py-2 pl-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 15).map((t) => (
                  <tr key={t._id} className="border-b border-border/20 dark:border-dark-border/20">
                    <td className="py-2 pr-2 text-xs text-text-muted dark:text-dark-text-muted">
                      {new Date(t.executedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        t.action === 'BUY' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                      }`}>
                        {t.action}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-medium text-text-primary dark:text-dark-text-primary">{t.symbol}</td>
                    <td className="text-right py-2 px-2 text-text-primary dark:text-dark-text-primary">{t.quantity}</td>
                    <td className="text-right py-2 px-2 text-text-muted dark:text-dark-text-muted">
                      {t.price > 0 ? `$${t.price.toFixed(4)}` : '—'}
                    </td>
                    <td className="py-2 px-2 text-xs text-text-muted dark:text-dark-text-muted truncate max-w-[120px]">{t.strategy}</td>
                    <td className="text-right py-2 pl-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        t.status === 'filled' ? 'bg-profit/20 text-profit' :
                        t.status === 'failed' ? 'bg-loss/20 text-loss' :
                        'bg-warning/20 text-warning'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
