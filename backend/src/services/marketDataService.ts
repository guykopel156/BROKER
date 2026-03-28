import axios, { type AxiosInstance } from 'axios';

import config from '../config';
import { AppError } from '../utils';

import type { StockData, NewsItem } from '../types/claude';

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

class MarketDataService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: POLYGON_BASE_URL,
      timeout: 10000,
      params: { apiKey: config.polygonApiKey },
    });
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

  // ── Helpers ──

  private validateApiKey(): void {
    if (!config.polygonApiKey) {
      throw new AppError(500, 'POLYGON_NOT_CONFIGURED', 'Polygon API key is not configured');
    }
  }

  private async request<T>(path: string): Promise<T> {
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
          throw new AppError(429, 'POLYGON_RATE_LIMITED', 'Polygon API rate limit reached. Free tier: 5 calls/min.');
        }

        throw new AppError(status, 'POLYGON_REQUEST_FAILED', `Polygon API error: ${message}`);
      }

      throw new AppError(500, 'POLYGON_UNKNOWN_ERROR', 'Unknown error fetching market data');
    }
  }
}

const marketDataService = new MarketDataService();

export default marketDataService;
