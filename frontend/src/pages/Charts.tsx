import React, { type ReactElement } from 'react';

function Charts(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Charts</h1>

      <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary mb-2">
          No chart data yet
        </h2>
        <p className="text-sm text-text-muted dark:text-dark-text-muted max-w-md mx-auto">
          Charts will appear here once Claude starts trading. Each stock position will have its own candlestick chart with entry price markers.
        </p>
      </div>
    </div>
  );
}

export default Charts;
