import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';

describe('Items Verification Test Suite (Items 15, 25, 27, 29, 30)', () => {
  const testTelegramId = 88880001;
  const user = DataStore.findOrCreateTelegramUser({
    telegram_id: testTelegramId,
    username: 'test_user_wallet',
    first_name: 'Test',
  });

  const testToken = `Bearer ${jwt.sign(
    {
      user_id: user.user.id,
      telegram_id: testTelegramId,
      username: 'test_user_wallet',
      role: 'customer',
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  )}`;

  it('Item 15 & 59: GET /api/products/in-stock returns active products for Home Page catalog', async () => {
    const res = await request(app).get('/api/products/in-stock');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((p: any) => {
      expect(p.is_active).toBe(true);
      expect(p.stock).toBeGreaterThan(0);
    });
  });

  it('Item 25: All 3 coupon redemption tiers (50, 100, 200 PTS) work with correct minimum order rules', async () => {
    // 1. Set exact points to 350 (50 + 100 + 200)
    const prof = DataStore.getProfile(testTelegramId);
    if (prof) {
      prof.points = 350;
    }

    // 2. Redeem Tier 1: 50 PTS -> $0.50 coupon, min order $1.50
    const res50 = await request(app)
      .post('/api/store/points/redeem-coupon')
      .set('Authorization', testToken)
      .send({ tierPoints: 50 });
    expect(res50.status).toBe(200);
    expect(res50.body.success).toBe(true);
    expect(res50.body.data.discount_value).toBe(0.5);
    expect(res50.body.data.min_order_amount).toBe(1.5);
    expect(res50.body.data.status).toBe('AVAILABLE');

    // 3. Redeem Tier 2: 100 PTS -> $1.00 coupon, min order $3.00
    const res100 = await request(app)
      .post('/api/store/points/redeem-coupon')
      .set('Authorization', testToken)
      .send({ tierPoints: 100 });
    expect(res100.status).toBe(200);
    expect(res100.body.success).toBe(true);
    expect(res100.body.data.discount_value).toBe(1.0);
    expect(res100.body.data.min_order_amount).toBe(3.0);
    expect(res100.body.data.status).toBe('AVAILABLE');

    // 4. Redeem Tier 3: 200 PTS -> $2.00 coupon, min order $5.00
    const res200 = await request(app)
      .post('/api/store/points/redeem-coupon')
      .set('Authorization', testToken)
      .send({ tierPoints: 200 });
    expect(res200.status).toBe(200);
    expect(res200.body.success).toBe(true);
    expect(res200.body.data.discount_value).toBe(2.0);
    expect(res200.body.data.min_order_amount).toBe(5.0);
    expect(res200.body.data.status).toBe('AVAILABLE');

    // 5. Customer Coupon Wallet GET /api/store/coupons/my-coupons contains all 3 redeemed coupons
    const walletRes = await request(app)
      .get('/api/store/coupons/my-coupons')
      .set('Authorization', testToken);
    expect(walletRes.status).toBe(200);
    expect(walletRes.body.success).toBe(true);
    expect(Array.isArray(walletRes.body.data)).toBe(true);
    const codes = walletRes.body.data.map((c: any) => c.code);
    expect(codes).toContain(res50.body.data.code);
    expect(codes).toContain(res100.body.data.code);
    expect(codes).toContain(res200.body.data.code);

    // 6. Insufficient points check: user now has 0 points left, cannot redeem any coupon
    const failRes = await request(app)
      .post('/api/store/points/redeem-coupon')
      .set('Authorization', testToken)
      .send({ tierPoints: 50 });
    expect(failRes.status).toBe(400);
    expect(failRes.body.success).toBe(false);
  });

  it('Item 27: Gacha prizes have real reward image URLs, not emojis', async () => {
    const res = await request(app).get('/api/gacha/pools');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const pool = res.body.data[0];
    expect(pool.prizes.length).toBeGreaterThan(0);

    pool.prizes.forEach((prize: any) => {
      expect(prize.icon_url).toBeDefined();
      expect(
        prize.icon_url.startsWith('http://') ||
          prize.icon_url.startsWith('https://') ||
          prize.icon_url.startsWith('/')
      ).toBe(true);
      expect(prize.title).toBeDefined();
      expect(prize.rarity).toBeDefined();
      expect(prize.probability_percent).toBeGreaterThan(0);
    });
  });
});
