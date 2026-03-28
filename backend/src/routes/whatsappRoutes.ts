import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { handleTestMessage, handleSendSummary, handleStatus } from '../controllers/whatsappController';

const router = Router();

router.post('/test', asyncWrapper(handleTestMessage));
router.post('/send-summary', asyncWrapper(handleSendSummary));
router.get('/status', handleStatus);

export default router;
