import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'dev-secret-change-me' || jwtSecret.length < 32) {
  // Fail safely: never run signing/verification with a weak or default secret.
  // eslint-disable-next-line no-console
  console.error('JWT_SECRET must be set to a random secret of at least 32 characters in .env. Refusing to start.');
  process.exit(1);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: 'fb_clone_token',
  databaseUrl: process.env.DATABASE_URL,
  uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(backendRoot, 'uploads')),
  maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10', 10),
  // Trust one reverse-proxy hop in production so req.ip (used by rate
  // limiting) reflects the real client behind nginx/caddy. Configurable via
  // TRUST_PROXY (e.g. "1" or "false").
  trustProxy: process.env.TRUST_PROXY !== undefined
    ? Number(process.env.TRUST_PROXY)
    : (process.env.NODE_ENV === 'production' ? 1 : false),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean),
};

export default env;