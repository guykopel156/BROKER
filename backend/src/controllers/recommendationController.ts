import type { Request, Response } from 'express';

import { Recommendation } from '../models';

async function getLatestRecommendations(_req: Request, res: Response): Promise<void> {
  // Get the most recent cycle timestamp
  const mostRecent = await Recommendation.findOne()
    .sort({ cycleTimestamp: -1 })
    .select('cycleTimestamp');

  if (!mostRecent) {
    res.json({ data: [] });
    return;
  }

  // Return only recommendations from the latest cycle
  const latest = await Recommendation.find({
    cycleTimestamp: mostRecent.cycleTimestamp,
  }).sort({ createdAt: -1 });

  res.json({ data: latest });
}

export { getLatestRecommendations };
