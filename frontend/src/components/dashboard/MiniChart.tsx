import React, { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
import { createChart, type IChartApi, ColorType, LineSeries } from 'lightweight-charts';

import { useThemeContext } from '../../context/ThemeContext';

interface MiniChartProps {
  symbol: string;
}

type ChartTimeframe = '1W' | '1M' | '3M' | '6M';

const TIMEFRAME_DAYS: Record<ChartTimeframe, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
};

const TIMEFRAMES: ChartTimeframe[] = ['1W', '1M', '3M', '6M'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15000;

interface LinePoint {
  time: string;
  value: number;
}

async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<LinePoint[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.data && result.data.length > 0) {
        return result.data.map((bar: { time: string; close: number }) => ({
          time: bar.time,
          value: bar.close,
        }));
      }

      if (result.error && attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
    } catch {
      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
    }
  }
  return [];
}

function MiniChart({ symbol }: MiniChartProps): ReactElement {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const { isDark } = useThemeContext();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1M');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const handleTimeframeChange = useCallback((tf: ChartTimeframe): void => {
    setTimeframe(tf);
    setStatus('loading');
  }, []);

  useEffect(() => {
    if (!chartRef.current || !symbol) return;

    let isCancelled = false;

    // Clean up previous chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor: isDark ? '#64748b' : '#94a3b8',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: gridColor, style: 3 },
      },
      width: chartRef.current.clientWidth,
      height: 150,
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
      },
    });

    chartInstanceRef.current = chart;

    const days = TIMEFRAME_DAYS[timeframe];

    fetchWithRetry(`http://localhost:4000/api/market/${symbol}/candles?days=${days}`)
      .then((points) => {
        if (isCancelled) return;

        if (points.length === 0) {
          setStatus('error');
          return;
        }

        const firstValue = points[0].value;
        const lastValue = points[points.length - 1].value;
        const isPositive = lastValue >= firstValue;

        const series = chart.addSeries(LineSeries, {
          color: isPositive ? '#22c55e' : '#ef4444',
          lineWidth: 2,
          crosshairMarkerVisible: true,
          priceLineVisible: false,
        });

        series.setData(points as never[]);
        chart.timeScale().fitContent();
        setStatus('ready');
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
  }, [symbol, isDark, timeframe]);

  return (
    <div>
      {/* Timeframe selector */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border dark:border-dark-border">
        <span className="text-xs font-medium text-text-muted dark:text-dark-text-muted">{symbol} Price</span>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => handleTimeframeChange(tf)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
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

      {/* Chart */}
      {status === 'error' ? (
        <div className="h-[150px] flex items-center justify-center text-xs text-text-muted dark:text-dark-text-muted">
          Chart unavailable — will retry next refresh
        </div>
      ) : (
        <div ref={chartRef} className="w-full" style={{ minHeight: 150 }} />
      )}
    </div>
  );
}

export default MiniChart;
