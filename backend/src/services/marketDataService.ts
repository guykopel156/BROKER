import axios, { type AxiosInstance } from 'axios';

import config from '../config';
import { AppError } from '../utils';
import { calculateAllIndicators } from '../utils/technicalAnalysis';

import type { StockData, NewsItem, WatchlistItem } from '../types/claude';
import type { TechnicalIndicators, Candle } from '../utils/technicalAnalysis';

const POLYGON_BASE_URL = 'https://api.polygon.io';
const API_DELAY_MS = 250;

interface PolygonPrevCloseResult {
  T: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw: number;
}

interface PolygonPrevCloseResponse {
  results: PolygonPrevCloseResult[];
}

interface PolygonAggBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

interface PolygonAggsResponse {
  results: PolygonAggBar[];
}

interface PolygonRsiResult {
  value: number;
  timestamp: number;
}

interface PolygonIndicatorResponse {
  results: {
    values: PolygonRsiResult[];
  };
}

interface PolygonMacdResult {
  value: number;
  signal: number;
  histogram: number;
  timestamp: number;
}

interface PolygonMacdResponse {
  results: {
    values: PolygonMacdResult[];
  };
}

interface PolygonNewsArticle {
  title: string;
  author: string;
  published_utc: string;
  tickers: string[];
  publisher: {
    name: string;
  };
}

