import type { Request, Response } from 'express';

import ibkrService from '../services/ibkrService';
import { AppError } from '../utils';

import type { IbkrOrderRequest } from '../types/ibkr';

interface PlaceOrderBody {
  conid: number;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT';
  price?: number;
  tif?: 'DAY' | 'GTC';
}

async function placeOrder(req: Request, res: Response): Promise<void> {
  const { conid, side, quantity, orderType, price, tif } = req.body as PlaceOrderBody;

  if (!conid || !side || !quantity || !orderType) {
    throw new AppError(400, 'INVALID_ORDER', 'Missing required fields: conid, side, quantity, orderType');
  }

  const order: IbkrOrderRequest = {
    acctId: '',
    conid,
    side,
    quantity,
    orderType,
    price,
    tif: tif ?? 'DAY',
  };

  const result = await ibkrService.placeOrder(order);
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
