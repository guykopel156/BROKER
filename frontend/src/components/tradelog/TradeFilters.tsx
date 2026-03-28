import React, { type ReactElement } from 'react';

import type { TradeAction } from '../../types';

interface TradeFiltersProps {
  symbolFilter: string;
  actionFilter: TradeAction | 'ALL';
  onSymbolChange: (value: string) => void;
  onActionChange: (value: TradeAction | 'ALL') => void;
}

const ACTION_OPTIONS: Array<{ label: string; value: TradeAction | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Buy', value: 'BUY' },
  { label: 'Sell', value: 'SELL' },
];

function TradeFilters({
  symbolFilter,
  actionFilter,
  onSymbolChange,
  onActionChange,
}: TradeFiltersProps): ReactElement {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <input
        type="text"
        placeholder="Filter by symbol..."
        value={symbolFilter}
        onChange={(e) => onSymbolChange(e.target.value)}
        className="px-3 py-2 text-sm rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface-secondary text-text-primary dark:text-dark-text-primary placeholder-text-muted dark:placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex gap-1">
        {ACTION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onActionChange(option.value)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              actionFilter === option.value
                ? 'bg-primary text-white'
                : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TradeFilters;
