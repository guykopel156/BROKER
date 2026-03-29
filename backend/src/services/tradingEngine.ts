import config from '../config';
import { Settings, Trade, Recommendation } from '../models';
import ibkrService from './ibkrService';
import claudeService from './claudeService';
import marketDataService from './marketDataService';
import { createAuditLog } from './auditLogService';
import {
  emitTradeNew,
  emitPnlUpdate,
  emitAlert,
  emitEngineStatus,
} from './socketService';

import type { ISettings } from '../models';
import type {
  CycleInput,
  CycleOutput,
  OpenPositionInput,
  PreviousCycleEntry,
  WatchlistItem,
} from '../types/claude';

let engineTimer: NodeJS.Timeout | null = null;
let priceCheckTimer: NodeJS.Timeout | null = null;
let isRunning = false;
let isPriceChecking = false;
const PRICE_CHECK_NORMAL_MS = 30000; // 30 seconds
const PRICE_CHECK_POWER_MS = 15000; // 15 seconds during power hours
let lastCycleTime: Date | null = null;
let currentIntervalMinutes = 15;

// Screened candidates from last cycle (exposed via API)
interface ScreenedCandidate {
  ticker: string;
  price: number;
  changePct: number;
  volume: number;
  score: number;
  rsi: number | null;
  macdHist: number | null;
  momentum: 'bullish' | 'bearish' | 'neutral';
  atr: number | null;
  affordable: boolean;
  sharesBuyable: number;
}

let lastScreenedCandidates: ScreenedCandidate[] = [];

function getScreenedCandidates(): ScreenedCandidate[] {
  return lastScreenedCandidates;
}

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

  // Fast price check — adapts speed based on market conditions
  if (!priceCheckTimer) {
    const startPriceCheck = (): void => {
      const intervalMs = isPowerHour() ? PRICE_CHECK_POWER_MS : PRICE_CHECK_NORMAL_MS;

      if (priceCheckTimer) clearInterval(priceCheckTimer);
      priceCheckTimer = setInterval(() => {
        runFastPriceCheck().catch((error) => {
          console.error('Price check error:', error);
        });
      }, intervalMs);
    };

    startPriceCheck();
    // Re-evaluate speed every 5 minutes (to switch between normal and power hour)
    setInterval(startPriceCheck, 5 * 60 * 1000);
    console.log('Fast price check started (30s normal, 15s power hours)');
  }
}

