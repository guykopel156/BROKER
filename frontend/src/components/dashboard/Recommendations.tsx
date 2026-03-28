import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Badge } from '../common';
import { fetchRecommendations } from '../../services/api';

import type { RecommendationData } from '../../services/api';

const ACTION_COLORS: Record<string, string> = {
  BUY: 'text-profit',
  SELL: 'text-loss',
  HOLD: 'text-warning',
};

const ACTION_BADGE: Record<string, 'buy' | 'sell' | 'pending'> = {
  BUY: 'buy',
  SELL: 'sell',
  HOLD: 'pending',
};

function ConfidenceBar({ value }: { value: number }): ReactElement {
  const color = value >= 70 ? 'bg-profit' : value >= 40 ? 'bg-warning' : 'bg-loss';

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-surface-tertiary dark:bg-dark-surface-tertiary">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-text-muted dark:text-dark-text-muted">{value}%</span>
    </div>
  );
}

function Recommendations(): ReactElement {
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchRecommendations();
      setRecommendations(data);
    } catch {
      // No data yet
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
          Claude Recommendations
        </h2>
        <span className="text-xs text-text-muted dark:text-dark-text-muted">
          Auto-refreshes every 30s
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-8 text-center">
          <p className="text-sm text-text-muted dark:text-dark-text-muted">
            No recommendations yet. Waiting for next trading cycle...
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recommendations.map((rec) => (
            <div
              key={rec._id}
              className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <Badge variant={ACTION_BADGE[rec.action] ?? 'default'}>
                    {rec.action}
                  </Badge>
                  {rec.symbol && (
                    <span className="text-base font-bold text-text-primary dark:text-dark-text-primary">
                      {rec.symbol}
                    </span>
                  )}
                  {rec.quantity > 0 && (
                    <span className="text-sm text-text-muted dark:text-dark-text-muted">
                      {rec.quantity} shares
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ConfidenceBar value={rec.confidence} />
                  {rec.strategy && (
                    <span className="text-xs text-text-muted dark:text-dark-text-muted">
                      {rec.strategy}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  <span className={`font-semibold ${ACTION_COLORS[rec.action] ?? 'text-primary'}`}>
                    Reasoning:{' '}
                  </span>
                  <span className="italic">{rec.reasoning}</span>
                </p>
              </div>

              <div className="mt-2 text-xs text-text-muted dark:text-dark-text-muted">
                {new Date(rec.cycleTimestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Recommendations;
