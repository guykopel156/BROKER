import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

router.get('/', asyncWrapper(getSettings));
router.patch('/', asyncWrapper(updateSettings));

export default router;
