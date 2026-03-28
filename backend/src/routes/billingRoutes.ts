import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { handleGetBilling } from '../controllers/billingController';

const router = Router();

router.get('/', asyncWrapper(handleGetBilling));

export default router;
