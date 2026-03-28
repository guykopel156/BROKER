import { sendDailySummary, isConfigured } from './whatsappService';

// US Market: 9:30 AM ET = 14:30 UTC = 16:30 Israel
// US Market close: 4:00 PM ET = 21:00 UTC = 23:00 Israel
const MARKET_OPEN_HOUR_UTC = 14;
const MARKET_OPEN_MINUTE_UTC = 30;
const MARKET_CLOSE_HOUR_UTC = 21;
const MARKET_CLOSE_MINUTE_UTC = 0;

let schedulerTimer: NodeJS.Timeout | null = null;
let lastSentKey = '';

function startDailyScheduler(): void {
  if (!isConfigured()) {
    console.log('WhatsApp not configured — daily scheduler skipped');
    return;
  }

  schedulerTimer = setInterval(() => {
    const now = new Date();
    const day = now.getUTCDay();

    // Skip weekends
    if (day === 0 || day === 6) return;

    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();
    const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;

    // Market open (14:30 UTC / 16:30 Israel)
    if (hour === MARKET_OPEN_HOUR_UTC && minute === MARKET_OPEN_MINUTE_UTC) {
      const key = `${todayKey}-open`;
      if (lastSentKey !== key) {
        lastSentKey = key;
        sendDailySummary()
          .then(() => console.log('WhatsApp: Market open summary sent'))
          .catch((err) => console.error('WhatsApp market open failed:', err));
      }
    }

    // Market close (21:00 UTC / 23:00 Israel)
    if (hour === MARKET_CLOSE_HOUR_UTC && minute === MARKET_CLOSE_MINUTE_UTC) {
      const key = `${todayKey}-close`;
      if (lastSentKey !== key) {
        lastSentKey = key;
        sendDailySummary()
          .then(() => console.log('WhatsApp: Market close summary sent'))
          .catch((err) => console.error('WhatsApp market close failed:', err));
      }
    }
  }, 60000);

  console.log(
    'WhatsApp scheduler: sends at market open (16:30 IL) and close (23:00 IL), Mon-Fri',
  );
}

function stopDailyScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

export { startDailyScheduler, stopDailyScheduler };
