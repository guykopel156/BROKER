import React, { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { createChart, type IChartApi, ColorType, LineSeries } from 'lightweight-charts';

import { useThemeContext } from '../context/ThemeContext';
import { LoadingSpinner } from '../components/common';
import { fetchPositions } from '../services/api';

type Timeframe = '1W' | '1M' | '3M' | '6M' | '1Y';

const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
};

const TIMEFRAMES: Timeframe[] = ['1W', '1M', '3M', '6M', '1Y'];

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
}

interface LinePoint {
  time: string;
  value: number;
}

function FullChart({ symbol, timeframe }: { symbol: string; timeframe: Timeframe }): ReactElement {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const { isDark } = useThemeContext();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!chartRef.current || !symbol) return;

    let isCancelled = false;
    setStatus('loading');

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      width: chartRef.current.clientWidth,
      height: 400,
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
      },
    });

    chartInstanceRef.current = chart;
    const days = TIMEFRAME_DAYS[timeframe];

    fetch(`http://localhost:4000/api/market/${symbol}/candles?days=${days}`)
      .then((res) => res.json())
      .then((response) => {
        if (isCancelled) return;

        const data = response.data;
        if (!data || data.length === 0) {
          setStatus('error');
          return;
        }

        const points: LinePoint[] = data.map((bar: { time: string; close: number }) => ({
          time: bar.time,
          value: bar.close,
        }));

        const firstValue = points[0].value;
        const lastValue = points[points.length - 1].value;
        const isPositive = lastValue >= firstValue;

        const series = chart.addSeries(LineSeries, {
          color: isPositive ? '#22c55e' : '#ef4444',
          lineWidth: 2,
          crosshairMarkerVisible: true,
        });

        series.setData(points as never[]);
        chart.timeScale().fitContent();
        setStatus('ready');
      })
      .catch(() => {
        if (!isCancelled) setStatus('error');
      });

    const handleResize = (): void => {
      if (chartRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [symbol, timeframe, isDark]);

  if (status === 'error') {
    return (
      <div className="h-[400px] flex items-center justify-center text-sm text-text-muted dark:text-dark-text-muted">
        Chart unavailable — API rate limited. Try again in a minute.
      </div>
    );
  }

  return <div ref={chartRef} className="w-full" style={{ minHeight: 400 }} />;
}

function Charts(): ReactElement {
  const [heldSymbols, setHeldSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('1M');
  const [isLoading, setIsLoading] = useState(true);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const loadPositions = useCallback(async (): Promise<void> => {
    try {
      const positions = await fetchPositions() as IbkrPosition[];
      if (Array.isArray(positions) && positions.length > 0) {
        const symbols = positions.map((p) => p.ticker);
        setHeldSymbols(symbols);
        if (!selectedSymbol) {
          setSelectedSymbol(symbols[0]);
        }
      }
    } catch {
      // Not connected
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const handleSearch = useCallback((): void => {
    const symbol = searchInput.toUpperCase().trim();
    if (!symbol) return;

    setSelectedSymbol(symbol);
    setSearchInput('');

    if (!searchHistory.includes(symbol) && !heldSymbols.includes(symbol)) {
      setSearchHistory((prev) => [symbol, ...prev.slice(0, 9)]);
    }
  }, [searchInput, searchHistory, heldSymbols]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading charts..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Charts</h1>

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search ticker (e.g. AAPL)"
            className="px-3 py-2 text-sm rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface-secondary text-text-primary dark:text-dark-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary w-48"
          />
          <button
            onClick={handleSearch}
            disabled={!searchInput.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Stock Tabs */}
      <div className="flex flex-col gap-2">
        {heldSymbols.length > 0 && (
          <div>
            <span className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-1 block">Your Stocks</span>
            <div className="flex flex-wrap gap-2">
              {heldSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    selectedSymbol === symbol
                      ? 'bg-primary text-white'
                      : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        )}

        {searchHistory.length > 0 && (
          <div>
            <span className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-1 block">Recent Searches</span>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    selectedSymbol === symbol
                      ? 'bg-primary text-white'
                      : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {selectedSymbol ? (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xl font-bold text-text-primary dark:text-dark-text-primary">{selectedSymbol}</span>
            <div className="flex gap-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    timeframe === tf
                      ? 'bg-primary text-white'
                      : 'text-text-muted dark:text-dark-text-muted hover:text-text-primary dark:hover:text-dark-text-primary'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <FullChart symbol={selectedSymbol} timeframe={timeframe} />
        </div>
      ) : (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-12 text-center">
          <p className="text-sm text-text-muted dark:text-dark-text-muted">
            Search for a stock ticker or select one from your holdings above
          </p>
        </div>
      )}
    </div>
  );
}

export default Charts;
