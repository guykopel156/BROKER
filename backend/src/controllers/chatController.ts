import type { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

import config from '../config';
import { AppError } from '../utils';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const CHAT_SYSTEM_PROMPT = `You are the AI assistant for the BROKER trading dashboard. You help the user understand their portfolio, trades, market conditions, and Claude's trading recommendations.

You have knowledge about:
- Stock trading and market analysis
- Technical indicators (RSI, MACD, moving averages)
- The user's trading dashboard and how it works
- Risk management and trading strategies

Keep responses concise and helpful. Use simple language. If the user asks about specific stocks, give your honest analysis based on what you know.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function handleChat(req: Request, res: Response): Promise<void> {
  const { message, history } = req.body as { message: string; history?: ChatMessage[] };

  if (!message) {
    throw new AppError(400, 'MISSING_MESSAGE', 'Message is required');
  }

  if (!config.anthropicApiKey) {
    throw new AppError(500, 'CLAUDE_NOT_CONFIGURED', 'Claude API key not configured');
  }

  const messages = [
    ...(history ?? []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: message },
  ];

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new AppError(500, 'CLAUDE_INVALID_RESPONSE', 'Unexpected response type');
  }

  res.json({ data: { reply: content.text } });
}

export { handleChat };
