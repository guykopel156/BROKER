import React, { useState, useMemo, type ReactElement } from 'react';

import { TradeFilters, TradeRow } from '../components/tradelog';
import { MOCK_TRADE_HISTORY } from '../mocks/tradeLogData';

import type { TradeAction } from '../types';

function TradeLog(): ReactElement {
  const [symbolFilter, setSymbolFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<TradeAction | 'ALL'>('ALL');

  const filteredTrades = useMemo(() => {
    return MOCK_TRADE_HISTORY.filter((trade) => {
      const matchesSymbol = symbolFilter === '' ||
        trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase());
      const matchesAction = actionFilter === 'ALL' || trade.action === actionFilter;
      return matchesSymbol && matchesAction;
    });
  }, [symbolFilter, actionFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Trade Log</h1>
          <p className="text-sm text-text-muted dark:text-dark-text-muted mt-1">
            {filteredTrades.length} trades
          </p>
        </div>
        <TradeFilters
          symbolFilter={symbolFilter}
          actionFilter={actionFilter}
          onSymbolChange={setSymbolFilter}
          onActionChange={setActionFilter}
        />
      </div>

      <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="px-4 py-12 text-center text-text-muted dark:text-dark-text-muted">
            No trades match your filters
          </div>
        ) : (
          filteredTrades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))
        )}
      </div>
    </div>
  );
}

export default TradeLog;
