import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  port: number;
  mongoUri: string;
  corsOrigin: string;
  nodeEnv: string;
  ibkrBaseUrl: string;
  ibkrAccountId: string;
  anthropicApiKey: string;
  claudeModel: string;
  polygonApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappFrom: string;
  whatsappToNumber: string;
  jwtSecret: string;
  adminUsername: string;
  adminPassword: string;
}

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config: AppConfig = {
  port: Number(getEnvVar('PORT', '5000')),
  mongoUri: getEnvVar('MONGO_URI'),
  corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000'),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  ibkrBaseUrl: getEnvVar('IBKR_BASE_URL', 'https://localhost:5000/v1/api'),
  ibkrAccountId: getEnvVar('IBKR_ACCOUNT_ID', ''),
  anthropicApiKey: getEnvVar('ANTHROPIC_API_KEY', ''),
  claudeModel: getEnvVar('CLAUDE_MODEL', 'claude-sonnet-4-20250514'),
  polygonApiKey: getEnvVar('POLYGON_API_KEY', ''),
  twilioAccountSid: getEnvVar('TWILIO_ACCOUNT_SID', ''),
  twilioAuthToken: getEnvVar('TWILIO_AUTH_TOKEN', ''),
  twilioWhatsappFrom: getEnvVar('TWILIO_WHATSAPP_FROM', ''),
  whatsappToNumber: getEnvVar('WHATSAPP_TO_NUMBER', ''),
  jwtSecret: getEnvVar('JWT_SECRET', 'broker-secret-change-in-production'),
  adminUsername: getEnvVar('ADMIN_USERNAME', 'admin'),
  adminPassword: getEnvVar('ADMIN_PASSWORD', 'admin123'),
};

export default config;
