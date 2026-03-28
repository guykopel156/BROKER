import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

interface TickerItem {
  symbol: string;
  price: number;
  changePercent: number;
}

const TICKER_SYMBOLS = ['SPY', 'QQQ', 'NVDA'];

function isMarketOpen(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();

  // Market: Mon-Fri, 9:30 AM - 4:00 PM ET (14:30 - 21:00 UTC)
  if (day === 0 || day === 6) return false;

  const utcTime = utcHour * 60 + utcMinute;
  const marketOpen = 14 * 60 + 30;
  const marketClose = 21 * 60;

  return utcTime >= marketOpen && utcTime < marketClose;
}

function getMarketCloseTime(): string {
  const now = new Date();
  const day = now.getUTCDay();

  if (day === 6) return 'Opens Monday 16:30 IL';
  if (day === 0) return 'Opens today 16:30 IL';
  if (day === 5 && !isMarketOpen()) return 'Opens Monday 16:30 IL';

  if (isMarketOpen()) return 'Closes 23:00 IL';
  return 'Opens 16:30 IL';
}

function MarketStatusBar(): ReactElement {
  const [isOpen, setIsOpen] = useState(isMarketOpen());
  const [tickers, setTickers] = useState<TickerItem[]>([]);

  const fetchTickers = useCallback(async (): Promise<void> => {
    try {
      const results: TickerItem[] = [];

      for (const symbol of TICKER_SYMBOLS) {
        try {
          const token = localStorage.getItem('broker-token');
          const response = await fetch(
            `http://localhost:4000/api/market/${symbol}/price`,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );
          const data = await response.json();
          const result = data.data;

          if (result) {
            results.push({
              symbol,
              price: result.price,
              changePercent: result.changePercent ?? 0,
            });
          }
        } catch {
          // Skip failed tickers
        }
      }

      setTickers(results);
    } catch {
      // Keep empty
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setIsOpen(isMarketOpen()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchTickers();
    const interval = setInterval(fetchTickers, 300000);
    return () => clearInterval(interval);
  }, [fetchTickers]);

  const tickerContent = tickers.length > 0 ? [...tickers, ...tickers] : [];

  return (
    <div className="bg-dark-surface dark:bg-dark-surface border-b border-border dark:border-dark-border">
      <div className="max-w-7xl mx-auto px-4 flex items-center h-8 gap-4">
        {/* Market Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-profit animate-pulse' : 'bg-loss'}`} />
          <span className={`text-xs font-semibold ${isOpen ? 'text-profit' : 'text-loss'}`}>
            {isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
          </span>
          <span className="text-xs text-dark-text-muted hidden sm:inline">
            {getMarketCloseTime()}
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-dark-border flex-shrink-0" />

        {/* Scrolling Ticker Tape */}
        <div className="flex-1 overflow-hidden relative">
          {tickerContent.length > 0 && (
            <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
              {tickerContent.map((ticker, index) => {
                const isPositive = ticker.changePercent >= 0;
                return (
                  <div key={`${ticker.symbol}-${index}`} className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-dark-text-primary">{ticker.symbol}</span>
                    <span className="text-xs text-dark-text-secondary">${ticker.price.toFixed(2)}</span>
                    <span className={`text-xs font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                      {isPositive ? '+' : ''}{ticker.changePercent.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketStatusBar;
