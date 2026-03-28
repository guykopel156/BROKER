import type { Request, Response } from 'express';

import { Recommendation } from '../models';

async function getLatestRecommendations(_req: Request, res: Response): Promise<void> {
  const latest = await Recommendation.find()
    .sort({ cycleTimestamp: -1 })
    .limit(20);

  res.json({ data: latest });
}

export { getLatestRecommendations };
