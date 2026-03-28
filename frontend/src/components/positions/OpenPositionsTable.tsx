import React, { type ReactElement } from 'react';

import { formatCurrency, formatPnl, formatPnlPercent } from '../../utils/formatters';

import type { Position } from '../../types';

interface OpenPositionsTableProps {
  positions: Position[];
}

function OpenPositionsTable({ positions }: OpenPositionsTableProps): ReactElement {
  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border dark:border-dark-border">
        <h2 className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
          Open Positions ({positions.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border dark:border-dark-border">
              <th className="px-4 py-3 text-left font-medium text-text-muted dark:text-dark-text-muted">Symbol</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted">Shares</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden sm:table-cell">Avg Entry</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted">Current</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted">P&L ($)</th>
              <th className="px-4 py-3 text-right font-medium text-text-muted dark:text-dark-text-muted hidden sm:table-cell">P&L (%)</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted dark:text-dark-text-muted">
                  No open positions
                </td>
              </tr>
            ) : (
              positions.map((pos) => {
                const isPositive = pos.unrealizedPnl >= 0;
                return (
                  <tr
                    key={pos.symbol}
                    className="border-b border-border dark:border-dark-border last:border-b-0 hover:bg-surface-secondary dark:hover:bg-dark-surface-tertiary transition-colors"
                  >
                    <td className="px-4 py-3 font-bold text-text-primary dark:text-dark-text-primary">{pos.symbol}</td>
                    <td className="px-4 py-3 text-right text-text-primary dark:text-dark-text-primary">{pos.shares}</td>
                    <td className="px-4 py-3 text-right text-text-secondary dark:text-dark-text-secondary hidden sm:table-cell">{formatCurrency(pos.avgEntryPrice)}</td>
                    <td className="px-4 py-3 text-right text-text-primary dark:text-dark-text-primary">{formatCurrency(pos.currentPrice)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                      {formatPnl(pos.unrealizedPnl)}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold hidden sm:table-cell ${isPositive ? 'text-profit' : 'text-loss'}`}>
                      {formatPnlPercent(pos.unrealizedPnlPercent)}
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

export default OpenPositionsTable;
