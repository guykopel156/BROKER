import React, { useState, useCallback, type ReactElement } from 'react';

import { Badge } from '../common';
import { formatCurrency, formatPnl } from '../../utils/formatters';

import type { Trade, TradeStatus } from '../../types';

interface TradeRowProps {
  trade: Trade;
}

const STATUS_VARIANT_MAP: Record<TradeStatus, 'filled' | 'pending' | 'failed' | 'default'> = {
  'filled': 'filled',
  'pending': 'pending',
  'failed': 'failed',
  'in-progress': 'pending',
};

function TradeRow({ trade }: TradeRowProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback((): void => {
    setIsExpanded((prev) => !prev);
  }, []);

  const hasProfitLoss = trade.profitLoss !== undefined;
  const profitLoss = trade.profitLoss ?? 0;
  const isProfit = hasProfitLoss && profitLoss >= 0;

  return (
    <div className="border-b border-border dark:border-dark-border last:border-b-0">
      <button
        onClick={handleToggle}
        className="w-full text-left px-4 py-3 hover:bg-surface-secondary dark:hover:bg-dark-surface-tertiary transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left: symbol, action, details */}
          <div className="flex items-center gap-3 min-w-0">
            <Badge variant={trade.action === 'BUY' ? 'buy' : 'sell'}>
              {trade.action}
            </Badge>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">
                  {trade.symbol}
                </span>
                <span className="text-xs text-text-muted dark:text-dark-text-muted hidden sm:inline">
                  {trade.quantity} shares @ {formatCurrency(trade.price)}
                </span>
              </div>
              <div className="text-xs text-text-muted dark:text-dark-text-muted">
                {trade.timestamp} &middot; {trade.strategy}
              </div>
            </div>
          </div>

          {/* Right: P&L, status, expand icon */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <div className={`text-sm font-semibold ${hasProfitLoss ? (isProfit ? 'text-profit' : 'text-loss') : 'text-text-primary dark:text-dark-text-primary'}`}>
                {hasProfitLoss ? formatPnl(profitLoss) : formatCurrency(trade.totalValue)}
              </div>
            </div>
            <Badge variant={STATUS_VARIANT_MAP[trade.status]}>
              {trade.outcomeLabel ?? trade.status}
            </Badge>
            <svg
              className={`w-4 h-4 text-text-muted dark:text-dark-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded reasoning */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
              <div>
                <span className="text-text-muted dark:text-dark-text-muted">Quantity</span>
                <div className="font-semibold text-text-primary dark:text-dark-text-primary">{trade.quantity} shares</div>
              </div>
              <div>
                <span className="text-text-muted dark:text-dark-text-muted">Price</span>
                <div className="font-semibold text-text-primary dark:text-dark-text-primary">{formatCurrency(trade.price)}</div>
              </div>
              <div>
                <span className="text-text-muted dark:text-dark-text-muted">Total Value</span>
                <div className="font-semibold text-text-primary dark:text-dark-text-primary">{formatCurrency(trade.totalValue)}</div>
              </div>
              <div>
                <span className="text-text-muted dark:text-dark-text-muted">Exchange</span>
                <div className="font-semibold text-text-primary dark:text-dark-text-primary">{trade.exchange}</div>
              </div>
            </div>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
              <span className="font-semibold text-primary">Reasoning: </span>
              <span className="italic">{trade.reasoning}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeRow;
