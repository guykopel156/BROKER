import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';

import config from '../config';

import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TradeUpdate,
  PnlUpdate,
  PositionUpdate,
  AlertPayload,
} from '../types';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

let io: TypedServer;

function initializeSocket(server: HttpServer): TypedServer {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function getSocket(): TypedServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocket first.');
  }
  return io;
}

function emitTradeNew(data: TradeUpdate): void {
  getSocket().emit('trade:new', data);
}

function emitTradeUpdated(data: TradeUpdate): void {
  getSocket().emit('trade:updated', data);
}

function emitPnlUpdate(data: PnlUpdate): void {
  getSocket().emit('pnl:update', data);
}

function emitPositionUpdate(data: PositionUpdate[]): void {
  getSocket().emit('position:update', data);
}

function emitAlert(data: AlertPayload): void {
  getSocket().emit('alert', data);
}

function emitEngineStatus(isPaused: boolean): void {
  getSocket().emit('engine:status', { isPaused });
}

export {
  initializeSocket,
  getSocket,
  emitTradeNew,
  emitTradeUpdated,
  emitPnlUpdate,
  emitPositionUpdate,
  emitAlert,
  emitEngineStatus,
};
