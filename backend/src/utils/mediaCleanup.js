import prisma from '../config/database.js';
import { deleteFile } from './helpers.js';

// Deletes stories past their 24h expiry along with their media files so
// expired stories never accumulate on disk. Safe to run repeatedly: it only
// touches rows with expiresAt < now, which are already invisible everywhere.
export async function cleanupExpiredStories() {
  const expired = await prisma.story.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, url: true },
  });
  if (expired.length === 0) return 0;

  await prisma.story.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
  for (const story of expired) deleteFile(story.url);
  return expired.length;
}

// Runs the cleanup once at startup and then on a fixed interval. The timer is
// unref()'d so it never keeps the process alive on its own.
export function scheduleMediaCleanup(intervalMs = 60 * 60 * 1000) {
  const run = () => {
    cleanupExpiredStories().catch(() => {
      // a failed sweep must not crash the server; the next tick will retry
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}