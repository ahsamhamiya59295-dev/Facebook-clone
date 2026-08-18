import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import env from './config/env.js';
import prisma from './config/database.js';
import { registerSocket } from './sockets/socket.js';
import { scheduleMediaCleanup } from './utils/mediaCleanup.js';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.allowedOrigins,
    credentials: true,
  },
});

registerSocket(io);

// Expired stories and their media files are swept on startup and hourly.
scheduleMediaCleanup();

httpServer.listen(env.port, env.host, () => {
  // eslint-disable-next-line no-console
  console.log(`API server running on http://${env.host}:${env.port} (${env.nodeEnv})`);
});

async function shutdown() {
  io.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { httpServer, io };