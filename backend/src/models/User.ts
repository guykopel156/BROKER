import { Schema, model, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export interface IUser extends Document {
  username: string;
  password: string;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    twoFactorSecret: { type: String },
    isTwoFactorEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser>('User', userSchema);

export default User;
