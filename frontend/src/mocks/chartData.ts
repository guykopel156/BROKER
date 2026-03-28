export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface TradeMarker {
  time: string;
  position: 'aboveBar' | 'belowBar';
  color: string;
  shape: 'arrowUp' | 'arrowDown';
  text: string;
}

interface StockChartData {
  symbol: string;
  entryPrice: number;
  candles: CandleData[];
  markers: TradeMarker[];
}

function generateCandles(basePrice: number, days: number): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice;
  const startDate = new Date('2026-03-01');

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (Math.random() - 0.48) * price * 0.03;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.01;
    const low = Math.min(open, close) - Math.random() * price * 0.01;

    candles.push({
      time: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });

    price = close;
  }

  return candles;
}

export const MOCK_CHART_DATA: StockChartData[] = [
  {
    symbol: 'AAPL',
    entryPrice: 189.45,
    candles: generateCandles(185, 28),
    markers: [
      { time: '2026-03-20', position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY 100' },
    ],
  },
  {
    symbol: 'TSLA',
    entryPrice: 174.50,
    candles: generateCandles(170, 28),
    markers: [
      { time: '2026-03-18', position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY 200' },
    ],
  },
  {
    symbol: 'MSFT',
    entryPrice: 420.30,
    candles: generateCandles(415, 28),
    markers: [
      { time: '2026-03-22', position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY 50' },
    ],
  },
  {
    symbol: 'META',
    entryPrice: 512.80,
    candles: generateCandles(500, 28),
    markers: [
      { time: '2026-03-15', position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY 30' },
      { time: '2026-03-21', position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL 25' },
    ],
  },
  {
    symbol: 'NVDA',
    entryPrice: 870.00,
    candles: generateCandles(860, 28),
    markers: [
      { time: '2026-03-17', position: 'belowBar', color: '#22c55e', shape: 'arrowUp', text: 'BUY 45' },
      { time: '2026-03-24', position: 'aboveBar', color: '#ef4444', shape: 'arrowDown', text: 'SELL 45' },
    ],
  },
];
