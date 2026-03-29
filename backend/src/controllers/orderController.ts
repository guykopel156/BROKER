import type { Request, Response } from 'express';

import config from '../config';
import ibkrService from '../services/ibkrService';
import { Trade, Recommendation } from '../models';
import { createAuditLog } from '../services/auditLogService';
import { AppError } from '../utils';

import type { IbkrOrderRequest } from '../types/ibkr';

interface PlaceOrderBody {
  symbol?: string;
  conid?: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT';
  price?: number;
  tif?: 'DAY' | 'GTC';
}

async function placeOrder(req: Request, res: Response): Promise<void> {
  const { symbol, conid, side, quantity, orderType, price, tif } = req.body as PlaceOrderBody;

  if ((!conid && !symbol) || !side || !quantity || !orderType) {
    throw new AppError(400, 'INVALID_ORDER', 'Missing required fields: symbol (or conid), side, quantity, orderType');
  }

  // Resolve conid from symbol if not provided
  const resolvedConid = conid ?? await ibkrService.getConid(symbol as string);
  const tickerSymbol = symbol ?? `conid:${resolvedConid}`;

  const order: IbkrOrderRequest = {
    acctId: config.ibkrAccountId,
    conid: resolvedConid,
    side,
    quantity,
    orderType,
    price,
    tif: tif ?? 'DAY',
  };

  const result = await ibkrService.placeOrder(order);

  // Auto-confirm if there's a warning
  if (result.warningMessage) {
    await ibkrService.confirmOrder(result.orderId);
  }

  // Log the trade
  await Trade.create({
    symbol: tickerSymbol,
    action: side,
    quantity,
    price: price ?? 0,
    totalValue: 0,
    reasoning: 'Manual trade',
    status: 'in-progress',
    strategy: 'Manual',
    exchange: 'US',
    executedAt: new Date(),
  });

  // If selling, deactivate the recommendation
  if (side === 'SELL') {
    await Recommendation.updateMany(
      { symbol: tickerSymbol, isActive: true },
      { isActive: false, closedAt: new Date(), closeReason: 'MANUAL_SELL' }
    );
  }

  await createAuditLog({
    action: 'MANUAL_TRADE',
    details: `Manual ${side} ${quantity} ${tickerSymbol}. Order ID: ${result.orderId}`,
  });

  res.json({ data: result });
}

async function confirmOrder(req: Request, res: Response): Promise<void> {
  const orderId = req.params.orderId as string;

  if (!orderId) {
    throw new AppError(400, 'MISSING_ORDER_ID', 'Order ID is required');
  }

  const result = await ibkrService.confirmOrder(orderId);
  res.json({ data: result });
}

async function getOrderStatus(req: Request, res: Response): Promise<void> {
  const orderId = req.params.orderId as string;

  if (!orderId) {
    throw new AppError(400, 'MISSING_ORDER_ID', 'Order ID is required');
  }

  const status = await ibkrService.getOrderStatus(orderId);
  res.json({ data: status });
}

async function getLiveOrders(_req: Request, res: Response): Promise<void> {
  const orders = await ibkrService.getLiveOrders();
  res.json({ data: orders });
}

export { placeOrder, confirmOrder, getOrderStatus, getLiveOrders };
