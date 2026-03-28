import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { handlePause, handleResume, handleRunCycle, handleGetAuditLogs } from '../controllers/engineController';

const router = Router();

router.post('/pause', asyncWrapper(handlePause));
router.post('/resume', asyncWrapper(handleResume));
router.post('/run-cycle', asyncWrapper(handleRunCycle));
router.get('/audit-logs', asyncWrapper(handleGetAuditLogs));

export default router;
