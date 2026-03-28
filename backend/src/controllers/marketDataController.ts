import type { Request, Response } from 'express';
import axios from 'axios';

import config from '../config';
import marketDataService from '../services/marketDataService';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const candleCache = new Map<string, CacheEntry<unknown[]>>();
const priceCache = new Map<string, CacheEntry<unknown>>();
const detailsCache = new Map<string, CacheEntry<unknown>>();

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

async function getStockDetails(req: Request, res: Response): Promise<void> {
  const symbol = req.params.symbol as string;

  const cached = getCached(detailsCache, symbol);
  if (cached) {
    res.json({ data: cached });
    return;
  }

  // Fetch ticker details from Polygon
  let name = symbol;
  let marketCap = 0;
  let description = '';
  let sector = '';
  let exchange = '';

  try {
    const tickerResponse = await axios.get(
      `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${config.polygonApiKey}`,
      { timeout: 10000 }
    );
    const tickerData = tickerResponse.data?.results;
    if (tickerData) {
      name = tickerData.name ?? symbol;
      marketCap = tickerData.market_cap ?? 0;
      description = tickerData.description ?? '';
      sector = tickerData.sic_description ?? '';
      exchange = tickerData.primary_exchange ?? '';
    }
  } catch {
    // Skip details
  }

  // Fetch price data
  let price = 0;
  let open = 0;
  let high = 0;
  let low = 0;
  let volume = 0;
  let changePercent = 0;

  try {
    const priceData = await marketDataService.getStockPrice(symbol);
    price = priceData.price;
    open = priceData.open;
    high = priceData.high;
    low = priceData.low;
    volume = priceData.volume;
    changePercent = priceData.changePercent;
  } catch {
    // Skip price
  }

  const details = {
    symbol,
    name,
    price,
    open,
    high,
    low,
    volume,
    changePercent,
    marketCap,
    description: description.substring(0, 300),
    sector,
    exchange,
  };

  setCache(detailsCache, symbol, details);
  res.json({ data: details });
}

export { getStockCandles, getStockPrice, getStockDetails };
