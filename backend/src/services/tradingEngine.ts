import config from '../config';
import { Settings, Trade, Recommendation } from '../models';
import ibkrService from './ibkrService';
import claudeService from './claudeService';
import marketDataService from './marketDataService';
import { createAuditLog } from './auditLogService';
// WhatsApp alerts removed — now only sends at market open/close via scheduler
import {
  emitTradeNew,
  emitPnlUpdate,
  emitAlert,
  emitEngineStatus,
} from './socketService';

import type { ISettings } from '../models';
import type { MarketContext, TradeDecision } from '../types/claude';

// Reference tickers for market context — Claude can recommend ANY stock
const MARKET_CONTEXT_TICKERS = ['SPY', 'QQQ', 'NVDA'];

let engineTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let lastCycleTime: Date | null = null;
let currentIntervalMinutes = 15;

// ── Engine Control ──

async function startEngine(): Promise<void> {
  if (engineTimer) return;

  if (!config.ibkrAccountId) {
    console.log('Trading engine skipped: IBKR_ACCOUNT_ID not configured.');
    return;
  }

  if (!config.anthropicApiKey) {
    console.log('Trading engine skipped: ANTHROPIC_API_KEY not configured.');
    return;
  }

  if (!config.polygonApiKey) {
    console.log('Trading engine skipped: POLYGON_API_KEY not configured.');
    return;
  }

  const settings = await getSettings();

  if (settings.isClaudePaused) {
    console.log('Trading engine is paused. Not starting.');
    return;
  }

  const intervalMs = settings.tradingIntervalMinutes * 60 * 1000;
  currentIntervalMinutes = settings.tradingIntervalMinutes;

  console.log(`Trading engine started. Interval: ${settings.tradingIntervalMinutes} min`);

  await runCycle();

  engineTimer = setInterval(() => {
    runCycle().catch((error) => {
      console.error('Trading cycle error:', error);
      createAuditLog({
        action: 'ENGINE_ERROR',
        details: `Trading cycle failed: ${String(error)}`,
      });
    });
  }, intervalMs);
}

function stopEngine(): void {
  if (engineTimer) {
    clearInterval(engineTimer);
    engineTimer = null;
  }
  isRunning = false;
  console.log('Trading engine stopped.');
}

async function pauseEngine(): Promise<void> {
  stopEngine();
  const settings = await getSettings();
  settings.isClaudePaused = true;
  await settings.save();
  emitEngineStatus(true);

  await createAuditLog({
    action: 'ENGINE_PAUSED',
    details: 'Trading engine paused by user',
  });

  emitAlert({
    type: 'engine-paused',
    message: 'Claude trading has been paused',
    timestamp: new Date().toISOString(),
  });
}

async function resumeEngine(): Promise<void> {
  const settings = await getSettings();
  settings.isClaudePaused = false;
  await settings.save();
  emitEngineStatus(false);

  await createAuditLog({
    action: 'ENGINE_RESUMED',
    details: 'Trading engine resumed by user',
  });

  await startEngine();
}

// ── Market Hours ──

function isMarketOpen(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const day = now.getUTCDay();

  if (day === 0 || day === 6) return false;

  const utcTime = utcHour * 60 + utcMinute;
  const marketOpen = 14 * 60 + 30; // 9:30 AM ET = 14:30 UTC
  const marketClose = 21 * 60; // 4:00 PM ET = 21:00 UTC

  return utcTime >= marketOpen && utcTime < marketClose;
}

// ── Main Trading Cycle ──

