import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  port: number;
  mongoUri: string;
  corsOrigin: string;
  nodeEnv: string;
  ibkrBaseUrl: string;
  ibkrAccountId: string;
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
};

export default config;
