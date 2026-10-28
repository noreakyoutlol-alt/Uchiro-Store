import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import productionApp from '../production';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { mintAdminSessionToken } from '../auth/admin-session';

describe('Product Image Gallery & Media Management (Prompt 3)', () => {
  let adminSessionToken: string;
  let adminBearerToken: string;
  const testProductId = '55555555-5555-5555-5555-555555555501';

  // Minimal valid 1x1 PNG image buffer (magic bytes: 89 50 4E 47 0D 0A 1A 0A)
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  // Invalid file buffer (plain text bytes)
  const invalidTextBuffer = Buffer.from('This is not an image file at all.');

  beforeAll(async () => {
    // Generate valid admin tokens
    adminSessionToken = mintAdminSessionToken('admin-super-1');
    adminBearerToken = jwt.sign(
      {
        id: 'admin-super-1',
        username: 'uchiro_admin',
        role: 'superadmin',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Seed test product in DataStore
    DataStore.saveProduct({
      id: testProductId,
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Blox Fruits Test Account for Gallery',
      price: 15.0,
      delivery_mode: 'auto_account',
      stock: 1,
      is_active: true,
      is_draft: false,
      media: [],
    });
  });

  // =========================================================================
  // 1. Upload Route Validation
  // =========================================================================
  describe('POST /api/admin/products/upload-image', () => {
    it('rejects upload when product_id is missing', async () => {
      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .attach('image', validPngBuffer, 'test.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('MISSING_PRODUCT_ID');
    });

    it('rejects upload when product_id has invalid format (path traversal attempt)', async () => {
      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', '../../etc/passwd')
        .attach('image', validPngBuffer, 'test.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('INVALID_PRODUCT_ID');
    });

    it('rejects upload when no image file is provided', async () => {
      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', testProductId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('NO_FILE');
    });

    it('rejects upload of non-image file by checking real magic bytes', async () => {
      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', testProductId)
        .attach('image', invalidTextBuffer, 'fake.jpg'); // Named fake.jpg but content is plain text

      expect(res.status).toBe(415);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('UNSUPPORTED_FILE_TYPE');
    });

    it('rejects upload when product already has maximum 5 images', async () => {
      // First, set 5 images on test product
      DataStore.updateProduct(testProductId, {
        media: [
          { id: 'm1', product_id: testProductId, url: 'https://images.unsplash.com/photo-1?w=800', alt_text: '1', is_primary: true, sort_order: 1 },
          { id: 'm2', product_id: testProductId, url: 'https://images.unsplash.com/photo-2?w=800', alt_text: '2', is_primary: false, sort_order: 2 },
          { id: 'm3', product_id: testProductId, url: 'https://images.unsplash.com/photo-3?w=800', alt_text: '3', is_primary: false, sort_order: 3 },
          { id: 'm4', product_id: testProductId, url: 'https://images.unsplash.com/photo-4?w=800', alt_text: '4', is_primary: false, sort_order: 4 },
          { id: 'm5', product_id: testProductId, url: 'https://images.unsplash.com/photo-5?w=800', alt_text: '5', is_primary: false, sort_order: 5 },
        ],
      });

      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', testProductId)
        .attach('image', validPngBuffer, 'new-photo.png');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('TOO_MANY_IMAGES');

      // Reset product media back to empty for subsequent tests
      DataStore.updateProduct(testProductId, { media: [] });
    });

    it('successfully uploads valid PNG image and returns public URL (not base64)', async () => {
      const res = await request(app)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', testProductId)
        .attach('image', validPngBuffer, 'valid-test.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBeDefined();
      expect(typeof res.body.url).toBe('string');
      // Must NOT be a base64 data-URL
      expect(res.body.url.startsWith('data:')).toBe(false);
      // Must start with http or https
      expect(res.body.url.startsWith('http://') || res.body.url.startsWith('https://')).toBe(true);
      expect(res.body.mime).toBe('image/png');
    });

    it('productionApp also registers uploadRouter and handles upload successfully', async () => {
      const res = await request(productionApp)
        .post('/api/admin/products/upload-image')
        .set('x-admin-session', adminSessionToken)
        .field('product_id', testProductId)
        .attach('image', validPngBuffer, 'prod-test.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toBeDefined();
      expect(res.body.url.startsWith('http://') || res.body.url.startsWith('https://')).toBe(true);
    });
  });

  // =========================================================================
  // 2. Product Media Validation on POST and PUT /api/admin/products
  // =========================================================================
  describe('Product Media Validation on Save/Update', () => {
    it('rejects product payload with more than 5 images (TOO_MANY_IMAGES)', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('x-admin-session', adminSessionToken)
        .send({
          title: 'Blox Fruits 6-image product',
          price: 20,
          category_id: '11111111-1111-1111-1111-111111111103',
          delivery_mode: 'auto_account',
          media: [
            { url: 'https://images.unsplash.com/p1?w=800' },
            { url: 'https://images.unsplash.com/p2?w=800' },
            { url: 'https://images.unsplash.com/p3?w=800' },
            { url: 'https://images.unsplash.com/p4?w=800' },
            { url: 'https://images.unsplash.com/p5?w=800' },
            { url: 'https://images.unsplash.com/p6?w=800' }, // 6th image
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('TOO_MANY_IMAGES');
    });

    it('rejects product payload containing base64 data URLs (INVALID_MEDIA_DATA_URL)', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('x-admin-session', adminSessionToken)
        .send({
          title: 'Blox Fruits Base64 Product',
          price: 20,
          category_id: '11111111-1111-1111-1111-111111111103',
          delivery_mode: 'auto_account',
          media: [
            { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('INVALID_MEDIA_DATA_URL');
    });

    it('rejects duplicate image URLs within the same product (DUPLICATE_MEDIA_URL)', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .set('x-admin-session', adminSessionToken)
        .send({
          title: 'Blox Fruits Duplicate Media Product',
          price: 20,
          category_id: '11111111-1111-1111-1111-111111111103',
          delivery_mode: 'auto_account',
          media: [
            { url: 'https://images.unsplash.com/same-image?w=800' },
            { url: 'https://images.unsplash.com/same-image?w=800' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.code).toBe('DUPLICATE_MEDIA_URL');
    });

    it('saves a product with 5 valid images and normalizes is_primary=true for slot 0', async () => {
      const images = [
        { url: 'https://images.unsplash.com/photo-a?w=800', alt_text: 'Cover Image' },
        { url: 'https://images.unsplash.com/photo-b?w=800', alt_text: 'Image 2' },
        { url: 'https://images.unsplash.com/photo-c?w=800', alt_text: 'Image 3' },
        { url: 'https://images.unsplash.com/photo-d?w=800', alt_text: 'Image 4' },
        { url: 'https://images.unsplash.com/photo-e?w=800', alt_text: 'Image 5' },
      ];

      const res = await request(app)
        .post('/api/admin/products')
        .set('x-admin-session', adminSessionToken)
        .send({
          title: 'Blox Fruits Full 5-Image Gallery Account',
          price: 25.0,
          category_id: '11111111-1111-1111-1111-111111111103',
          delivery_mode: 'auto_account',
          stock: 1,
          media: images,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const savedProduct = res.body.data;
      expect(savedProduct.media).toHaveLength(5);

      // Verify slot 0 is primary, slots 1-4 are not primary
      expect(savedProduct.media[0].is_primary).toBe(true);
      expect(savedProduct.media[0].sort_order).toBe(1);
      expect(savedProduct.media[0].url).toBe('https://images.unsplash.com/photo-a?w=800');

      for (let i = 1; i < 5; i++) {
        expect(savedProduct.media[i].is_primary).toBe(false);
        expect(savedProduct.media[i].sort_order).toBe(i + 1);
      }
    });

    it('persists reordered images on update, updating cover image to the new slot 0', async () => {
      // Reorder so photo-c is slot 0 (new cover)
      const reordered = [
        { url: 'https://images.unsplash.com/photo-c?w=800', alt_text: 'Promoted Cover' },
        { url: 'https://images.unsplash.com/photo-a?w=800', alt_text: 'Old Cover' },
      ];

      const res = await request(app)
        .put(`/api/admin/products/${testProductId}`)
        .set('x-admin-session', adminSessionToken)
        .send({
          media: reordered,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const updated = res.body.data;
      expect(updated.media).toHaveLength(2);
      expect(updated.media[0].url).toBe('https://images.unsplash.com/photo-c?w=800');
      expect(updated.media[0].is_primary).toBe(true);
      expect(updated.media[1].url).toBe('https://images.unsplash.com/photo-a?w=800');
      expect(updated.media[1].is_primary).toBe(false);
    });
  });

  // =========================================================================
  // 3. Backwards Compatibility for Older Single-Image Records
  // =========================================================================
  describe('Backwards Compatibility with Legacy Single-Image Records', () => {
    it('normalizes legacy product with only image_url into a 1-item gallery', async () => {
      const legacyId = '66666666-6666-6666-6666-666666666601';
      // Save directly into DataStore simulating an older record without media array
      DataStore.saveProduct({
        id: legacyId,
        category_id: '11111111-1111-1111-1111-111111111103',
        title: 'Legacy Blox Fruits Account',
        price: 9.99,
        delivery_mode: 'auto_account',
        stock: 1,
        is_active: true,
        is_draft: false,
        image_url: 'https://images.unsplash.com/legacy-cover?w=800',
      } as any);

      // Query via public store API
      const res = await request(app).get(`/api/products/${legacyId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const product = res.body.data;
      expect(product.media).toBeDefined();
      expect(product.media).toHaveLength(1);
      expect(product.media[0].url).toBe('https://images.unsplash.com/legacy-cover?w=800');
      expect(product.media[0].is_primary).toBe(true);
      expect(product.media[0].sort_order).toBe(1);
      // Legacy image_url field is also preserved for older clients
      expect(product.image_url).toBe('https://images.unsplash.com/legacy-cover?w=800');
    });

    it('returns empty media array and null image_url when product has no images', async () => {
      const emptyImageId = '77777777-7777-7777-7777-777777777701';
      DataStore.saveProduct({
        id: emptyImageId,
        category_id: '11111111-1111-1111-1111-111111111103',
        title: 'No Image Product',
        price: 5.0,
        delivery_mode: 'digital_code',
        stock: 5,
        is_active: true,
        is_draft: false,
      });

      const res = await request(app).get(`/api/products/${emptyImageId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.media).toEqual([]);
      expect(res.body.data.image_url).toBeNull();
    });
  });
});
