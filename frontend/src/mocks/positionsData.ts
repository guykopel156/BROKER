import type { Position } from '../types';

export interface ClosedPosition {
  symbol: string;
  shares: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
  realizedPnlPercent: number;
  holdDuration: string;
  closedAt: string;
}

export const MOCK_OPEN_POSITIONS: Position[] = [
  { symbol: 'AAPL', shares: 100, avgEntryPrice: 189.45, currentPrice: 192.10, unrealizedPnl: 265.0, unrealizedPnlPercent: 1.4 },
  { symbol: 'TSLA', shares: 200, avgEntryPrice: 174.50, currentPrice: 171.80, unrealizedPnl: -540.0, unrealizedPnlPercent: -1.55 },
  { symbol: 'MSFT', shares: 50, avgEntryPrice: 420.30, currentPrice: 425.60, unrealizedPnl: 265.0, unrealizedPnlPercent: 1.26 },
  { symbol: 'META', shares: 30, avgEntryPrice: 512.80, currentPrice: 540.90, unrealizedPnl: 843.0, unrealizedPnlPercent: 5.48 },
  { symbol: 'V', shares: 40, avgEntryPrice: 278.20, currentPrice: 282.45, unrealizedPnl: 170.0, unrealizedPnlPercent: 1.53 },
];

export const MOCK_CLOSED_POSITIONS: ClosedPosition[] = [
  { symbol: 'NVDA', shares: 45, entryPrice: 870.00, exitPrice: 892.12, realizedPnl: 995.4, realizedPnlPercent: 2.54, holdDuration: '3h 12m', closedAt: '2026-03-28 13:45' },
  { symbol: 'GOOGL', shares: 75, entryPrice: 162.40, exitPrice: 158.90, realizedPnl: -262.5, realizedPnlPercent: -2.15, holdDuration: '1d 4h', closedAt: '2026-03-28 10:15' },
  { symbol: 'META', shares: 25, entryPrice: 498.50, exitPrice: 512.80, realizedPnl: 357.5, realizedPnlPercent: 2.87, holdDuration: '2d 1h', closedAt: '2026-03-27 15:45' },
  { symbol: 'AMZN', shares: 60, entryPrice: 187.20, exitPrice: 186.45, realizedPnl: -45.0, realizedPnlPercent: -0.4, holdDuration: '2d 0h', closedAt: '2026-03-27 10:05' },
  { symbol: 'JPM', shares: 100, entryPrice: 195.80, exitPrice: 201.30, realizedPnl: 550.0, realizedPnlPercent: 2.81, holdDuration: '5h 30m', closedAt: '2026-03-26 15:30' },
  { symbol: 'SPY', shares: 150, entryPrice: 510.20, exitPrice: 512.45, realizedPnl: 337.5, realizedPnlPercent: 0.44, holdDuration: '1h 15m', closedAt: '2026-03-26 11:20' },
];
