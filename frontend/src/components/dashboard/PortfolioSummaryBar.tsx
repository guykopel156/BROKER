import React, { type ReactElement } from 'react';

import { formatCurrency, formatPnl, formatPnlPercent } from '../../utils/formatters';

import type { PortfolioSummary } from '../../types';

interface PortfolioSummaryBarProps {
  data: PortfolioSummary;
}

interface SummaryCardProps {
  label: string;
  value: string;
  subValue?: string;
  isPositive?: boolean;
  hasColor?: boolean;
}

function SummaryCard({ label, value, subValue, isPositive, hasColor = false }: SummaryCardProps): ReactElement {
  const valueColor = hasColor
    ? isPositive
      ? 'text-profit'
      : 'text-loss'
    : 'text-text-primary dark:text-dark-text-primary';

  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">
        {label}
      </span>
      <span className={`text-xl font-bold ${valueColor}`}>
        {value}
      </span>
      {subValue && (
        <span className={`text-xs font-medium ${valueColor}`}>
          {subValue}
        </span>
      )}
    </div>
  );
}

function PortfolioSummaryBar({ data }: PortfolioSummaryBarProps): ReactElement {
  const isTodayPositive = data.todayPnl >= 0;
  const isTotalPositive = data.totalPnl >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <SummaryCard
        label="Total Portfolio Value"
        value={formatCurrency(data.totalValue)}
      />
      <SummaryCard
        label="Today's P&L"
        value={formatPnl(data.todayPnl)}
        subValue={formatPnlPercent(data.todayPnlPercent)}
        isPositive={isTodayPositive}
        hasColor
      />
      <SummaryCard
        label="Total P&L"
        value={formatPnl(data.totalPnl)}
        subValue={formatPnlPercent(data.totalPnlPercent)}
        isPositive={isTotalPositive}
        hasColor
      />
      <SummaryCard
        label="Open Positions"
        value={String(data.openPositions)}
      />
      <SummaryCard
        label="Available Cash"
        value={formatCurrency(data.availableCash)}
      />
    </div>
  );
}

export default PortfolioSummaryBar;
