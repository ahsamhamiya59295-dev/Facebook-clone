import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import env from '../config/env.js';
import AppError from '../utils/AppError.js';

const MB = 1024 * 1024;

export const uploadDir = path.resolve(env.uploadDir);

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}
ensureUploadDir();

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
const ALLOWED_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi', 'video/x-msvideo'];

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.avi']);

// Extension is derived from the (validated) declared mimetype — the stored
// filename, including its extension, is fully server-controlled.
const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/avi': '.avi',
  'video/x-msvideo': '.avi',
};

// Defense in depth: refuse any extension that could be executed or interpreted
// by a browser/server even if the declared mimetype claims to be a photo/video.
const DANGEROUS_EXTENSIONS = new Set([
  '.html', '.htm', '.shtml', '.svg', '.svgz', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', '.jsonp', '.xml', '.xhtml', '.php', '.php3', '.php4', '.php5', '.phtml',
  '.asp', '.aspx', '.jsp', '.jspx', '.cfm', '.pl', '.py', '.rb', '.sh', '.bash',
  '.csh', '.zsh', '.bat', '.cmd', '.ps1', '.vbs', '.com', '.scr', '.pif', '.hta',
  '.exe', '.msi', '.msp', '.dll', '.so', '.dylib', '.jar', '.war', '.apk', '.deb',
  '.rpm', '.bin', '.dat', '.class', '.wasm', '.swf', '.pdf', '.doc', '.docx', '.xls',
  '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.gz', '.tar', '.7z', '.rar', '.iso',
]);

const CONTROL_CHARS = /[\x00-\x1f\x7f]/; // eslint-disable-line no-control-regex

