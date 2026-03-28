import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { Badge } from '../components/common';
import MiniChart from '../components/dashboard/MiniChart';
import { LoadingSpinner } from '../components/common';
import { fetchPositions } from '../services/api';

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
  mktValue: number;
}

interface StockHolding {
  symbol: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  marketValue: number;
  holdType: 'short-term' | 'long-term';
}

const LONG_TERM_SYMBOLS = ['SPY', 'QQQ', 'VOO', 'VTI', 'IVV', 'DIA', 'SCHD', 'VIG', 'AAPL', 'MSFT', 'GOOGL', 'BRK.B'];

function classifyHolding(symbol: string): 'short-term' | 'long-term' {
  return LONG_TERM_SYMBOLS.includes(symbol) ? 'long-term' : 'short-term';
}

function StockCard({ stock }: { stock: StockHolding }): ReactElement {
  const isProfit = stock.pnl >= 0;
  const isLongTerm = stock.holdType === 'long-term';

  return (
    <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-text-primary dark:text-dark-text-primary">{stock.symbol}</span>
          <Badge variant={isLongTerm ? 'filled' : 'pending'}>
            {isLongTerm ? 'Long-Term' : 'Short-Term'}
          </Badge>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-text-primary dark:text-dark-text-primary">
            ${stock.currentPrice.toFixed(2)}
          </div>
          <div className={`text-xs font-medium ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{stock.pnlPercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-3 p-3 rounded-lg bg-surface-secondary dark:bg-dark-surface-tertiary text-center">
        <div>
          <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Shares</span>
          <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">{stock.shares}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Avg Cost</span>
          <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">${stock.avgPrice.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">Market Value</span>
          <span className="text-sm font-bold text-text-primary dark:text-dark-text-primary">${stock.marketValue.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[10px] text-text-muted dark:text-dark-text-muted block">P&L</span>
          <span className={`text-sm font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}${stock.pnl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-lg overflow-hidden border border-border dark:border-dark-border">
        <MiniChart symbol={stock.symbol} />
      </div>

      {/* Hold type explanation */}
      <div className={`mt-3 px-3 py-2 rounded-md text-xs ${
        isLongTerm
          ? 'bg-profit-light/30 dark:bg-green-900/10 text-green-800 dark:text-green-200'
          : 'bg-warning-light/30 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-200'
      }`}>
        {isLongTerm
          ? 'Long-term hold — index/blue chip stock for steady growth. Hold unless fundamentals change.'
          : 'Short-term trade — momentum/swing play. Monitor closely for entry/exit signals.'}
      </div>
    </div>
  );
}

function MyStocks(): ReactElement {
  const [stocks, setStocks] = useState<StockHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'short-term' | 'long-term'>('all');

  const loadStocks = useCallback(async (): Promise<void> => {
    try {
      const positions = await fetchPositions() as IbkrPosition[];

      if (Array.isArray(positions)) {
        const mapped: StockHolding[] = positions.map((p) => ({
          symbol: p.ticker,
          shares: p.position,
          avgPrice: p.avgPrice,
          currentPrice: p.mktPrice,
          pnl: p.unrealizedPnl,
          pnlPercent: p.avgPrice > 0 ? ((p.mktPrice - p.avgPrice) / p.avgPrice) * 100 : 0,
          marketValue: p.mktValue ?? p.mktPrice * p.position,
          holdType: classifyHolding(p.ticker),
        }));
        setStocks(mapped);
      }
    } catch {
      // Not connected
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStocks();
    const interval = setInterval(loadStocks, 30000);
    return () => clearInterval(interval);
  }, [loadStocks]);

  const filteredStocks = filter === 'all'
    ? stocks
    : stocks.filter((s) => s.holdType === filter);

  const totalValue = stocks.reduce((sum, s) => sum + s.marketValue, 0);
  const totalPnl = stocks.reduce((sum, s) => sum + s.pnl, 0);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading your stocks..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">My Stocks</h1>
          <p className="text-sm text-text-muted dark:text-dark-text-muted mt-1">
            {stocks.length} holdings &middot; Value: ${totalValue.toFixed(2)} &middot;
            <span className={totalPnl >= 0 ? ' text-profit' : ' text-loss'}>
              {' '}{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </span>
          </p>
        </div>
        <div className="flex gap-1 bg-surface-tertiary dark:bg-dark-surface-tertiary rounded-lg p-1">
          {[
            { key: 'all' as const, label: 'All' },
            { key: 'short-term' as const, label: 'Short-Term' },
            { key: 'long-term' as const, label: 'Long-Term' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-primary text-white'
                  : 'text-text-secondary dark:text-dark-text-secondary hover:text-text-primary dark:hover:text-dark-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredStocks.length === 0 ? (
        <div className="bg-surface dark:bg-dark-surface-secondary border border-border dark:border-dark-border rounded-xl p-12 text-center">
          <p className="text-sm text-text-muted dark:text-dark-text-muted">
            {stocks.length === 0
              ? 'No stocks held. Your positions will appear here once trades are executed.'
              : 'No stocks match this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredStocks.map((stock) => (
            <StockCard key={stock.symbol} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
}

export default MyStocks;
