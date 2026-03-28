import { Schema, model, type Document } from 'mongoose';

import DEFAULT_STRATEGY_PROMPT from '../config/defaultStrategy';

export interface ISettings extends Document {
  maxLossPercent: number;
  tradingIntervalMinutes: number;
  strategyPrompt: string;
  isPaperTrading: boolean;
  isClaudePaused: boolean;
}

const settingsSchema = new Schema<ISettings>(
  {
    maxLossPercent: { type: Number, required: true, default: 10 },
    tradingIntervalMinutes: { type: Number, required: true, default: 15 },
    strategyPrompt: { type: String, required: true, default: DEFAULT_STRATEGY_PROMPT },
    isPaperTrading: { type: Boolean, required: true, default: true },
    isClaudePaused: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

const Settings = model<ISettings>('Settings', settingsSchema);

export default Settings;
