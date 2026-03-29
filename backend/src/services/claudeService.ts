import Anthropic from '@anthropic-ai/sdk';

import config from '../config';
import { AppError } from '../utils';

import type {
  CycleInput,
  CycleOutput,
  PositionReviewEntry,
  NewTradeEntry,
  WatchlistSkippedEntry,
  StabilityLogEntry,
  CycleSummaryOutput,
} from '../types/claude';

class ClaudeService {
  private client: Anthropic;

  constructor() {
    if (!config.anthropicApiKey) {
      console.warn('ANTHROPIC_API_KEY not set. Claude trading engine will not function.');
    }

    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  async getStructuredDecisions(
    input: CycleInput,
    strategyPrompt: string
  ): Promise<CycleOutput> {
    if (!config.anthropicApiKey) {
      throw new AppError(500, 'CLAUDE_NOT_CONFIGURED', 'Anthropic API key is not configured');
    }

    const userMessage = JSON.stringify({
      account: {
        available_cash: input.account.availableCash,
        total_portfolio_value: input.account.totalPortfolioValue,
        open_positions: input.account.openPositions.map((p) => ({
          ticker: p.ticker,
          direction: p.direction,
          entry_price: p.entryPrice,
          current_price: p.currentPrice,
          quantity: p.quantity,
          stop_loss: p.stopLoss,
          take_profit: p.takeProfit,
          open_date: p.openDate,
          strategy_type: p.strategyType,
          rationale: p.rationale,
        })),
      },
      watchlist: input.watchlist.map((w) => ({
        ticker: w.ticker,
        price: w.price,
        volume: w.volume,
        avg_volume_10d: w.avgVolume10d,
        rsi_14: w.rsi14,
        macd_line: w.macdLine,
        macd_signal: w.macdSignal,
        macd_hist: w.macdHist,
        ma20: w.ma20,
        ma50: w.ma50,
        ma200: w.ma200,
        atr_14: w.atr14,
        week_high_52: w.weekHigh52,
        week_low_52: w.weekLow52,
        change_pct_1d: w.changePct1d,
        change_pct_5d: w.changePct5d,
        sentiment_score: w.sentimentScore,
      })),
      previous_cycle_summary: input.previousCycleSummary.map((p) => ({
        ticker: p.ticker,
        action: p.action,
        reasoning: p.reasoning,
        outcome: p.outcome,
      })),
    }, null, 2);

    const response = await this.client.messages.create({
      model: config.claudeModel,
      max_tokens: 4096,
      system: strategyPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new AppError(500, 'CLAUDE_INVALID_RESPONSE', 'Claude returned non-text response');
    }

    return this.parseStructuredOutput(content.text);
  }

  private parseStructuredOutput(text: string): CycleOutput {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    try {
      const parsed: Record<string, unknown> = JSON.parse(cleaned);

      const rawSummary = parsed.cycle_summary as Record<string, unknown> | undefined;
      const cycleSummary: CycleSummaryOutput = {
        totalPortfolioValue: Number(rawSummary?.total_portfolio_value ?? 0),
        availableCash: Number(rawSummary?.available_cash ?? 0),
        reservedCash: Number(rawSummary?.reserved_cash ?? 0),
        deployableCash: Number(rawSummary?.deployable_cash ?? 0),
        freedCashFromSells: Number(rawSummary?.freed_cash_from_sells ?? 0),
        totalDeployable: Number(rawSummary?.total_deployable ?? 0),
        accountTier: String(rawSummary?.account_tier ?? 'micro') as CycleSummaryOutput['accountTier'],
        shortTermBudget: Number(rawSummary?.short_term_budget ?? 0),
        longTermBudget: Number(rawSummary?.long_term_budget ?? 0),
      };

      const rawReview = parsed.position_review as Array<Record<string, unknown>> | undefined;
      const positionReview: PositionReviewEntry[] = (rawReview ?? []).map((r) => ({
        ticker: String(r.ticker ?? ''),
        action: String(r.action ?? 'HOLD') as 'HOLD' | 'SELL',
        sellReason: r.sell_reason ? String(r.sell_reason) as PositionReviewEntry['sellReason'] : null,
        entryPrice: Number(r.entry_price ?? 0),
        currentPrice: Number(r.current_price ?? 0),
        pnlPct: Number(r.pnl_pct ?? 0),
        reasoning: String(r.reasoning ?? ''),
      }));

      const rawTrades = parsed.new_trades as Array<Record<string, unknown>> | undefined;
      const newTrades: NewTradeEntry[] = (rawTrades ?? []).map((t) => ({
        action: 'BUY' as const,
        ticker: String(t.ticker ?? ''),
        strategyType: String(t.strategy_type ?? 'SHORT') as 'SHORT' | 'LONG',
        strategyLabel: String(t.strategy_label ?? ''),
        price: Number(t.price ?? 0),
        quantity: Math.floor(Number(t.quantity ?? 0)),
        allocatedDollars: Number(t.allocated_dollars ?? 0),
        stopLoss: Number(t.stop_loss ?? 0),
        takeProfit: t.take_profit != null ? Number(t.take_profit) : null,
        confidence: Number(t.confidence ?? 0),
        signalsTriggered: Array.isArray(t.signals_triggered)
          ? (t.signals_triggered as string[]).map(String)
          : [],
        reasoning: String(t.reasoning ?? ''),
      }));

      const rawSkipped = parsed.watchlist_skipped as Array<Record<string, unknown>> | undefined;
      const watchlistSkipped: WatchlistSkippedEntry[] = (rawSkipped ?? []).map((s) => ({
        ticker: String(s.ticker ?? ''),
        reason: String(s.reason ?? ''),
      }));

      const rawStability = parsed.stability_log as Array<Record<string, unknown>> | undefined;
      const stabilityLog: StabilityLogEntry[] = (rawStability ?? []).map((s) => ({
        ticker: String(s.ticker ?? ''),
        previousAction: String(s.previous_action ?? ''),
        priceChangeSinceLastCycle: String(s.price_change_since_last_cycle ?? ''),
        decision: String(s.decision ?? 'KEEP') as 'KEEP' | 'DROP',
        justification: String(s.justification ?? ''),
      }));

      const rawAlerts = parsed.alerts as string[] | undefined;
      const alerts: string[] = (rawAlerts ?? []).map(String);

      return {
        cycleSummary,
        positionReview,
        newTrades,
        watchlistSkipped,
        stabilityLog,
        alerts,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        500,
        'CLAUDE_PARSE_ERROR',
        `Failed to parse Claude response: ${cleaned.substring(0, 300)}`
      );
    }
  }
}

const claudeService = new ClaudeService();

export default claudeService;
