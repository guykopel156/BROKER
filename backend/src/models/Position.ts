import { Schema, model, type Document } from 'mongoose';

export interface IPosition extends Document {
  symbol: string;
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  isOpen: boolean;
  openedAt: Date;
  closedAt?: Date;
  realizedPnl?: number;
  holdDuration?: string;
  exitPrice?: number;
}

const positionSchema = new Schema<IPosition>(
  {
    symbol: { type: String, required: true, index: true },
    shares: { type: Number, required: true },
    avgEntryPrice: { type: Number, required: true },
    currentPrice: { type: Number, required: true },
    unrealizedPnl: { type: Number, required: true, default: 0 },
    unrealizedPnlPercent: { type: Number, required: true, default: 0 },
    isOpen: { type: Boolean, required: true, default: true, index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    realizedPnl: { type: Number },
    holdDuration: { type: String },
    exitPrice: { type: Number },
  },
  { timestamps: true }
);

const Position = model<IPosition>('Position', positionSchema);

export default Position;
