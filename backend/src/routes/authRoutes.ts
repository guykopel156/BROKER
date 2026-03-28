import { Router } from 'express';

import { asyncWrapper } from '../middleware';
import authMiddleware from '../middleware/authMiddleware';
import { handleLogin, handleSetup2FA, handleVerify2FA, handleMe } from '../controllers/authController';

const router = Router();

router.post('/login', asyncWrapper(handleLogin));
router.get('/me', authMiddleware, asyncWrapper(handleMe));
router.post('/2fa/setup', authMiddleware, asyncWrapper(handleSetup2FA));
router.post('/2fa/verify', authMiddleware, asyncWrapper(handleVerify2FA));

export default router;
