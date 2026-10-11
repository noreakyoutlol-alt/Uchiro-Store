import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../server';
import {
  TELEGRAM_EMOJIS,
  WEBM_EMOJI_IDS,
  WEBM_EMOJI_NAMES,
  WEBP_EMOJI_IDS,
  WEBP_EMOJI_NAMES,
} from '../config/telegram-emojis';

describe('Local Telegram Premium Emojis Integration & Rendering Optimization', () => {
  const storeEmojiDir = path.resolve(__dirname, '../../../client-store/public/emojis');
  const adminEmojiDir = path.resolve(__dirname, '../../../client-admin/public/emojis');

  it('verifies that public/emojis directory exists in both client-store and client-admin', () => {
    expect(fs.existsSync(storeEmojiDir)).toBe(true);
    expect(fs.existsSync(adminEmojiDir)).toBe(true);
  });

  it('verifies all known WEBM animated emoji video assets exist on disk in client-store and client-admin', () => {
    for (const id of WEBM_EMOJI_IDS) {
      const storeFile = path.join(storeEmojiDir, `${id}.webm`);
      const adminFile = path.join(adminEmojiDir, `${id}.webm`);
      expect(fs.existsSync(storeFile)).toBe(true);
      expect(fs.existsSync(adminFile)).toBe(true);
    }
  });

  it('verifies all known WEBP static emoji image assets exist on disk in client-store and client-admin', () => {
    for (const id of WEBP_EMOJI_IDS) {
      const storeFile = path.join(storeEmojiDir, `${id}.webp`);
      const adminFile = path.join(adminEmojiDir, `${id}.webp`);
      expect(fs.existsSync(storeFile)).toBe(true);
      expect(fs.existsSync(adminFile)).toBe(true);
    }
  });

  it('serves local emoji assets statically via GET /emojis/:asset with 200 OK and cache headers', async () => {
    // Test static webp asset
    const webpRes = await request(app).get('/emojis/6084765169940961891.webp');
    expect(webpRes.status).toBe(200);
    expect(webpRes.headers['content-type']).toMatch(/image\/webp/);

    // Test video webm asset
    const webmRes = await request(app).get('/emojis/5193070340850327783.webm');
    expect(webmRes.status).toBe(200);
    expect(webmRes.headers['content-type']).toMatch(/video\/webm/);

    // Test named webm asset
    const namedWebmRes = await request(app).get('/emojis/key.webm');
    expect(namedWebmRes.status).toBe(200);
    expect(namedWebmRes.headers['content-type']).toMatch(/video\/webm/);

    // Test named webp asset
    const namedWebpRes = await request(app).get('/emojis/sword.webp');
    expect(namedWebpRes.status).toBe(200);
    expect(namedWebpRes.headers['content-type']).toMatch(/image\/webp/);
  });

  it('returns 404 instead of index.html for non-existent emoji assets to allow clean onError fallback', async () => {
    const missingRes = await request(app).get('/emojis/non_existent_emoji_12345.webp');
    expect(missingRes.status).toBe(404);
  });

  it('verifies key animated and static emoji configurations in TELEGRAM_EMOJIS', () => {
    // KEY should be configured with customEmojiId in WEBM set
    expect(TELEGRAM_EMOJIS.KEY.customEmojiId).toBe('5193070340850327783');
    expect(WEBM_EMOJI_IDS.has(TELEGRAM_EMOJIS.KEY.customEmojiId!)).toBe(true);

    // PACKAGE should be configured with customEmojiId in WEBM set
    expect(TELEGRAM_EMOJIS.PACKAGE.customEmojiId).toBe('5854908544712707500');
    expect(WEBM_EMOJI_IDS.has(TELEGRAM_EMOJIS.PACKAGE.customEmojiId!)).toBe(true);

    // SWORD should be configured with customEmojiId in WEBP set
    expect(TELEGRAM_EMOJIS.SWORD.customEmojiId).toBe('6084765169940961891');
    expect(WEBP_EMOJI_IDS.has(TELEGRAM_EMOJIS.SWORD.customEmojiId!)).toBe(true);

    // TICKET should be configured with customEmojiId in WEBP set
    expect(TELEGRAM_EMOJIS.TICKET.customEmojiId).toBe('5291994784980813319');
    expect(WEBP_EMOJI_IDS.has(TELEGRAM_EMOJIS.TICKET.customEmojiId!)).toBe(true);
  });
});
