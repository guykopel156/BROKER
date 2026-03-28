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

async function getAllRecommendations(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 50;
  const all = await Recommendation.find()
    .sort({ cycleTimestamp: -1 })
    .limit(limit);

  res.json({ data: all });
}

export { getLatestRecommendations, getAllRecommendations };
