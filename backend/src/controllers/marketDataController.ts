import type { Request, Response } from 'express';

import marketDataService from '../services/marketDataService';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const candleCache = new Map<string, CacheEntry<unknown[]>>();
const priceCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function getStockCandles(req: Request, res: Response): Promise<void> {
  const symbol = req.params.symbol as string;
  const days = Number(req.query.days) || 30;
  const cacheKey = `${symbol}-${days}`;

  const cached = getCached(candleCache, cacheKey);
  if (cached) {
    res.json({ data: cached });
    return;
  }

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

  setCache(candleCache, cacheKey, mapped);
  res.json({ data: mapped });
}

async function getStockPrice(req: Request, res: Response): Promise<void> {
  const symbol = req.params.symbol as string;

  const cached = getCached(priceCache, symbol);
  if (cached) {
    res.json({ data: cached });
    return;
  }

  const data = await marketDataService.getStockPrice(symbol);
  setCache(priceCache, symbol, data);
  res.json({ data });
}

export { getStockCandles, getStockPrice };
