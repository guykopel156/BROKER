import type { Request, Response } from 'express';

import marketDataService from '../services/marketDataService';

async function getStockCandles(req: Request, res: Response): Promise<void> {
  const symbol = req.params.symbol as string;
  const days = Number(req.query.days) || 30;

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);

  const candles = await marketDataService.getCandles(
    symbol,
    'day',
    from.toISOString().split('T')[0],
    to.toISOString().split('T')[0]
  );

  const mapped = candles.map((bar) => ({
    time: new Date(bar.t).toISOString().split('T')[0],
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
  }));

  res.json({ data: mapped });
}

async function getStockPrice(req: Request, res: Response): Promise<void> {
  const symbol = req.params.symbol as string;
  const data = await marketDataService.getStockPrice(symbol);
  res.json({ data });
}

export { getStockCandles, getStockPrice };
