export interface IbkrAuthStatus {
  authenticated: boolean;
  competing: boolean;
  connected: boolean;
  message: string;
}

export interface IbkrAccount {
  id: string;
  accountId: string;
  currency: string;
  type: string;
}

export interface IbkrAccountSummary {
  totalCashValue: number;
  netLiquidation: number;
  unrealizedPnl: number;
  realizedPnl: number;
  buyingPower: number;
}

export interface IbkrPosition {
  acctId: string;
  conid: number;
  contractDesc: string;
  position: number;
  mktPrice: number;
  mktValue: number;
  avgCost: number;
  avgPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  currency: string;
  ticker: string;
}

export interface IbkrOrderRequest {
  acctId: string;
  conid: number;
  orderType: 'MKT' | 'LMT';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  tif: 'DAY' | 'GTC';
}

export interface IbkrOrderResponse {
  orderId: string;
  orderStatus: string;
  warningMessage?: string;
}

export interface IbkrOrderStatus {
  orderId: string;
  status: string;
  filledQuantity: number;
  remainingQuantity: number;
  avgPrice: number;
  lastExecutionTime: string;
}

export interface IbkrTradeRecord {
  execution_id: string;
  symbol: string;
  side: string;
  size: number;
  price: number;
  order_ref: string;
  account: string;
  conid: number;
  exchange: string;
  net_amount: number;
  trade_time: string;
  trade_time_r: number;
  commission: number;
  realized_pnl: number;
}
