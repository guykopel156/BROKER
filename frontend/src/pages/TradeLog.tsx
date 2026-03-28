import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { TradeFilters, TradeRow } from '../components/tradelog';
import { LoadingSpinner } from '../components/common';
import { fetchAllTrades } from '../services/api';

import type { Trade, TradeAction } from '../types';
import type { TradeData } from '../services/api';

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

function TradeLog(): ReactElement {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbolFilter, setSymbolFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<TradeAction | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const loadTrades = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchAllTrades(
        symbolFilter || undefined,
        actionFilter !== 'ALL' ? actionFilter : undefined
      );
      setTrades(data.map(mapTradeData));
    } catch {
      // Backend unreachable
    } finally {
      setIsLoading(false);
    }
  }, [symbolFilter, actionFilter]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Trade Log</h1>
          <p className="text-sm text-text-muted dark:text-dark-text-muted mt-1">
            {trades.length} trades
          </p>
        </div>
        <TradeFilters
          symbolFilter={symbolFilter}
          actionFilter={actionFilter}
          onSymbolChange={setSymbolFilter}
          onActionChange={setActionFilter}
        />
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading trades..." />
      ) : (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
          {trades.length === 0 ? (
            <div className="px-4 py-12 text-center text-text-muted dark:text-dark-text-muted">
              No trades yet. Claude will log trades here once the engine runs.
            </div>
          ) : (
            trades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default TradeLog;
