import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import { uploadDir } from './middleware/uploadMiddleware.js';
import AppError from './utils/AppError.js';
import { apiLimiter } from './middleware/rateLimitMiddleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';
import { csrfProtection } from './middleware/csrfMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import reactionRoutes from './routes/reactionRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import storyRoutes from './routes/storyRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import marketplaceRoutes from './routes/marketplaceRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import savedRoutes from './routes/savedRoutes.js';
import safetyRoutes from './routes/safetyRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import streamRoutes from './routes/streamRoutes.js';

const app = express();

// Behind a reverse proxy (production), trust one hop so req.ip — used by
// express-rate-limit and socket connections — reflects the real client.
app.set('trust proxy', env.trustProxy);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.allowedOrigins.includes(origin)) return callback(null, true);
      if (env.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// HTTP Parameter Pollution guard: duplicate query keys produce arrays in
// req.query; reject them outright rather than risk them reaching validators
// or Prisma as unexpected types (which previously caused 500s).
app.use((req, res, next) => {
  if (req.query && Object.values(req.query).some((v) => Array.isArray(v))) {
    return next(new AppError('Unexpected duplicate parameter', 400));
  }
  return next();
});

// Path traversal guard: reject any request whose raw URL contains a ".."
// path segment (encoded or not) before Express routing normalizes it away.
app.use((req, res, next) => {
  if (/(^|\/)\.\.(\/|$)/.test(req.originalUrl) || /%2e/i.test(req.originalUrl)) {
    return next(new AppError('Not found', 404));
  }
  return next();
});

// CSRF double-submit protection. All state-mutating requests must echo the
// fb_clone_csrf cookie value in the x-csrf-token header.
app.use(csrfProtection);

// Uploaded media is served only through this hardened router. Filenames are
// server-generated (<timestamp>-<nanoid>.<ext>), so an allowlist pattern plus a
// rooted-path check makes traversal impossible. Files are served as inert
// media: nosniff + sandboxed CSP + a Content-Type allowlist, so even a
// maliciously-crafted payload can never be interpreted as HTML/JS.
const MEDIA_NAME_RE = /^[\d]+-[A-Za-z0-9_-]+\.(jpg|jpeg|png|gif|webp|heic|mp4|webm|mov|avi)$/;

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
};

app.get('/uploads/:name', (req, res, next) => {
  const name = req.params.name || '';
  if (!MEDIA_NAME_RE.test(name)) return next(new AppError('Not found', 404));

  const root = path.resolve(uploadDir);
  const filePath = path.resolve(root, name);
  if (!filePath.startsWith(root + path.sep)) return next(new AppError('Not found', 404));
  if (!fs.existsSync(filePath)) return next(new AppError('Not found', 404));

  const ext = path.extname(name).toLowerCase();
  res.set({
    'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  return res.sendFile(filePath);
});

app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok' }));

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', commentRoutes);
app.use('/api', reactionRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', messageRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/streams', streamRoutes);

// Production single-server mode: if the frontend has been built
// (frontend/dist), serve it from Express and fall back to index.html for SPA
// routes. API, uploads and socket endpoints are handled above and take
// precedence. In development this block is skipped (vite serves the SPA).
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    index: 'index.html',
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) return next();
    return res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;