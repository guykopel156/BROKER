import type { Request, Response } from 'express';

import { Trade } from '../models';
import ibkrService from '../services/ibkrService';

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

async function getIbkrTradeHistory(_req: Request, res: Response): Promise<void> {
  try {
    const ibkrTrades = await ibkrService.getTradeHistory();

    const mapped = ibkrTrades.map((t) => ({
      _id: t.execution_id,
      symbol: t.symbol,
      action: t.side === 'B' ? 'BUY' : 'SELL',
      quantity: t.size,
      price: t.price,
      totalValue: t.net_amount,
      reasoning: 'Manual trade via IBKR',
      status: 'filled',
      strategy: 'Manual',
      exchange: t.exchange,
      profitLoss: t.realized_pnl,
      outcomeLabel: 'Filled',
      executedAt: t.trade_time,
      commission: t.commission,
    }));

    res.json({ data: mapped });
  } catch {
    res.json({ data: [] });
  }
}

export { getRecentTrades, getAllTrades, getIbkrTradeHistory };
