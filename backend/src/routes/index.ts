import { Router } from 'express';

import authRoutes from './authRoutes';
import authMiddleware from '../middleware/authMiddleware';
import portfolioRoutes from './portfolioRoutes';
import orderRoutes from './orderRoutes';
import settingsRoutes from './settingsRoutes';
import engineRoutes from './engineRoutes';
import tradeRoutes from './tradeRoutes';
import recommendationRoutes from './recommendationRoutes';
import marketDataRoutes from './marketDataRoutes';
import chatRoutes from './chatRoutes';
import whatsappRoutes from './whatsappRoutes';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes — require login
router.use('/portfolio', authMiddleware, portfolioRoutes);
router.use('/orders', authMiddleware, orderRoutes);
router.use('/settings', authMiddleware, settingsRoutes);
router.use('/engine', authMiddleware, engineRoutes);
router.use('/trades', authMiddleware, tradeRoutes);
router.use('/recommendations', authMiddleware, recommendationRoutes);
router.use('/market', authMiddleware, marketDataRoutes);
router.use('/chat', authMiddleware, chatRoutes);
router.use('/whatsapp', authMiddleware, whatsappRoutes);

export default router;
