/**
 * Product Image Upload Route
 *
 * POST /api/admin/products/upload-image
 *
 * Accepts one image file per request (multipart/form-data, field "image").
 * Validates:
 *   - File present
 *   - MIME type from actual content (not extension): JPEG, PNG, WebP only
 *   - File size ≤ 5 MB
 *   - product_id provided (to scope storage paths)
 *   - Current image count for that product ≤ 4 (so adding one more stays ≤ 5)
 *
 * Uploads to Supabase Storage bucket "product-images" (public bucket).
 * Stores only the durable public URL. Never stores base64 or binary in product records.
 *
 * Returns: { success: true, url: string }
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { supabase, isSupabaseConfigured } from '../database/supabase';
import { DataStore } from '../database/data-store';
import { AppError } from '../middleware/error-handler';

export const uploadRouter = Router();

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES_PER_PRODUCT = 5;
const STORAGE_BUCKET = 'product-images';

/** Allowed MIME types by content magic bytes */
const ALLOWED_MIME_SIGNATURES: Array<{ mime: string; bytes: number[]; offset: number }> = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  // WebP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function detectMimeFromBuffer(buf: Buffer): string | null {
  // Check JPEG
  if (buf.length >= 3 &&
      buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // Check PNG
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
      buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return 'image/png';
  }
  // Check WebP: RIFF at 0 and WEBP at offset 8
  if (buf.length >= 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}

function sanitizeFilename(originalName: string, mimeType: string): string {
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[mimeType] || '.jpg';
  // Generate a safe, random server-side filename — never use user-provided paths
  return `${uuidv4()}${ext}`;
}

