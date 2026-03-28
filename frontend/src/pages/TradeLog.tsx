import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { TradeFilters, TradeRow } from '../components/tradelog';
import { LoadingSpinner } from '../components/common';
import { fetchAllTrades, fetchIbkrTradeHistory } from '../services/api';

import type { Trade, TradeAction } from '../types';
import type { TradeData } from '../services/api';

function mapTradeData(t: TradeData, source: string): Trade {
  return {
    id: t._id,
    symbol: t.symbol,
    action: t.action,
    quantity: t.quantity,
    price: t.price,
    totalValue: t.totalValue,
    reasoning: t.reasoning ?? `${source} trade`,
    status: t.status,
    strategy: t.strategy ?? source,
    exchange: t.exchange ?? '',
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
  const [activeTab, setActiveTab] = useState<'all' | 'agent' | 'ibkr'>('all');

  const loadTrades = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const allTrades: Trade[] = [];

    // Fetch agent trades
    if (activeTab === 'all' || activeTab === 'agent') {
      try {
        const data = await fetchAllTrades(
          symbolFilter || undefined,
          actionFilter !== 'ALL' ? actionFilter : undefined
        );
        allTrades.push(...data.map((t) => mapTradeData(t, 'AI Agent')));
      } catch {
        // Backend unreachable
      }
    }

    // Fetch IBKR trade history
    if (activeTab === 'all' || activeTab === 'ibkr') {
      try {
        const ibkrData = await fetchIbkrTradeHistory();
        const ibkrTrades = ibkrData
          .map((t) => mapTradeData(t, 'IBKR'))
          .filter((t) => {
            const matchesSymbol = !symbolFilter || t.symbol.toLowerCase().includes(symbolFilter.toLowerCase());
            const matchesAction = actionFilter === 'ALL' || t.action === actionFilter;
            return matchesSymbol && matchesAction;
          });
        allTrades.push(...ibkrTrades);
      } catch {
        // IBKR not connected
      }
    }

    // Sort by timestamp (newest first)
    allTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTrades(allTrades);
    setIsLoading(false);
  }, [symbolFilter, actionFilter, activeTab]);

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

      {/* Source tabs */}
      <div className="flex gap-1 bg-surface-tertiary dark:bg-dark-surface-tertiary rounded-lg p-1 w-fit">
        {[
          { key: 'all' as const, label: 'All Trades' },
          { key: 'agent' as const, label: 'AI Agent' },
          { key: 'ibkr' as const, label: 'IBKR History' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-primary text-white'
                : 'text-text-secondary dark:text-dark-text-secondary hover:text-text-primary dark:hover:text-dark-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading trades..." />
      ) : (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
          {trades.length === 0 ? (
            <div className="px-4 py-12 text-center text-text-muted dark:text-dark-text-muted">
              {activeTab === 'ibkr'
                ? 'No IBKR trade history found. Make sure the gateway is connected.'
                : 'No trades yet. Claude will log trades here once the engine runs.'}
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
