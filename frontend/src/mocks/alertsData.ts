export interface AlertItem {
  id: string;
  type: 'trade' | 'loss-limit' | 'engine-paused' | 'error';
  message: string;
  timestamp: string;
}

export const MOCK_ALERTS: AlertItem[] = [
  { id: 'a1', type: 'trade', message: 'BUY 100 shares of AAPL @ $189.45', timestamp: '2026-03-28 14:22:04' },
  { id: 'a2', type: 'trade', message: 'SELL 45 shares of NVDA @ $892.12 (+$2,140.22)', timestamp: '2026-03-28 13:45:12' },
  { id: 'a3', type: 'trade', message: 'BUY 200 shares of TSLA @ $174.50', timestamp: '2026-03-28 13:10:55' },
  { id: 'a4', type: 'trade', message: 'BUY 50 shares of MSFT @ $420.30', timestamp: '2026-03-28 11:30:22' },
  { id: 'a5', type: 'trade', message: 'SELL 75 shares of GOOGL @ $158.90 (-$262.50)', timestamp: '2026-03-28 10:15:08' },
  { id: 'a6', type: 'engine-paused', message: 'Claude trading resumed by user', timestamp: '2026-03-28 09:30:00' },
  { id: 'a7', type: 'loss-limit', message: 'Max loss limit reached (-3.2%). Trading paused.', timestamp: '2026-03-27 15:58:30' },
  { id: 'a8', type: 'error', message: 'IBKR session expired. Auto-reauthenticating...', timestamp: '2026-03-27 14:00:12' },
  { id: 'a9', type: 'trade', message: 'BUY 30 shares of META @ $512.80', timestamp: '2026-03-27 13:45:33' },
  { id: 'a10', type: 'engine-paused', message: 'Claude trading paused by user', timestamp: '2026-03-27 12:00:00' },
];
