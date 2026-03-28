import type { Request, Response } from 'express';

import { sendDailySummary, sendWhatsAppMessage, isConfigured } from '../services/whatsappService';

async function handleTestMessage(_req: Request, res: Response): Promise<void> {
  if (!isConfigured()) {
    res.json({ data: { success: false, message: 'WhatsApp not configured. Set TWILIO env vars.' } });
    return;
  }

  await sendWhatsAppMessage('✅ BROKER WhatsApp connection test successful!');
  res.json({ data: { success: true, message: 'Test message sent' } });
}

async function handleSendSummary(_req: Request, res: Response): Promise<void> {
  if (!isConfigured()) {
    res.json({ data: { success: false, message: 'WhatsApp not configured' } });
    return;
  }

  await sendDailySummary();
  res.json({ data: { success: true, message: 'Daily summary sent' } });
}

function handleStatus(_req: Request, res: Response): void {
  res.json({ data: { configured: isConfigured() } });
}

export { handleTestMessage, handleSendSummary, handleStatus };
