import { Router } from 'express';

import portfolioRoutes from './portfolioRoutes';
import orderRoutes from './orderRoutes';
import settingsRoutes from './settingsRoutes';
import engineRoutes from './engineRoutes';

const router = Router();

router.use('/portfolio', portfolioRoutes);
router.use('/orders', orderRoutes);
router.use('/settings', settingsRoutes);
router.use('/engine', engineRoutes);

export default router;
