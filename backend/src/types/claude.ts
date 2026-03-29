// ── Input types (sent to Claude) ──

export interface CycleInput {
  account: AccountInput;
  watchlist: WatchlistItem[];
  previousCycleSummary: PreviousCycleEntry[];
}

export interface AccountInput {
  availableCash: number;
  totalPortfolioValue: number;
  openPositions: OpenPositionInput[];
}

export interface OpenPositionInput {
  ticker: string;
  direction: 'LONG';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number | null;
  openDate: string;
  strategyType: 'SHORT' | 'LONG';
  rationale: string;
}

export interface WatchlistItem {
  ticker: string;
  price: number;
  volume: number;
  avgVolume10d: number | null;
  rsi14: number | null;
  macdLine: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  ma20: number | null;
  ma50: number | null;
  ma200: number | null;
  atr14: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  changePct1d: number;
  changePct5d: number | null;
  sentimentScore: number | null;
}

export interface PreviousCycleEntry {
  ticker: string;
  action: string;
  reasoning: string;
  outcome: string;
}

// ── Output types (parsed from Claude response) ──

export interface CycleOutput {
  cycleSummary: CycleSummaryOutput;
  positionReview: PositionReviewEntry[];
  newTrades: NewTradeEntry[];
  watchlistSkipped: WatchlistSkippedEntry[];
  stabilityLog: StabilityLogEntry[];
  alerts: string[];
}

export interface CycleSummaryOutput {
  totalPortfolioValue: number;
  availableCash: number;
  reservedCash: number;
  deployableCash: number;
  freedCashFromSells: number;
  totalDeployable: number;
  accountTier: 'micro' | 'small' | 'medium' | 'large';
  shortTermBudget: number;
  longTermBudget: number;
}

export interface PositionReviewEntry {
  ticker: string;
  action: 'HOLD' | 'SELL';
  sellReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'THESIS_BROKEN' | 'SUPERIOR_OPPORTUNITY' | null;
  entryPrice: number;
  currentPrice: number;
  pnlPct: number;
  reasoning: string;
}

export interface NewTradeEntry {
  action: 'BUY';
  ticker: string;
  strategyType: 'SHORT' | 'LONG';
  strategyLabel: string;
  price: number;
  quantity: number;
  allocatedDollars: number;
  stopLoss: number;
  takeProfit: number | null;
  confidence: number;
  signalsTriggered: string[];
  reasoning: string;
}

export interface WatchlistSkippedEntry {
  ticker: string;
  reason: string;
}

export interface StabilityLogEntry {
  ticker: string;
  previousAction: string;
  priceChangeSinceLastCycle: string;
  decision: 'KEEP' | 'DROP';
  justification: string;
}

// ── Legacy types (kept for backward compatibility) ──

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
