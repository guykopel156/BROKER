import { Schema, model, type Document } from 'mongoose';

export interface ITrade extends Document {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalValue: number;
  reasoning: string;
  status: 'pending' | 'filled' | 'failed' | 'in-progress';
  strategy: string;
  exchange: string;
  profitLoss?: number;
  outcomeLabel?: string;
  executedAt: Date;
}

const tradeSchema = new Schema<ITrade>(
  {
    symbol: { type: String, required: true, index: true },
    action: { type: String, required: true, enum: ['BUY', 'SELL'] },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalValue: { type: Number, required: true },
    reasoning: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'filled', 'failed', 'in-progress'],
      default: 'pending',
    },
    strategy: { type: String, required: true },
    exchange: { type: String, required: true },
    profitLoss: { type: Number },
    outcomeLabel: { type: String },
    executedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Trade = model<ITrade>('Trade', tradeSchema);

export default Trade;
