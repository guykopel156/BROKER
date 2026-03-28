import config from '../config';
import { Settings, Trade, Recommendation } from '../models';
import ibkrService from './ibkrService';
import claudeService from './claudeService';
import marketDataService from './marketDataService';
import { createAuditLog } from './auditLogService';
import { sendTradeAlert, sendRecommendationAlert } from './whatsappService';
import {
  emitTradeNew,
  emitPnlUpdate,
  emitAlert,
  emitEngineStatus,
} from './socketService';

import type { ISettings } from '../models';
import type { MarketContext, TradeDecision } from '../types/claude';

const DEFAULT_WATCHLIST = [
  // Penny / sub-$5 stocks
  'SNDL', 'TELL', 'MULN', 'XELA', 'CLOV',
  'WISH', 'GSAT', 'OPEN', 'DNA', 'SKLZ',
  // Leveraged ETFs (often $2-$10)
  'TQQQ', 'SQQQ', 'UVXY', 'LABU', 'SOXL',
  // Sub-$20 growth
  'SOFI', 'PLTR', 'NIO', 'RIVN', 'LCID',
  // Large caps (for context)
  'AAPL', 'NVDA', 'TSLA',
];
const MIN_CASH_RESERVE_PERCENT = 5;
const MAX_OPEN_POSITIONS = 10;
const MAX_POSITION_PERCENT = 30;

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
    const decisions = await claudeService.getTradeDecisions(context, settings.strategyPrompt);

    await createAuditLog({
      action: 'CLAUDE_RESPONSE',
      details: `Claude returned ${decisions.length} decision(s)`,
      claudeResponse: JSON.stringify(decisions),
    });

    // Filter out unaffordable BUY recommendations
    const availableCash = context.portfolio.availableCash;
    const affordableDecisions = decisions.filter((decision) => {
      if (decision.action !== 'BUY') return true;
      const stockPrice = getStockPrice(decision.symbol, context);
      if (!stockPrice || stockPrice <= 0) return true;
      const maxShares = Math.floor(availableCash * 0.95 / stockPrice);
      if (maxShares <= 0) {
        createAuditLog({
          action: 'TRADE_FILTERED',
          details: `Filtered ${decision.symbol}: price $${stockPrice.toFixed(2)} > budget $${availableCash.toFixed(2)}`,
        });
        return false;
      }
      // Correct the quantity if Claude over-estimated
      decision.quantity = Math.min(decision.quantity, maxShares);
      return true;
    });

    // Only save recommendation if it's different from the latest one
    const cycleTimestamp = new Date();
    for (const decision of affordableDecisions) {
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

    // Send WhatsApp recommendation alert
    const newRecs = affordableDecisions.filter((d) => d.action !== 'HOLD');
    if (newRecs.length > 0) {
      sendRecommendationAlert(newRecs).catch(() => {
        console.error('WhatsApp recommendation alert failed');
      });
    }

    // Only execute trades when market is open
    if (isMarketOpen()) {
      for (const decision of affordableDecisions) {
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

  const watchlistSymbols = [
    ...DEFAULT_WATCHLIST,
    ...ibkrPositions.map((p) => p.ticker),
  ];
  const uniqueSymbols = [...new Set(watchlistSymbols)];

  const marketData = await marketDataService.getFullStockData(uniqueSymbols);
  const news = await marketDataService.getNews(uniqueSymbols, 15);

  return {
    portfolio: {
      totalValue: accountSummary.netLiquidation,
      availableCash: accountSummary.totalCashValue,
      todayPnl: accountSummary.unrealizedPnl + accountSummary.realizedPnl,
      openPositions,
    },
    marketData,
    news,
    watchlist: uniqueSymbols,
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

  // Check cash reserve for BUY orders
  if (decision.action === 'BUY') {
    const minCash = portfolio.totalValue * (MIN_CASH_RESERVE_PERCENT / 100);
    const orderCost = decision.quantity * (getStockPrice(decision.symbol, context) ?? 0);

    if (portfolio.availableCash - orderCost < minCash) {
      await createAuditLog({
        action: 'TRADE_REJECTED',
        details: `Insufficient cash reserve. Need $${minCash.toFixed(2)} minimum. Available: $${portfolio.availableCash.toFixed(2)}`,
      });
      return false;
    }

    // Check max position size
    const maxPositionValue = portfolio.totalValue * (MAX_POSITION_PERCENT / 100);
    if (orderCost > maxPositionValue) {
      await createAuditLog({
        action: 'TRADE_REJECTED',
        details: `Position too large ($${orderCost.toFixed(2)} > max $${maxPositionValue.toFixed(2)})`,
      });
      return false;
    }

    // Check max open positions
    if (portfolio.openPositions.length >= MAX_OPEN_POSITIONS) {
      await createAuditLog({
        action: 'TRADE_REJECTED',
        details: `Max open positions reached (${MAX_OPEN_POSITIONS})`,
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

    // WhatsApp alert
    sendTradeAlert(decision.action, decision.symbol, decision.quantity, decision.reasoning).catch(() => {
      console.error('WhatsApp trade alert failed');
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
