import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import {
  PortfolioSummaryBar,
  KillSwitch,
  RecentTrades,
  EquityCurve,
  EngineHealth,
  Watchlist,
  AlertHistory,
} from '../components/dashboard';
import {
  MOCK_PORTFOLIO_SUMMARY,
  MOCK_RECENT_TRADES,
  MOCK_EQUITY_CURVE,
  MOCK_ENGINE_HEALTH,
  MOCK_WATCHLIST,
} from '../mocks/dashboardData';
import { MOCK_ALERTS } from '../mocks/alertsData';
import { fetchPortfolioSummary, fetchAuditLogs } from '../services/api';

import type { PortfolioSummary } from '../types';
import type { AlertItem } from '../mocks/alertsData';

function Dashboard(): ReactElement {
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(MOCK_PORTFOLIO_SUMMARY);
  const [alerts, setAlerts] = useState<AlertItem[]>(MOCK_ALERTS);
  const [isLive, setIsLive] = useState(false);

  const loadLiveData = useCallback(async (): Promise<void> => {
    try {
      const summary = await fetchPortfolioSummary() as Record<string, number>;
      setPortfolio({
        totalValue: summary.netLiquidation ?? 0,
        todayPnl: (summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0),
        todayPnlPercent: summary.netLiquidation > 0
          ? (((summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0)) / summary.netLiquidation) * 100
          : 0,
        totalPnl: (summary.unrealizedPnl ?? 0) + (summary.realizedPnl ?? 0),
        totalPnlPercent: 0,
        openPositions: 0,
        availableCash: summary.totalCashValue ?? 0,
      });
      setIsLive(true);

      const logs = await fetchAuditLogs(20);
      const mappedAlerts: AlertItem[] = logs.map((log) => ({
        id: log._id,
        type: log.action.includes('TRADE') ? 'trade'
          : log.action.includes('LOSS') ? 'loss-limit'
          : log.action.includes('ENGINE') ? 'engine-paused'
          : 'error',
        message: log.details,
        timestamp: new Date(log.createdAt).toLocaleString(),
      }));
      if (mappedAlerts.length > 0) {
        setAlerts(mappedAlerts);
      }
    } catch {
      // Keep mock data on failure
    }
  }, []);

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, [loadLiveData]);

  return (
    <div className="flex flex-col gap-6">
      {isLive && (
        <div className="px-3 py-1.5 bg-profit-light dark:bg-green-900/30 border border-profit/30 rounded-lg text-xs font-medium text-green-800 dark:text-green-200 text-center">
          Live data from IBKR
        </div>
      )}

      <PortfolioSummaryBar data={portfolio} />

      <KillSwitch />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <RecentTrades trades={MOCK_RECENT_TRADES} />
          <AlertHistory alerts={alerts} />
        </div>

        <div className="flex flex-col gap-4">
          <EquityCurve data={MOCK_EQUITY_CURVE} />
          <EngineHealth data={MOCK_ENGINE_HEALTH} />
          <Watchlist items={MOCK_WATCHLIST} />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
