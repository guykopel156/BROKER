import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  port: number;
  mongoUri: string;
  corsOrigin: string;
  nodeEnv: string;
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
};

export default config;