async function runCycle(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  lastCycleTime = new Date();

  try {
    const settings = await getSettings();

    if (settings.isClaudePaused) {
      isRunning = false;
      return;
    }

    await createAuditLog({
      action: 'CYCLE_START',
      details: 'Trading cycle started',
    });

    const context = await buildMarketContext();

    // Get previous recommendations for continuity
    const previousRecs = await Recommendation.find()
      .sort({ cycleTimestamp: -1 })
      .limit(10);

    const previousPicks = previousRecs.length > 0
      ? previousRecs.map((r) => ({
          symbol: r.symbol,
          action: r.action,
          quantity: r.quantity,
          strategy: r.strategy,
        }))
      : undefined;

    const decisions = await claudeService.getTradeDecisions(context, settings.strategyPrompt, previousPicks);

    await createAuditLog({
      action: 'CLAUDE_RESPONSE',
      details: `Claude returned ${decisions.length} decision(s)`,
      claudeResponse: JSON.stringify(decisions),
    });

    // Hard budget enforcer: allocate proportionally by confidence
    const availableCash = context.portfolio.availableCash;
    const totalBudget = context.portfolio.totalValue;
    const spendableBudget = totalBudget * 0.95; // 5% reserve

    // Sort: SELL first, then SHORT by quick-profit potential, then LONG by confidence
    const sorted = [...decisions].sort((a, b) => {
      // SELL always first
      if (a.action === 'SELL' && b.action !== 'SELL') return -1;
      if (a.action !== 'SELL' && b.action === 'SELL') return 1;

      const aIsShort = a.strategy.toLowerCase().startsWith('short');
      const bIsShort = b.strategy.toLowerCase().startsWith('short');

      // Short-term: prioritize highest confidence (fastest profit)
      // Long-term: goes after short-term
      if (aIsShort && !bIsShort) return -1;
      if (!aIsShort && bIsShort) return 1;

      // Within same type: highest confidence first
      return b.confidence - a.confidence;
    });

    // Greedy allocation: short-term gets ALL budget first, long-term only if affordable
    let remainingBudget = spendableBudget;
    for (const decision of sorted) {
      if (decision.action === 'BUY') {
        const isLong = decision.strategy.toLowerCase().startsWith('long');
        const stockPrice = getStockPrice(decision.symbol, context);

        if (stockPrice && stockPrice > 0) {
          const maxAffordable = Math.floor(remainingBudget / stockPrice);

          if (isLong && maxAffordable <= 0) {
            // Long-term but can't afford — watchlist, don't waste budget
            decision.quantity = 0;
          } else if (maxAffordable <= 0) {
            decision.quantity = 0;
          } else {
            decision.quantity = Math.min(decision.quantity, maxAffordable);
            remainingBudget -= decision.quantity * stockPrice;
          }
        } else {
          // No price data — watchlist
          decision.quantity = 0;
        }
      }
    }

    const cycleTimestamp = new Date();
    for (const decision of sorted) {
      const lastRec = await Recommendation.findOne({
        symbol: decision.symbol,
        action: decision.action,
      }).sort({ cycleTimestamp: -1 });

      const isDuplicate = lastRec &&
        lastRec.action === decision.action &&
        lastRec.symbol === decision.symbol &&
        lastRec.quantity === decision.quantity;

      if (!isDuplicate) {
        const isLongTerm = decision.strategy.toLowerCase().startsWith('long');
        await Recommendation.create({
          action: decision.action,
          symbol: decision.symbol,
          quantity: decision.quantity,
          reasoning: decision.reasoning,
          confidence: decision.confidence,
          strategy: decision.strategy,
          holdType: isLongTerm ? 'long' : 'short',
          cycleTimestamp,
        });
      }
    }

    // WhatsApp alerts handled by scheduler (market open/close only)

    // Filter affordable decisions for execution only
    const executableDecisions = decisions.filter((decision) => {
      if (decision.action !== 'BUY') return true;
      if (decision.quantity <= 0) return false;
      const stockPrice = getStockPrice(decision.symbol, context);
      if (!stockPrice || stockPrice <= 0) return false;
      const maxShares = Math.floor(availableCash * 0.95 / stockPrice);
      if (maxShares <= 0) return false;
      decision.quantity = Math.min(decision.quantity, maxShares);
      return true;
    });

    // Only execute trades when market is open
    if (isMarketOpen()) {
      for (const decision of executableDecisions) {
        if (decision.action === 'HOLD') continue;

        const isValid = await validateDecision(decision, context, settings);
        if (!isValid) continue;

        await executeTrade(decision);
      }
    } else {
      await createAuditLog({
        action: 'MARKET_CLOSED',
        details: 'Market is closed. Recommendations saved but no trades executed.',
      });
    }

    await updatePortfolioPnl(context);

  } catch (error) {
    console.error('Trading cycle failed:', error);
    await createAuditLog({
      action: 'CYCLE_ERROR',
      details: `Cycle failed: ${String(error)}`,
    });
  } finally {
    isRunning = false;
  }
}

