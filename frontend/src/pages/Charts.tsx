import React, { useState, useMemo, type ReactElement } from 'react';

import { StockChart, SymbolSelector, TimeframeSelector } from '../components/charts';
import { MOCK_CHART_DATA } from '../mocks/chartData';

import type { Timeframe } from '../components/charts';

function Charts(): ReactElement {
  const symbols = useMemo(() => MOCK_CHART_DATA.map((d) => d.symbol), []);
  const [activeSymbol, setActiveSymbol] = useState(symbols[0]);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>('1M');

  const activeData = useMemo(
    () => MOCK_CHART_DATA.find((d) => d.symbol === activeSymbol),
    [activeSymbol]
  );

  const filteredCandles = useMemo(() => {
    if (!activeData) return [];

    const now = new Date('2026-03-28');
    let daysBack = 30;

    if (activeTimeframe === '1D') daysBack = 1;
    else if (activeTimeframe === '1W') daysBack = 7;
    else if (activeTimeframe === '1M') daysBack = 30;
    else if (activeTimeframe === '3M') daysBack = 90;

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return activeData.candles.filter((c) => c.time >= cutoffStr);
  }, [activeData, activeTimeframe]);

  if (!activeData) {
    return (
      <div className="text-center text-text-muted dark:text-dark-text-muted py-12">
        No chart data available
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Charts</h1>
        <TimeframeSelector activeTimeframe={activeTimeframe} onSelect={setActiveTimeframe} />
      </div>

      <SymbolSelector symbols={symbols} activeSymbol={activeSymbol} onSelect={setActiveSymbol} />

      <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">{activeData.symbol}</span>
            <span className="text-sm text-text-muted dark:text-dark-text-muted ml-2">
              Entry: ${activeData.entryPrice.toFixed(2)}
            </span>
          </div>
          {filteredCandles.length > 0 && (
            <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
              ${filteredCandles[filteredCandles.length - 1].close.toFixed(2)}
            </span>
          )}
        </div>
        <StockChart
          symbol={activeData.symbol}
          candles={filteredCandles}
          entryPrice={activeData.entryPrice}
          markers={activeData.markers}
        />
      </div>
    </div>
  );
}

export default Charts;
