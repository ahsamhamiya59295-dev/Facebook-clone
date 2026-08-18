import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database.js';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signToken(userId, tokenVersion) {
  return jwt.sign({ id: userId, ver: tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// Returns a URL-safe random token.
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Gmail ignores dots in the local part (a.bc@gmail.com === abc@gmail.com).
// Normalize to the stored form so dot-variants match for login + reset.
export function normalizeGmail(email) {
  const e = email.trim().toLowerCase();
  const m = e.match(/^(.*)@(gmail\.com)$/);
  if (!m) return e;
  return m[1].replace(/\./g, '') + '@' + m[2];
}

export async function findByCredential(identifier) {
  const normalized = identifier.toLowerCase().trim();
  const gmail = normalizeGmail(identifier);
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: normalized },
        { email: gmail },
        { username: normalized },
        { profile: { phone: identifier.trim() } },
      ],
    },
    include: { profile: true },
  });
}

export async function findUserById(id) {
  return prisma.user.findUnique({
    where: { id },
    include: { profile: true },
  });
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.profile?.avatarUrl || null,
    coverUrl: user.profile?.coverUrl || null,
    bio: user.profile?.bio || null,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    role: user.role,
    dob: user.dob,
    createdAt: user.createdAt,
  };
}

export async function registerUser(data) {
  const passwordHash = await hashPassword(data.password);
  const username = data.username.toLowerCase().trim();
  const email = normalizeGmail(data.email);

  const existing = await prisma.user.count({
    where: { OR: [{ username }, { email }] },
  });
  if (existing > 0) {
    throw new AppError('An account with this email or username already exists', 409);
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      fullName: data.fullName.trim(),
      dob: new Date(data.dob),
      gender: data.gender || null,
      profile: { create: { birthdayVisibility: Boolean(data.showBirthday) } },
      notificationSettings: { create: {} },
    },
    include: { profile: true },
  });

  return publicUser(user);
}

export async function loginUser(identifier, password) {
  const user = await findByCredential(identifier);
  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid credentials', 401);
  }
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return user;
}

export async function createPasswordReset(email) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: email.toLowerCase().trim() }, { email: normalizeGmail(email) }] },
  });
  // Never reveal whether an account exists
  if (!user) return { token: null };

  const token = generateResetToken();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // invalidate any previous reset tokens
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  return { token };
}

export async function resetPassword(token, newPassword) {
  if (!token || !newPassword) throw new AppError('Token and password are required', 400);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const reset = await prisma.passwordReset.findFirst({
    where: { tokenHash, used: false },
    include: { user: true },
  });

  if (!reset || reset.expiresAt <= new Date()) {
    throw new AppError('Reset token is invalid or has expired', 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    // Atomically consume the token first; concurrent replays lose the race
    // and abort the whole transaction (nothing is changed).
    const consumed = await tx.passwordReset.updateMany({
      where: { id: reset.id, used: false },
      data: { used: true },
    });
    if (consumed.count !== 1) {
      throw new AppError('Reset token is invalid or has expired', 400);
    }
    await tx.user.update({
      where: { id: reset.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } }, // invalidates existing JWTs
    });
  });

  const user = await prisma.user.findUnique({ where: { id: reset.userId } });
  return publicUser(user);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Current password is incorrect', 400);

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, tokenVersion: { increment: 1 } },
  });
}

export async function verifyEmailToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError('Verification link is invalid or has expired', 400);
  }
  if (payload.purpose !== 'email_verify') throw new AppError('Invalid token', 400);

  const user = await prisma.user.findUnique({ where: { id: payload.id } });
  if (!user) throw new AppError('User not found', 404);
  if (user.isEmailVerified) return { alreadyVerified: true };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true },
    include: { profile: true },
  });
  return { alreadyVerified: false, user: publicUser(updated) };
}

export function getVerificationToken(userId) {
  return jwt.sign({ id: userId, purpose: 'email_verify' }, env.jwtSecret, { expiresIn: '7d' });
}