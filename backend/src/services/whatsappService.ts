import twilio from 'twilio';

import config from '../config';
import { Recommendation, Trade, Settings } from '../models';
import ibkrService from './ibkrService';

interface WhatsAppConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  toNumber: string;
}

function getWhatsAppConfig(): WhatsAppConfig {
  return {
    accountSid: config.twilioAccountSid,
    authToken: config.twilioAuthToken,
    fromNumber: config.twilioWhatsappFrom,
    toNumber: config.whatsappToNumber,
  };
}

function isConfigured(): boolean {
  const cfg = getWhatsAppConfig();
  return Boolean(cfg.accountSid && cfg.authToken && cfg.fromNumber && cfg.toNumber);
}

async function sendWhatsAppMessage(message: string): Promise<void> {
  if (!isConfigured()) {
    console.log('WhatsApp not configured — skipping message');
    return;
  }

  const cfg = getWhatsAppConfig();
  const client = twilio(cfg.accountSid, cfg.authToken);

  await client.messages.create({
    body: message,
    from: `whatsapp:${cfg.fromNumber}`,
    to: `whatsapp:${cfg.toNumber}`,
  });
}

async function sendDailySummary(): Promise<void> {
  const lines: string[] = [];
  lines.push('📊 *BROKER — Daily Update*');
  lines.push(`📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
  lines.push('');

  // Portfolio
  try {
    const summary = await ibkrService.getAccountSummary();
    lines.push('💰 *Portfolio*');
    lines.push(`• Total Value: $${summary.netLiquidation.toFixed(2)}`);
    lines.push(`• Cash: $${summary.totalCashValue.toFixed(2)}`);
    lines.push(`• Unrealized P&L: $${summary.unrealizedPnl.toFixed(2)}`);
    lines.push('');
  } catch {
    lines.push('💰 *Portfolio:* IBKR not connected');
    lines.push('');
  }

  // Positions
  try {
    const positions = await ibkrService.getPositions();
    if (positions.length > 0) {
      lines.push(`📈 *Positions (${positions.length})*`);
      for (const pos of positions) {
        const pnlPercent = pos.avgPrice > 0 ? ((pos.mktPrice - pos.avgPrice) / pos.avgPrice) * 100 : 0;
        const emoji = pos.unrealizedPnl >= 0 ? '🟢' : '🔴';
        lines.push(`${emoji} ${pos.ticker}: ${pos.position} shares @ $${pos.mktPrice.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%)`);
      }
      lines.push('');
    }
  } catch { /* skip */ }

  // Recommendations
  const recs = await Recommendation.find().sort({ cycleTimestamp: -1 }).limit(5);
  if (recs.length > 0) {
    lines.push('🎯 *Latest Recommendations*');
    for (const rec of recs) {
      const isLong = rec.strategy?.toLowerCase().startsWith('long');
      const badge = isLong ? '🔵 LONG' : '🟡 SHORT';
      lines.push(`• ${rec.action} *${rec.symbol}* — ${rec.quantity} shares (${rec.confidence}%) ${badge}`);
      lines.push(`  _${rec.reasoning.substring(0, 100)}_`);
    }
    lines.push('');
  }

  // Recent trades
  const trades = await Trade.find().sort({ executedAt: -1 }).limit(3);
  if (trades.length > 0) {
    lines.push('🔄 *Recent Trades*');
    for (const trade of trades) {
      const emoji = trade.action === 'BUY' ? '🟢' : '🔴';
      lines.push(`${emoji} ${trade.action} ${trade.symbol} — ${trade.quantity} shares — ${trade.status}`);
    }
    lines.push('');
  }

  // Settings
  const settings = await Settings.findOne();
  if (settings) {
    lines.push('⚙️ *Engine*');
    lines.push(`• Status: ${settings.isClaudePaused ? '⏸ Paused' : '▶ Running'}`);
    lines.push(`• Interval: ${settings.tradingIntervalMinutes} min`);
    lines.push(`• Mode: ${settings.isPaperTrading ? 'Paper' : '🔴 LIVE'}`);
  }

  lines.push('');
  lines.push('_Sent by BROKER AI Agent_');

  await sendWhatsAppMessage(lines.join('\n'));
  console.log('WhatsApp daily summary sent');
}

async function sendTradeAlert(action: string, symbol: string, quantity: number, reasoning: string): Promise<void> {
  const message = [
    `🚨 *Trade Alert*`,
    ``,
    `${action === 'BUY' ? '🟢' : '🔴'} *${action} ${symbol}*`,
    `• Shares: ${quantity}`,
    `• Reason: _${reasoning.substring(0, 150)}_`,
    ``,
    `_BROKER AI Agent_`,
  ].join('\n');

  await sendWhatsAppMessage(message);
}

async function sendRecommendationAlert(recs: Array<{ action: string; symbol: string; quantity: number; strategy: string; confidence: number }>): Promise<void> {
  const lines: string[] = [];
  lines.push('🎯 *New Recommendations*');
  lines.push('');

  for (const rec of recs) {
    const isLong = rec.strategy?.toLowerCase().startsWith('long');
    lines.push(`• ${rec.action} *${rec.symbol}* — ${rec.quantity} shares`);
    lines.push(`  ${isLong ? '🔵 Long-term' : '🟡 Short-term'} | ${rec.confidence}% confidence`);
  }

  lines.push('');
  lines.push('_BROKER AI Agent_');

  await sendWhatsAppMessage(lines.join('\n'));
}

export {
  sendWhatsAppMessage,
  sendDailySummary,
  sendTradeAlert,
  sendRecommendationAlert,
  isConfigured,
};
