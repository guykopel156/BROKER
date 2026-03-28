import React, { type ReactElement } from 'react';

import { Badge } from '../common';
import { formatCurrency, formatPnl } from '../../utils/formatters';

import type { Trade, TradeAction, TradeStatus } from '../../types';

interface RecentTradesProps {
  trades: Trade[];
}

const ACTION_VARIANT_MAP: Record<TradeAction, 'buy' | 'sell'> = {
  BUY: 'buy',
  SELL: 'sell',
};

const STATUS_COLOR_MAP: Record<TradeStatus, string> = {
  'in-progress': 'text-info',
  filled: 'text-profit',
  failed: 'text-loss',
  pending: 'text-warning',
};

const FAILURE_REASONS: Record<string, string> = {
  failed: 'Market is closed or order was rejected by IBKR',
};

function TradeCard({ trade }: { trade: Trade }): ReactElement {
  const profitLoss = trade.profitLoss ?? 0;
  const hasProfitLoss = trade.profitLoss !== undefined;
  const isProfit = hasProfitLoss && profitLoss >= 0;
  const isFailed = trade.status === 'failed';

  return (
    <div className={`p-4 border rounded-xl bg-surface dark:bg-dark-surface-secondary ${
      isFailed ? 'border-loss/50' : 'border-border dark:border-dark-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant={ACTION_VARIANT_MAP[trade.action]}>
            {trade.action}
          </Badge>
          <div>
            <span className="text-base font-bold text-text-primary dark:text-dark-text-primary">
              {trade.symbol}
            </span>
            <span className="ml-2 text-sm text-text-muted dark:text-dark-text-muted">
              {trade.quantity} shares @ {formatCurrency(trade.price)}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-sm font-bold ${hasProfitLoss && isProfit ? 'text-profit' : hasProfitLoss ? 'text-loss' : 'text-text-primary dark:text-dark-text-primary'}`}>
            {hasProfitLoss ? formatPnl(profitLoss) : formatCurrency(trade.totalValue)}
          </div>
          <div className={`text-xs font-medium ${STATUS_COLOR_MAP[trade.status]}`}>
            {trade.outcomeLabel}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-text-muted dark:text-dark-text-muted">
        {trade.timestamp} &middot; {trade.strategy}
      </div>

      {isFailed && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-loss-light/50 dark:bg-red-900/20 border border-loss/20">
          <p className="text-xs font-medium text-loss">
            Failed: {FAILURE_REASONS[trade.status] ?? 'Unknown error'}
          </p>
        </div>
      )}

      <div className="mt-3 p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
        <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
          <span className="font-semibold text-primary">Reasoning: </span>
          <span className="italic">{trade.reasoning}</span>
        </p>
      </div>
    </div>
  );
}

function RecentTrades({ trades }: RecentTradesProps): ReactElement {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
          Recent AI Trades
        </h2>
        <Badge variant="default">LIVE FEED</Badge>
      </div>
      {trades.length === 0 ? (
        <div className="p-8 border border-border dark:border-dark-border rounded-xl bg-surface dark:bg-dark-surface-secondary text-center">
          <p className="text-sm text-text-muted dark:text-dark-text-muted">
            No trades executed yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trades.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecentTrades;
