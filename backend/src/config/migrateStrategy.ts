import { Settings } from '../models';
import DEFAULT_STRATEGY_PROMPT from './defaultStrategy';

const OLD_PROMPT_MARKER = 'You are an autonomous AI trading agent managing a brokerage account';
const NEW_PROMPT_MARKER = 'You are an autonomous AI trading agent managing a real brokerage account';

async function migrateStrategyPrompt(): Promise<void> {
  const settings = await Settings.findOne();
  if (!settings) return;

  const hasOldPrompt = settings.strategyPrompt.includes(OLD_PROMPT_MARKER)
    && !settings.strategyPrompt.includes(NEW_PROMPT_MARKER);

  if (hasOldPrompt) {
    settings.strategyPrompt = DEFAULT_STRATEGY_PROMPT;
    await settings.save();
    console.log('Strategy prompt migrated to new structured version');
  }
}

export { migrateStrategyPrompt };
