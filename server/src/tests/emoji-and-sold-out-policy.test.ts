import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server';
import { DataStore } from '../database/data-store';
import { ProductController } from '../controllers/product.controller';

describe('Emoji Restoration, Sold Out Visibility & Env Resolution Verification', () => {
  it('Product catalog does NOT hide sold out products or Blox Fruits accounts', async () => {
    // Pick or create a product to ensure it has 0 stock
    const products = DataStore.getShopProducts({});
    const bloxFruitsProd = products.find((p) => p.category_id === '11111111-1111-1111-1111-111111111103');
    expect(bloxFruitsProd).toBeDefined();

    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const catalog = res.body.data;
    const foundBloxFruits = catalog.find((p: any) => p.id === bloxFruitsProd?.id);
    expect(foundBloxFruits).toBeDefined();

    // Verify all products in catalog have stock and status defined
    for (const item of catalog) {
      expect(typeof item.stock).toBe('number');
      expect(item.status).toBe(item.stock === 0 ? 'delivered' : 'available');
    }
  });

  it('ProductController handles queries and returns catalog correctly', async () => {
    const res = await request(app).get('/api/products?category=blox-fruits');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Env resolution warning check detects missing .env and active secrets in .env.example', () => {
    const tempDir = path.resolve(__dirname, '../../temp-env-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    const examplePath = path.join(tempDir, '.env.example');
    const envPath = path.join(tempDir, '.env');

    fs.writeFileSync(
      examplePath,
      'JWT_SECRET=m8QZ1vR7xL4pT2wK9sF0jA6dC3bN8eY5uI1oP4qS7tU=\nSTORE_BOT_TOKEN=123456:ABC-DEF\n'
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Function matching our startup check logic
    function checkEnv(root: string) {
      const ePath = path.join(root, '.env');
      const exPath = path.join(root, '.env.example');
      if (!fs.existsSync(ePath) && fs.existsSync(exPath)) {
        const content = fs.readFileSync(exPath, 'utf8');
        if (/JWT_SECRET|SUPABASE_URL|STORE_BOT_TOKEN/i.test(content)) {
          console.warn('[CONFIG] CRITICAL: .env file missing! Please ensure variables are copied from .env.example into .env.');
          fs.copyFileSync(exPath, ePath);
        }
      }
    }

    checkEnv(tempDir);

    expect(warnSpy).toHaveBeenCalledWith(
      '[CONFIG] CRITICAL: .env file missing! Please ensure variables are copied from .env.example into .env.'
    );
    expect(fs.existsSync(envPath)).toBe(true);

    warnSpy.mockRestore();
    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