function isSafeOriginalName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 255) return false;
  if (CONTROL_CHARS.test(name)) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  return true;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || '.bin';
    cb(null, `${Date.now()}-${nanoid(10)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const original = file.originalname || '';
  if (!isSafeOriginalName(original)) {
    return cb(new AppError('Invalid file name', 400));
  }

  const ext = path.extname(original).toLowerCase();
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return cb(new AppError('File type not allowed', 400));
  }

  const allowedExt = imageExtensions.has(ext) || videoExtensions.has(ext);
  const allowedMime = ALLOWED_IMAGES.includes(file.mimetype) || ALLOWED_VIDEOS.includes(file.mimetype);
  if (!allowedExt || !allowedMime) {
    return cb(new AppError('Only photos and videos are allowed', 400));
  }
  return cb(null, true);
};

export function uploadSingle(field = 'file', maxMb = env.maxUploadSizeMb) {
  return multer({
    storage,
    limits: { fileSize: maxMb * MB, files: 1 },
    fileFilter,
  }).single(field);
}

export function uploadArray(field = 'files', maxFiles = 10, maxMb = env.maxUploadSizeMb) {
  return multer({
    storage,
    limits: { fileSize: maxMb * MB, files: maxFiles },
    fileFilter,
  }).array(field, maxFiles);
}

export const uploadSingleImageOrVideo = uploadSingle('file', env.maxUploadSizeMb);

export const uploadImages = uploadArray('files', 10, env.maxUploadSizeMb);

export const optionalUpload = (req, res, next) => {
  const instance = multer({
    storage,
    limits: { fileSize: env.maxUploadSizeMb * MB, files: 10 },
    fileFilter,
  }).any();
  instance(req, res, (err) => (err ? next(err) : next()));
};

// Rejects uploads whose combined size exceeds the route budget. Must run after
// the multer middleware. Deletes the just-written files on rejection.
export function enforceTotalSize(maxMb) {
  return (req, res, next) => {
    const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
    const total = files.reduce((sum, f) => sum + (f.size || 0), 0);
    if (total > maxMb * MB) {
      for (const f of files) {
        try { fs.unlinkSync(f.path); } catch { /* already gone */ }
      }
      return next(new AppError(`Total upload exceeds ${maxMb}MB`, 413));
    }
    return next();
  };
}

// Removes uploaded files when the request ultimately fails (validation, DB
// errors, aborts) so attackers cannot exhaust disk with orphaned uploads.
export function cleanupUploads(req, res, next) {
  const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      for (const f of files) {
        try { fs.unlinkSync(f.path); } catch { /* already gone */ }
      }
    }
  });
  next();
}

export function sniffMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    const n = fs.readSync(fd, buf, 0, 12, 0);
    const head = buf.subarray(0, n);
    const latin = (a, b) => head.subarray(a, Math.min(b, head.length)).toString('latin1');
    const hex = head.subarray(0, Math.min(4, head.length)).toString('hex');
    return {
      isJpeg: hex.startsWith('ffd8ff'),
      isPng: hex === '89504e47',
      isGif: latin(0, 3) === 'GIF',
      isWebp: latin(0, 4) === 'RIFF' && latin(8, 12) === 'WEBP',
      isFtyp: latin(4, 8) === 'ftyp',
      isWebm: hex === '1a45dfa3',
      isAvi: latin(0, 4) === 'RIFF' && latin(8, 12) === 'AVI ',
    };
  } finally {
    fs.closeSync(fd);
  }
}

function assertMagicMatches(file) {
  const { path: filePath, mimetype, originalname } = file;
  const magic = sniffMagicBytes(filePath);

  if (mimetype === 'image/jpeg') {
    if (!magic.isJpeg) return `JPEG file header mismatch for '${originalname}'`;
  } else if (mimetype === 'image/png') {
    if (!magic.isPng) return `PNG file header mismatch for '${originalname}'`;
  } else if (mimetype === 'image/gif') {
    if (!magic.isGif) return `GIF file header mismatch for '${originalname}'`;
  } else if (mimetype === 'image/webp') {
    if (!magic.isWebp) return `WEBP file header mismatch for '${originalname}'`;
  } else if (mimetype === 'image/heic') {
    if (!magic.isFtyp) return `HEIC file header mismatch for '${originalname}'`;
  } else if (mimetype === 'video/mp4' || mimetype === 'video/quicktime') {
    if (!magic.isFtyp) return `${mimetype} container header mismatch for '${originalname}'`;
  } else if (mimetype === 'video/webm') {
    if (!magic.isWebm) return `WEBM file header mismatch for '${originalname}'`;
  } else if (mimetype === 'video/avi' || mimetype === 'video/x-msvideo') {
    if (!magic.isAvi) return `AVI file header mismatch for '${originalname}'`;
  }
  return null;
}

const MAX_IMAGE_DIMENSION = 12000;
const MAX_PIXELS = 200_000_000;

// Decodes image headers to reject polyglots/corrupt files and decompression
// bombs (absurd dimensions) before they are stored or served.
async function assertImageSafe(file) {
  if (!ALLOWED_IMAGES.includes(file.mimetype)) return null;
  if (file.mimetype === 'image/heic') return null;
  try {
    const meta = await sharp(file.path, { failOn: 'error' }).metadata();
    if (!meta || !meta.width || !meta.height) return 'Invalid image file';
    if (meta.width > MAX_IMAGE_DIMENSION || meta.height > MAX_IMAGE_DIMENSION) {
      return `Image dimensions exceed ${MAX_IMAGE_DIMENSION}px`;
    }
    if (meta.width * meta.height > MAX_PIXELS) {
      return 'Image is too large';
    }
    return null;
  } catch {
    return 'Invalid image file (could not be decoded)';
  }
}

export async function sniffUploadedFiles(req, res, next) {
  const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
  for (const file of files) {
    const magicErr = assertMagicMatches(file);
    if (magicErr) {
      try { fs.unlinkSync(file.path); } catch { /* already gone */ }
      return next(new AppError(magicErr, 400));
    }
    const imgErr = await assertImageSafe(file);
    if (imgErr) {
      try { fs.unlinkSync(file.path); } catch { /* already gone */ }
      return next(new AppError(imgErr, 400));
    }
  }
  return next();
}

export function inferMediaType(url, mimetype) {
  const ext = path.extname(url).toLowerCase();
  if (videoExtensions.has(ext)) return 'VIDEO';
  if (imageExtensions.has(ext)) return 'IMAGE';
  if (mimetype && ALLOWED_VIDEOS.includes(mimetype)) return 'VIDEO';
  return 'FILE';
}