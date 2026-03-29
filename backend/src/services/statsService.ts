import { Recommendation } from '../models';

interface TradeStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  bestTrade: { symbol: string; pnlPercent: number } | null;
  worstTrade: { symbol: string; pnlPercent: number } | null;
  totalRealizedPnl: number;
  avgHoldTimeHours: number;
  streakCurrent: number;
  streakType: 'win' | 'loss' | 'none';
}

async function getTradeStats(): Promise<TradeStats> {
  const closedRecs = await Recommendation.find({
    isActive: false,
    action: 'BUY',
    entryPrice: { $gt: 0 },
    closedAt: { $ne: null },
  })
    .sort({ closedAt: -1 })
    .lean();

  if (closedRecs.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      bestTrade: null,
      worstTrade: null,
      totalRealizedPnl: 0,
      avgHoldTimeHours: 0,
      streakCurrent: 0,
      streakType: 'none',
    };
  }

  let wins = 0;
  let losses = 0;
  let totalWinPct = 0;
  let totalLossPct = 0;
  let totalPnl = 0;
  let totalHoldMs = 0;
  let bestTrade: { symbol: string; pnlPercent: number } | null = null;
  let worstTrade: { symbol: string; pnlPercent: number } | null = null;

  interface ClosedRec {
    symbol: string;
    entryPrice: number;
    highestPrice: number;
    quantity: number;
    closedAt: Date;
    cycleTimestamp: Date;
    closeReason: string | null;
  }

  const tradeResults: Array<{ isWin: boolean }> = [];

  for (const rec of closedRecs as unknown as ClosedRec[]) {
    // Estimate exit price from close reason
    let exitPrice = rec.highestPrice || rec.entryPrice;

    if (rec.closeReason?.includes('STOP_LOSS') || rec.closeReason?.includes('TRAILING_STOP')) {
      // Lost money — estimate exit at stop
      exitPrice = rec.entryPrice * 0.85;
    } else if (rec.closeReason?.includes('TAKE_PROFIT')) {
      exitPrice = rec.highestPrice || rec.entryPrice * 1.2;
    } else if (rec.closeReason?.includes('BUDGET_FIX') || rec.closeReason?.includes('SYSTEM_MIGRATION') || rec.closeReason?.includes('STRATEGY_UPDATE')) {
      continue; // Not a real trade
    }

    const pnlPercent = rec.entryPrice > 0
      ? ((exitPrice - rec.entryPrice) / rec.entryPrice) * 100
      : 0;
    const pnlDollar = (exitPrice - rec.entryPrice) * rec.quantity;

    const isWin = pnlPercent > 0;
    tradeResults.push({ isWin });

    if (isWin) {
      wins++;
      totalWinPct += pnlPercent;
    } else {
      losses++;
      totalLossPct += Math.abs(pnlPercent);
    }

    totalPnl += pnlDollar;

    if (rec.closedAt && rec.cycleTimestamp) {
      totalHoldMs += new Date(rec.closedAt).getTime() - new Date(rec.cycleTimestamp).getTime();
    }

    if (!bestTrade || pnlPercent > bestTrade.pnlPercent) {
      bestTrade = { symbol: rec.symbol, pnlPercent };
    }
    if (!worstTrade || pnlPercent < worstTrade.pnlPercent) {
      worstTrade = { symbol: rec.symbol, pnlPercent };
    }
  }

  // Calculate current streak
  let streakCurrent = 0;
  let streakType: 'win' | 'loss' | 'none' = 'none';

  if (tradeResults.length > 0) {
    streakType = tradeResults[0].isWin ? 'win' : 'loss';
    for (const result of tradeResults) {
      if ((streakType === 'win' && result.isWin) || (streakType === 'loss' && !result.isWin)) {
        streakCurrent++;
      } else {
        break;
      }
    }
  }

  const totalReal = wins + losses;

  return {
    totalTrades: totalReal,
    wins,
    losses,
    winRate: totalReal > 0 ? (wins / totalReal) * 100 : 0,
    avgWinPercent: wins > 0 ? totalWinPct / wins : 0,
    avgLossPercent: losses > 0 ? totalLossPct / losses : 0,
    bestTrade,
    worstTrade,
    totalRealizedPnl: totalPnl,
    avgHoldTimeHours: totalReal > 0 ? totalHoldMs / totalReal / (1000 * 60 * 60) : 0,
    streakCurrent,
    streakType,
  };
}

export { getTradeStats };
export type { TradeStats };
