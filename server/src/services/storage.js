// Image/video storage: local disk (default) or Cloudinary, picked by STORAGE_DRIVER.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { HttpError } from '../middleware.js';

export const UPLOAD_ROOT = path.resolve(import.meta.dirname, '../../uploads');
const MIME_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif', 'image/gif': '.gif',
  'video/mp4': '.mp4', 'video/webm': '.webm',
}; // SVG deliberately excluded: user-uploaded SVG served from our origin is an XSS vector.

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 72 },
  fileFilter: (_req, file, cb) => (MIME_EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(415, `Unsupported file type: ${file.mimetype}`))),
});

const useCloudinary = () => process.env.STORAGE_DRIVER === 'cloudinary';
if (useCloudinary()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/** Stores a multer file and returns { url, storage_key }. */
export async function saveFile(file, folder = 'products') {
  if (useCloudinary()) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `bakachiki/${folder}`, resource_type: 'auto' }, (err, res) => (err ? reject(err) : resolve(res)))
        .end(file.buffer);
    });
    return { url: result.secure_url, storage_key: `cloudinary:${result.resource_type}:${result.public_id}` };
  }
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${MIME_EXT[file.mimetype]}`;
  await fs.mkdir(path.join(UPLOAD_ROOT, folder), { recursive: true });
  await fs.writeFile(path.join(UPLOAD_ROOT, folder, name), file.buffer);
  return { url: `/uploads/${folder}/${name}`, storage_key: `local:${folder}/${name}` };
}

/** Best-effort delete; seed assets (no storage_key) are never removed. */
export async function deleteFile(storageKey) {
  if (!storageKey) return;
  try {
    if (storageKey.startsWith('cloudinary:')) {
      const [, type, publicId] = storageKey.split(':');
      await cloudinary.uploader.destroy(publicId, { resource_type: type });
    } else if (storageKey.startsWith('local:')) {
      const target = path.resolve(UPLOAD_ROOT, storageKey.slice(6));
      if (target.startsWith(UPLOAD_ROOT + path.sep)) await fs.unlink(target);
    }
  } catch (err) {
    console.warn('File delete failed:', storageKey, err.message);
  }
}
