import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[env.cookieName];

  if (!token) {
    return next(new AppError('Not authenticated', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    return next(new AppError('Session expired, please log in again', 401));
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      isVerified: true,
      tokenVersion: true,
      profile: { select: { avatarUrl: true, coverUrl: true, bio: true } },
    },
  });

  if (!user || !user.isActive) {
    return next(new AppError('User no longer exists', 401));
  }

  // Token revocation: any token signed before a password change is rejected.
  if (decoded.ver !== undefined && decoded.ver !== user.tokenVersion) {
    return next(new AppError('Session expired, please log in again', 401));
  }

  req.user = user;
  req.user.id = user.id;
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[env.cookieName];
  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, isActive: true, tokenVersion: true },
      });
      // Revoked (outdated tokenVersion) or disabled accounts never authenticate.
      if (user && user.isActive && (decoded.ver === undefined || decoded.ver === user.tokenVersion)) {
        req.user = user;
      }
    } catch (err) {
      // ignore invalid tokens for optional auth
    }
  }
  next();
});

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  next();
};