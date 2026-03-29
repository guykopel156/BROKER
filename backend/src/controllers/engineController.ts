import type { Request, Response } from 'express';

import { pauseEngine, resumeEngine, runCycle, getCycleStatus, getScreenedCandidates } from '../services/tradingEngine';
import { getRecentLogs } from '../services/auditLogService';
import { getTradeStats } from '../services/statsService';

async function handlePause(_req: Request, res: Response): Promise<void> {
  await pauseEngine();
  res.json({ data: { isPaused: true } });
}

async function handleResume(_req: Request, res: Response): Promise<void> {
  await resumeEngine();
  res.json({ data: { isPaused: false } });
}

async function handleRunCycle(_req: Request, res: Response): Promise<void> {
  await runCycle();
  res.json({ data: { message: 'Trading cycle completed' } });
}

async function handleGetAuditLogs(req: Request, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 50;
  const logs = await getRecentLogs(limit);
  res.json({ data: logs });
}

function handleCycleStatus(_req: Request, res: Response): void {
  res.json({ data: getCycleStatus() });
}

function handleScreenedCandidates(_req: Request, res: Response): void {
  res.json({ data: getScreenedCandidates() });
}

async function handleTradeStats(_req: Request, res: Response): Promise<void> {
  const stats = await getTradeStats();
  res.json({ data: stats });
}

export { handlePause, handleResume, handleRunCycle, handleGetAuditLogs, handleCycleStatus, handleScreenedCandidates, handleTradeStats };
