import React, { useState, useCallback, type ReactElement } from 'react';

import Button from '../common/Button';
import { useToast } from '../../context/ToastContext';

function KillSwitch(): ReactElement {
  const [isPaused, setIsPaused] = useState(false);
  const { showToast } = useToast();

  const handleToggle = useCallback((): void => {
    setIsPaused((prev) => {
      const nextState = !prev;
      if (nextState) {
        showToast('Claude trading has been paused', 'warning');
      } else {
        showToast('Claude trading has been resumed', 'success');
      }
      return nextState;
    });
  }, [showToast]);

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl border ${
      isPaused
        ? 'bg-warning-light dark:bg-yellow-900/30 border-warning'
        : 'bg-loss-light/30 dark:bg-red-900/20 border-loss/50'
    }`}>
      <div className="flex flex-col gap-1">
        <h3 className={`text-base font-semibold ${
          isPaused
            ? 'text-yellow-800 dark:text-yellow-200'
            : 'text-profit dark:text-profit'
        }`}>
          {isPaused ? 'Claude Trading Paused' : 'Emergency System Override'}
        </h3>
        <p className="text-sm text-text-secondary dark:text-dark-text-secondary max-w-xl">
          {isPaused
            ? 'Claude is currently paused. No new trades will be executed. Existing positions remain open.'
            : 'Immediately liquidate all active positions and disconnect Claude from the API exchange. Use only in cases of extreme market volatility or technical failure.'}
        </p>
      </div>
      <Button
        variant={isPaused ? 'secondary' : 'danger'}
        size="lg"
        onClick={handleToggle}
        className="whitespace-nowrap font-bold"
      >
        {isPaused ? 'RESUME CLAUDE' : 'PAUSE CLAUDE'}
      </Button>
    </div>
  );
}

export default KillSwitch;
