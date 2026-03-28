import { AuditLog } from '../models';

import type { IAuditLog } from '../models';

interface CreateAuditLogParams {
  action: string;
  details: string;
  claudeResponse?: string;
  tradeId?: unknown;
  metadata?: Record<string, unknown>;
}

async function createAuditLog(params: CreateAuditLogParams): Promise<IAuditLog> {
  const log = await AuditLog.create({
    action: params.action,
    details: params.details,
    claudeResponse: params.claudeResponse,
    ...(params.tradeId ? { tradeId: params.tradeId } : {}),
    metadata: params.metadata,
  });

  return log;
}

async function getRecentLogs(limit: number = 50): Promise<IAuditLog[]> {
  return AuditLog.find().sort({ createdAt: -1 }).limit(limit);
}

export { createAuditLog, getRecentLogs };
