import express from 'express';
import cors from 'cors';
import http from 'http';

import config from './config';
import connectDatabase from './config/database';
import { migrateStrategyPrompt } from './config/migrateStrategy';
import { initializeSocket } from './services/socketService';
import { startEngine } from './services/tradingEngine';
import ibkrService from './services/ibkrService';
import { startDailyScheduler } from './services/scheduler';
import { ensureAdminExists } from './controllers/authController';
import { errorHandler } from './middleware';
import routes from './routes';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Status endpoint (no auth required for connection checks)
import { handleFullStatus } from './controllers/statusController';
app.get('/api/status', handleFullStatus);

app.use('/api', routes);

// Error handler must be last middleware
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDatabase();
  await ensureAdminExists();
  await migrateStrategyPrompt();
  initializeSocket(server);
  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);

    // Check IBKR gateway and open login page if needed
    if (config.ibkrAccountId) {
      ibkrService.checkGatewayOnStartup().then(() => {
        ibkrService.startKeepAlive();
        console.log('IBKR keep-alive started (tickle every 55s)');
      });
    }

    startEngine().catch((err) => {
      console.error('Failed to start trading engine:', err);
    });

    // Start WhatsApp daily scheduler
    startDailyScheduler();
  });
}

start();

export { app, server };
