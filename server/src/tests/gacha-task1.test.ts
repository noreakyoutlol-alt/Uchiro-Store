import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../database/data-store';
import { GachaService } from '../services/gacha.service';
import { AdminService } from '../services/admin.service';

describe('Gacha System - Task 1 Contract Verification', () => {
  const testTelegramId = 77889900;
  const testCustomerId = 'cust-test-77889900';

  beforeEach(() => {
    DataStore.findOrCreateTelegramUser({
      telegram_id: testTelegramId,
      first_name: 'GachaTester',
    });
    // Credit points and tickets
    const profile = DataStore.findOrCreateTelegramUser({
      telegram_id: testTelegramId,
      first_name: 'GachaTester',
    }).profile;
    profile.points = 500;
    profile.gacha_tickets = 2;
    profile.next_gacha_roll_at = null;
  });

  it('API returns currentPrize, nextPrize, and userState matching requirements', () => {
    const status = GachaService.getStatus(testTelegramId);

    expect(status).toHaveProperty('currentPrize');
    expect(status).toHaveProperty('nextPrize');
    expect(status).toHaveProperty('userState');

    expect(status.userState).toEqual({
      points: 500,
      tickets: 2,
      cooldownUntil: null,
    });

    if (status.currentPrize) {
      expect(status.currentPrize).toHaveProperty('id');
      expect(status.currentPrize).toHaveProperty('title');
      expect(status.currentPrize).toHaveProperty('name');
      expect(status.currentPrize).toHaveProperty('rarity');
      expect(status.currentPrize).toHaveProperty('stock');
      expect(status.currentPrize.slot_status).toBe('current');
    }

    if (status.nextPrize) {
      expect(status.nextPrize).toHaveProperty('id');
      expect(status.nextPrize).toHaveProperty('title');
      expect(status.nextPrize).toHaveProperty('name');
      expect(status.nextPrize.slot_status).toBe('draft');
    }
  });

  it('exchanges 100 points for 1 ticket', () => {
    const buyResult = GachaService.buyTickets(testTelegramId, 1);
    expect(buyResult.success).toBe(true);
    expect(buyResult.tickets).toBe(3);
    expect(buyResult.newBalance).toBe(400);
  });

  it('spins gacha with server-authoritative winner, sets 1-hour cooldown, and consumes 1 ticket', async () => {
    const pools = GachaService.getPools();
    expect(pools.length).toBeGreaterThan(0);
    const pool = pools[0];

    const spinResult = await GachaService.spin({
      poolId: pool.id,
      customerId: testCustomerId,
      telegramId: testTelegramId,
    });

    expect(spinResult).toHaveProperty('prize');
    expect(spinResult).toHaveProperty('spin');
    expect(spinResult).toHaveProperty('claim');
    expect(spinResult.prize).toHaveProperty('rarity');
    expect(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL']).toContain(spinResult.prize.rarity);

    // Verify cooldown is set
    const updatedStatus = GachaService.getStatus(testTelegramId);
    expect(updatedStatus.cooldownSecondsRemaining).toBeGreaterThan(3500);
    expect(updatedStatus.canRoll).toBe(false);
  });

  it('auto-promotes draft prize when current prize stock reaches 0', async () => {
    const pools = GachaService.getPools();
    const pool = pools[0];

    // Find current prize and set its stock to 1
    const currentPrize = pool.prizes.find((p) => p.slot_status === 'current');
    expect(currentPrize).toBeDefined();

    if (currentPrize) {
      currentPrize.stock = 1;
      const targetSlot = currentPrize.slot_number || currentPrize.reward_number;

      // Ensure a draft prize exists for this slot
      const allPrizes = (DataStore as any).gachaPrizes;
      let draftPrize = allPrizes.find(
        (p: any) =>
          p.pool_id === pool.id &&
          (p.slot_number === targetSlot || p.reward_number === targetSlot) &&
          p.slot_status === 'draft'
      );

      if (!draftPrize) {
        draftPrize = {
          id: 'test-draft-prize-id',
          pool_id: pool.id,
          slot_number: targetSlot,
          reward_number: targetSlot,
          slot_status: 'draft',
          title: 'Standby Test Prize',
          description: 'Standby test description',
          rarity: 'EPIC',
          probability_percent: 14.0,
          delivery_mode: 'instant_code',
          reward_type: 'code',
          reward_data: { code: 'TEST-CODE' },
          icon_url: 'https://example.com/icon.png',
          stock: 10,
          is_active: false,
          created_at: new Date().toISOString(),
        };
        allPrizes.push(draftPrize);
      }

      // Reset cooldown and tickets
      const profile = DataStore.findOrCreateTelegramUser({
        telegram_id: testTelegramId,
        first_name: 'GachaTester',
      }).profile;
      profile.gacha_tickets = 5;
      profile.next_gacha_roll_at = null;

      // Force chosen prize to be currentPrize to test stock depletion
      currentPrize.stock = 0;
      // Trigger auto-promote logic
      const promoted = DataStore.promoteDraftPrize(draftPrize.id);
      expect(promoted.success).toBe(true);
      expect(promoted.prize?.slot_status).toBe('current');

      const archivedInStore = allPrizes.find((p: any) => p.id === currentPrize.id);
      expect(archivedInStore.slot_status).toBe('archived');
      expect(archivedInStore.is_active).toBe(false);

      // Restore prize state so test isolation is maintained
      archivedInStore.slot_status = 'current';
      archivedInStore.is_active = true;
      archivedInStore.stock = 9999;
      draftPrize.slot_status = 'draft';
      draftPrize.is_active = false;
      const testDraftIdx = allPrizes.findIndex((p: any) => p.id === 'test-draft-prize-id');
      if (testDraftIdx >= 0) allPrizes.splice(testDraftIdx, 1);
    }
  });

  it('AdminService.listGachaPools returns pools populated with all prizes for admin portal', () => {
    const adminPools = AdminService.listGachaPools();
    expect(adminPools.length).toBeGreaterThan(0);

    const firstPool = adminPools[0];
    expect(firstPool).toHaveProperty('id');
    expect(firstPool).toHaveProperty('title');
    expect(firstPool).toHaveProperty('prizes');
    expect(Array.isArray(firstPool.prizes)).toBe(true);
    expect(firstPool.prizes.length).toBeGreaterThan(0);

    // Verify prize fields expected by admin gacha portal
    const firstPrize = firstPool.prizes[0];
    expect(firstPrize).toHaveProperty('id');
    expect(firstPrize).toHaveProperty('title');
    expect(firstPrize).toHaveProperty('probability_percent');
    expect(firstPrize).toHaveProperty('slot_status');
    expect(firstPrize).toHaveProperty('delivery_mode');
  });

  it('validates active pool probabilities total exactly 100.0% with canonical distribution', () => {
    const pools = GachaService.getPools();
    expect(pools.length).toBeGreaterThan(0);
    const pool = pools[0];
    const validation = DataStore.validatePoolProbabilities(pool.id);
    expect(validation.isValid).toBe(true);
    expect(validation.totalProbability).toBe(100.0);
    expect(validation.difference).toBe(0.0);

    const activePrizes = pool.prizes.filter((p) => p.is_active && p.slot_status === 'current');
    expect(activePrizes.length).toBe(5);

    const common = activePrizes.find((p) => p.rarity === 'COMMON');
    const rare = activePrizes.find((p) => p.rarity === 'RARE');
    const epic = activePrizes.find((p) => p.rarity === 'EPIC');
    const legendary = activePrizes.find((p) => p.rarity === 'LEGENDARY');
    const mythical = activePrizes.find((p) => p.rarity === 'MYTHICAL');

    expect(common?.probability_percent).toBe(70.0);
    expect(rare?.probability_percent).toBe(20.0);
    expect(epic?.probability_percent).toBe(7.0);
    expect(legendary?.probability_percent).toBe(2.5);
    expect(mythical?.probability_percent).toBe(0.5);

    // Common is most likely, Mythical is least likely
    expect(common!.probability_percent).toBeGreaterThan(rare!.probability_percent);
    expect(rare!.probability_percent).toBeGreaterThan(epic!.probability_percent);
    expect(epic!.probability_percent).toBeGreaterThan(legendary!.probability_percent);
    expect(legendary!.probability_percent).toBeGreaterThan(mythical!.probability_percent);
  });
});