// ── Build Context ──

async function buildMarketContext(): Promise<MarketContext> {
  const accountSummary = await ibkrService.getAccountSummary();
  const ibkrPositions = await ibkrService.getPositions();

  const openPositions = ibkrPositions.map((pos) => ({
    symbol: pos.ticker,
    shares: pos.position,
    avgEntryPrice: pos.avgPrice,
    currentPrice: pos.mktPrice,
    unrealizedPnl: pos.unrealizedPnl,
    unrealizedPnlPercent: pos.avgPrice > 0
      ? ((pos.mktPrice - pos.avgPrice) / pos.avgPrice) * 100
      : 0,
  }));

  // Get ALL stocks from the market (single API call, cached 30 min)
  const allStocks = await marketDataService.getAllStocks();

  // Convert to StockData format — top 50 by volume for Claude's context
  const topStocks = allStocks
    .filter((s) => s.v > 50000 && s.c > 0.01)
    .sort((a, b) => b.v - a.v)
    .slice(0, 50);

  const marketData = topStocks.map((s) => ({
    symbol: s.T,
    price: s.c,
    open: s.o,
    high: s.h,
    low: s.l,
    volume: s.v,
    changePercent: s.o > 0 ? ((s.c - s.o) / s.o) * 100 : 0,
  }));

  // Also include held positions and previous picks if not in top 50
  const prevRecs = await Recommendation.find().sort({ cycleTimestamp: -1 }).limit(10);
  const extraSymbols = [
    ...ibkrPositions.map((p) => p.ticker),
    ...prevRecs.map((r) => r.symbol).filter(Boolean),
  ];
  const existingSymbols = new Set(marketData.map((s) => s.symbol));
  for (const sym of extraSymbols) {
    if (!existingSymbols.has(sym)) {
      const found = allStocks.find((s) => s.T === sym);
      if (found) {
        marketData.push({
          symbol: found.T,
          price: found.c,
          open: found.o,
          high: found.h,
          low: found.l,
          volume: found.v,
          changePercent: found.o > 0 ? ((found.c - found.o) / found.o) * 100 : 0,
        });
      }
    }
  }

  const news = await marketDataService.getNews(MARKET_CONTEXT_TICKERS.slice(0, 1), 10);

  return {
    portfolio: {
      totalValue: accountSummary.netLiquidation,
      availableCash: accountSummary.totalCashValue,
      todayPnl: accountSummary.unrealizedPnl + accountSummary.realizedPnl,
      openPositions,
    },
    marketData,
    news,
    watchlist: marketData.map((s) => s.symbol),
  };
}

// ── Validation ──

async function validateDecision(
  decision: TradeDecision,
  context: MarketContext,
  settings: ISettings
): Promise<boolean> {
  const { portfolio } = context;

  // Check loss limit
  const lossPercent = portfolio.totalValue > 0
    ? (portfolio.todayPnl / portfolio.totalValue) * 100
    : 0;

  if (lossPercent <= -settings.maxLossPercent) {
    await createAuditLog({
      action: 'TRADE_REJECTED',
      details: `Loss limit hit (${lossPercent.toFixed(2)}% >= ${settings.maxLossPercent}%). Rejecting ${decision.action} ${decision.symbol}`,
    });

    emitAlert({
      type: 'loss-limit',
      message: `Max loss limit reached (${lossPercent.toFixed(2)}%). Trading paused.`,
      timestamp: new Date().toISOString(),
    });

    await pauseEngine();
    return false;
  }

  // Check if we can afford this BUY
  if (decision.action === 'BUY') {
    const orderCost = decision.quantity * (getStockPrice(decision.symbol, context) ?? 0);

    if (orderCost > portfolio.availableCash) {
      await createAuditLog({
        action: 'TRADE_REJECTED',
        details: `Can't afford: $${orderCost.toFixed(2)} > available $${portfolio.availableCash.toFixed(2)}`,
      });
      return false;
    }
  }

  return true;
}