interface PolygonNewsResponse {
  results: PolygonNewsArticle[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GroupedStockData {
  T: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface GroupedResponse {
  results: GroupedStockData[];
}

// Cache for grouped daily data (all stocks in one call)
let groupedCache: { data: GroupedStockData[]; expiresAt: number } | null = null;
const GROUPED_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (paid plan)

// Cache for snapshot data (real-time prices)
let snapshotCache: { data: Map<string, SnapshotData>; expiresAt: number } | null = null;
const SNAPSHOT_CACHE_TTL_MS = 30 * 1000; // 30 seconds

// Cache for candle data per symbol (avoid re-fetching within a cycle)
const candleCache: Map<string, { data: PolygonAggBar[]; expiresAt: number }> = new Map();
const CANDLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (faster refresh on paid plan)
const RATE_LIMIT_DELAY_MS = 100; // Paid plan — minimal delay between calls

// Cache for news sentiment
const newsCache: Map<string, { sentiment: number; expiresAt: number }> = new Map();
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface SnapshotData {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevClose: number;
  changePct: number;
  vwap: number;
  name: string;
}

interface SnapshotResult {
  ticker: string;
  name: string;
  type: string;
  session: {
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    previous_close: number;
    change_percent: number;
    vwap: number;
  };
}

interface SnapshotResponse {
  results: SnapshotResult[];
}

class MarketDataService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: POLYGON_BASE_URL,
      timeout: 15000,
      params: { apiKey: config.polygonApiKey },
    });
  }

  // ── Real-Time Snapshots ──

  async getSnapshots(tickers: string[]): Promise<Map<string, SnapshotData>> {
    // Check cache
    if (snapshotCache && snapshotCache.expiresAt > Date.now()) {
      // Return only requested tickers from cache
      const result = new Map<string, SnapshotData>();
      for (const t of tickers) {
        const cached = snapshotCache.data.get(t.toUpperCase());
        if (cached) result.set(t.toUpperCase(), cached);
      }
      if (result.size > 0) return result;
    }

    this.validateApiKey();

    const result = new Map<string, SnapshotData>();

    // Fetch in batches of 50 (API limit per request)
    for (let i = 0; i < tickers.length; i += 50) {
      const batch = tickers.slice(i, i + 50);
      const tickerParam = batch.join(',');

      try {
        const response = await this.request<SnapshotResponse>(
          `/v3/snapshot?ticker.any_of=${tickerParam}`
        );

        for (const snap of response.results ?? []) {
          const data: SnapshotData = {
            ticker: snap.ticker,
            price: snap.session?.price ?? snap.session?.close ?? 0,
            open: snap.session?.open ?? 0,
            high: snap.session?.high ?? 0,
            low: snap.session?.low ?? 0,
            close: snap.session?.close ?? 0,
            volume: snap.session?.volume ?? 0,
            prevClose: snap.session?.previous_close ?? 0,
            changePct: snap.session?.change_percent ?? 0,
            vwap: snap.session?.vwap ?? 0,
            name: snap.name ?? snap.ticker,
          };
          result.set(snap.ticker.toUpperCase(), data);
        }
      } catch {
        // Skip batch on error
      }
    }

    // Update cache
    snapshotCache = { data: result, expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS };
    return result;
  }

  async getRealtimePrice(ticker: string): Promise<number> {
    const snapshots = await this.getSnapshots([ticker]);
    const snap = snapshots.get(ticker.toUpperCase());
    return snap?.price ?? 0;
  }

  async getRealtimePrices(tickers: string[]): Promise<Map<string, number>> {
    const snapshots = await this.getSnapshots(tickers);
    const prices = new Map<string, number>();
    for (const [key, snap] of snapshots) {
      prices.set(key, snap.price);
    }
    return prices;
  }

  // ── News Sentiment ──

  async getNewsSentiment(ticker: string): Promise<number | null> {
    const cacheKey = ticker.toUpperCase();
    const cached = newsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.sentiment;
    }

    try {
      const newsItems = await this.getNews([ticker], 5);
      if (newsItems.length === 0) return null;

      // Simple sentiment: count positive/negative keywords in titles
      let score = 0;
      const positiveWords = ['surge', 'jump', 'rally', 'gain', 'up', 'high', 'bull', 'soar', 'record', 'growth', 'profit', 'beat', 'strong'];
      const negativeWords = ['crash', 'drop', 'fall', 'loss', 'down', 'low', 'bear', 'plunge', 'decline', 'weak', 'miss', 'cut', 'warn'];

      for (const item of newsItems) {
        const titleLower = item.title.toLowerCase();
        for (const word of positiveWords) {
          if (titleLower.includes(word)) score += 0.2;
        }
        for (const word of negativeWords) {
          if (titleLower.includes(word)) score -= 0.2;
        }
      }

      const sentiment = Math.max(-1, Math.min(1, score));
      newsCache.set(cacheKey, { sentiment, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
      return sentiment;
    } catch {
      return null;
    }
  }

  // ── Sector Lookup ──

  private sectorCache: Map<string, { sector: string; expiresAt: number }> = new Map();

  async getSector(ticker: string): Promise<string> {
    const cacheKey = ticker.toUpperCase();
    const cached = this.sectorCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.sector;
    }

    try {
      const response = await this.request<{ results: { sic_description?: string } }>(
        `/v3/reference/tickers/${ticker}`
      );
      const sector = response.results?.sic_description ?? 'Unknown';
      this.sectorCache.set(cacheKey, { sector, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }); // Cache 24h
      return sector;
    } catch {
      return 'Unknown';
    }
  }

  // ── All Stocks (single API call) ──

  async getAllStocks(): Promise<GroupedStockData[]> {
    if (groupedCache && groupedCache.expiresAt > Date.now()) {
      return groupedCache.data;
    }

    this.validateApiKey();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Skip weekends
    if (yesterday.getDay() === 0) yesterday.setDate(yesterday.getDate() - 2);
    if (yesterday.getDay() === 6) yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const response = await this.request<GroupedResponse>(
      `/v2/aggs/grouped/locale/us/market/stocks/${dateStr}?adjusted=true`
    );

    const results = response.results ?? [];
    groupedCache = { data: results, expiresAt: Date.now() + GROUPED_CACHE_TTL_MS };
    return results;
  }

  async getTopMovers(limit: number = 20): Promise<StockData[]> {
    const all = await this.getAllStocks();
    // Sort by volume, filter out penny stocks with no volume
    const sorted = all
      .filter((s) => s.v > 100000 && s.c > 0.01)
      .sort((a, b) => b.v - a.v)
      .slice(0, limit);

    return sorted.map((s) => ({
      symbol: s.T,
      price: s.c,
      open: s.o,
      high: s.h,
      low: s.l,
      volume: s.v,
      changePercent: s.o > 0 ? ((s.c - s.o) / s.o) * 100 : 0,
    }));
  }

  // ── Stock Prices (free tier: previous close) ──

  async getStockPrice(symbol: string): Promise<StockData> {
    this.validateApiKey();

    const response = await this.request<PolygonPrevCloseResponse>(
      `/v2/aggs/ticker/${symbol}/prev?adjusted=true`
    );

    const result = response.results?.[0];
    if (!result) {
      throw new AppError(404, 'STOCK_NOT_FOUND', `No data found for ${symbol}`);
    }

    return {
      symbol,
      price: result.c,
      open: result.o,
      high: result.h,
      low: result.l,
      volume: result.v,
      changePercent: result.o > 0 ? ((result.c - result.o) / result.o) * 100 : 0,
    };
  }

  async getMultipleStockPrices(symbols: string[]): Promise<StockData[]> {
    const results: StockData[] = [];

    for (const symbol of symbols) {
      try {
        const data = await this.getStockPrice(symbol);
        results.push(data);
        await delay(API_DELAY_MS);
      } catch {
        // Skip stocks that fail
      }
    }

    return results;
  }

  // ── Candles (OHLCV) ──

  async getCandles(
    symbol: string,
    timespan: 'minute' | 'hour' | 'day' | 'week',
    from: string,
    to: string,
    multiplier: number = 1
  ): Promise<PolygonAggBar[]> {
    this.validateApiKey();

    const response = await this.request<PolygonAggsResponse>(
      `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc`
    );

    return response.results ?? [];
  }

  // ── Technical Indicators ──

  async getRsi(symbol: string, period: number = 14): Promise<number | undefined> {
    this.validateApiKey();

    try {
      const response = await this.request<PolygonIndicatorResponse>(
        `/v1/indicators/rsi/${symbol}?timespan=day&window=${period}&series_type=close&limit=1`
      );

      const values = response.results?.values ?? [];
      return values[0]?.value;
    } catch {
      return undefined;
    }
  }

  async getMacd(symbol: string): Promise<{ value: number; signal: number; histogram: number } | undefined> {
    this.validateApiKey();

    try {
      const response = await this.request<PolygonMacdResponse>(
        `/v1/indicators/macd/${symbol}?timespan=day&short_window=12&long_window=26&signal_window=9&series_type=close&limit=1`
      );

      const values = response.results?.values ?? [];
      const latest = values[0];
      if (!latest) return undefined;

      return {
        value: latest.value,
        signal: latest.signal,
        histogram: latest.histogram,
      };
    } catch {
      return undefined;
    }
  }

  async getSma(symbol: string, period: number): Promise<number | undefined> {
    this.validateApiKey();

    try {
      const response = await this.request<PolygonIndicatorResponse>(
        `/v1/indicators/sma/${symbol}?timespan=day&window=${period}&series_type=close&limit=1`
      );

      const values = response.results?.values ?? [];
      return values[0]?.value;
    } catch {
      return undefined;
    }
  }

  // ── News ──

  async getNews(symbols?: string[], limit: number = 10): Promise<NewsItem[]> {
    this.validateApiKey();

    let url = `/v2/reference/news?limit=${limit}&order=desc&sort=published_utc`;
    if (symbols && symbols.length > 0) {
      url += `&ticker=${symbols[0]}`;
    }

    try {
      const response = await this.request<PolygonNewsResponse>(url);

      return (response.results ?? []).map((article) => ({
        title: article.title,
        source: article.publisher.name,
        symbol: article.tickers?.[0],
        publishedAt: article.published_utc,
      }));
    } catch {
      return [];
    }
  }

  // ── Full Context Builder ──

  async getFullStockData(symbols: string[]): Promise<StockData[]> {
    const stockPrices = await this.getMultipleStockPrices(symbols);

    const enriched: StockData[] = [];

    for (const stock of stockPrices) {
      await delay(API_DELAY_MS);

      const [rsi, macd, sma20, sma50] = await Promise.all([
        this.getRsi(stock.symbol),
        this.getMacd(stock.symbol),
        this.getSma(stock.symbol, 20),
        this.getSma(stock.symbol, 50),
      ]);

      enriched.push({
        ...stock,
        rsi,
        macd: macd?.value,
        movingAvg20: sma20,
        movingAvg50: sma50,
      });
    }

    return enriched;
  }

  // ── Enriched Watchlist (local indicators, rate-limit safe) ──

  async getEnrichedWatchlist(
    symbols: string[],
    groupedData: GroupedStockData[]
  ): Promise<WatchlistItem[]> {
    const watchlist: WatchlistItem[] = [];
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 365);
    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];

    for (const symbol of symbols) {
      const grouped = groupedData.find((s) => s.T === symbol);
      if (!grouped) continue;

      let indicators: TechnicalIndicators = {
        rsi14: null,
        macdLine: null,
        macdSignal: null,
        macdHistogram: null,
        sma20: null,
        sma50: null,
        sma200: null,
        atr14: null,
        weekHigh52: null,
        weekLow52: null,
        avgVolume10d: null,
        changePct5d: null,
      };

      try {
        const cacheKey = symbol.toUpperCase();
        const cached = candleCache.get(cacheKey);

        let candles: PolygonAggBar[];

        if (cached && cached.expiresAt > Date.now()) {
          candles = cached.data;
        } else {
          await delay(RATE_LIMIT_DELAY_MS);
          candles = await this.getCandles(symbol, 'day', fromStr, toStr);
          candleCache.set(cacheKey, { data: candles, expiresAt: Date.now() + CANDLE_CACHE_TTL_MS });
        }

        if (candles.length > 0) {
          indicators = calculateAllIndicators(candles as Candle[]);
        }
      } catch {
        // Skip this stock's indicators on error
      }

      const changePct1d = grouped.o > 0
        ? ((grouped.c - grouped.o) / grouped.o) * 100
        : 0;

      watchlist.push({
        ticker: symbol,
        price: grouped.c,
        volume: grouped.v,
        avgVolume10d: indicators.avgVolume10d,
        rsi14: indicators.rsi14,
        macdLine: indicators.macdLine,
        macdSignal: indicators.macdSignal,
        macdHist: indicators.macdHistogram,
        ma20: indicators.sma20,
        ma50: indicators.sma50,
        ma200: indicators.sma200,
        atr14: indicators.atr14,
        weekHigh52: indicators.weekHigh52,
        weekLow52: indicators.weekLow52,
        changePct1d,
        changePct5d: indicators.changePct5d,
        sentimentScore: null,
      });
    }

    // Fetch sentiment for top 10 candidates (don't slow down for all 30)
    const topForSentiment = watchlist
      .sort((a, b) => Math.abs(b.changePct1d) - Math.abs(a.changePct1d))
      .slice(0, 10);

    for (const item of topForSentiment) {
      try {
        const sentiment = await this.getNewsSentiment(item.ticker);
        const idx = watchlist.findIndex((w) => w.ticker === item.ticker);
        if (idx >= 0 && sentiment !== null) {
          watchlist[idx].sentimentScore = sentiment;
        }
      } catch { /* skip */ }
    }

    return watchlist;
  }

  // ── Smart Stock Screener ──
  // Scores ALL stocks — all thresholds scale relative to available cash

  screenTopCandidates(
    allStocks: GroupedStockData[],
    extraSymbols: string[],
    maxCandidates: number = 12,
    availableCash: number = 10000
  ): string[] {
    const maxPrice = availableCash * 0.95;

    // All thresholds scale with balance
    const minVolume = Math.max(1000, Math.floor(availableCash * 10));

    // Filter: must be affordable and have some volume
    const candidates = allStocks.filter(
      (s) => s.c > 0 && s.c <= maxPrice && s.v >= minVolume
    );

    const scored: Array<{ ticker: string; score: number }> = [];

    for (const stock of candidates) {
      let score = 0;
      const changePct = stock.o > 0 ? ((stock.c - stock.o) / stock.o) * 100 : 0;
      const absChange = Math.abs(changePct);
      const dollarVolume = stock.v * stock.c;
      const sharesBuyable = Math.floor(maxPrice / stock.c);
      const dayRange = stock.h - stock.l;
      const rangePercent = stock.l > 0 ? (dayRange / stock.l) * 100 : 0;

      // ── % Daily move (scaled: bigger move = more points, no cap) ──
      score += Math.min(absChange * 2, 50);

      // ── Shares buyable (scaled relative to balance) ──
      // More shares = more leverage on % moves
      const buyableRatio = sharesBuyable / Math.max(maxPrice, 1);
      score += Math.min(buyableRatio * 5, 30);

      // ── Volume relative to price (interest relative to stock size) ──
      const relativeVolume = stock.v / Math.max(stock.c, 0.01);
      const relVolScore = Math.log10(Math.max(relativeVolume, 1)) * 3;
      score += Math.min(relVolScore, 30);

      // ── Intraday volatility (range as % of price) ──
      score += Math.min(rangePercent * 0.8, 20);

      // ── Liquidity check (dollar volume relative to balance) ──
      const liquidityRatio = dollarVolume / Math.max(availableCash, 1);
      if (liquidityRatio > 100) score += 15;
      else if (liquidityRatio > 10) score += 10;
      else if (liquidityRatio > 1) score += 5;
      else score -= 15; // Can't sell it easily

      // ── Near daily low (bounce potential) ──
      if (dayRange > 0) {
        const posInRange = (stock.c - stock.l) / dayRange;
        if (posInRange < 0.3) score += 10;
      }

      // ── Closing near high with upward momentum ──
      if (dayRange > 0 && changePct > 0) {
        const posInRange = (stock.c - stock.l) / dayRange;
        if (posInRange > 0.7) score += 10;
      }

      scored.push({ ticker: stock.T, score });
    }

    // Sort by score, take best
    scored.sort((a, b) => b.score - a.score);
    const topTickers = scored.slice(0, maxCandidates).map((s) => s.ticker);

    // Always include held/previous positions
    const result = new Set([...topTickers, ...extraSymbols]);
    return [...result].slice(0, maxCandidates + extraSymbols.length);
  }

  // ── Helpers ──

  private validateApiKey(): void {
    if (!config.polygonApiKey) {
      throw new AppError(500, 'POLYGON_NOT_CONFIGURED', 'Polygon API key is not configured');
    }
  }

  private async request<T>(path: string, retries: number = 1): Promise<T> {
    try {
      const response = await this.client.get<T>(path);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 500;
        const message = error.response?.data?.message ?? error.response?.data?.error ?? error.message;

        if (status === 403) {
          throw new AppError(403, 'POLYGON_AUTH_FAILED', `Polygon API: ${message}`);
        }

        if (status === 429) {
          if (retries > 0) {
            console.log(`Polygon rate limited — waiting 60s before retry (${retries} left)`);
            await delay(60000);
            return this.request<T>(path, retries - 1);
          }
          throw new AppError(429, 'POLYGON_RATE_LIMITED', 'Polygon API rate limit reached after retries.');
        }

        throw new AppError(status, 'POLYGON_REQUEST_FAILED', `Polygon API error: ${message}`);
      }

      throw new AppError(500, 'POLYGON_UNKNOWN_ERROR', 'Unknown error fetching market data');
    }
  }
}

const marketDataService = new MarketDataService();

export default marketDataService;
