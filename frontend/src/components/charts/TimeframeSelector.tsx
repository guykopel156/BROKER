import React, { type ReactElement } from 'react';

export type Timeframe = '1D' | '1W' | '1M' | '3M';

interface TimeframeSelectorProps {
  activeTimeframe: Timeframe;
  onSelect: (timeframe: Timeframe) => void;
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M'];

function TimeframeSelector({ activeTimeframe, onSelect }: TimeframeSelectorProps): ReactElement {
  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onSelect(tf)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTimeframe === tf
              ? 'bg-primary text-white'
              : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}

export default TimeframeSelector;
