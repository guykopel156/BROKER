import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getStockCandles, getStockPrice, getStockDetails, getTopMovers } from '../controllers/marketDataController';

const router = Router();

router.get('/top-movers', asyncWrapper(getTopMovers));
router.get('/:symbol/candles', asyncWrapper(getStockCandles));
router.get('/:symbol/price', asyncWrapper(getStockPrice));
router.get('/:symbol/details', asyncWrapper(getStockDetails));

export default router;