// ── Execution ──

async function executeTrade(decision: TradeDecision): Promise<void> {
  const trade = await Trade.create({
    symbol: decision.symbol,
    action: decision.action,
    quantity: decision.quantity,
    price: 0,
    totalValue: 0,
    reasoning: decision.reasoning,
    status: 'pending',
    strategy: decision.strategy,
    exchange: 'US',
    executedAt: new Date(),
  });

  try {
    const orderResult = await ibkrService.placeOrder({
      acctId: '',
      conid: 0, // Will need symbol-to-conid lookup in production
      side: decision.action as 'BUY' | 'SELL',
      quantity: decision.quantity,
      orderType: 'MKT',
      tif: 'DAY',
    });

    if (orderResult.warningMessage) {
      await ibkrService.confirmOrder(orderResult.orderId);
    }

    trade.status = 'in-progress';
    await trade.save();

    emitTradeNew({
      id: trade.id as string,
      symbol: trade.symbol,
      action: trade.action,
      quantity: trade.quantity,
      price: trade.price,
      totalValue: trade.totalValue,
      reasoning: trade.reasoning,
      status: trade.status,
      strategy: trade.strategy,
      timestamp: trade.executedAt.toISOString(),
    });

    emitAlert({
      type: 'trade',
      message: `${decision.action} ${decision.quantity} shares of ${decision.symbol}`,
      timestamp: new Date().toISOString(),
    });

    await createAuditLog({
      action: 'TRADE_EXECUTED',
      details: `${decision.action} ${decision.quantity} ${decision.symbol}. Order ID: ${orderResult.orderId}`,
      tradeId: trade.id as string,
      metadata: { orderId: orderResult.orderId, reasoning: decision.reasoning },
    });

  } catch (error) {
    trade.status = 'failed';
    await trade.save();

    await createAuditLog({
      action: 'TRADE_FAILED',
      details: `Failed to execute ${decision.action} ${decision.symbol}: ${String(error)}`,
      tradeId: trade.id as string,
    });
  }
}

// ── Helpers ──

async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}

function getStockPrice(symbol: string, context: MarketContext): number | undefined {
  const stock = context.marketData.find((s) => s.symbol === symbol);
  return stock?.price;
}

async function updatePortfolioPnl(context: MarketContext): Promise<void> {
  const summary = await ibkrService.getAccountSummary();

  emitPnlUpdate({
    totalValue: summary.netLiquidation,
    todayPnl: summary.unrealizedPnl + summary.realizedPnl,
    todayPnlPercent: summary.netLiquidation > 0
      ? ((summary.unrealizedPnl + summary.realizedPnl) / summary.netLiquidation) * 100
      : 0,
    totalPnl: summary.unrealizedPnl + summary.realizedPnl,
    totalPnlPercent: 0,
    openPositions: context.portfolio.openPositions.length,
    availableCash: summary.totalCashValue,
  });
}

interface CycleStatus {
  lastCycleTime: string | null;
  nextCycleTime: string | null;
  intervalMinutes: number;
  secondsUntilNext: number;
  isRunning: boolean;
}

function getCycleStatus(): CycleStatus {
  const now = Date.now();
  const nextTime = lastCycleTime
    ? new Date(lastCycleTime.getTime() + currentIntervalMinutes * 60 * 1000)
    : null;
  const secondsUntilNext = nextTime
    ? Math.max(0, Math.floor((nextTime.getTime() - now) / 1000))
    : 0;

  return {
    lastCycleTime: lastCycleTime?.toISOString() ?? null,
    nextCycleTime: nextTime?.toISOString() ?? null,
    intervalMinutes: currentIntervalMinutes,
    secondsUntilNext,
    isRunning,
  };
}

export {
  startEngine,
  stopEngine,
  pauseEngine,
  resumeEngine,
  runCycle,
  getCycleStatus,
};
