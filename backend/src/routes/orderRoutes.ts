import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { placeOrder, confirmOrder, getOrderStatus, getLiveOrders } from '../controllers/orderController';

const router = Router();

router.post('/', asyncWrapper(placeOrder));
router.post('/:orderId/confirm', asyncWrapper(confirmOrder));
router.get('/:orderId/status', asyncWrapper(getOrderStatus));
router.get('/', asyncWrapper(getLiveOrders));

export default router;
