export interface TradeUpdate {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  reasoning: string;
  status: 'pending' | 'filled' | 'failed' | 'in-progress';
  strategy: string;
  timestamp: string;
}

export interface PnlUpdate {
  totalValue: number;
  todayPnl: number;
  todayPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  openPositions: number;
  availableCash: number;
}

export interface PositionUpdate {
  symbol: string;
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface AlertPayload {
  type: 'trade' | 'loss-limit' | 'engine-paused' | 'error';
  message: string;
  timestamp: string;
}

export interface ServerToClientEvents {
  'trade:new': (data: TradeUpdate) => void;
  'trade:updated': (data: TradeUpdate) => void;
  'pnl:update': (data: PnlUpdate) => void;
  'position:update': (data: PositionUpdate[]) => void;
  'alert': (data: AlertPayload) => void;
  'engine:status': (data: { isPaused: boolean }) => void;
}

export interface ClientToServerEvents {
  'engine:pause': () => void;
  'engine:resume': () => void;
}
