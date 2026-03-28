import { Schema, model, type Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  details: string;
  claudeResponse?: string;
  tradeId?: Schema.Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true, index: true },
    details: { type: String, required: true },
    claudeResponse: { type: String },
    tradeId: { type: Schema.Types.ObjectId, ref: 'Trade' },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
