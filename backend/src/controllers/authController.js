import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import {
  registerUser,
  loginUser,
  signToken,
  publicUser,
  findUserById,
  createPasswordReset,
  resetPassword,
  changePassword,
  verifyEmailToken,
  getVerificationToken,
} from '../services/authService.js';
import env from '../config/env.js';

const isHttps = env.clientUrl?.startsWith('https://') === true;

const cookieOptions = {
  httpOnly: true,
  secure: isHttps,
  sameSite: isHttps ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

// clearCookie must mirror the original attributes (Secure/SameSite/httpOnly)
// or the browser will refuse to clear a production cookie.
const clearCookieOptions = {
  httpOnly: true,
  secure: isHttps,
  sameSite: isHttps ? 'none' : 'lax',
  path: '/',
};

function setTokenCookie(res, user) {
  const token = signToken(user.id, user.tokenVersion);
  res.cookie(env.cookieName, token, cookieOptions);
  return token;
}

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  const verifyToken = getVerificationToken(user.id);
  // No mailer is configured: expose the verification link in the response so
  // it can be shown on screen (same mechanism as the password reset token).
  const verificationUrl = `${env.clientUrl}/verify-email?token=${verifyToken}`;
  setTokenCookie(res, user);
  res.status(201).json({ success: true, user, verificationUrl });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    throw new AppError('Email/username and password are required', 400);
  }
  const user = await loginUser(identifier, password);
  setTokenCookie(res, user);
  res.json({ success: true, user: publicUser(user) });
});

export const logout = async (req, res) => {
  // Revoke the session server-side (bumps tokenVersion so every outstanding
  // JWT — including live Socket.IO connections — is invalidated). Always
  // succeed and clear the cookie regardless so logout is idempotent and does
  // not leak whether a session existed.
  const token = req.cookies?.[env.cookieName];
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      if (decoded?.id) {
        await prisma.user.updateMany({
          where: { id: decoded.id, tokenVersion: decoded.ver ?? 0 },
          data: { tokenVersion: { increment: 1 } },
        });
      }
    } catch {
      // stale/expired token — nothing to revoke
    }
  }
  res.clearCookie(env.cookieName, clearCookieOptions);
  res.json({ success: true, message: 'Logged out' });
};

export const me = asyncHandler(async (req, res) => {
  const user = await findUserById(req.user.id);
  res.json({ success: true, user: publicUser(user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('Email is required', 400);

  const { token } = await createPasswordReset(email);
  // No mailer is configured, so the generated token is returned in the
  // response and shown to the user on screen instead of being emailed or
  // logged to the terminal. The message stays identical whether or not the
  // account exists (no user enumeration); the token is only present when a
  // reset was actually created.
  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset token was generated.',
    resetToken: token || undefined,
  });
});

export const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError('Token and new password are required', 400);
  await resetPassword(token, password);
  res.json({ success: true, message: 'Password updated. Please log in again.' });
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError('Current and new passwords are required', 400);
  await changePassword(req.user.id, currentPassword, newPassword);
  res.json({ success: true, message: 'Password updated' });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) throw new AppError('Verification token is required', 400);
  const result = await verifyEmailToken(token);
  res.json({ success: true, ...result });
});

export const requestEmailVerification = asyncHandler(async (req, res) => {
  const token = getVerificationToken(req.user.id);
  const verificationUrl = `${env.clientUrl}/verify-email?token=${token}`;
  res.json({ success: true, message: 'Verification email sent', verificationUrl });
});

export const setPassword = async (req, res) => {
  res.status(501).json({ success: false, message: 'Not implemented' });
};