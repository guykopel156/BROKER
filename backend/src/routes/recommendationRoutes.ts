import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getLatestRecommendations, getAllRecommendations, getPredictions } from '../controllers/recommendationController';

const router = Router();

router.get('/', asyncWrapper(getLatestRecommendations));
router.get('/history', asyncWrapper(getAllRecommendations));
router.get('/predictions', asyncWrapper(getPredictions));

export default router;
