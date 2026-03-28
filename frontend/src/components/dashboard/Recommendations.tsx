import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Badge } from '../common';
import MiniChart from './MiniChart';
import { fetchRecommendations, fetchPositions, authFetch } from '../../services/api';

import type { RecommendationData } from '../../services/api';

interface HeldPosition {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
}

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
      <div className="h-2 w-20 rounded-full bg-surface-tertiary dark:bg-dark-surface-tertiary">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-sm font-bold text-text-muted dark:text-dark-text-muted">{value}%</span>
    </div>
  );
}

function ArrowButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }): ReactElement {
  return (
    <button
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-dark-surface-secondary/80 dark:bg-dark-surface/80 border border-border dark:border-dark-border text-text-primary dark:text-dark-text-primary flex items-center justify-center hover:bg-primary hover:text-white hover:border-primary transition-all shadow-lg"
      style={{ [direction === 'left' ? 'left' : 'right']: '-12px' }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        {direction === 'left' ? (
          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
        ) : (
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        )}
      </svg>
    </button>
  );
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function Recommendations(): ReactElement {
  const [recommendations, setRecommendations] = useState<RecommendationData[]>([]);
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [holdings, setHoldings] = useState<Record<string, HeldPosition>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchRecommendations();
      // Sort: buyable first (quantity > 0), then watchlist (quantity = 0)
      const sorted = [...data].sort((a, b) => {
        if (a.quantity > 0 && b.quantity === 0) return -1;
        if (a.quantity === 0 && b.quantity > 0) return 1;
        return b.confidence - a.confidence;
      });
      setRecommendations(sorted);

      const priceMap: Record<string, StockPrice> = {};
      for (const rec of data) {
        if (rec.symbol && !priceMap[rec.symbol]) {
          try {
            const response = await authFetch(`/market/${rec.symbol}/price`);
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

      // Fetch current holdings
      try {
        const positions = await fetchPositions() as IbkrPosition[];
        if (Array.isArray(positions)) {
          const holdingsMap: Record<string, HeldPosition> = {};
          for (const pos of positions) {
            holdingsMap[pos.ticker] = {
              symbol: pos.ticker,
              shares: pos.position,
              avgPrice: pos.avgPrice,
              currentPrice: pos.mktPrice,
              pnl: pos.unrealizedPnl,
              pnlPercent: pos.avgPrice > 0
                ? ((pos.mktPrice - pos.avgPrice) / pos.avgPrice) * 100
                : 0,
            };
          }
          setHoldings(holdingsMap);
        }
      } catch {
        // No positions
      }
    } catch {
      // No data yet
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Countdown timer from backend
  useEffect(() => {
    async function fetchStatus(): Promise<void> {
      try {
        const response = await authFetch('/engine/cycle-status');
        const result = await response.json();
        if (result.data) {
          setCountdown(result.data.secondsUntilNext);
        }
      } catch {
        // Skip
      }
    }

    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    const tick = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(tick);
    };
  }, []);

  const handlePrev = useCallback((): void => {
    setCurrentIndex((prev) => (prev === 0 ? recommendations.length - 1 : prev - 1));
  }, [recommendations.length]);

  const handleNext = useCallback((): void => {
    setCurrentIndex((prev) => (prev === recommendations.length - 1 ? 0 : prev + 1));
  }, [recommendations.length]);

  const handleDotClick = useCallback((index: number): void => {
    setCurrentIndex(index);
  }, []);

  // Reset index if recommendations change
  useEffect(() => {
    if (currentIndex >= recommendations.length) {
      setCurrentIndex(0);
    }
  }, [recommendations.length, currentIndex]);

  const rec = recommendations[currentIndex];
  const stockPrice = rec?.symbol ? prices[rec.symbol] : undefined;
  const totalCost = stockPrice && rec ? stockPrice.price * rec.quantity : 0;
  const isPositiveChange = stockPrice ? stockPrice.changePercent >= 0 : false;
  const currentHolding = rec?.symbol ? holdings[rec.symbol] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
            Claude Recommendations
          </h2>
          {recommendations.length > 1 && (
            <span className="text-xs text-text-muted dark:text-dark-text-muted">
              {currentIndex + 1} / {recommendations.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {countdown > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-tertiary dark:bg-dark-surface-tertiary">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono font-semibold text-text-primary dark:text-dark-text-primary">
                {formatCountdown(countdown)}
              </span>
            </div>
          )}
          {countdown === 0 && recommendations.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              <span className="text-xs font-semibold text-primary">Analyzing...</span>
            </div>
          )}
        </div>
      </div>

      {recommendations.length === 0 || !rec ? (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-8 text-center">
          <p className="text-sm text-text-muted dark:text-dark-text-muted">
            No recommendations yet. Waiting for next trading cycle...
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Arrows */}
          {recommendations.length > 1 && (
            <>
              <ArrowButton direction="left" onClick={handlePrev} />
              <ArrowButton direction="right" onClick={handleNext} />
            </>
          )}

          {/* Card */}
          <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-5 mx-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Badge variant={ACTION_BADGE[rec.action] ?? 'default'}>
                  {rec.action}
                </Badge>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                  rec.holdType === 'long'
                    ? 'bg-profit/20 text-profit border border-profit/30'
                    : 'bg-warning/20 text-warning border border-warning/30'
                }`}>
                  {rec.holdType === 'long' ? 'LONG-TERM' : 'SHORT-TERM'}
                </span>
                {rec.symbol && (
                  <div>
                    <span className="text-xl font-bold text-text-primary dark:text-dark-text-primary">
                      {rec.symbol}
                    </span>
                    {stockPrice && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-semibold text-text-primary dark:text-dark-text-primary">
                          ${stockPrice.price.toFixed(2)}
                        </span>
                        <span className={`text-xs font-medium ${isPositiveChange ? 'text-profit' : 'text-loss'}`}>
                          {isPositiveChange ? '+' : ''}{stockPrice.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <ConfidenceBar value={rec.confidence} />
                {rec.strategy && (
                  <span className="text-xs font-medium text-primary">
                    {rec.strategy}
                  </span>
                )}
              </div>
            </div>

            {/* Trade Details */}
            {rec.action === 'BUY' && (
              <div className="mb-4">
                {rec.quantity === 0 && (
                  <div className="p-3 mb-3 rounded-lg bg-warning-light/20 dark:bg-yellow-900/10 border border-warning/20 text-center">
                    <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                      Watchlist — can't afford yet. Buy when budget allows.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
                  <div className="text-center">
                    <span className="text-xs text-text-muted dark:text-dark-text-muted block">Shares</span>
                    <div className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                      {rec.quantity}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-text-muted dark:text-dark-text-muted block">Price/Share</span>
                    {stockPrice ? (
                      <div className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
                        ${stockPrice.price.toFixed(2)}
                      </div>
                    ) : (
                      <div className="flex justify-center mt-1">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="text-xs text-text-muted dark:text-dark-text-muted block">Total Cost</span>
                    {totalCost > 0 ? (
                      <div className="text-lg font-bold text-primary">
                        ${totalCost.toFixed(2)}
                      </div>
                    ) : (
                      <div className="flex justify-center mt-1">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                {stockPrice && (
                  <div className="mt-2 px-3 py-1.5 rounded-md bg-primary/5 dark:bg-primary/10">
                    <p className="text-xs text-text-muted dark:text-dark-text-muted">
                      Why {rec.quantity} shares: Budget ÷ ${stockPrice.price.toFixed(2)} per share = {Math.floor(10.67 * 0.95 / stockPrice.price)} shares max (keeping 5% cash reserve)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Current Holding Info */}
            {currentHolding && (
              <div className={`mb-4 p-3 rounded-lg border ${
                currentHolding.pnl >= 0
                  ? 'bg-profit-light/30 dark:bg-green-900/10 border-profit/30'
                  : 'bg-loss-light/30 dark:bg-red-900/10 border-loss/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-text-muted dark:text-dark-text-muted">YOU OWN THIS STOCK</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Shares</span>
                    <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">{currentHolding.shares}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Avg Cost</span>
                    <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">${currentHolding.avgPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Current</span>
                    <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">${currentHolding.currentPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">P&L</span>
                    <span className={`text-sm font-bold ${currentHolding.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {currentHolding.pnl >= 0 ? '+' : ''}${currentHolding.pnl.toFixed(2)} ({currentHolding.pnlPercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                {rec.action === 'SELL' && (
                  <div className="mt-2 pt-2 border-t border-loss/20">
                    <p className="text-xs text-loss font-medium">
                      Sell recommendation: {currentHolding.pnl < 0
                        ? `This position is down ${Math.abs(currentHolding.pnlPercent).toFixed(1)}%. Better opportunities may exist.`
                        : `Lock in ${currentHolding.pnlPercent.toFixed(1)}% profit and reinvest in higher-growth stocks.`}
                    </p>
                  </div>
                )}
                {rec.action === 'BUY' && (
                  <div className="mt-2 pt-2 border-t border-profit/20">
                    <p className="text-xs text-profit font-medium">
                      Adding to position: Agent sees more upside potential for this stock.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Mini Chart */}
            {rec.symbol && (
              <div className="mb-4 rounded-lg overflow-hidden border border-border dark:border-dark-border">
                <MiniChart symbol={rec.symbol} />
              </div>
            )}

            {/* Reasoning */}
            <div className="p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary">
              <p className="text-sm text-text-secondary dark:text-dark-text-secondary leading-relaxed">
                <span className={`font-semibold ${ACTION_COLORS[rec.action] ?? 'text-primary'}`}>
                  Reasoning:{' '}
                </span>
                <span className="italic">{rec.reasoning}</span>
              </p>
            </div>

            {/* Timestamp */}
            <div className="mt-3 text-xs text-text-muted dark:text-dark-text-muted">
              {new Date(rec.cycleTimestamp).toLocaleString()}
            </div>
          </div>

          {/* Dots */}
          {recommendations.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`rounded-full transition-all ${
                    index === currentIndex
                      ? 'w-6 h-2 bg-primary'
                      : 'w-2 h-2 bg-border dark:bg-dark-border hover:bg-text-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Recommendations;
