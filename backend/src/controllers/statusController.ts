import type { Request, Response } from 'express';

import ibkrService from '../services/ibkrService';
import config from '../config';
import { isConfigured as isWhatsAppConfigured } from '../services/whatsappService';

function handleFullStatus(_req: Request, res: Response): void {
  const ibkrStatus = ibkrService.getConnectionStatus();

  res.json({
    data: {
      backend: true,
      mongodb: true,
      claude: Boolean(config.anthropicApiKey),
      polygon: Boolean(config.polygonApiKey),
      ibkr: ibkrStatus.isAuthenticated,
      ibkrAccountId: config.ibkrAccountId || null,
      whatsapp: isWhatsAppConfigured(),
    },
  });
}

export { handleFullStatus };
