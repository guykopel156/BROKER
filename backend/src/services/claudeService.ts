import Anthropic from '@anthropic-ai/sdk';

import config from '../config';
import { AppError } from '../utils';

import type { MarketContext, TradeDecision } from '../types/claude';

const RESPONSE_FORMAT_INSTRUCTION = `
You MUST respond with valid JSON only. No markdown, no explanation outside JSON.
Respond with an array of trade decisions:
[
  {
    "action": "BUY" | "SELL" | "HOLD",
    "symbol": "TICKER",
    "quantity": number,
    "reasoning": "detailed explanation",
    "confidence": 0-100,
    "strategy": "strategy name"
  }
]
If no action should be taken, respond with:
[{ "action": "HOLD", "symbol": "", "quantity": 0, "reasoning": "explanation", "confidence": 0, "strategy": "" }]
`;

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

  async getTradeDecisions(
    context: MarketContext,
    strategyPrompt: string
  ): Promise<TradeDecision[]> {
    if (!config.anthropicApiKey) {
      throw new AppError(500, 'CLAUDE_NOT_CONFIGURED', 'Anthropic API key is not configured');
    }

    const userMessage = this.buildContextMessage(context);

    const response = await this.client.messages.create({
      model: config.claudeModel,
      max_tokens: 2048,
      system: `${strategyPrompt}\n\n${RESPONSE_FORMAT_INSTRUCTION}`,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new AppError(500, 'CLAUDE_INVALID_RESPONSE', 'Claude returned non-text response');
    }

    return this.parseDecisions(content.text);
  }

  private buildContextMessage(context: MarketContext): string {
    const lines: string[] = [];

    lines.push('=== CURRENT PORTFOLIO ===');
    lines.push(`Total Value: $${context.portfolio.totalValue.toFixed(2)}`);
    lines.push(`Available Cash: $${context.portfolio.availableCash.toFixed(2)}`);
    lines.push(`Today P&L: $${context.portfolio.todayPnl.toFixed(2)}`);

    if (context.portfolio.openPositions.length > 0) {
      lines.push('\nOpen Positions:');
      for (const pos of context.portfolio.openPositions) {
        lines.push(
          `  ${pos.symbol}: ${pos.shares} shares @ $${pos.avgEntryPrice.toFixed(2)} | ` +
          `Current: $${pos.currentPrice.toFixed(2)} | ` +
          `P&L: $${pos.unrealizedPnl.toFixed(2)} (${pos.unrealizedPnlPercent.toFixed(2)}%)`
        );
      }
    } else {
      lines.push('\nNo open positions.');
    }

    const availableCash = context.portfolio.availableCash;
    lines.push(`\n=== BUDGET CONSTRAINT: You have $${availableCash.toFixed(2)} to spend ===`);
    lines.push(`ONLY recommend stocks where price <= $${availableCash.toFixed(2)}`);

    lines.push('\n=== MARKET DATA (USE THESE EXACT PRICES) ===');
    const affordableStocks: string[] = [];
    const expensiveStocks: string[] = [];

    for (const stock of context.marketData) {
      const maxShares = Math.floor(availableCash * 0.95 / stock.price);
      let line =
        `${stock.symbol}: PRICE=$${stock.price.toFixed(2)} | ` +
        `Change: ${stock.changePercent.toFixed(2)}% | ` +
        `Vol: ${stock.volume} | ` +
        `You can buy: ${maxShares} shares`;

      if (stock.rsi !== undefined) line += ` | RSI: ${stock.rsi.toFixed(1)}`;
      if (stock.macd !== undefined) line += ` | MACD: ${stock.macd.toFixed(2)}`;
      if (stock.movingAvg20 !== undefined) line += ` | MA20: $${stock.movingAvg20.toFixed(2)}`;
      if (stock.movingAvg50 !== undefined) line += ` | MA50: $${stock.movingAvg50.toFixed(2)}`;

      if (maxShares > 0) {
        affordableStocks.push(line + ' ✅ AFFORDABLE');
      } else {
        expensiveStocks.push(line + ' ❌ TOO EXPENSIVE');
      }
    }

    if (affordableStocks.length > 0) {
      lines.push('\nAFFORDABLE (can buy):');
      affordableStocks.forEach((s) => lines.push(s));
    }
    if (expensiveStocks.length > 0) {
      lines.push('\nTOO EXPENSIVE (skip these):');
      expensiveStocks.forEach((s) => lines.push(s));
    }

    if (context.news.length > 0) {
      lines.push('\n=== NEWS ===');
      for (const item of context.news) {
        const symbolTag = item.symbol ? ` [${item.symbol}]` : '';
        lines.push(`- ${item.title}${symbolTag} (${item.source}, ${item.publishedAt})`);
      }
    }

    lines.push('\n=== INSTRUCTIONS ===');
    lines.push('Analyze the above data and provide your trading decisions.');

    return lines.join('\n');
  }

  private parseDecisions(text: string): TradeDecision[] {
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

    try {
      const parsed: unknown = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new AppError(500, 'CLAUDE_PARSE_ERROR', 'Claude response is not an array');
      }

      return parsed.map((item: Record<string, unknown>) => ({
        action: String(item.action) as TradeDecision['action'],
        symbol: String(item.symbol ?? ''),
        quantity: Number(item.quantity ?? 0),
        reasoning: String(item.reasoning ?? ''),
        confidence: Number(item.confidence ?? 0),
        strategy: String(item.strategy ?? ''),
      }));
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'CLAUDE_PARSE_ERROR', `Failed to parse Claude response: ${cleaned.substring(0, 200)}`);
    }
  }
}

const claudeService = new ClaudeService();

export default claudeService;