function stopEngine(): void {
  if (engineTimer) {
    clearInterval(engineTimer);
    engineTimer = null;
  }
  if (priceCheckTimer) {
    clearInterval(priceCheckTimer);
    priceCheckTimer = null;
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

function isPowerHour(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcTime = utcHour * 60 + utcMinute;

  const marketOpen = 14 * 60 + 30; // 14:30 UTC
  const marketClose = 21 * 60; // 21:00 UTC
  const firstHalfHourEnd = marketOpen + 30;
  const lastHalfHourStart = marketClose - 30;

  return (utcTime >= marketOpen && utcTime < firstHalfHourEnd) ||
    (utcTime >= lastHalfHourStart && utcTime < marketClose);
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

    const marketOpen = isMarketOpen();

    await createAuditLog({
      action: 'CYCLE_START',
      details: marketOpen ? 'Trading cycle started' : 'Trading cycle started (market closed — analysis only)',
    });

    // Step 1: Check existing positions for stop-loss / take-profit (no Claude needed)
    const sellsExecuted = await checkStopLossAndTakeProfit(settings, marketOpen);

    // Step 2: Calculate free cash
    const activeRecs = await Recommendation.find({ isActive: true, action: 'BUY' });
    const allocatedCash = activeRecs.reduce(
      (sum, rec) => sum + (rec.quantity * rec.entryPrice),
      0
    );

    let accountCash = 0;
    try {
      const summary = await ibkrService.getAccountSummary();
      accountCash = summary.totalCashValue;
    } catch {
      accountCash = 0;
    }

    const freeCash = Math.max(0, (accountCash * 0.95) - allocatedCash);
    const hasFreeCash = freeCash > 0.01;

    await createAuditLog({
      action: 'CYCLE_BUDGET',
      details: `Cash: $${accountCash.toFixed(2)}, Allocated: $${allocatedCash.toFixed(2)}, Free: $${freeCash.toFixed(2)}, Sells: ${sellsExecuted}`,
    });

    // Step 3: Only call Claude if there's free cash to invest OR no active positions
    if (hasFreeCash || activeRecs.length === 0) {
      if (marketOpen) {
        await ibkrService.cachePositionConids();
      }

      const cycleInput = await buildCycleInput();

      const cycleOutput = await claudeService.getStructuredDecisions(
        cycleInput,
        settings.strategyPrompt
      );

      await createAuditLog({
        action: 'CLAUDE_RESPONSE',
        details: `New trades: ${cycleOutput.newTrades.length}, Alerts: ${cycleOutput.alerts.length}`,
        claudeResponse: JSON.stringify(cycleOutput),
      });

      for (const alert of cycleOutput.alerts) {
        emitAlert({
          type: 'trade',
          message: alert,
          timestamp: new Date().toISOString(),
        });
      }

      // Save new recommendations with budget enforcement + momentum check
      await saveRecommendations(cycleOutput, accountCash, cycleInput.watchlist);

      if (marketOpen) {
        await executeNewTrades(cycleOutput, cycleInput);
      }
    } else {
      await createAuditLog({
        action: 'CYCLE_SKIP_CLAUDE',
        details: `No free cash ($${freeCash.toFixed(2)}) and ${activeRecs.length} active positions — holding.`,
      });
    }

    if (marketOpen) {
      await updatePortfolioPnl();
    }

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

// ── Build Structured Input ──

async function buildCycleInput(): Promise<CycleInput> {
  // Get account data from IBKR
  const accountSummary = await ibkrService.getAccountSummary();
  const ibkrPositions = await ibkrService.getPositions();

  // Get active recommendations (our tracked positions)
  const activeRecs = await Recommendation.find({ isActive: true, action: 'BUY' });

  // Build open positions from IBKR data + our recommendation tracking
  const openPositions: OpenPositionInput[] = ibkrPositions.map((pos) => {
    const rec = activeRecs.find((r) => r.symbol === pos.ticker);

    return {
      ticker: pos.ticker,
      direction: 'LONG' as const,
      entryPrice: rec?.entryPrice ?? pos.avgPrice,
      currentPrice: pos.mktPrice,
      quantity: pos.position,
      stopLoss: rec?.stopLoss ?? pos.avgPrice * 0.85,
      takeProfit: rec?.takeProfit ?? null,
      openDate: rec?.cycleTimestamp?.toISOString() ?? new Date().toISOString(),
      strategyType: (rec?.holdType === 'long' ? 'LONG' : 'SHORT') as 'SHORT' | 'LONG',
      rationale: rec?.reasoning ?? 'Pre-existing position',
    };
  });

  // Get market data (grouped daily as base)
  const allStocks = await marketDataService.getAllStocks();

  // Screen top candidates — include held tickers and previous picks
  const heldTickers = ibkrPositions.map((p) => p.ticker);
  const prevRecs = await Recommendation.find({ isActive: true }).distinct('symbol');
  const extraSymbols = Array.from(new Set([...heldTickers, ...prevRecs]));

  const candidateSymbols = marketDataService.screenTopCandidates(
    allStocks,
    extraSymbols,
    30,
    accountSummary.totalCashValue
  );

  // Get enriched watchlist with technical indicators
  const watchlist: WatchlistItem[] = await marketDataService.getEnrichedWatchlist(
    candidateSymbols,
    allStocks
  );

  // Overlay real-time snapshot prices on watchlist (replaces stale daily close with live price)
  try {
    const snapshots = await marketDataService.getSnapshots(candidateSymbols);
    for (const item of watchlist) {
      const snap = snapshots.get(item.ticker.toUpperCase());
      if (snap && snap.price > 0) {
        item.price = snap.price;
        item.changePct1d = snap.changePct;
        item.volume = snap.volume;
      }
    }
  } catch {
    // Snapshot failed — use grouped daily prices (still works)
  }

  // Save screened candidates for the frontend
  const maxPrice = accountSummary.totalCashValue * 0.95;
  lastScreenedCandidates = watchlist.map((w) => {
    const affordable = w.price <= maxPrice;
    return {
      ticker: w.ticker,
      price: w.price,
      changePct: w.changePct1d,
      volume: w.volume,
      score: 0,
      rsi: w.rsi14,
      macdHist: w.macdHist,
      momentum: w.macdHist !== null
        ? (w.macdHist > 0 ? 'bullish' as const : 'bearish' as const)
        : 'neutral' as const,
      atr: w.atr14,
      affordable,
      sharesBuyable: affordable ? Math.floor(maxPrice / w.price) : 0,
    };
  });

  // Build previous cycle summary
  const lastCycleRecs = await Recommendation.find()
    .sort({ cycleTimestamp: -1 })
    .limit(10);

  const previousCycleSummary: PreviousCycleEntry[] = lastCycleRecs.map((rec) => {
    const currentStock = allStocks.find((s) => s.T === rec.symbol);
    const currentPrice = currentStock?.c ?? 0;
    const priceChange = rec.entryPrice > 0
      ? ((currentPrice - rec.entryPrice) / rec.entryPrice * 100).toFixed(2)
      : '0.00';

    return {
      ticker: rec.symbol,
      action: rec.action,
      reasoning: rec.reasoning,
      outcome: `Price change since entry: ${priceChange}%`,
    };
  });

  return {
    account: {
      availableCash: accountSummary.totalCashValue,
      totalPortfolioValue: accountSummary.netLiquidation,
      openPositions,
    },
    watchlist,
    previousCycleSummary,
  };
}

// ── Fast Price Check (every 30s) — trailing stop, stop-loss, take-profit, scale-in ──

async function runFastPriceCheck(): Promise<void> {
  if (isPriceChecking || !isMarketOpen()) return;
  isPriceChecking = true;

  try {
    const activeRecs = await Recommendation.find({ isActive: true, action: 'BUY' });
    if (activeRecs.length === 0) return;

    // Get real-time prices via snapshot
    const tickers = activeRecs.map((r) => r.symbol);
    const prices = await marketDataService.getRealtimePrices(tickers);

    const settings = await getSettings();

    for (const rec of activeRecs) {
      const currentPrice = prices.get(rec.symbol.toUpperCase());
      if (!currentPrice || currentPrice <= 0) continue;
      if (rec.entryPrice <= 0) continue;

      // ── Trailing stop: update highest price and move stop up ──
      if (currentPrice > rec.highestPrice) {
        rec.highestPrice = currentPrice;
        const trailingStopPrice = currentPrice * (1 - rec.trailingStopPct / 100);

        if (rec.stopLoss !== null && trailingStopPrice > rec.stopLoss) {
          rec.stopLoss = trailingStopPrice;
        }
        await rec.save();
      }

      // ── Check stop-loss ──
      let shouldSell = false;
      let reason = '';

      if (rec.stopLoss !== null && currentPrice <= rec.stopLoss) {
        shouldSell = true;
        reason = `TRAILING_STOP: $${currentPrice.toFixed(4)} <= stop $${rec.stopLoss.toFixed(4)} (high was $${rec.highestPrice.toFixed(4)})`;
      }

      // ── Check take-profit ──
      if (rec.takeProfit !== null && currentPrice >= rec.takeProfit) {
        shouldSell = true;
        reason = `TAKE_PROFIT: $${currentPrice.toFixed(4)} >= target $${rec.takeProfit.toFixed(4)}`;
      }

      if (shouldSell) {
        rec.isActive = false;
        rec.closedAt = new Date();
        rec.closeReason = reason;
        await rec.save();

        await createAuditLog({
          action: 'AUTO_SELL_TRIGGERED',
          details: `${rec.symbol}: ${reason}`,
        });

        emitAlert({
          type: 'trade',
          message: `${rec.symbol}: ${reason}`,
          timestamp: new Date().toISOString(),
        });

        const lossCheck = await checkLossLimit(settings);
        if (!lossCheck) return;

        const positions = await ibkrService.getPositions();
        const position = positions.find((p) => p.ticker === rec.symbol);
        const sellQuantity = position?.position ?? 0;

        if (sellQuantity > 0) {
          await executeTrade({
            action: 'SELL',
            symbol: rec.symbol,
            quantity: sellQuantity,
            reasoning: reason,
            strategy: 'Auto: ' + reason.split(':')[0],
          });
        }
        continue;
      }

      // ── Scale-in: if price is up 5%+ from entry and not yet scaled in ──
      if (!rec.scaledIn && currentPrice > rec.entryPrice * 1.05) {
        const summary = await ibkrService.getAccountSummary();
        const freeCash = summary.totalCashValue * 0.95;
        const scaleAmount = Math.floor(freeCash * 0.3 / currentPrice);

        if (scaleAmount >= 1) {
          rec.scaledIn = true;
          rec.quantity += scaleAmount;
          await rec.save();

          await executeTrade({
            action: 'BUY',
            symbol: rec.symbol,
            quantity: scaleAmount,
            reasoning: `Scale-in: price up ${((currentPrice / rec.entryPrice - 1) * 100).toFixed(1)}% — adding ${scaleAmount} shares`,
            strategy: 'Auto: Scale-In',
          });

          await createAuditLog({
            action: 'SCALE_IN',
            details: `${rec.symbol}: added ${scaleAmount} shares at $${currentPrice.toFixed(4)} (up from entry $${rec.entryPrice.toFixed(4)})`,
          });
        }
      }

      // ── Fast rule: Momentum death — RSI spiked from oversold to overbought ──
      // Get fresh snapshot for RSI check (use cached indicators from last cycle)
      const candidateData = lastScreenedCandidates.find((c) => c.ticker === rec.symbol);
      if (candidateData?.rsi !== null && candidateData?.rsi !== undefined) {
        if (candidateData.rsi > 75) {
          const pnlPct = ((currentPrice - rec.entryPrice) / rec.entryPrice) * 100;
          if (pnlPct > 5) {
            // Stock is overbought AND in profit — sell to lock in gains
            rec.isActive = false;
            rec.closedAt = new Date();
            rec.closeReason = `MOMENTUM_DEATH: RSI ${candidateData.rsi.toFixed(0)} (overbought) — locking ${pnlPct.toFixed(1)}% profit`;
            await rec.save();

            const positions = await ibkrService.getPositions();
            const position = positions.find((p) => p.ticker === rec.symbol);
            if (position && position.position > 0) {
              await executeTrade({
                action: 'SELL',
                symbol: rec.symbol,
                quantity: position.position,
                reasoning: rec.closeReason,
                strategy: 'Auto: Momentum Death',
              });
            }

            await createAuditLog({
              action: 'MOMENTUM_DEATH_SELL',
              details: `${rec.symbol}: RSI ${candidateData.rsi.toFixed(0)}, profit ${pnlPct.toFixed(1)}% — sold`,
            });
            continue;
          }
        }
      }

      // ── Fast rule: Volume collapse — no buyers left ──
      if (candidateData?.volume !== undefined && candidateData?.volume !== null) {
        const snapshots = await marketDataService.getSnapshots([rec.symbol]);
        const snap = snapshots.get(rec.symbol.toUpperCase());
        if (snap && snap.volume > 0 && candidateData.volume > 0) {
          const volumeRatio = snap.volume / candidateData.volume;
          if (volumeRatio < 0.2) {
            const pnlPct = ((currentPrice - rec.entryPrice) / rec.entryPrice) * 100;
            rec.isActive = false;
            rec.closedAt = new Date();
            rec.closeReason = `VOLUME_COLLAPSE: volume dropped to ${(volumeRatio * 100).toFixed(0)}% of average — no liquidity`;
            await rec.save();

            const positions = await ibkrService.getPositions();
            const position = positions.find((p) => p.ticker === rec.symbol);
            if (position && position.position > 0) {
              await executeTrade({
                action: 'SELL',
                symbol: rec.symbol,
                quantity: position.position,
                reasoning: rec.closeReason,
                strategy: 'Auto: Volume Collapse',
              });
            }

            await createAuditLog({
              action: 'VOLUME_COLLAPSE_SELL',
              details: `${rec.symbol}: volume at ${(volumeRatio * 100).toFixed(0)}% of avg, P&L ${pnlPct.toFixed(1)}% — sold`,
            });
            continue;
          }
        }
      }
    }

    // ── Fast rule: Quick buy on dip — candidate from last cycle dropped 10%+ intraday ──
    if (lastScreenedCandidates.length > 0) {
      const summary = await ibkrService.getAccountSummary();
      const activeSymbols = new Set(activeRecs.map((r) => r.symbol));
      const freeCash = summary.totalCashValue * 0.95;
      const allocatedCash = activeRecs.reduce((sum, r) => sum + (r.quantity * r.entryPrice), 0);
      const realFreeCash = Math.max(0, freeCash - allocatedCash);

      if (realFreeCash > 0.01) {
        for (const candidate of lastScreenedCandidates) {
          if (activeSymbols.has(candidate.ticker)) continue;
          if (!candidate.affordable || candidate.sharesBuyable < 1) continue;
          if (candidate.momentum === 'bearish') continue;

          // Stock dropped 10%+ today with bullish momentum = dip buy opportunity
          if (candidate.changePct <= -10 && candidate.rsi !== null && candidate.rsi < 35) {
            const qty = Math.min(
              candidate.sharesBuyable,
              Math.floor(realFreeCash * 0.25 / candidate.price)
            );
            if (qty < 1) continue;

            await createAuditLog({
              action: 'DIP_BUY',
              details: `${candidate.ticker}: down ${candidate.changePct.toFixed(1)}% today, RSI ${candidate.rsi.toFixed(0)} — buying ${qty} shares at $${candidate.price.toFixed(4)}`,
            });

            emitAlert({
              type: 'trade',
              message: `DIP BUY: ${candidate.ticker} down ${candidate.changePct.toFixed(1)}% — buying ${qty} shares`,
              timestamp: new Date().toISOString(),
            });

            const atr = candidate.atr ?? candidate.price * 0.1;
            await Recommendation.create({
              action: 'BUY',
              symbol: candidate.ticker,
              quantity: qty,
              reasoning: `Dip buy: down ${candidate.changePct.toFixed(1)}% with RSI ${candidate.rsi.toFixed(0)} — oversold bounce expected`,
              confidence: 65,
              strategy: 'Short: Dip Buy',
              holdType: 'short',
              entryPrice: candidate.price,
              stopLoss: candidate.price - 1.5 * atr,
              takeProfit: candidate.price + 3 * atr,
              trailingStopPct: 15,
              highestPrice: candidate.price,
              scaledIn: false,
              sector: '',
              isActive: true,
              cycleTimestamp: new Date(),
            });

            await executeTrade({
              action: 'BUY',
              symbol: candidate.ticker,
              quantity: qty,
              reasoning: `Dip buy: ${candidate.ticker} down ${candidate.changePct.toFixed(1)}%`,
              strategy: 'Auto: Dip Buy',
            });

            break; // Only one dip buy per check
          }
        }
      }
    }
  } catch (error) {
    console.error('Fast price check error:', error);
  } finally {
    isPriceChecking = false;
  }
}

// ── Wrapper for cycle's stop-loss check (uses same logic) ──

async function checkStopLossAndTakeProfit(
  _settings: ISettings,
  marketOpen: boolean
): Promise<number> {
  if (!marketOpen) return 0;
  await runFastPriceCheck();
  const closed = await Recommendation.countDocuments({ isActive: false, closeReason: { $regex: /STOP|PROFIT/ } });
  return closed;
}

// ── Save Recommendations (always, regardless of market hours) ──

async function saveRecommendations(
  output: CycleOutput,
  availableCash: number,
  watchlist?: import('../types/claude').WatchlistItem[]
): Promise<void> {
  const cycleTimestamp = new Date();

  // Subtract cash already allocated to active recommendations
  const activeRecs = await Recommendation.find({ isActive: true, action: 'BUY' });
  const alreadyAllocated = activeRecs.reduce(
    (sum, rec) => sum + (rec.quantity * rec.entryPrice),
    0
  );
  let remainingCash = Math.max(0, (availableCash * 0.95) - alreadyAllocated);

  for (const trade of output.newTrades) {
    if (trade.confidence < 55) continue;

    const existing = await Recommendation.findOne({
      symbol: trade.ticker,
      isActive: true,
    });

    if (existing) continue;

    // Check momentum — skip stocks with bearish signals
    if (watchlist) {
      const stockData = watchlist.find((w) => w.ticker === trade.ticker);
      if (stockData) {
        const isBearish = stockData.macdHist !== null && stockData.macdHist < 0;
        const isOverbought = stockData.rsi14 !== null && stockData.rsi14 > 70;
        const isDroppingToday = stockData.changePct1d < -5;

        if (isBearish && isOverbought) {
          await createAuditLog({
            action: 'TRADE_SKIPPED',
            details: `${trade.ticker}: bearish MACD + overbought RSI (${stockData.rsi14?.toFixed(0)}) — skipping`,
          });
          continue;
        }

        if (isBearish && isDroppingToday) {
          await createAuditLog({
            action: 'TRADE_SKIPPED',
            details: `${trade.ticker}: bearish MACD + down ${stockData.changePct1d.toFixed(1)}% today — skipping`,
          });
          continue;
        }
      }
    }

    // Smart position sizing by confidence tier
    let maxBudgetPct = 0.15; // default 15%
    if (trade.confidence >= 85) maxBudgetPct = 0.35;
    else if (trade.confidence >= 70) maxBudgetPct = 0.25;
    else if (trade.confidence >= 55) maxBudgetPct = 0.15;

    const maxForThisTrade = remainingCash * maxBudgetPct;
    let quantity = Math.floor(maxForThisTrade / trade.price);

    // Cap to what Claude suggested if it's less
    if (trade.quantity > 0 && trade.quantity < quantity) {
      quantity = trade.quantity;
    }

    // Final budget cap
    const totalCost = quantity * trade.price;
    if (totalCost > remainingCash) {
      quantity = Math.floor(remainingCash / trade.price);
    }

    // Skip if can't afford even 1 share
    if (quantity < 1) continue;

    // Sector check — max 2 positions per sector
    const MAX_PER_SECTOR = 2;
    let sector = 'Unknown';
    try {
      sector = await marketDataService.getSector(trade.ticker);
    } catch { /* skip */ }

    if (sector !== 'Unknown') {
      const sectorCount = activeRecs.filter((r) => r.sector === sector).length;
      if (sectorCount >= MAX_PER_SECTOR) {
        await createAuditLog({
          action: 'TRADE_SKIPPED',
          details: `${trade.ticker}: already ${sectorCount} positions in "${sector}" sector — skipping for diversification`,
        });
        continue;
      }
    }

    remainingCash -= quantity * trade.price;

    const isLongTerm = trade.strategyType === 'LONG';
    await Recommendation.create({
      action: 'BUY',
      symbol: trade.ticker,
      quantity,
      reasoning: trade.reasoning,
      confidence: trade.confidence,
      strategy: trade.strategyLabel,
      holdType: isLongTerm ? 'long' : 'short',
      entryPrice: trade.price,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      trailingStopPct: 15,
      highestPrice: trade.price,
      scaledIn: false,
      sector,
      isActive: true,
      cycleTimestamp,
    });
  }

  // Close recommendations that Claude wants to sell
  for (const review of output.positionReview) {
    if (review.action !== 'SELL') continue;

    const rec = await Recommendation.findOne({
      symbol: review.ticker,
      isActive: true,
    });

    if (rec) {
      rec.isActive = false;
      rec.closedAt = new Date();
      rec.closeReason = review.sellReason ?? 'MANUAL';
      await rec.save();
    }
  }
}

// ── Execute Position Review (SELLs) ──

// ── Execute New Trades (BUYs) ──

async function executeNewTrades(
  output: CycleOutput,
  input: CycleInput
): Promise<void> {
  let remainingCash = input.account.availableCash * 0.95; // 5% reserve

  for (const trade of output.newTrades) {
    if (trade.confidence < 55) continue;
    if (trade.quantity < 1) continue;

    const totalCost = trade.quantity * trade.price;

    // Check against REMAINING cash, not total
    if (totalCost > remainingCash) {
      // Try to buy fewer shares with what's left
      const affordableQty = Math.floor(remainingCash / trade.price);
      if (affordableQty < 1) continue;
      trade.quantity = affordableQty;
    }

    const actualCost = trade.quantity * trade.price;
    remainingCash -= actualCost;

    await executeTrade({
      action: 'BUY',
      symbol: trade.ticker,
      quantity: trade.quantity,
      reasoning: trade.reasoning,
      strategy: trade.strategyLabel,
    });
  }
}

// ── Trade Execution ──

const MAX_SINGLE_TRADE_PERCENT = 40; // Max 40% of portfolio in one trade
const ORDER_FILL_CHECK_DELAY_MS = 5000;
const ORDER_FILL_MAX_RETRIES = 3;
const recentOrders: Map<string, number> = new Map(); // symbol → timestamp for duplicate prevention

interface TradeParams {
  action: 'BUY' | 'SELL';
  symbol: string;
  quantity: number;
  reasoning: string;
  strategy: string;
}

async function executeTrade(params: TradeParams): Promise<void> {
  // ── Safety #3: Duplicate order prevention ──
  const orderKey = `${params.action}-${params.symbol}`;
  const lastOrderTime = recentOrders.get(orderKey);
  const now = Date.now();
  if (lastOrderTime && now - lastOrderTime < 60000) {
    await createAuditLog({
      action: 'TRADE_BLOCKED',
      details: `Duplicate order blocked: ${params.action} ${params.symbol} — same order placed ${Math.floor((now - lastOrderTime) / 1000)}s ago`,
    });
    return;
  }

  // ── Safety #4: Max single trade limit ──
  if (params.action === 'BUY') {
    try {
      const summary = await ibkrService.getAccountSummary();
      const tradeCost = params.quantity * (await getEstimatedPrice(params.symbol));
      const tradePercent = summary.netLiquidation > 0
        ? (tradeCost / summary.netLiquidation) * 100
        : 100;

      if (tradePercent > MAX_SINGLE_TRADE_PERCENT) {
        const maxCost = summary.netLiquidation * (MAX_SINGLE_TRADE_PERCENT / 100);
        const price = await getEstimatedPrice(params.symbol);
        const cappedQty = Math.floor(maxCost / price);

        if (cappedQty < 1) {
          await createAuditLog({
            action: 'TRADE_BLOCKED',
            details: `${params.symbol}: trade would be ${tradePercent.toFixed(0)}% of portfolio — exceeds ${MAX_SINGLE_TRADE_PERCENT}% limit`,
          });
          return;
        }

        await createAuditLog({
          action: 'TRADE_CAPPED',
          details: `${params.symbol}: quantity capped from ${params.quantity} to ${cappedQty} (${MAX_SINGLE_TRADE_PERCENT}% limit)`,
        });
        params.quantity = cappedQty;
      }
    } catch {
      // Can't check — proceed with caution
    }
  }

  // ── Safety #5: Daily loss circuit breaker ──
  try {
    const settings = await getSettings();
    const isOk = await checkDailyLoss(settings);
    if (!isOk) return;
  } catch {
    // Can't check — proceed
  }

  const trade = await Trade.create({
    symbol: params.symbol,
    action: params.action,
    quantity: params.quantity,
    price: 0,
    totalValue: 0,
    reasoning: params.reasoning,
    status: 'pending',
    strategy: params.strategy,
    exchange: 'US',
    executedAt: new Date(),
  });

  try {
    // ── Safety #2: conid validation ──
    const conid = await ibkrService.getConid(params.symbol);

    // Verify conid maps back to the correct symbol
    const isValid = await validateConid(conid, params.symbol);
    if (!isValid) {
      trade.status = 'failed';
      await trade.save();
      await createAuditLog({
        action: 'TRADE_BLOCKED',
        details: `conid ${conid} validation failed for ${params.symbol} — possible wrong stock match`,
        tradeId: trade.id as string,
      });
      return;
    }

    const orderResult = await ibkrService.placeOrder({
      acctId: config.ibkrAccountId,
      conid,
      side: params.action,
      quantity: params.quantity,
      orderType: 'MKT',
      tif: 'DAY',
    });

    if (orderResult.warningMessage) {
      await ibkrService.confirmOrder(orderResult.orderId);
    }

    // Mark as duplicate-protected
    recentOrders.set(orderKey, Date.now());

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
      message: `${params.action} ${params.quantity} shares of ${params.symbol}`,
      timestamp: new Date().toISOString(),
    });

    await createAuditLog({
      action: 'TRADE_EXECUTED',
      details: `${params.action} ${params.quantity} ${params.symbol}. Order ID: ${orderResult.orderId}`,
      tradeId: trade.id as string,
      metadata: { orderId: orderResult.orderId, reasoning: params.reasoning },
    });

    // ── Safety #1: Order fill verification (async, non-blocking) ──
    verifyOrderFill(orderResult.orderId, trade.id as string, params.symbol).catch(() => {
      // Non-critical — trade is already placed
    });

  } catch (error) {
    trade.status = 'failed';
    await trade.save();

    await createAuditLog({
      action: 'TRADE_FAILED',
      details: `Failed to execute ${params.action} ${params.symbol}: ${String(error)}`,
      tradeId: trade.id as string,
    });
  }
}

// ── Safety #1: Order Fill Verification ──

async function verifyOrderFill(orderId: string, tradeId: string, symbol: string): Promise<void> {
  for (let attempt = 0; attempt < ORDER_FILL_MAX_RETRIES; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, ORDER_FILL_CHECK_DELAY_MS));

    try {
      const status = await ibkrService.getOrderStatus(orderId);

      if (status.status === 'Filled') {
        await Trade.findByIdAndUpdate(tradeId, {
          status: 'filled',
          price: status.avgPrice,
          totalValue: status.avgPrice * status.filledQuantity,
        });

        await createAuditLog({
          action: 'ORDER_FILLED',
          details: `${symbol} filled: ${status.filledQuantity} shares @ $${status.avgPrice.toFixed(4)}`,
          tradeId,
        });
        return;
      }

      if (status.status === 'Cancelled' || status.status === 'Inactive') {
        await Trade.findByIdAndUpdate(tradeId, { status: 'failed' });

        // Deactivate recommendation if buy was cancelled
        await Recommendation.updateMany(
          { symbol, isActive: true },
          { isActive: false, closedAt: new Date(), closeReason: 'ORDER_CANCELLED' }
        );

        await createAuditLog({
          action: 'ORDER_CANCELLED',
          details: `${symbol} order ${orderId} was ${status.status}`,
          tradeId,
        });
        return;
      }
    } catch {
      // IBKR might not have the status yet — retry
    }
  }

  // After all retries, log that we couldn't verify
  await createAuditLog({
    action: 'ORDER_UNVERIFIED',
    details: `Could not verify fill status for ${symbol} order ${orderId} after ${ORDER_FILL_MAX_RETRIES} attempts`,
    tradeId,
  });
}

