import { sendDailySummary, isConfigured } from './whatsappService';

const DAILY_HOUR_UTC = 14; // 2 PM UTC = 5 PM Israel time

let schedulerTimer: NodeJS.Timeout | null = null;

function startDailyScheduler(): void {
  if (!isConfigured()) {
    console.log('WhatsApp not configured — daily scheduler skipped');
    return;
  }

  // Check every minute if it's time to send
  schedulerTimer = setInterval(() => {
    const now = new Date();
    if (now.getUTCHours() === DAILY_HOUR_UTC && now.getUTCMinutes() === 0) {
      sendDailySummary().catch((err) => {
        console.error('Failed to send daily WhatsApp summary:', err);
      });
    }
  }, 60000);

  console.log(`WhatsApp daily scheduler started (sends at ${DAILY_HOUR_UTC}:00 UTC / 5:00 PM Israel)`);
}

function stopDailyScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export { startDailyScheduler, stopDailyScheduler };
