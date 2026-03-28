import React, { type ReactElement } from 'react';

interface SymbolSelectorProps {
  symbols: string[];
  activeSymbol: string;
  onSelect: (symbol: string) => void;
}

function SymbolSelector({ symbols, activeSymbol, onSelect }: SymbolSelectorProps): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {symbols.map((symbol) => (
        <button
          key={symbol}
          onClick={() => onSelect(symbol)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            activeSymbol === symbol
              ? 'bg-primary text-white'
              : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
          }`}
        >
          {symbol}
        </button>
      ))}
    </div>
  );
}

export default SymbolSelector;
