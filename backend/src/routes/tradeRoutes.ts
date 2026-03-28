import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getRecentTrades, getAllTrades, getIbkrTradeHistory } from '../controllers/tradeController';

const router = Router();

router.get('/recent', asyncWrapper(getRecentTrades));
router.get('/ibkr-history', asyncWrapper(getIbkrTradeHistory));
router.get('/', asyncWrapper(getAllTrades));

export default router;
