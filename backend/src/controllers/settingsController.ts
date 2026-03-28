import type { Request, Response } from 'express';

import { Settings } from '../models';
import { stopEngine, startEngine } from '../services/tradingEngine';

async function getSettings(_req: Request, res: Response): Promise<void> {
  let settings = await Settings.findOne();

  if (!settings) {
    settings = await Settings.create({});
  }

  res.json({ data: settings });
}

interface UpdateSettingsBody {
  maxLossPercent?: number;
  tradingIntervalMinutes?: number;
  strategyPrompt?: string;
  isPaperTrading?: boolean;
  isClaudePaused?: boolean;
}

async function updateSettings(req: Request, res: Response): Promise<void> {
  const updates = req.body as UpdateSettingsBody;

  let settings = await Settings.findOne();

  if (!settings) {
    settings = await Settings.create(updates);
  } else {
    Object.assign(settings, updates);
    await settings.save();
  }

  // Restart engine if interval changed
  if (updates.tradingIntervalMinutes !== undefined) {
    stopEngine();
    startEngine().catch((err) => {
      console.error('Failed to restart engine:', err);
    });
  }

  res.json({ data: settings });
}

export { getSettings, updateSettings };
