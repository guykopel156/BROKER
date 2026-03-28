import express from 'express';
import cors from 'cors';
import http from 'http';

import config from './config';
import connectDatabase from './config/database';
import { initializeSocket } from './services/socketService';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start(): Promise<void> {
  await connectDatabase();
  initializeSocket(server);
  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
}

start();

export { app, server };
