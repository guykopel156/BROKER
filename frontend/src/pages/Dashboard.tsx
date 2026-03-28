import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import {
  PortfolioSummaryBar,
  KillSwitch,
  RecentTrades,
  EquityCurve,
  EngineHealth,
  Watchlist,
  Recommendations,
} from '../components/dashboard';
import { LoadingSpinner } from '../components/common';
import {
  fetchPortfolioSummary,
  fetchRecentTrades,
  fetchPositions,
} from '../services/api';

import type { PortfolioSummary, Trade, EquityPoint, EngineHealthData, WatchlistItem } from '../types';
import type { TradeData } from '../services/api';

const EMPTY_PORTFOLIO: PortfolioSummary = {
  totalValue: 0,
  todayPnl: 0,
  todayPnlPercent: 0,
  totalPnl: 0,
  totalPnlPercent: 0,
  openPositions: 0,
  availableCash: 0,
};

function mapTradeData(t: TradeData): Trade {
  return {
    id: t._id,
    symbol: t.symbol,
    action: t.action,
    quantity: t.quantity,
    price: t.price,
    totalValue: t.totalValue,
    reasoning: t.reasoning,
    status: t.status,
    strategy: t.strategy,
    exchange: t.exchange,
    timestamp: new Date(t.executedAt).toLocaleString(),
    profitLoss: t.profitLoss,
    outcomeLabel: t.outcomeLabel ?? t.status,
  };
}

function Dashboard(): ReactElement {
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(EMPTY_PORTFOLIO);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equityData] = useState<EquityPoint[]>([]);
  const [engineHealth] = useState<EngineHealthData>({
    apiLatencyMs: 0,
    processingLoadPercent: 0,
    memoryContextTokens: 0,
    exchange: 'N/A',
  });
  const [watchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const loadLiveData = useCallback(async (): Promise<void> => {
    try {
      const summary = await fetchPortfolioSummary() as Record<string, number>;
      const positions = await fetchPositions() as Array<Record<string, unknown>>;

      setPortfolio({
        totalValue: summary.netLiquidation ?? 0,
        todayPnl: (summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0),
        todayPnlPercent: summary.netLiquidation > 0
          ? (((summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0)) / summary.netLiquidation) * 100
          : 0,
        totalPnl: (summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0),
        totalPnlPercent: 0,
        openPositions: Array.isArray(positions) ? positions.length : 0,
        availableCash: summary.totalCashValue ?? 0,
      });
      setIsLive(true);
    } catch {
      // Backend unreachable
    }

    try {
      const recentTrades = await fetchRecentTrades(10);
      setTrades(recentTrades.map(mapTradeData));
    } catch {
      // No trades yet
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, [loadLiveData]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Connecting to backend..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      {isLive && (
        <div className="px-3 py-1.5 bg-profit-light dark:bg-green-900/30 border border-profit/30 rounded-lg text-xs font-medium text-green-800 dark:text-green-200 text-center">
          Live data from IBKR
        </div>
      )}
      {!isLive && (
        <div className="px-3 py-1.5 bg-warning-light dark:bg-yellow-900/30 border border-warning/30 rounded-lg text-xs font-medium text-yellow-800 dark:text-yellow-200 text-center">
          Backend unreachable — start the backend and IBKR Gateway
        </div>
      )}

      <PortfolioSummaryBar data={portfolio} />

      <KillSwitch />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Recommendations />
          <RecentTrades trades={trades} />
        </div>

        <div className="flex flex-col gap-4">
          <EquityCurve data={equityData} />
          <EngineHealth data={engineHealth} />
          <Watchlist items={watchlist} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
