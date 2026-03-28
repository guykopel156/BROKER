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

const POLYGON_API_KEY = 'FEpGsxnBj8cLyc2L0r_teFNX2t0vD_3K';

function getDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function MiniChart({ symbol }: MiniChartProps): ReactElement {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const { isDark } = useThemeContext();
  const [hasData, setHasData] = useState(true);

  useEffect(() => {
    if (!chartRef.current || !symbol) return;

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

    const { from, to } = getDateRange();

    fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${POLYGON_API_KEY}`
    )
      .then((res) => res.json())
      .then((data) => {
        const results = data.results;
        if (!results || results.length === 0) {
          setHasData(false);
          return;
        }

        const candles: CandleBar[] = results.map((bar: { t: number; o: number; h: number; l: number; c: number }) => ({
          time: new Date(bar.t).toISOString().split('T')[0],
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
        }));

        series.setData(candles as never[]);
        chart.timeScale().fitContent();
      })
      .catch(() => {
        setHasData(false);
      });

    const handleResize = (): void => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [symbol, isDark]);

  if (!hasData) {
    return (
      <div className="h-[150px] flex items-center justify-center text-xs text-text-muted dark:text-dark-text-muted">
        No chart data for {symbol}
      </div>
    );
  }

  return <div ref={chartRef} className="w-full" />;
}

export default MiniChart;
