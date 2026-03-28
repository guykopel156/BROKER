import React, { type ReactElement } from 'react';

import { formatCurrency, formatPnl, formatPnlPercent } from '../../utils/formatters';

import type { ClosedPosition } from '../../mocks/positionsData';

interface ClosedPositionsTableProps {
  positions: ClosedPosition[];
}

function ClosedPositionsTable({ positions }: ClosedPositionsTableProps): ReactElement {
  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border dark:border-dark-border">
        <h2 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
          Closed Positions ({positions.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border dark:border-dark-border">
              <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-dark-text-muted">Symbol</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden sm:table-cell">Entry</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden sm:table-cell">Exit</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted">P&L ($)</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden sm:table-cell">P&L (%)</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden md:table-cell">Duration</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden lg:table-cell">Closed</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted dark:text-dark-text-muted">
                  No closed positions
                </td>
              </tr>
            ) : (
              positions.map((pos, index) => {
                const isPositive = pos.realizedPnl >= 0;
                return (
                  <tr
                    key={`${pos.symbol}-${index}`}
                    className="border-b border-border dark:border-dark-border last:border-b-0 hover:bg-surface-secondary dark:hover:bg-dark-surface-tertiary transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-text-primary dark:text-dark-text-primary">{pos.symbol}</span>
                      <span className="text-xs text-text-muted dark:text-dark-text-muted ml-2">{pos.shares} shares</span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary dark:text-dark-text-secondary hidden sm:table-cell">
                      {formatCurrency(pos.entryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary dark:text-dark-text-secondary hidden sm:table-cell">
                      {formatCurrency(pos.exitPrice)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                      {formatPnl(pos.realizedPnl)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold hidden sm:table-cell ${isPositive ? 'text-profit' : 'text-loss'}`}>
                      {formatPnlPercent(pos.realizedPnlPercent)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted dark:text-dark-text-muted hidden md:table-cell">
                      {pos.holdDuration}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted dark:text-dark-text-muted hidden lg:table-cell">
                      {pos.closedAt}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ClosedPositionsTable;
