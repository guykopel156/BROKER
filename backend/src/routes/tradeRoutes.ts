import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getRecentTrades, getAllTrades } from '../controllers/tradeController';

const router = Router();

router.get('/recent', asyncWrapper(getRecentTrades));
router.get('/', asyncWrapper(getAllTrades));

export default router;
