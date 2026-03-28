import React, { useEffect, useRef, useState, type ReactElement } from 'react';
import { createChart, type IChartApi, ColorType, CandlestickSeries } from 'lightweight-charts';

import { useThemeContext } from '../../context/ThemeContext';

interface CandleBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MiniChartProps {
  symbol: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15000;

async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<CandleBar[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.data && result.data.length > 0) {
        return result.data;
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!chartRef.current || !symbol) return;

    let isCancelled = false;

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
        visible: false,
      },
      crosshair: {
        horzLine: { visible: false },
        vertLine: { visible: false },
      },
    });

    chartInstanceRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    fetchWithRetry(`http://localhost:4000/api/market/${symbol}/candles?days=30`)
      .then((candles) => {
        if (isCancelled) return;

        if (candles.length === 0) {
          setStatus('error');
          return;
        }

        series.setData(candles as never[]);
        chart.timeScale().fitContent();
        setStatus('ready');
      });

    const handleResize = (): void => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isCancelled = true;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [symbol, isDark]);

  if (status === 'error') {
    return (
      <div className="h-[150px] flex items-center justify-center text-xs text-text-muted dark:text-dark-text-muted">
        Chart unavailable — API rate limited. Will retry next refresh.
      </div>
    );
  }

  return <div ref={chartRef} className="w-full" style={{ minHeight: 150 }} />;
}

export default MiniChart;
