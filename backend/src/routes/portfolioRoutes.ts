import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getAccountSummary, getPositions } from '../controllers/portfolioController';

const router = Router();

router.get('/summary', asyncWrapper(getAccountSummary));
router.get('/positions', asyncWrapper(getPositions));

export default router;
