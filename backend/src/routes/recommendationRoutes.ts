import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getLatestRecommendations } from '../controllers/recommendationController';

const router = Router();

router.get('/', asyncWrapper(getLatestRecommendations));

export default router;
