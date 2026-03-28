import express from 'express';
import cors from 'cors';
import http from 'http';

const PORT = process.env.PORT ?? 5000;

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, server };
