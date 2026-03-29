import type { Request, Response } from 'express';

import { Recommendation } from '../models';
import marketDataService from '../services/marketDataService';
import { calculateAllIndicators } from '../utils/technicalAnalysis';
import type { Candle } from '../utils/technicalAnalysis';

async function getLatestRecommendations(_req: Request, res: Response): Promise<void> {
  // Try active recommendations first (new system)
  const active = await Recommendation.find({ isActive: true })
    .sort({ confidence: -1 })
    .limit(20)
    .lean();

  if (active.length > 0) {
    res.json({ data: active });
    return;
  }

  // Fallback: latest cycle (old system or no active recs)
  const mostRecent = await Recommendation.findOne()
    .sort({ cycleTimestamp: -1 })
    .select('cycleTimestamp')
    .lean();

  if (!mostRecent) {
    res.json({ data: [] });
    return;
  }

  const latest = await Recommendation.find({
    cycleTimestamp: mostRecent.cycleTimestamp,
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ data: latest });
}

async function getAllRecommendations(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 50;
  const all = await Recommendation.find()
    .sort({ cycleTimestamp: -1 })
    .limit(limit);

  res.json({ data: all });
}

interface StockPrediction {
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

async function getPredictions(_req: Request, res: Response): Promise<void> {
  const activeRecs = await Recommendation.find({ isActive: true, action: 'BUY' }).lean();

  if (activeRecs.length === 0) {
    res.json({ data: [], totalPredictedProfit: 0 });
    return;
  }

  const allStocks = await marketDataService.getAllStocks();
  const predictions: StockPrediction[] = [];
  let totalPredictedProfit = 0;

  for (const rec of activeRecs) {
    const stock = allStocks.find((s) => s.T === rec.symbol);
    if (!stock) continue;

    const currentPrice = stock.c;
    const entryPrice = rec.entryPrice || currentPrice;
    const quantity = rec.quantity || 0;

    // Current P&L
    const currentPnl = (currentPrice - entryPrice) * quantity;
    const currentPnlPercent = entryPrice > 0
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : 0;

    // Get indicators for prediction
    let rsi: number | null = null;
    let atr: number | null = null;
    let momentum: 'bullish' | 'bearish' | 'neutral' = 'neutral';

    try {
      const today = new Date();
      const fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 60);
      const candles = await marketDataService.getCandles(
        rec.symbol, 'day',
        fromDate.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );

      if (candles.length > 0) {
        const indicators = calculateAllIndicators(candles as Candle[]);
        rsi = indicators.rsi14;
        atr = indicators.atr14;

        if (indicators.macdHistogram !== null) {
          momentum = indicators.macdHistogram > 0 ? 'bullish' : 'bearish';
        }
      }
    } catch {
      // Use basic data if candles fail
    }

    // Predict end-of-day price
    const dailyChange = stock.o > 0 ? ((stock.c - stock.o) / stock.o) * 100 : 0;
    const dailyAtr = atr ?? Math.abs(stock.h - stock.l);

    let predictedMove = 0;
    if (momentum === 'bullish') {
      // Trending up — predict continued move in same direction
      predictedMove = dailyAtr * 0.5;
    } else if (momentum === 'bearish') {
      // Trending down
      predictedMove = -dailyAtr * 0.3;
    } else {
      // Neutral — slight move based on today's direction
      predictedMove = dailyChange > 0 ? dailyAtr * 0.2 : -dailyAtr * 0.2;
    }

    // RSI adjustments
    if (rsi !== null) {
      if (rsi < 30) predictedMove += dailyAtr * 0.3; // Oversold bounce
      if (rsi > 70) predictedMove -= dailyAtr * 0.3; // Overbought pullback
    }

    const predictedEodPrice = Math.max(0.001, currentPrice + predictedMove);
    const predictedEodPnl = (predictedEodPrice - entryPrice) * quantity;
    const predictedEodPnlPercent = entryPrice > 0
      ? ((predictedEodPrice - entryPrice) / entryPrice) * 100
      : 0;
    const predictedTotalProfit = predictedEodPnl;

    // Distance to targets
    const distanceToTarget = rec.takeProfit
      ? ((rec.takeProfit - currentPrice) / currentPrice) * 100
      : null;
    const distanceToStop = rec.stopLoss
      ? ((currentPrice - rec.stopLoss) / currentPrice) * 100
      : null;

    totalPredictedProfit += predictedTotalProfit;

    predictions.push({
      symbol: rec.symbol,
      entryPrice,
      currentPrice,
      stopLoss: rec.stopLoss ?? null,
      takeProfit: rec.takeProfit ?? null,
      quantity,
      currentPnl,
      currentPnlPercent,
      predictedEodPrice,
      predictedEodPnl,
      predictedEodPnlPercent,
      predictedTotalProfit,
      momentum,
      rsi,
      distanceToTarget,
      distanceToStop,
      confidence: rec.confidence,
      strategy: rec.strategy,
    });
  }

  res.json({ data: predictions, totalPredictedProfit });
}

export { getLatestRecommendations, getAllRecommendations, getPredictions };
