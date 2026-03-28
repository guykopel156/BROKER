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
const AUTH_CHECK_INTERVAL_MS = 30000;

class IbkrService {
  private client: AxiosInstance;
  private tickleTimer: NodeJS.Timeout | null = null;
  private authCheckTimer: NodeJS.Timeout | null = null;
  private isAuthenticated = false;

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
      const retryResponse = await this.get<IbkrAuthStatus>('/iserver/auth/status');
      this.isAuthenticated = retryResponse.authenticated;
      return retryResponse;
    }

    this.isAuthenticated = true;
    return response;
  }

  async reauthenticate(): Promise<void> {
    console.log('IBKR: Attempting reauthentication...');
    try {
      await this.post('/iserver/reauthenticate', {});
      console.log('IBKR: Reauthentication request sent');
    } catch {
      console.error('IBKR: Reauthentication failed');
    }
  }

  async tickle(): Promise<void> {
    try {
      await this.post('/tickle', {});
    } catch {
      console.error('IBKR: Tickle failed — session may have expired');
      this.isAuthenticated = false;
      await this.tryReconnect();
    }
  }

  private async tryReconnect(): Promise<void> {
    console.log('IBKR: Trying to reconnect...');
    try {
      await this.reauthenticate();
      // Wait a moment for reauthentication to process
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const status = await this.get<IbkrAuthStatus>('/iserver/auth/status');
      if (status.authenticated) {
        this.isAuthenticated = true;
        console.log('IBKR: Reconnected successfully');
      } else {
        console.log('IBKR: Reconnect failed — need manual login at https://localhost:5000');
      }
    } catch {
      console.log('IBKR: Gateway unreachable — make sure bin\\run.bat is running');
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.isAuthenticated) return;

    try {
      const status = await this.get<IbkrAuthStatus>('/iserver/auth/status');
      if (status.authenticated) {
        this.isAuthenticated = true;
        return;
      }
    } catch {
      // Gateway might be down
    }

    await this.tryReconnect();

    if (!this.isAuthenticated) {
      throw new AppError(401, 'IBKR_NOT_AUTHENTICATED', 'IBKR session expired. Please log in at https://localhost:5000');
    }
  }

  startKeepAlive(): void {
    if (this.tickleTimer) return;

    // Tickle every 55 seconds
    this.tickleTimer = setInterval(() => {
      this.tickle();
    }, TICKLE_INTERVAL_MS);

    // Check auth status every 30 seconds
    this.authCheckTimer = setInterval(async () => {
      try {
        const status = await this.get<IbkrAuthStatus>('/iserver/auth/status');
        const wasAuthenticated = this.isAuthenticated;
        this.isAuthenticated = status.authenticated;

        if (!status.authenticated && wasAuthenticated) {
          console.log('IBKR: Session lost, attempting reconnect...');
          await this.tryReconnect();
        }
      } catch {
        this.isAuthenticated = false;
      }
    }, AUTH_CHECK_INTERVAL_MS);

    console.log('IBKR: Keep-alive started (tickle every 55s, auth check every 30s)');
  }

  stopKeepAlive(): void {
    if (this.tickleTimer) {
      clearInterval(this.tickleTimer);
      this.tickleTimer = null;
    }
    if (this.authCheckTimer) {
      clearInterval(this.authCheckTimer);
      this.authCheckTimer = null;
    }
  }

  getConnectionStatus(): { isAuthenticated: boolean } {
    return { isAuthenticated: this.isAuthenticated };
  }

  // ── Account ──

  async getAccountSummary(): Promise<IbkrAccountSummary> {
    await this.ensureAuthenticated();
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
    await this.ensureAuthenticated();
    const accountId = this.getAccountId();
    const response = await this.get<IbkrPosition[]>(
      `/portfolio/${accountId}/positions/0`
    );
    return response;
  }

  // ── Orders ──

  async placeOrder(order: IbkrOrderRequest): Promise<IbkrOrderResponse> {
    await this.ensureAuthenticated();
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
    await this.ensureAuthenticated();
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
    await this.ensureAuthenticated();
    return this.get<IbkrOrderStatus>(`/iserver/account/order/status/${orderId}`);
  }

  async getLiveOrders(): Promise<IbkrOrderStatus[]> {
    await this.ensureAuthenticated();
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
        this.isAuthenticated = false;
        throw new AppError(401, 'IBKR_AUTH_FAILED', 'IBKR session expired. Please log in at https://localhost:5000');
      }

      throw new AppError(status, 'IBKR_REQUEST_FAILED', `IBKR ${method} ${path} failed: ${message}`);
    }

    throw new AppError(500, 'IBKR_UNKNOWN_ERROR', 'Unknown error communicating with IBKR');
  }
}

const ibkrService = new IbkrService();

export default ibkrService;
