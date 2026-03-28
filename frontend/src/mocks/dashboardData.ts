import type {
  PortfolioSummary,
  Trade,
  WatchlistItem,
  EngineHealthData,
  EquityPoint,
} from '../types';

export const MOCK_PORTFOLIO_SUMMARY: PortfolioSummary = {
  totalValue: 1245678.9,
  todayPnl: 12450.23,
  todayPnlPercent: 1.01,
  totalPnl: 456789.01,
  totalPnlPercent: 57.83,
  openPositions: 8,
  availableCash: 125000.0,
};

export const MOCK_RECENT_TRADES: Trade[] = [
  {
    id: 'trade-001',
    symbol: 'AAPL',
    action: 'BUY',
    quantity: 100,
    price: 189.45,
    totalValue: 18945.0,
    reasoning:
      'Bullish momentum detected on 15m RSI cross above 40. Volume confirmation on 5m timeframe suggests entry for a tactical swing toward previous resistance at $192.10.',
    status: 'in-progress',
    timestamp: '14:22:04 EST',
    strategy: 'Momentum',
    exchange: 'NASDAQ',
    outcomeLabel: 'In Progress',
  },
  {
    id: 'trade-002',
    symbol: 'NVDA',
    action: 'SELL',
    quantity: 45,
    price: 892.12,
    totalValue: 2140.22,
    reasoning:
      'Profit target of 2.5% achieved. Selling into strength as hourly Bollinger Bands show over-extension. Position held for 3h 12m.',
    status: 'filled',
    timestamp: '13:45:12 EST',
    strategy: 'Exit Target Met',
    exchange: 'NASDAQ',
    profitLoss: 2140.22,
    outcomeLabel: 'Closed (Profit)',
  },
  {
    id: 'trade-003',
    symbol: 'TSLA',
    action: 'BUY',
    quantity: 200,
    price: 174.5,
    totalValue: 34900.0,
    reasoning:
      'Identifying double bottom formation on 1m chart. Entry triggered by MACD histogram turning positive. Stop loss set at $172.80 (tight risk).',
    status: 'pending',
    timestamp: '13:10:55 EST',
    strategy: 'Scalp Strategy',
    exchange: 'NASDAQ',
    outcomeLabel: 'Awaiting Execution',
  },
];

export const MOCK_WATCHLIST: WatchlistItem[] = [
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 512.45, changePercent: 0.45 },
  { symbol: 'QQQ', name: 'Nasdaq 100', price: 438.12, changePercent: 0.82 },
  { symbol: 'BTC-USD', name: 'Bitcoin', price: 67124.0, changePercent: -1.22 },
];

export const MOCK_ENGINE_HEALTH: EngineHealthData = {
  apiLatencyMs: 12,
  processingLoadPercent: 24,
  memoryContextTokens: 98200,
  exchange: 'NYSE',
};

export const MOCK_EQUITY_CURVE: EquityPoint[] = [
  { time: '09:30', value: 1233000 },
  { time: '10:00', value: 1235200 },
  { time: '10:30', value: 1231800 },
  { time: '11:00', value: 1237500 },
  { time: '11:30', value: 1239100 },
  { time: '12:00', value: 1236400 },
  { time: '12:30', value: 1238900 },
  { time: '13:00', value: 1241200 },
  { time: '13:30', value: 1243800 },
  { time: '14:00', value: 1245678 },
];
