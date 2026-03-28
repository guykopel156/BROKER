import { Router } from 'express';

import portfolioRoutes from './portfolioRoutes';
import orderRoutes from './orderRoutes';
import settingsRoutes from './settingsRoutes';

const router = Router();

router.use('/portfolio', portfolioRoutes);
router.use('/orders', orderRoutes);
router.use('/settings', settingsRoutes);

export default router;
