import axios, { type AxiosInstance } from 'axios';

import config from '../config';
import { AppError } from '../utils';

import type { StockData, NewsItem } from '../types/claude';

const POLYGON_BASE_URL = 'https://api.polygon.io';

interface PolygonTickerSnapshot {
  ticker: string;
  day: {
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    vw: number;
  };
  todaysChange: number;
  todaysChangePerc: number;
  updated: number;
}

interface PolygonSnapshotResponse {
  tickers: PolygonTickerSnapshot[];
}

interface PolygonSingleSnapshotResponse {
  ticker: PolygonTickerSnapshot;
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

class MarketDataService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: POLYGON_BASE_URL,
      timeout: 10000,
      params: { apiKey: config.polygonApiKey },
    });
  }

  // ── Stock Prices ──

  async getStockSnapshot(symbol: string): Promise<StockData> {
    this.validateApiKey();

    const response = await this.request<PolygonSingleSnapshotResponse>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`
    );

    const ticker = response.ticker;
    return this.mapTickerToStockData(ticker);
  }

  async getMultipleSnapshots(symbols: string[]): Promise<StockData[]> {
    this.validateApiKey();

    const tickers = symbols.join(',');
    const response = await this.request<PolygonSnapshotResponse>(
      `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`
    );

    return response.tickers.map((t) => this.mapTickerToStockData(t));
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
      url += `&ticker=${symbols.join(',')}`;
    }

    const response = await this.request<PolygonNewsResponse>(url);

    return (response.results ?? []).map((article) => ({
      title: article.title,
      source: article.publisher.name,
      symbol: article.tickers[0],
      publishedAt: article.published_utc,
    }));
  }

  // ── Full Context Builder ──

  async getFullStockData(symbols: string[]): Promise<StockData[]> {
    const snapshots = await this.getMultipleSnapshots(symbols);

    const enriched = await Promise.all(
      snapshots.map(async (stock) => {
        const [rsi, macd, sma20, sma50] = await Promise.all([
          this.getRsi(stock.symbol),
          this.getMacd(stock.symbol),
          this.getSma(stock.symbol, 20),
          this.getSma(stock.symbol, 50),
        ]);

        return {
          ...stock,
          rsi,
          macd: macd?.value,
          movingAvg20: sma20,
          movingAvg50: sma50,
        };
      })
    );

    return enriched;
  }

  // ── Helpers ──

  private validateApiKey(): void {
    if (!config.polygonApiKey) {
      throw new AppError(500, 'POLYGON_NOT_CONFIGURED', 'Polygon API key is not configured');
    }
  }

  private mapTickerToStockData(ticker: PolygonTickerSnapshot): StockData {
    return {
      symbol: ticker.ticker,
      price: ticker.day.c,
      open: ticker.day.o,
      high: ticker.day.h,
      low: ticker.day.l,
      volume: ticker.day.v,
      changePercent: ticker.todaysChangePerc,
    };
  }

  private async request<T>(path: string): Promise<T> {
    try {
      const response = await this.client.get<T>(path);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? 500;
        const message = error.response?.data?.error ?? error.message;

        if (status === 403) {
          throw new AppError(403, 'POLYGON_AUTH_FAILED', 'Polygon API key is invalid or rate limited');
        }

        throw new AppError(status, 'POLYGON_REQUEST_FAILED', `Polygon API error: ${message}`);
      }

      throw new AppError(500, 'POLYGON_UNKNOWN_ERROR', 'Unknown error fetching market data');
    }
  }
}

const marketDataService = new MarketDataService();

export default marketDataService;
