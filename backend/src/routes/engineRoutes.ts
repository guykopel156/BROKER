import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import { handlePause, handleResume, handleRunCycle, handleGetAuditLogs, handleCycleStatus } from '../controllers/engineController';

const router = Router();

router.post('/pause', asyncWrapper(handlePause));
router.post('/resume', asyncWrapper(handleResume));
router.post('/run-cycle', asyncWrapper(handleRunCycle));
router.get('/audit-logs', asyncWrapper(handleGetAuditLogs));
router.get('/cycle-status', handleCycleStatus);

export default router;
