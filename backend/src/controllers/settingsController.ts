import type { Request, Response } from 'express';

import { Settings } from '../models';

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

  res.json({ data: settings });
}

export { getSettings, updateSettings };
