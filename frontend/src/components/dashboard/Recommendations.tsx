import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Badge } from '../common';
import MiniChart from './MiniChart';
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

interface StockPrice {
  price: number;
  changePercent: number;
}

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
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchRecommendations();
      setRecommendations(data);

      // Fetch prices for each recommended symbol
      const priceMap: Record<string, StockPrice> = {};
      for (const rec of data) {
        if (rec.symbol && !priceMap[rec.symbol]) {
          try {
            const response = await fetch(`http://localhost:4000/api/market/${rec.symbol}/price`);
            const result = await response.json();
            if (result.data) {
              priceMap[rec.symbol] = {
                price: result.data.price,
                changePercent: result.data.changePercent ?? 0,
              };
            }
          } catch {
            // Skip
          }
        }
      }
      setPrices(priceMap);
    } catch {
      // No data yet
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
          Claude Recommendations
        </h2>
        <span className="text-xs text-text-muted dark:text-dark-text-muted">
          Auto-refreshes every 60s
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
          {recommendations.map((rec) => {
            const stockPrice = rec.symbol ? prices[rec.symbol] : undefined;
            const totalCost = stockPrice ? stockPrice.price * rec.quantity : 0;

            return (
              <div
                key={rec._id}
                className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={ACTION_BADGE[rec.action] ?? 'default'}>
                      {rec.action}
                    </Badge>
                    {rec.symbol && (
                      <span className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                        {rec.symbol}
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

                {/* Trade Details */}
                {rec.quantity > 0 && (
                  <div className="grid grid-cols-3 gap-3 mb-3 p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                    <div>
                      <span className="text-xs text-text-muted dark:text-dark-text-muted">Shares</span>
                      <div className="text-sm font-bold text-text-primary dark:text-dark-text-primary">
                        {rec.quantity}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-text-muted dark:text-dark-text-muted">Price/Share</span>
                      <div className="text-sm font-bold text-text-primary dark:text-dark-text-primary">
                        {stockPrice ? `$${stockPrice.price.toFixed(2)}` : '...'}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-text-muted dark:text-dark-text-muted">Total Cost</span>
                      <div className="text-sm font-bold text-text-primary dark:text-dark-text-primary">
                        {totalCost > 0 ? `$${totalCost.toFixed(2)}` : '...'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Mini Chart */}
                {rec.symbol && (
                  <div className="my-3 rounded-lg overflow-hidden border border-border dark:border-dark-border">
                    <MiniChart symbol={rec.symbol} />
                  </div>
                )}

                {/* Reasoning */}
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
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Recommendations;
