import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

import config from '../config';
import User from '../models/User';
import { AppError } from '../utils';

const TOKEN_EXPIRY = '24h';

function generateToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, config.jwtSecret, { expiresIn: TOKEN_EXPIRY });
}

async function handleLogin(req: Request, res: Response): Promise<void> {
  const { username, password, twoFactorCode } = req.body as {
    username: string;
    password: string;
    twoFactorCode?: string;
  };

  if (!username || !password) {
    throw new AppError(400, 'MISSING_CREDENTIALS', 'Username and password required');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  // Check 2FA if enabled
  if (user.isTwoFactorEnabled) {
    if (!twoFactorCode) {
      res.json({ data: { requiresTwoFactor: true } });
      return;
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret ?? '',
      encoding: 'base32',
      token: twoFactorCode,
      window: 1,
    });

    if (!isValid) {
      throw new AppError(401, 'INVALID_2FA', 'Invalid two-factor code');
    }
  }

  const token = generateToken(user.id as string, user.username);
  res.json({
    data: {
      token,
      username: user.username,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    },
  });
}

async function handleSetup2FA(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const secret = speakeasy.generateSecret({
    name: `BROKER (${user.username})`,
    issuer: 'BROKER AI Trading',
  });

  user.twoFactorSecret = secret.base32;
  await user.save();

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url ?? '');

  res.json({
    data: {
      secret: secret.base32,
      qrCode: qrCodeUrl,
    },
  });
}

async function handleVerify2FA(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const { code } = req.body as { code: string };

  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');
  if (!code) throw new AppError(400, 'MISSING_CODE', 'Verification code required');

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const isValid = speakeasy.totp.verify({
    secret: user.twoFactorSecret ?? '',
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!isValid) {
    throw new AppError(400, 'INVALID_CODE', 'Invalid verification code');
  }

  user.isTwoFactorEnabled = true;
  await user.save();

  res.json({ data: { success: true, message: '2FA enabled successfully' } });
}

async function handleMe(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, 'UNAUTHORIZED', 'Not authenticated');

  const user = await User.findById(userId).select('-password -twoFactorSecret');
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  res.json({ data: user });
}

// Create admin user if none exists
async function ensureAdminExists(): Promise<void> {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      username: config.adminUsername,
      password: config.adminPassword,
    });
    console.log(`Admin user created: ${config.adminUsername}`);
  }
}

export { handleLogin, handleSetup2FA, handleVerify2FA, handleMe, ensureAdminExists };
