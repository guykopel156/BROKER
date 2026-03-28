import React, { type ReactElement } from 'react';

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

function Dashboard(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <PortfolioSummaryBar data={MOCK_PORTFOLIO_SUMMARY} />

      <KillSwitch />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Recent Trades */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <RecentTrades trades={MOCK_RECENT_TRADES} />
          <AlertHistory alerts={MOCK_ALERTS} />
        </div>

        {/* Right column — Widgets */}
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
