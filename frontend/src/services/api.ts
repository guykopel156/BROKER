import axios from 'axios';

const API_BASE_URL = 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

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

// ── Health ──

export async function fetchHealth(): Promise<{ status: string }> {
  const response = await api.get('/health');
  return response.data;
}

export default api;
