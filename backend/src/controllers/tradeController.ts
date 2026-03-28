import type { Request, Response } from 'express';

import { Trade } from '../models';

async function getRecentTrades(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 20;
  const trades = await Trade.find().sort({ executedAt: -1 }).limit(limit);
  res.json({ data: trades });
}

async function getAllTrades(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 100;
  const symbol = req.query.symbol as string | undefined;
  const action = req.query.action as string | undefined;

  const filter: Record<string, unknown> = {};
  if (symbol) filter.symbol = { $regex: symbol, $options: 'i' };
  if (action && action !== 'ALL') filter.action = action;

  const trades = await Trade.find(filter).sort({ executedAt: -1 }).limit(limit);
  res.json({ data: trades });
}

export { getRecentTrades, getAllTrades };
