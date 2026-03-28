import { Router } from 'express';

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

router.use('/portfolio', portfolioRoutes);
router.use('/orders', orderRoutes);
router.use('/settings', settingsRoutes);
router.use('/engine', engineRoutes);
router.use('/trades', tradeRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/market', marketDataRoutes);
router.use('/chat', chatRoutes);
router.use('/whatsapp', whatsappRoutes);

export default router;
