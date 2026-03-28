import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getStockCandles, getStockPrice } from '../controllers/marketDataController';

const router = Router();

router.get('/:symbol/candles', asyncWrapper(getStockCandles));
router.get('/:symbol/price', asyncWrapper(getStockPrice));

export default router;
