import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to every request
api.interceptors.request.use((requestConfig) => {
  const token = localStorage.getItem('broker-token');
  if (token) {
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

// ── Auth Fetch Helper ──

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('broker-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  });
}

// ── Portfolio ──

export async function fetchPortfolioSummary(): Promise<unknown> {
  const response = await api.get('/portfolio/summary');
  return response.data.data;
}

export async function fetchPositions(): Promise<unknown> {
  const response = await api.get('/portfolio/positions');
  return response.data.data;
}

// ── Orders ──

export async function fetchLiveOrders(): Promise<unknown> {
  const response = await api.get('/orders');
  return response.data.data;
}

// ── Settings ──

export interface SettingsData {
  maxLossPercent: number;
  tradingIntervalMinutes: number;
  strategyPrompt: string;
  isPaperTrading: boolean;
  isClaudePaused: boolean;
  polygonTrialStart: string | null;
  polygonTrialDays: number;
}

export async function fetchSettings(): Promise<SettingsData> {
  const response = await api.get('/settings');
  return response.data.data;
}

export async function updateSettings(updates: Partial<SettingsData>): Promise<SettingsData> {
  const response = await api.patch('/settings', updates);
  return response.data.data;
}

// ── Engine ──

export async function pauseEngine(): Promise<void> {
  await api.post('/engine/pause');
}

export async function resumeEngine(): Promise<void> {
  await api.post('/engine/resume');
}

export async function runCycle(): Promise<void> {
  await api.post('/engine/run-cycle');
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  details: string;
  claudeResponse?: string;
  createdAt: string;
}

export async function fetchAuditLogs(limit: number = 50): Promise<AuditLogEntry[]> {
  const response = await api.get(`/engine/audit-logs?limit=${limit}`);
  return response.data.data;
}

// ── Trades ──

export interface TradeData {
  _id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  reasoning: string;
  status: 'pending' | 'filled' | 'failed' | 'in-progress';
  strategy: string;
  exchange: string;
  profitLoss?: number;
  outcomeLabel?: string;
  executedAt: string;
}

export async function fetchRecentTrades(limit: number = 20): Promise<TradeData[]> {
  const response = await api.get(`/trades/recent?limit=${limit}`);
  return response.data.data;
}

export async function fetchIbkrTradeHistory(): Promise<TradeData[]> {
  const response = await api.get('/trades/ibkr-history');
  return response.data.data;
}

export async function fetchAllTrades(symbol?: string, action?: string): Promise<TradeData[]> {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (action && action !== 'ALL') params.set('action', action);
  const response = await api.get(`/trades?${params.toString()}`);
  return response.data.data;
}

// ── Recommendations ──

export interface RecommendationData {
  _id: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  quantity: number;
  reasoning: string;
  confidence: number;
  strategy: string;
  holdType: 'short' | 'long';
  cycleTimestamp: string;
}

export async function fetchRecommendations(): Promise<RecommendationData[]> {
  const response = await api.get('/recommendations');
  return response.data.data;
}

// ── Screened Candidates ──

export interface CandidateData {
  ticker: string;
  price: number;
  changePct: number;
  volume: number;
  score: number;
  rsi: number | null;
  macdHist: number | null;
  momentum: 'bullish' | 'bearish' | 'neutral';
  atr: number | null;
  affordable: boolean;
  sharesBuyable: number;
}

export async function fetchCandidates(): Promise<CandidateData[]> {
  const response = await api.get('/engine/candidates');
  return response.data.data;
}

// ── Predictions ──

export interface PredictionData {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  quantity: number;
  currentPnl: number;
  currentPnlPercent: number;
  predictedEodPrice: number;
  predictedEodPnl: number;
  predictedEodPnlPercent: number;
  predictedTotalProfit: number;
  momentum: 'bullish' | 'bearish' | 'neutral';
  rsi: number | null;
  distanceToTarget: number | null;
  distanceToStop: number | null;
  confidence: number;
  strategy: string;
}

export interface PredictionsResponse {
  data: PredictionData[];
  totalPredictedProfit: number;
}

export async function fetchPredictions(): Promise<PredictionsResponse> {
  const response = await api.get('/recommendations/predictions');
  return response.data;
}

// ── Manual Orders ──

export interface ManualOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT';
  price?: number;
}

export async function placeManualOrder(params: ManualOrderParams): Promise<{ orderId: string; orderStatus: string }> {
  const response = await api.post('/orders', params);
  return response.data.data;
}

// ── Health ──

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await api.get('/health');
  return response.data;
}

export default api;
