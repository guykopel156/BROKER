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
}

interface StockDetails {
  symbol: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePercent: number;
  marketCap: number;
  description: string;
  sector: string;
  exchange: string;
}

interface LinePoint {
  time: string;
  value: number;
}

function formatVolume(vol: number): string {
  if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(1)}B`;
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return String(vol);
}

function formatMarketCap(cap: number): string {
  if (cap >= 1000000000000) return `$${(cap / 1000000000000).toFixed(1)}T`;
  if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(1)}B`;
  if (cap >= 1000000) return `$${(cap / 1000000).toFixed(1)}M`;
  if (cap > 0) return `$${cap.toLocaleString()}`;
  return 'N/A';
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

    if (chartInstanceRef.current) { chartInstanceRef.current.remove(); chartInstanceRef.current = null; }

    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: bgColor }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      width: chartRef.current.clientWidth,
      height: 400,
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor, timeVisible: false },
      crosshair: { mode: 0 },
    });

    chartInstanceRef.current = chart;

    fetch(`http://localhost:4000/api/market/${symbol}/candles?days=${TIMEFRAME_DAYS[timeframe]}`)
      .then((res) => res.json())
      .then((response) => {
        if (isCancelled) return;
        const data = response.data;
        if (!data || data.length === 0) { setStatus('error'); return; }

        const points: LinePoint[] = data.map((bar: { time: string; close: number }) => ({ time: bar.time, value: bar.close }));
        const isPositive = points[points.length - 1].value >= points[0].value;

        const series = chart.addSeries(LineSeries, {
          color: isPositive ? '#22c55e' : '#ef4444',
          lineWidth: 2,
          crosshairMarkerVisible: true,
        });
        series.setData(points as never[]);
        chart.timeScale().fitContent();
        setStatus('ready');
      })
      .catch(() => { if (!isCancelled) setStatus('error'); });

    const handleResize = (): void => {
      if (chartRef.current && chartInstanceRef.current)
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) { chartInstanceRef.current.remove(); chartInstanceRef.current = null; }
    };
  }, [symbol, timeframe, isDark]);

  if (status === 'error') {
    return <div className="h-[400px] flex items-center justify-center text-sm text-text-muted dark:text-dark-text-muted">Chart unavailable — try again in a minute</div>;
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
  const [stockDetails, setStockDetails] = useState<StockDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const loadPositions = useCallback(async (): Promise<void> => {
    try {
      const positions = await fetchPositions() as IbkrPosition[];
      if (Array.isArray(positions) && positions.length > 0) {
        const symbols = positions.map((p) => p.ticker);
        setHeldSymbols(symbols);
        if (!selectedSymbol) setSelectedSymbol(symbols[0]);
      }
    } catch { /* not connected */ }
    finally { setIsLoading(false); }
  }, [selectedSymbol]);

  const loadDetails = useCallback(async (symbol: string): Promise<void> => {
    setIsLoadingDetails(true);
    setStockDetails(null);
    try {
      const response = await fetch(`http://localhost:4000/api/market/${symbol}/details`);
      const result = await response.json();
      if (result.data) setStockDetails(result.data);
    } catch { /* skip */ }
    finally { setIsLoadingDetails(false); }
  }, []);

  useEffect(() => { loadPositions(); }, [loadPositions]);
  useEffect(() => { if (selectedSymbol) loadDetails(selectedSymbol); }, [selectedSymbol, loadDetails]);

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
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  if (isLoading) return <LoadingSpinner size="lg" message="Loading charts..." />;

  const isPositive = stockDetails ? stockDetails.changePercent >= 0 : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">Charts</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search ticker (e.g. AAPL)"
            className="px-3 py-2 text-sm rounded-lg border border-border dark:border-dark-border bg-surface dark:bg-dark-surface-secondary text-text-primary dark:text-dark-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary w-48"
          />
          <button onClick={handleSearch} disabled={!searchInput.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors">
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
              {heldSymbols.map((sym) => (
                <button key={sym} onClick={() => setSelectedSymbol(sym)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${selectedSymbol === sym ? 'bg-primary text-white' : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'}`}>
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}
        {searchHistory.length > 0 && (
          <div>
            <span className="text-xs font-medium text-text-muted dark:text-dark-text-muted mb-1 block">Recent Searches</span>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((sym) => (
                <button key={sym} onClick={() => setSelectedSymbol(sym)}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${selectedSymbol === sym ? 'bg-primary text-white' : 'bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-secondary dark:text-dark-text-secondary hover:bg-border dark:hover:bg-dark-border'}`}>
                  {sym}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock Details + Chart */}
      {selectedSymbol ? (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl overflow-hidden">
          {/* Stock Info */}
          {isLoadingDetails ? (
            <div className="p-4 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-text-muted dark:text-dark-text-muted">Loading stock info...</span>
            </div>
          ) : stockDetails ? (
            <div className="p-4 border-b border-border dark:border-dark-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">{stockDetails.symbol}</span>
                    {stockDetails.exchange && (
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-tertiary dark:bg-dark-surface-tertiary text-text-muted dark:text-dark-text-muted">{stockDetails.exchange}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary dark:text-dark-text-secondary">{stockDetails.name}</p>
                  {stockDetails.sector && (
                    <span className="text-xs text-text-muted dark:text-dark-text-muted">{stockDetails.sector}</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-text-primary dark:text-dark-text-primary">
                    ${stockDetails.price.toFixed(2)}
                  </div>
                  <div className={`text-sm font-semibold ${isPositive ? 'text-profit' : 'text-loss'}`}>
                    {isPositive ? '+' : ''}{stockDetails.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Open', value: `$${stockDetails.open.toFixed(2)}` },
                  { label: 'High', value: `$${stockDetails.high.toFixed(2)}`, color: 'text-profit' },
                  { label: 'Low', value: `$${stockDetails.low.toFixed(2)}`, color: 'text-loss' },
                  { label: 'Volume', value: formatVolume(stockDetails.volume) },
                  { label: 'Market Cap', value: formatMarketCap(stockDetails.marketCap) },
                ].map((item) => (
                  <div key={item.label} className="p-2 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary text-center">
                    <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">{item.label}</span>
                    <span className={`text-sm font-bold ${item.color ?? 'text-text-primary dark:text-dark-text-primary'}`}>{item.value}</span>
                  </div>
                ))}
              </div>

              {stockDetails.description && (
                <p className="mt-3 text-xs text-text-muted dark:text-dark-text-muted leading-relaxed">
                  {stockDetails.description}
                </p>
              )}
            </div>
          ) : null}

          {/* Chart */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-text-muted dark:text-dark-text-muted">Price History</span>
              <div className="flex gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${timeframe === tf ? 'bg-primary text-white' : 'text-text-muted dark:text-dark-text-muted hover:text-text-primary dark:hover:text-dark-text-primary'}`}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <FullChart symbol={selectedSymbol} timeframe={timeframe} />
          </div>
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
