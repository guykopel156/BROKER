import type { Request, Response } from 'express';

import ibkrService from '../services/ibkrService';

async function getAccountSummary(_req: Request, res: Response): Promise<void> {
  const summary = await ibkrService.getAccountSummary();
  res.json({ data: summary });
}

async function getPositions(_req: Request, res: Response): Promise<void> {
  const positions = await ibkrService.getPositions();
  res.json({ data: positions });
}

export { getAccountSummary, getPositions };
