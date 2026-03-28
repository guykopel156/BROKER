import React, { type ReactElement } from 'react';

import { formatCurrency, formatPnlPercent } from '../../utils/formatters';

import type { WatchlistItem } from '../../types';

interface WatchlistProps {
  items: WatchlistItem[];
}

function WatchlistRow({ item }: { item: WatchlistItem }): ReactElement {
  const isPositive = item.changePercent >= 0;

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-bold text-text-primary dark:text-dark-text-primary">
          {item.symbol}
        </div>
        <div className="text-xs text-text-muted dark:text-dark-text-muted">
          {item.name}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
          {formatCurrency(item.price)}
        </div>
        <div className={`text-xs font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
          {formatPnlPercent(item.changePercent)}
        </div>
      </div>
    </div>
  );
}

function Watchlist({ items }: WatchlistProps): ReactElement {
  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted dark:text-dark-text-muted mb-3">
        Core Watchlist
      </h3>
      <div className="divide-y divide-border dark:divide-dark-border">
        {items.map((item) => (
          <WatchlistRow key={item.symbol} item={item} />
        ))}
      </div>
    </div>
  );
}

export default Watchlist;