// ── Safety #2: conid Validation ──

async function validateConid(conid: number, expectedSymbol: string): Promise<boolean> {
  try {
    // Check if positions already have this conid mapped to the right symbol
    const positions = await ibkrService.getPositions();
    const matchByConid = positions.find((p) => p.conid === conid);
    if (matchByConid) {
      return matchByConid.ticker.toUpperCase() === expectedSymbol.toUpperCase();
    }

    // If not in positions, trust the search result but log it
    await createAuditLog({
      action: 'CONID_LOOKUP',
      details: `conid ${conid} resolved for ${expectedSymbol} — not in positions, using search result`,
    });
    return true;
  } catch {
    return true; // Can't validate — proceed
  }
}

// ── Safety #5: Daily Loss Circuit Breaker ──

async function checkDailyLoss(settings: ISettings): Promise<boolean> {
  try {
    const summary = await ibkrService.getAccountSummary();
    const totalPnl = summary.unrealizedPnl + summary.realizedPnl;
    const lossPercent = summary.netLiquidation > 0
      ? (totalPnl / summary.netLiquidation) * 100
      : 0;

    if (lossPercent <= -settings.maxLossPercent) {
      await createAuditLog({
        action: 'CIRCUIT_BREAKER',
        details: `Daily loss ${lossPercent.toFixed(2)}% exceeds limit of ${settings.maxLossPercent}%. Engine paused.`,
      });

      emitAlert({
        type: 'loss-limit',
        message: `CIRCUIT BREAKER: Daily loss ${lossPercent.toFixed(2)}% — all trading paused.`,
        timestamp: new Date().toISOString(),
      });

      await pauseEngine();
      return false;
    }

    return true;
  } catch {
    return true; // Can't check — proceed
  }
}

// ── Validation ──

async function checkLossLimit(settings: ISettings): Promise<boolean> {
  return checkDailyLoss(settings);
}

// ── Helpers ──

async function getEstimatedPrice(symbol: string): Promise<number> {
  try {
    const allStocks = await marketDataService.getAllStocks();
    const stock = allStocks.find((s) => s.T === symbol);
    return stock?.c ?? 0;
  } catch {
    return 0;
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

async function updatePortfolioPnl(): Promise<void> {
  const summary = await ibkrService.getAccountSummary();
  const positions = await ibkrService.getPositions();

  emitPnlUpdate({
    totalValue: summary.netLiquidation,
    todayPnl: summary.unrealizedPnl + summary.realizedPnl,
    todayPnlPercent: summary.netLiquidation > 0
      ? ((summary.unrealizedPnl + summary.realizedPnl) / summary.netLiquidation) * 100
      : 0,
    totalPnl: summary.unrealizedPnl + summary.realizedPnl,
    totalPnlPercent: 0,
    openPositions: positions.length,
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
  getScreenedCandidates,
};
