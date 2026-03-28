import React, { useEffect, useRef, type ReactElement } from 'react';
import { createChart, type IChartApi, ColorType, CandlestickSeries } from 'lightweight-charts';

import { useThemeContext } from '../../context/ThemeContext';

import type { CandleData, TradeMarker } from '../../mocks/chartData';

interface StockChartProps {
  symbol: string;
  candles: CandleData[];
  entryPrice: number;
  markers: TradeMarker[];
}

function StockChart({ symbol, candles, entryPrice, markers }: StockChartProps): ReactElement {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const { isDark } = useThemeContext();

  useEffect(() => {
    if (!chartRef.current) return;

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

    series.setData(candles as any);

    // Entry price line
    series.createPriceLine({
      price: entryPrice,
      color: '#3b82f6',
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `Entry: $${entryPrice}`,
    });

    // Trade markers
    if (markers.length > 0) {
      (series as any).setMarkers(
        markers.map((m) => ({
          time: m.time,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        }))
      );
    }

    chart.timeScale().fitContent();

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
  }, [symbol, candles, entryPrice, markers, isDark]);

  return <div ref={chartRef} className="w-full" />;
}

export default StockChart;
