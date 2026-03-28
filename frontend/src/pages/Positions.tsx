import React, { useState, useEffect, useCallback, type ReactElement } from 'react';

import { PositionsSummary, OpenPositionsTable, ClosedPositionsTable } from '../components/positions';
import { LoadingSpinner } from '../components/common';
import { fetchPositions } from '../services/api';

import type { Position } from '../types';
import type { ClosedPosition } from '../mocks/positionsData';

interface IbkrPosition {
  ticker: string;
  position: number;
  avgPrice: number;
  mktPrice: number;
  unrealizedPnl: number;
}

function Positions(): ReactElement {
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedPositions] = useState<ClosedPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  const loadLiveData = useCallback(async (): Promise<void> => {
    try {
      const positions = await fetchPositions() as IbkrPosition[];

      if (Array.isArray(positions)) {
        const mapped: Position[] = positions.map((p) => ({
          symbol: p.ticker,
          shares: p.position,
          avgEntryPrice: p.avgPrice,
          currentPrice: p.mktPrice,
          unrealizedPnl: p.unrealizedPnl,
          unrealizedPnlPercent: p.avgPrice > 0
            ? ((p.mktPrice - p.avgPrice) / p.avgPrice) * 100
            : 0,
        }));
        setOpenPositions(mapped);
        setIsLive(true);
      }
    } catch {
      // Backend unreachable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(loadLiveData, 30000);
    return () => clearInterval(interval);
  }, [loadLiveData]);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading positions..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
          Positions & P&L
        </h1>
        {isLive && (
          <span className="px-3 py-1 bg-profit-light dark:bg-green-900/30 border border-profit/30 rounded-full text-xs font-medium text-green-800 dark:text-green-200">
            Live
          </span>
        )}
      </div>

      <PositionsSummary
        openPositions={openPositions}
        closedPositions={closedPositions}
      />

      <OpenPositionsTable positions={openPositions} />

      <ClosedPositionsTable positions={closedPositions} />
    </div>
  );
}

export default Positions;
