import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

import config from '../config';
import { AppError } from '../utils';
import { Trade, Recommendation, Settings } from '../models';
import ibkrService from '../services/ibkrService';
import marketDataService from '../services/marketDataService';
import { pauseEngine, resumeEngine, runCycle } from '../services/tradingEngine';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function buildContext(): Promise<string> {
  const lines: string[] = [];

  // Portfolio
  try {
    const summary = await ibkrService.getAccountSummary();
    lines.push('=== YOUR PORTFOLIO ===');
    lines.push(`Total Value: $${summary.netLiquidation.toFixed(2)}`);
    lines.push(`Available Cash: $${summary.totalCashValue.toFixed(2)}`);
    lines.push(`Unrealized P&L: $${summary.unrealizedPnl.toFixed(2)}`);
    lines.push(`Buying Power: $${summary.buyingPower.toFixed(2)}`);
  } catch {
    lines.push('=== PORTFOLIO: Unable to fetch (IBKR may be disconnected) ===');
  }

  // Positions
  try {
    const positions = await ibkrService.getPositions();
    if (positions.length > 0) {
      lines.push('\n=== OPEN POSITIONS ===');
      for (const pos of positions) {
        lines.push(`${pos.ticker}: ${pos.position} shares @ $${pos.avgPrice.toFixed(2)} | Current: $${pos.mktPrice.toFixed(2)} | P&L: $${pos.unrealizedPnl.toFixed(2)}`);
      }
    } else {
      lines.push('\n=== NO OPEN POSITIONS ===');
    }
  } catch {
    lines.push('\n=== POSITIONS: Unable to fetch ===');
  }

  // Recent recommendations
  const recommendations = await Recommendation.find().sort({ cycleTimestamp: -1 }).limit(5);
  if (recommendations.length > 0) {
    lines.push('\n=== LATEST RECOMMENDATIONS ===');
    for (const rec of recommendations) {
      lines.push(`${rec.action} ${rec.symbol} (${rec.quantity} shares) — ${rec.strategy} — Confidence: ${rec.confidence}%`);
      lines.push(`  Reasoning: ${rec.reasoning}`);
    }
  }

  // Recent trades
  const trades = await Trade.find().sort({ executedAt: -1 }).limit(5);
  if (trades.length > 0) {
    lines.push('\n=== RECENT TRADES ===');
    for (const trade of trades) {
      lines.push(`${trade.action} ${trade.symbol} ${trade.quantity} shares @ $${trade.price.toFixed(2)} — Status: ${trade.status}`);
    }
  }

  // Settings
  const settings = await Settings.findOne();
  if (settings) {
    lines.push('\n=== ENGINE SETTINGS ===');
    lines.push(`Trading Interval: ${settings.tradingIntervalMinutes} minutes`);
    lines.push(`Max Loss Limit: ${settings.maxLossPercent}%`);
    lines.push(`Paper Trading: ${settings.isPaperTrading ? 'YES' : 'NO (LIVE)'}`);
    lines.push(`Engine Paused: ${settings.isClaudePaused ? 'YES' : 'NO (Running)'}`);
  }

  return lines.join('\n');
}

function detectAction(message: string): string | null {
  const lower = message.toLowerCase();
  if (lower.includes('pause') && (lower.includes('engine') || lower.includes('trading') || lower.includes('claude'))) return 'PAUSE';
  if (lower.includes('resume') && (lower.includes('engine') || lower.includes('trading') || lower.includes('claude'))) return 'RESUME';
  if (lower.includes('run') && (lower.includes('cycle') || lower.includes('analyze') || lower.includes('scan'))) return 'RUN_CYCLE';
  if (lower.includes('analyze') && lower.includes('now')) return 'RUN_CYCLE';
  return null;
}

async function executeAction(action: string): Promise<string> {
  switch (action) {
    case 'PAUSE':
      await pauseEngine();
      return '⏸ Trading engine has been paused. No new trades will be executed.';
    case 'RESUME':
      await resumeEngine();
      return '▶ Trading engine has been resumed. Claude will analyze the market on the next cycle.';
    case 'RUN_CYCLE':
      runCycle().catch(() => { /* handled internally */ });
      return '🔄 Trading cycle triggered. Claude is analyzing the market now. Check recommendations in ~30 seconds.';
    default:
      return '';
  }
}

async function handleChat(req: Request, res: Response): Promise<void> {
  const { message, history } = req.body as { message: string; history?: ChatMessage[] };

  if (!message) {
    throw new AppError(400, 'MISSING_MESSAGE', 'Message is required');
  }

  if (!config.anthropicApiKey) {
    throw new AppError(500, 'CLAUDE_NOT_CONFIGURED', 'Claude API key not configured');
  }

  // Check for actions
  const action = detectAction(message);
  let actionResult = '';
  if (action) {
    actionResult = await executeAction(action);
  }

  // Fetch stock price if user asks about a specific stock
  let stockContext = '';
  const tickerMatch = message.match(/\b([A-Z]{1,5})\b/);
  if (tickerMatch) {
    const symbol = tickerMatch[1];
    try {
      const stockData = await marketDataService.getStockPrice(symbol);
      stockContext = `\n\n=== LIVE DATA FOR ${symbol} ===\nPrice: $${stockData.price.toFixed(2)} | Change: ${stockData.changePercent.toFixed(2)}% | Open: $${stockData.open.toFixed(2)} | High: $${stockData.high.toFixed(2)} | Low: $${stockData.low.toFixed(2)} | Volume: ${stockData.volume}`;

      try {
        const rsi = await marketDataService.getRsi(symbol);
        if (rsi !== undefined) stockContext += ` | RSI: ${rsi.toFixed(1)}`;
      } catch { /* skip */ }
    } catch { /* skip */ }
  }

  // Build full context
  const portfolioContext = await buildContext();

  const systemPrompt = `You are the AI trading assistant for the BROKER dashboard. You have FULL access to the user's portfolio, positions, recommendations, and trades.

${portfolioContext}
${stockContext}
${actionResult ? `\n=== ACTION TAKEN ===\n${actionResult}` : ''}

=== YOUR CAPABILITIES ===
- Answer questions about the user's portfolio, positions, and P&L
- Explain why trades were recommended or executed
- Analyze any stock the user asks about (you have live price data)
- Give trading advice and market analysis
- The user can ask you to: pause trading, resume trading, run a new analysis cycle
- You can see all recent recommendations and their reasoning

=== RESPONSE FORMAT ===
- ALWAYS respond in clear bullet points (use • or -)
- Each point should be one clear idea with specific data
- Use sections with headers when explaining strategies or multiple stocks
- Example format:
  **SNDL — Cannabis Catalyst Play**
  • Price: $1.31
  • Why: Rescheduling news, 1.6M volume
  • Shares: 7 (fits $10 budget)
  • Risk: Stop loss at $1.10

=== RULES ===
- Be concise but informative — bullet points, not paragraphs
- Use numbers and data from the context above
- If the user asks about a stock, reference the live data provided
- If an action was taken, confirm it to the user
- Speak like a smart trading partner, not a textbook
- Use $ for prices, % for percentages
- When explaining strategy, list each rule/criteria as a bullet point
- When showing recommendations, list each stock separately with its own section`;

  const messages = [
    ...(history ?? []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new AppError(500, 'CLAUDE_INVALID_RESPONSE', 'Unexpected response type');
  }

  const reply = actionResult
    ? `${actionResult}\n\n${content.text}`
    : content.text;

  res.json({ data: { reply } });
}

export { handleChat };
