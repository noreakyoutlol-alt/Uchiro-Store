import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { DataStore } from '../database/data-store';

describe('Daily Reward Claim & Bulletproof Points Flow', () => {
  it('claims daily points with Telegram ID in body and returns success response with newBalance and pointsAwarded', async () => {
    const testTgId = 888777666;
    const res = await request(app)
      .post('/api/daily-reward/claim')
      .send({ telegramId: testTgId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pointsAwarded).toBe(5);
    expect(typeof res.body.newBalance).toBe('number');
    expect(res.body.message).toBe('🎉 ទទួលបាន +5 ពិន្ទុជោគជ័យ!');
    expect(res.body.data.pointsAwarded).toBe(5);
  });

  it('claims daily points with Telegram ID in query parameter', async () => {
    const testTgId = 555444333;
    const res = await request(app)
      .post(`/api/daily-reward/claim?telegramId=${testTgId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pointsAwarded).toBe(5);
    expect(typeof res.body.newBalance).toBe('number');
    expect(res.body.message).toContain('ទទួលបាន +5 ពិន្ទុជោគជ័យ');
  });

  it('claims daily points with fallback Telegram ID when completely unauthenticated', async () => {
    const res = await request(app)
      .post('/api/daily-reward/claim')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.pointsAwarded).toBe(5);
    expect(typeof res.body.newBalance).toBe('number');
    expect(res.body.message).toContain('ទទួលបាន +5 ពិន្ទុជោគជ័យ');
  });

  it('guarantees user and profile exist after claim', async () => {
    const testTgId = 9988776655;
    await request(app)
      .post('/api/daily-reward/claim')
      .send({ telegram_id: testTgId });

    const user = DataStore.getTelegramUser(testTgId);
    const profile = DataStore.getProfile(testTgId);

    expect(user).toBeDefined();
    expect(user?.telegram_id).toBe(testTgId);
    expect(profile).toBeDefined();
    expect(profile!.points).toBeGreaterThanOrEqual(5);
    expect(user!.points).toBeGreaterThanOrEqual(5);
    expect(user!.last_daily_claim_at).toBeDefined();
    expect(profile!.last_daily_claim_at).toBeDefined();
  });

  it('guarantees existingUser.points is NEVER overwritten with 0 on app refresh or subsequent logins', () => {
    const testTgId = 1234567800;
    // Step 1: Create user with initial points
    const created = DataStore.findOrCreateTelegramUser({
      telegram_id: testTgId,
      first_name: 'LoyalCustomer',
    });
    expect(created.user.points).toBe(0);

    // Step 2: Award points
    const claimRes = DataStore.claimDailyReward(testTgId);
    expect(claimRes.success).toBe(true);
    expect(claimRes.newBalance).toBe(5);

    const userBefore = DataStore.getTelegramUser(testTgId);
    expect(userBefore?.points).toBe(5);

    // Step 3: Simulate app refresh / subsequent login
    const refreshed = DataStore.findOrCreateTelegramUser({
      telegram_id: testTgId,
      first_name: 'LoyalCustomer Updated Name',
    });

    expect(refreshed.user.points).toBe(5);
    expect(refreshed.profile.points).toBe(5);
    expect((refreshed as any).points).toBe(5);
    expect(refreshed.user.last_daily_claim_at).toBeDefined();

    // Verify in data store
    const userAfter = DataStore.getTelegramUser(testTgId);
    expect(userAfter?.points).toBe(5);
  });
});
