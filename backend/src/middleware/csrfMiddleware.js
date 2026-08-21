import crypto from 'crypto';
import AppError from '../utils/AppError.js';

const CSRF_COOKIE = 'fb_clone_csrf';

// Current deployment is HTTP, so CSRF cookies must not use Secure.
const csrfCookieOptions = {
  httpOnly: false,
  secure: false,
  sameSite: 'lax',
  path: '/',
};

// Methods that don't require CSRF protection
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req, res, next) {
  // Socket.IO polling requests are not conventional XHR and carry the
  // handshake JWT (not the CSRF header), so exempt the socket path.
  if (req.path.startsWith('/socket.io')) {
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(24).toString('base64url');
      res.cookie(CSRF_COOKIE, token, csrfCookieOptions);
    }
    return next();
  }

  // Ensure every visitor has a CSRF cookie (double-submit).
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(24).toString('base64url');
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions);
    req.csrfToken = token;
    return next();
  }

  req.csrfToken = req.cookies[CSRF_COOKIE];

  if (SAFE_METHODS.has(req.method)) return next();

  const expected = req.cookies[CSRF_COOKIE];
  const supplied = req.get('x-csrf-token');

  if (!expected || !supplied) {
    return next(new AppError('CSRF validation failed', 403));
  }

  if (expected.length !== supplied.length) {
    return next(new AppError('CSRF validation failed', 403));
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
      return next(new AppError('CSRF validation failed', 403));
    }
  } catch {
    return next(new AppError('CSRF validation failed', 403));
  }

  return next();
}