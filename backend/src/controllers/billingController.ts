import type { Request, Response } from 'express';

import { AuditLog, Recommendation } from '../models';

const CLAUDE_INPUT_COST_PER_TOKEN = 3 / 1000000;
const CLAUDE_OUTPUT_COST_PER_TOKEN = 15 / 1000000;
const AVG_INPUT_TOKENS_PER_CYCLE = 2000;
const AVG_OUTPUT_TOKENS_PER_CYCLE = 500;

async function handleGetBilling(_req: Request, res: Response): Promise<void> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const cycleCount = await AuditLog.countDocuments({ action: 'CYCLE_START', createdAt: { $gte: monthStart } });
  const claudeResponses = await AuditLog.countDocuments({ action: 'CLAUDE_RESPONSE', createdAt: { $gte: monthStart } });
  const recCount = await Recommendation.countDocuments({ createdAt: { $gte: monthStart } });

  const totalClaudeCost = claudeResponses * (
    AVG_INPUT_TOKENS_PER_CYCLE * CLAUDE_INPUT_COST_PER_TOKEN +
    AVG_OUTPUT_TOKENS_PER_CYCLE * CLAUDE_OUTPUT_COST_PER_TOKEN
  );

  const polygonCost = 29;
  const totalCost = totalClaudeCost + polygonCost;

  res.json({
    data: {
      month: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      services: [
        { name: 'Claude API', description: 'Trading engine + chat bot', cost: totalClaudeCost, details: `${claudeResponses} API calls`, plan: 'Pay per use' },
        { name: 'Polygon.io', description: 'Real-time market data & stock prices', cost: polygonCost, details: 'Unlimited calls, real-time data', plan: 'Starter ($29/mo)' },
        { name: 'Twilio WhatsApp', description: 'WhatsApp notifications', cost: 0, details: 'Sandbox (free)', plan: 'Free' },
        { name: 'MongoDB Atlas', description: 'Database storage', cost: 0, details: `${recCount} records`, plan: 'Free tier' },
        { name: 'IBKR', description: 'Brokerage connection', cost: 0, details: 'No API fees', plan: 'Free' },
      ],
      total: totalCost,
      cyclesThisMonth: cycleCount,
      recommendationsThisMonth: recCount,
    },
  });
}

export { handleGetBilling };
