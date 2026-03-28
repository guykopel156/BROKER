import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getLatestRecommendations, getAllRecommendations } from '../controllers/recommendationController';

const router = Router();

router.get('/', asyncWrapper(getLatestRecommendations));
router.get('/history', asyncWrapper(getAllRecommendations));

export default router;
