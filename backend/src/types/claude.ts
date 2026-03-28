export interface MarketContext {
  portfolio: PortfolioContext;
  marketData: StockData[];
  news: NewsItem[];
  watchlist: string[];
}

export interface PortfolioContext {
  totalValue: number;
  availableCash: number;
  todayPnl: number;
  openPositions: PositionContext[];
}

export interface PositionContext {
  symbol: string;
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface StockData {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePercent: number;
  rsi?: number;
  macd?: number;
  movingAvg20?: number;
  movingAvg50?: number;
}

export interface NewsItem {
  title: string;
  source: string;
  symbol?: string;
  publishedAt: string;
}

export type TradeDecisionAction = 'BUY' | 'SELL' | 'HOLD';

export interface TradeDecision {
  action: TradeDecisionAction;
  symbol: string;
  quantity: number;
  reasoning: string;
  confidence: number;
  strategy: string;
}