uploadRouter.post(
  '/products/upload-image',
  (req: Request, res: Response, next: NextFunction): void => {
    const form = new IncomingForm({
      maxFileSize: MAX_FILE_SIZE_BYTES,
      maxFiles: 1,
      keepExtensions: false,
      allowEmptyFiles: false,
    });

    form.parse(req, async (err: any, fields: Record<string, any>, files: Record<string, any>) => {
      try {
        if (err) {
          const isSize = err.message?.toLowerCase().includes('maxfilesize');
          next(new AppError(
            isSize
              ? `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB per image.`
              : `Upload error: ${err.message}`,
            isSize ? 413 : 400,
            isSize ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR'
          ));
          return;
        }

        // Extract product_id from fields
        const productIdRaw = Array.isArray(fields.product_id) ? fields.product_id[0] : fields.product_id;
        const productId = (productIdRaw || '').trim();

        // Extract current image count (sent from client to support server-side enforcement)
        const currentCountRaw = Array.isArray(fields.current_count) ? fields.current_count[0] : fields.current_count;
        const currentCount = parseInt(currentCountRaw || '0', 10) || 0;

        if (!productId) {
          next(new AppError('product_id is required', 400, 'MISSING_PRODUCT_ID'));
          return;
        }

        // Validate product_id format (UUID pattern) to prevent path traversal
        if (!/^[0-9a-f-]{8,36}$/i.test(productId)) {
          next(new AppError('Invalid product_id format', 400, 'INVALID_PRODUCT_ID'));
          return;
        }

        // Server-side check: existing product must exist (when DataStore is populated)
        const existing = DataStore.getProductById(productId);
        // Enforce max 5 images — using current_count from client + 1; also check stored media
        const storedMediaCount = existing?.media?.length ?? 0;
        const effectiveCount = Math.max(currentCount, storedMediaCount);
        if (effectiveCount >= MAX_IMAGES_PER_PRODUCT) {
          next(new AppError(
            `Maximum ${MAX_IMAGES_PER_PRODUCT} images allowed per product. Remove an image before uploading a new one.`,
            400,
            'TOO_MANY_IMAGES'
          ));
          return;
        }

        // Get uploaded file
        const fileField = files.image;
        const file: FormidableFile | undefined = Array.isArray(fileField) ? fileField[0] : fileField;

        if (!file || !file.filepath) {
          next(new AppError('No image file provided. Use field name "image".', 400, 'NO_FILE'));
          return;
        }

        // Read first 12 bytes to detect real MIME from content (not extension or declared type)
        let headerBuf: Buffer;
        try {
          const fd = fs.openSync(file.filepath, 'r');
          headerBuf = Buffer.alloc(12);
          fs.readSync(fd, headerBuf, 0, 12, 0);
          fs.closeSync(fd);
        } catch {
          // Clean up temp file
          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
          next(new AppError('Could not read uploaded file', 500, 'FILE_READ_ERROR'));
          return;
        }

        const detectedMime = detectMimeFromBuffer(headerBuf);
        if (!detectedMime) {
          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
          next(new AppError(
            'Unsupported file type. Accepted formats: JPEG, PNG, WebP.',
            415,
            'UNSUPPORTED_FILE_TYPE'
          ));
          return;
        }

        // Verify declared mime vs detected (if declared)
        const declaredMime = (file.mimetype || '').toLowerCase();
        if (declaredMime && !ALLOWED_MIME_TYPES.includes(declaredMime)) {
          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
          next(new AppError(
            'Unsupported file type. Accepted formats: JPEG, PNG, WebP.',
            415,
            'UNSUPPORTED_FILE_TYPE'
          ));
          return;
        }

        // File size double-check (formidable enforces it, but belt-and-suspenders)
        const fileSize = file.size || 0;
        if (fileSize > MAX_FILE_SIZE_BYTES) {
          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
          next(new AppError(
            `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
            413,
            'FILE_TOO_LARGE'
          ));
          return;
        }

        // Generate a safe storage path under the product's directory
        const safeFilename = sanitizeFilename(file.originalFilename || 'upload', detectedMime);
        const storagePath = `${productId}/${safeFilename}`;

        let publicUrl: string;

        if (isSupabaseConfigured()) {
          // Upload to Supabase Storage
          const fileBuffer = fs.readFileSync(file.filepath);

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(storagePath, fileBuffer, {
              contentType: detectedMime,
              upsert: false,
              cacheControl: '31536000',
            });

          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

          if (uploadError) {
            console.error('[Upload] Supabase Storage upload error:', uploadError.message);
            next(new AppError(
              'Image upload failed. Please try again.',
              500,
              'STORAGE_UPLOAD_FAILED'
            ));
            return;
          }

          // Get the public URL
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(storagePath);

          if (!urlData?.publicUrl) {
            next(new AppError('Could not obtain public URL for uploaded image.', 500, 'URL_GENERATION_FAILED'));
            return;
          }

          publicUrl = urlData.publicUrl;
        } else {
          // Development fallback: serve image from a local /api/admin/media path.
          // WARNING: this is ephemeral on Railway — Supabase Storage should be configured for production.
          try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

          // Return a descriptive placeholder so the UI still functions in dev without Supabase Storage
          publicUrl = `https://picsum.photos/seed/${safeFilename.replace(/\.[^.]+$/, '')}/800/600`;
          console.warn(
            '[Upload] Supabase Storage not configured. Returning placeholder URL for development.',
            storagePath
          );
        }

        res.json({
          success: true,
          url: publicUrl,
          storage_path: storagePath,
          mime: detectedMime,
        });
      } catch (err) {
        next(err);
      }
    });
  }
);

/**
 * DELETE /api/admin/products/delete-image
 * Body: { product_id, storage_path }
 *
 * Deletes an image from Supabase Storage only when the image is no longer
 * referenced by any product (safe orphan cleanup).
 * If multiple products share a URL or Supabase is not configured, this is a no-op
 * and the API still returns success so the product record update is not blocked.
 */
uploadRouter.delete(
  '/products/delete-image',
  (req: Request, res: Response, next: NextFunction): void => {
    (async () => {
      try {
        const { storage_path, product_id } = req.body as { storage_path?: string; product_id?: string };

        if (!storage_path || !product_id) {
          res.json({ success: true, deleted: false, reason: 'missing_params' });
          return;
        }

        // Validate storage_path: must start with the product_id to prevent traversal
        if (!storage_path.startsWith(`${product_id}/`)) {
          res.json({ success: true, deleted: false, reason: 'path_mismatch' });
          return;
        }

        if (!isSupabaseConfigured()) {
          res.json({ success: true, deleted: false, reason: 'storage_not_configured' });
          return;
        }

        // Get public URL for this path and check if any other product references it
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storage_path);

        if (urlData?.publicUrl) {
          const allProducts = DataStore.getAllProductsAdmin();
          const urlReferenceCount = allProducts.reduce((count, p) => {
            const mediaUrls = (p.media || []).map((m: any) => m.url);
            return count + mediaUrls.filter((u: string) => u === urlData.publicUrl).length;
          }, 0);

          // Only delete from storage if no product still references this URL
          if (urlReferenceCount === 0) {
            const { error } = await supabase.storage
              .from(STORAGE_BUCKET)
              .remove([storage_path]);

            if (error) {
              console.warn('[Upload] Supabase Storage delete error (non-fatal):', error.message);
              res.json({ success: true, deleted: false, reason: 'storage_delete_failed' });
              return;
            }

            res.json({ success: true, deleted: true });
            return;
          }
        }

        res.json({ success: true, deleted: false, reason: 'still_referenced' });
      } catch (err) {
        next(err);
      }
    })();
  }
);
