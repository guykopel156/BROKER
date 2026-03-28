import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import Button from '../common/Button';
import { useToast } from '../../context/ToastContext';
import { fetchSettings, pauseEngine, resumeEngine } from '../../services/api';

function KillSwitch(): ReactElement {
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadState(): Promise<void> {
      try {
        const settings = await fetchSettings();
        setIsPaused(settings.isClaudePaused);
      } catch {
        // Keep default
      }
    }
    loadState();
  }, []);

  const handleToggle = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (isPaused) {
        await resumeEngine();
        setIsPaused(false);
        showToast('Claude trading has been resumed', 'success');
      } else {
        await pauseEngine();
        setIsPaused(true);
        showToast('Claude trading has been paused', 'warning');
      }
    } catch {
      showToast('Failed to toggle engine', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isPaused, showToast]);

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
        isLoading={isLoading}
        className="whitespace-nowrap font-bold"
      >
        {isPaused ? 'RESUME CLAUDE' : 'PAUSE CLAUDE'}
      </Button>
    </div>
  );
}

export default KillSwitch;
