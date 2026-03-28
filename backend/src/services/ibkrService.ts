import axios, { type AxiosInstance } from 'axios';
import https from 'https';

import config from '../config';
import { AppError } from '../utils';

import type {
  IbkrAuthStatus,
  IbkrAccountSummary,
  IbkrPosition,
  IbkrOrderRequest,
  IbkrOrderResponse,
  IbkrOrderStatus,
} from '../types/ibkr';

const TICKLE_INTERVAL_MS = 55000;

class IbkrService {
  private client: AxiosInstance;
  private tickleTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: config.ibkrBaseUrl,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 10000,
    });
  }

  // ── Session Management ──

  async authenticate(): Promise<IbkrAuthStatus> {
    const response = await this.get<IbkrAuthStatus>('/iserver/auth/status');

    if (!response.authenticated) {
      await this.reauthenticate();
      return this.get<IbkrAuthStatus>('/iserver/auth/status');
    }

    return response;
  }

  async reauthenticate(): Promise<void> {
    await this.post('/iserver/reauthenticate', {});
  }

  async tickle(): Promise<void> {
    await this.post('/tickle', {});
  }

  startKeepAlive(): void {
    if (this.tickleTimer) return;
    this.tickleTimer = setInterval(() => {
      this.tickle().catch(() => {
        console.error('IBKR tickle failed');
      });
    }, TICKLE_INTERVAL_MS);
  }

  stopKeepAlive(): void {
    if (this.tickleTimer) {
      clearInterval(this.tickleTimer);
      this.tickleTimer = null;
    }
  }

  // ── Account ──

  async getAccountSummary(): Promise<IbkrAccountSummary> {
    const accountId = this.getAccountId();
    const response = await this.get<Record<string, { amount: number }>>(
      `/portfolio/${accountId}/summary`
    );

    return {
      totalCashValue: response.totalcashvalue?.amount ?? 0,
      netLiquidation: response.netliquidation?.amount ?? 0,
      unrealizedPnl: response.unrealizedpnl?.amount ?? 0,
      realizedPnl: response.realizedpnl?.amount ?? 0,
      buyingPower: response.buyingpower?.amount ?? 0,
    };
  }

  // ── Positions ──

  async getPositions(): Promise<IbkrPosition[]> {
    const accountId = this.getAccountId();
    const response = await this.get<IbkrPosition[]>(
      `/portfolio/${accountId}/positions/0`
    );
    return response;
  }

  // ── Orders ──

  async placeOrder(order: IbkrOrderRequest): Promise<IbkrOrderResponse> {
    const accountId = this.getAccountId();
    const response = await this.post<IbkrOrderResponse[]>(
      `/iserver/account/${accountId}/orders`,
      { orders: [order] }
    );

    const result = response[0];
    if (!result) {
      throw new AppError(500, 'ORDER_FAILED', 'No response from IBKR order placement');
    }

    return result;
  }

  async confirmOrder(orderId: string): Promise<IbkrOrderResponse> {
    const response = await this.post<IbkrOrderResponse[]>(
      `/iserver/reply/${orderId}`,
      { confirmed: true }
    );

    const result = response[0];
    if (!result) {
      throw new AppError(500, 'ORDER_CONFIRM_FAILED', 'No response from IBKR order confirmation');
    }

    return result;
  }

  async getOrderStatus(orderId: string): Promise<IbkrOrderStatus> {
    return this.get<IbkrOrderStatus>(`/iserver/account/order/status/${orderId}`);
  }

  async getLiveOrders(): Promise<IbkrOrderStatus[]> {
    const response = await this.get<{ orders: IbkrOrderStatus[] }>('/iserver/account/orders');
    return response.orders ?? [];
  }

  // ── Helpers ──

  private getAccountId(): string {
    if (!config.ibkrAccountId) {
      throw new AppError(400, 'MISSING_ACCOUNT_ID', 'IBKR_ACCOUNT_ID is not configured');
    }
    return config.ibkrAccountId;
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const response = await this.client.get<T>(path);
      return response.data;
    } catch (error) {
      this.handleRequestError(error, 'GET', path);
    }
  }

  private async post<T>(path: string, data: unknown): Promise<T> {
    try {
      const response = await this.client.post<T>(path, data);
      return response.data;
    } catch (error) {
      this.handleRequestError(error, 'POST', path);
    }
  }

  private handleRequestError(error: unknown, method: string, path: string): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const message = error.response?.data?.error ?? error.message;

      if (status === 401) {
        throw new AppError(401, 'IBKR_AUTH_FAILED', 'IBKR session expired. Please reauthenticate.');
      }

      throw new AppError(status, 'IBKR_REQUEST_FAILED', `IBKR ${method} ${path} failed: ${message}`);
    }

    throw new AppError(500, 'IBKR_UNKNOWN_ERROR', 'Unknown error communicating with IBKR');
  }
}

const ibkrService = new IbkrService();

export default ibkrService;
