export type TradeAction = 'BUY' | 'SELL';

export type TradeStatus = 'pending' | 'filled' | 'failed' | 'in-progress';

export interface Trade {
  id: string;
  symbol: string;
  action: TradeAction;
  quantity: number;
  price: number;
  totalValue: number;
  reasoning: string;
  status: TradeStatus;
  timestamp: string;
  strategy: string;
  exchange: string;
  profitLoss?: number;
  outcomeLabel?: string;
}

export interface Position {
  symbol: string;
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface PortfolioSummary {
  totalValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  openPositions: number;
  availableCash: number;
}

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
}

export interface EngineHealthData {
  apiLatencyMs: number;
  processingLoadPercent: number;
  memoryContextTokens: number;
  exchange: string;
}

export interface EquityPoint {
  time: string;
  value: number;
}
