import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { handleChat } from '../controllers/chatController';

const router = Router();

router.post('/', asyncWrapper(handleChat));

export default router;
