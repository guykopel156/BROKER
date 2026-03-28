import { Schema, model, type Document } from 'mongoose';

export interface IRecommendation extends Document {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  quantity: number;
  reasoning: string;
  confidence: number;
  strategy: string;
  holdType: 'short' | 'long';
  cycleTimestamp: Date;
}

const recommendationSchema = new Schema<IRecommendation>(
  {
    action: { type: String, required: true, enum: ['BUY', 'SELL', 'HOLD'] },
    symbol: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    reasoning: { type: String, required: true },
    confidence: { type: Number, required: true },
    strategy: { type: String, default: '' },
    holdType: { type: String, default: 'short', enum: ['short', 'long'] },
    cycleTimestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

const Recommendation = model<IRecommendation>('Recommendation', recommendationSchema);

export default Recommendation;
