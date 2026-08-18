import path from 'path';
import fs from 'fs';
import env from '../config/env.js';

export function publicUrl(filename) {
  if (!filename) return null;
  if (/^https?:\/\//.test(filename)) return filename;
  return `/uploads/${filename}`;
}

export function deleteFile(filename) {
  if (!filename || /^https?:\/\//.test(filename)) return;
  // basename() strips any directory components, so a stored URL can never be
  // turned into a path traversal here.
  const name = path.basename(filename);
  const absolute = path.resolve(env.uploadDir, name);
  try {
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch (err) {
    // ignore cleanup errors
  }
}

export function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  const intervals = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, value] of intervals) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return count === 1 ? `1 ${name} ago` : `${count} ${name}s ago`;
  }
  return 'just now';
}