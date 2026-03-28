import React, { type ReactElement } from 'react';

import { formatCurrency, formatPnl } from '../../utils/formatters';

import type { Position } from '../../types';
import type { ClosedPosition } from '../../mocks/positionsData';

interface PositionsSummaryProps {
  openPositions: Position[];
  closedPositions: ClosedPosition[];
}

function PositionsSummary({ openPositions, closedPositions }: PositionsSummaryProps): ReactElement {
  const totalUnrealized = openPositions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalRealized = closedPositions.reduce((sum, p) => sum + p.realizedPnl, 0);
  const totalMarketValue = openPositions.reduce((sum, p) => sum + p.currentPrice * p.shares, 0);
  const winCount = closedPositions.filter((p) => p.realizedPnl > 0).length;
  const winRate = closedPositions.length > 0 ? (winCount / closedPositions.length) * 100 : 0;

  const cards = [
    { label: 'Open Positions', value: String(openPositions.length), hasColor: false },
    { label: 'Market Value', value: formatCurrency(totalMarketValue), hasColor: false },
    { label: 'Unrealized P&L', value: formatPnl(totalUnrealized), hasColor: true, isPositive: totalUnrealized >= 0 },
    { label: 'Realized P&L', value: formatPnl(totalRealized), hasColor: true, isPositive: totalRealized >= 0 },
    { label: 'Win Rate', value: `${winRate.toFixed(0)}%`, hasColor: true, isPositive: winRate >= 50 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted">
            {card.label}
          </span>
          <div className={`text-xl font-bold mt-1 ${
            card.hasColor
              ? card.isPositive ? 'text-profit' : 'text-loss'
              : 'text-text-primary dark:text-dark-text-primary'
          }`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PositionsSummary;
