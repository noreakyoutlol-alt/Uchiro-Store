import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { BatchAnnouncementService, formatQuantityLabel, escapeTelegramHtml } from '../services/batch-announcement.service';
import { handleAdminCallback } from '../bots/admin-bot/admin-actions';
import { Product } from '../types';

describe('PROMPT 5: Batch Stock Announcements Verification Suite', () => {
  let adminToken: string;
  let customerToken: string;
  const adminTgId = 99887766;
  const customerTgId = 11223344;

  const mockProduct1Id = 'prod-test-batch-001';
  const mockProduct2Id = 'prod-test-batch-002';
  const mockProduct3Id = 'prod-test-batch-003';
  const mockSoldOutProdId = 'prod-test-batch-soldout';
  const mockInactiveProdId = 'prod-test-batch-inactive';
  const mockDraftProdId = 'prod-test-batch-draft';

  beforeAll(() => {
    // Generate valid admin token
    adminToken = jwt.sign(
      {
        id: 'admin_test_p5',
        telegram_id: adminTgId,
        user_id: String(adminTgId),
        role: 'admin',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate customer token (for non-admin authorization testing)
    customerToken = jwt.sign(
      {
        id: 'customer_test_p5',
        telegram_id: customerTgId,
        user_id: String(customerTgId),
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    process.env.ADMIN_TELEGRAM_IDS = String(adminTgId);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    BatchAnnouncementService.setMockDispatcher(null);

    // Reset DataStore groups and events for deterministic test state
    const groups = DataStore.getRegisteredGroups();
    for (const g of groups) {
      DataStore.deleteRegisteredGroup(g.id);
    }

    // Register 2 test groups
    DataStore.registerGroup({
      chat_id: '-100111222333',
      title: 'Uchiro Announcements Channel 1',
      chat_type: 'supergroup',
    });
    DataStore.registerGroup({
      chat_id: '-100444555666',
      title: 'Uchiro VIP Group 2',
      chat_type: 'supergroup',
    });

    // Seed mock products in DataStore
    const cat = DataStore.getCategories()[0] || { id: 'cat-test-01', name: 'Blox Fruits', slug: 'blox-fruits' };

    const prod1: Product = {
      id: mockProduct1Id,
      category_id: cat.id,
      title: 'Blox Fruits Kitsune Max Level',
      slug: 'blox-fruits-kitsune-max-level',
      description: 'Awakened Kitsune account with Godhuman',
      short_description: 'Kitsune account',
      price: 25.00,
      compare_at_price: 35.00,
      stock: 3,
      delivery_mode: 'auto_account',
      product_type: 'account',
      warranty_days: 14,
      authenticator_enabled: true,
      requires_roblox_username: false,
      requires_roblox_verification: false,
      is_active: true,
      is_featured: true,
      is_draft: false,
      badge: 'HOT',
      views_count: 50,
      sales_count: 5,
      specifications: { Fruit: 'Kitsune', Level: '2550' },
      media: [{ id: 'm1', product_id: mockProduct1Id, url: 'https://img.uchiro.store/1.png', alt_text: null, is_primary: true, sort_order: 0, created_at: new Date().toISOString() }],
      video_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const prod2: Product = {
      id: mockProduct2Id,
      category_id: cat.id,
      title: 'Dark Blade V3 Gamepass Code',
      slug: 'dark-blade-v3-gamepass-code',
      description: 'Digital gift code for Dark Blade',
      short_description: 'Dark Blade code',
      price: 15.00,
      compare_at_price: null,
      stock: 5,
      delivery_mode: 'digital_code',
      product_type: 'digital_code',
      warranty_days: 7,
      authenticator_enabled: false,
      requires_roblox_username: false,
      requires_roblox_verification: false,
      is_active: true,
      is_featured: false,
      is_draft: false,
      badge: null,
      views_count: 20,
      sales_count: 2,
      specifications: {},
      media: [],
      video_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const prod3: Product = {
      id: mockProduct3Id,
      category_id: cat.id,
      title: 'Dragon Fruit Physical In-Game Trade',
      slug: 'dragon-fruit-physical-trade',
      description: 'Physical mythical dragon fruit transferred via in-game trade server',
      short_description: 'Dragon fruit trade',
      price: 12.50,
      compare_at_price: null,
      stock: 2,
      delivery_mode: 'trade_item',
      product_type: 'trade',
      warranty_days: 0,
      authenticator_enabled: false,
      requires_roblox_username: true,
      requires_roblox_verification: false,
      is_active: true,
      is_featured: false,
      is_draft: false,
      badge: null,
      views_count: 10,
      sales_count: 1,
      specifications: {},
      media: [],
      video_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const soldOutProd: Product = {
      ...prod1,
      id: mockSoldOutProdId,
      title: 'Sold Out Fruit Account',
      slug: 'sold-out-fruit-account',
      stock: 0,
    };

    const inactiveProd: Product = {
      ...prod1,
      id: mockInactiveProdId,
      title: 'Inactive Product',
      slug: 'inactive-product',
      is_active: false,
      stock: 10,
    };

    const draftProd: Product = {
      ...prod1,
      id: mockDraftProdId,
      title: 'Draft Product',
      slug: 'draft-product',
      is_draft: true,
      stock: 10,
    };

    // Save into DataStore
    DataStore.saveProduct(prod1);
    DataStore.saveProduct(prod2);
    DataStore.saveProduct(prod3);
    DataStore.saveProduct(soldOutProd);
    DataStore.saveProduct(inactiveProd);
    DataStore.saveProduct(draftProd);

    // Clear mock inventory items
    const inv = DataStore.getInventoryList();
    for (let i = inv.length - 1; i >= 0; i--) {
      if (inv[i].product_id.startsWith('prod-test-batch-')) {
        inv.splice(i, 1);
      }
    }

    // Add inventory items for auto_account and digital_code products
    DataStore.bulkAddInventoryItems(mockProduct1Id, [
      { account_username: 'u1', raw_password: 'p1' },
      { account_username: 'u2', raw_password: 'p2' },
      { account_username: 'u3', raw_password: 'p3' },
    ]);
    DataStore.bulkAddInventoryItems(mockProduct2Id, [
      { digital_code: 'CODE-1' },
      { digital_code: 'CODE-2' },
      { digital_code: 'CODE-3' },
      { digital_code: 'CODE-4' },
      { digital_code: 'CODE-5' },
    ]);

    // Clear existing pending stock events first
    const pendingEvents = DataStore.getPendingStockEvents();
    for (const pe of pendingEvents) {
      DataStore.removePendingStockEvent(pe.product_id);
    }

    // Record pending stock announcement events
    DataStore.recordPendingStockEvent(mockProduct1Id, 'new_product', 3);
    DataStore.recordPendingStockEvent(mockProduct2Id, 'restock', 5);
    DataStore.recordPendingStockEvent(mockProduct3Id, 'manual', 2);
    DataStore.recordPendingStockEvent(mockSoldOutProdId, 'restock', 0);
    DataStore.recordPendingStockEvent(mockInactiveProdId, 'new_product', 10);
    DataStore.recordPendingStockEvent(mockDraftProdId, 'new_product', 10);
  });

  afterEach(() => {
    BatchAnnouncementService.setMockDispatcher(null);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. HELPERS & FORMATTING
  // ============================================================================
  describe('1. Formatting and Helper Functions', () => {
    it('escapes special HTML characters for safe Telegram parsing', () => {
      expect(escapeTelegramHtml('Uchiro & Co. <Store> "VIP"')).toBe('Uchiro &amp; Co. &lt;Store&gt; &quot;VIP&quot;');
      expect(escapeTelegramHtml('')).toBe('');
      expect(escapeTelegramHtml(null as any)).toBe('');
    });

    it('formats quantity labels dynamically based on product_type and count', () => {
      expect(formatQuantityLabel(1, 'account')).toBe('1 account available');
      expect(formatQuantityLabel(5, 'account')).toBe('5 accounts available');
      expect(formatQuantityLabel(1, 'digital_code')).toBe('1 code available');
      expect(formatQuantityLabel(4, 'digital_code')).toBe('4 codes available');
      expect(formatQuantityLabel(1, 'trade')).toBe('1 item available');
      expect(formatQuantityLabel(10, 'trade')).toBe('10 items available');
      expect(formatQuantityLabel(0, 'account')).toBe('0 accounts available');
    });
  });

  // ============================================================================
  // 2. PREVIEW (SIDE-EFFECT FREE) & ELIGIBILITY FILTERS
  // ============================================================================
  describe('2. Preview Engine (Side-Effect Free & Eligibility)', () => {
    it('generates preview and excludes sold-out, inactive, and draft products', async () => {
      const mockDispatcherSpy = vi.fn();
      BatchAnnouncementService.setMockDispatcher(mockDispatcherSpy);

      const preview = await BatchAnnouncementService.previewBatch();

      // Zero outbound message dispatch calls must happen during preview
      expect(mockDispatcherSpy).not.toHaveBeenCalled();

      // Exactly 3 products are eligible (prod1, prod2, prod3)
      expect(preview.eligible_count).toBe(3);
      expect(preview.excluded_count).toBe(3);

      const eligibleIds = preview.grouped_preview.flatMap((g) => g.products.map((p) => p.id));
      expect(eligibleIds).toContain(mockProduct1Id);
      expect(eligibleIds).toContain(mockProduct2Id);
      expect(eligibleIds).toContain(mockProduct3Id);
      expect(eligibleIds).not.toContain(mockSoldOutProdId);
      expect(eligibleIds).not.toContain(mockInactiveProdId);
      expect(eligibleIds).not.toContain(mockDraftProdId);

      // Verify exclusion reasons
      const soldOutExclusion = preview.excluded_products.find((e) => e.id === mockSoldOutProdId);
      expect(soldOutExclusion?.reason).toBe('OUT_OF_STOCK');

      const inactiveExclusion = preview.excluded_products.find((e) => e.id === mockInactiveProdId);
      expect(inactiveExclusion?.reason).toBe('INACTIVE_PRODUCT');

      const draftExclusion = preview.excluded_products.find((e) => e.id === mockDraftProdId);
      expect(draftExclusion?.reason).toBe('DRAFT_PRODUCT');

      // Verify that pending events remain 'pending' after preview
      const pendingEvents = DataStore.getPendingStockEvents();
      expect(pendingEvents.length).toBeGreaterThanOrEqual(3);

      // Verify preview text contains headers and buy URLs
      expect(preview.preview_text).toContain('NEW STOCK ARRIVAL — UCHIRO STORE');
      expect(preview.preview_text).toContain('Blox Fruits Kitsune Max Level');
      expect(preview.preview_text).toContain('Buy Here / ទិញទីនេះ');
      expect(preview.preview_text).toContain('/product/' + mockProduct1Id);
    });
  });

  // ============================================================================
  // 3. CONSOLIDATED MESSAGE CHUNKING & TELEGRAM LIMITS
  // ============================================================================
  describe('3. Message Chunking and Part Indexing', () => {
    it('creates a single message chunk when total length is well within limits', async () => {
      const preview = await BatchAnnouncementService.previewBatch();
      const chunks = BatchAnnouncementService.formatConsolidatedMessageChunks(preview.grouped_preview);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toContain('NEW STOCK ARRIVAL — UCHIRO STORE');
      expect(chunks[0]).not.toContain('(Part 1/');
      expect(chunks[0].length).toBeLessThan(3800);
    });

    it('gracefully splits oversized batches into multiple parts with Part X/Y headers', () => {
      const largeProducts = Array.from({ length: 30 }, (_, i) => ({
        id: `large-prod-${i}`,
        title: `Blox Fruits Legendary Mythical Account Variant Special Edition #${i + 1} with Full Awakening and Godhuman V2`,
        product_type: 'account' as const,
        category_id: 'cat-test-01',
        category_name: 'Blox Fruits',
        price: 49.99,
        stock: 5,
        quantity_label: '5 accounts available',
        buy_url: `https://t.me/uchiro_store_bot/app?startapp=prod_large_${i}`,
      }));

      const largeGroup = [
        {
          category_id: 'cat-test-01',
          category_name: 'Blox Fruits',
          product_type: 'account' as const,
          group_label: 'Blox Fruits — Accounts',
          products: largeProducts,
        },
      ];

      const chunks = BatchAnnouncementService.formatConsolidatedMessageChunks(largeGroup);

      // Must be split into at least 2 parts
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]).toContain('(Part 1/');
      expect(chunks[1]).toContain('(Part 2/');

      // Every chunk must be strictly under 3800 characters (Telegram hard limit is 4096)
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].length).toBeLessThan(3800);
        expect(chunks[i]).toContain('Open Uchiro Store');
      }
    });
  });

  // ============================================================================
  // 4. PUBLISHING WORKFLOW, IDEMPOTENCY & CONCURRENCY
  // ============================================================================
  describe('4. Publishing Workflow, Idempotency & Duplicate Protection', () => {
    it('publishes consolidated message to all registered groups and marks events as published', async () => {
      let callCount = 0;
      BatchAnnouncementService.setMockDispatcher(async (_chatId, _text) => {
        callCount++;
        return {
          success: true,
          message_id: 1000 + callCount,
        };
      });

      const idempotencyKey = `idemp_test_${Date.now()}`;
      const result = await BatchAnnouncementService.publishBatch(adminTgId, idempotencyKey);

      expect(result.success).toBe(true);
      expect(result.status).toBe('succeeded');
      expect(result.total_groups).toBe(2);
      expect(result.succeeded_groups).toBe(2);
      expect(result.failed_groups).toBe(0);
      expect(result.published_products_count).toBe(3);

      // Exactly 2 telegram messages dispatched (1 chunk * 2 groups)
      expect(callCount).toBe(2);

      // Batch record exists in DataStore
      const batchRecord = DataStore.getStockBatch(result.batch_id!);
      expect(batchRecord).not.toBeNull();
      expect(batchRecord?.status).toBe('succeeded');
      expect(batchRecord?.snapshot.length).toBe(3);

      // Deliveries exist in DataStore with message IDs
      const deliveries = DataStore.getStockBatchDeliveries(result.batch_id!);
      expect(deliveries.length).toBe(2);
      expect(deliveries.every((d) => d.status === 'succeeded')).toBe(true);
      expect(deliveries[0].telegram_message_id).toBeGreaterThan(0);

      // Pending events for announced products must now be marked as published
      const pendingEvents = DataStore.getPendingStockEvents();
      const pendingProductIds = pendingEvents.map((e) => e.product_id);
      expect(pendingProductIds).not.toContain(mockProduct1Id);
      expect(pendingProductIds).not.toContain(mockProduct2Id);
      expect(pendingProductIds).not.toContain(mockProduct3Id);
    });

    it('enforces idempotency: re-publishing with same key does not duplicate deliveries', async () => {
      let dispatchCount = 0;
      BatchAnnouncementService.setMockDispatcher(async () => {
        dispatchCount++;
        return { success: true, message_id: 7777 };
      });

      // Fresh pending event for idempotency test
      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);

      const idempotencyKey = `fixed_idemp_key_12345`;
      const firstResult = await BatchAnnouncementService.publishBatch(adminTgId, idempotencyKey);
      expect(firstResult.success).toBe(true);
      const initialCallCount = dispatchCount;

      // Second publish with the exact same idempotency key
      const secondResult = await BatchAnnouncementService.publishBatch(adminTgId, idempotencyKey);

      // Must return identical existing batch record
      expect(secondResult.batch_id).toBe(firstResult.batch_id);
      expect(secondResult.status).toBe(firstResult.status);

      // ZERO additional dispatch calls must be made!
      expect(dispatchCount).toBe(initialCallCount);
    });

    it('re-checks stock at publish time and aborts if all products sold out', async () => {
      // Clear all pending events and add only mockSoldOutProdId
      const pending = DataStore.getPendingStockEvents();
      for (const p of pending) {
        DataStore.removePendingStockEvent(p.product_id);
      }
      DataStore.recordPendingStockEvent(mockSoldOutProdId, 'manual', 0);

      const result = await BatchAnnouncementService.publishBatch(adminTgId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('NO_ELIGIBLE_PRODUCTS');
    });
  });

  // ============================================================================
  // 5. DELIVERY ERRORS, RATE LIMITS, BOT KICK & PARTIAL FAILURES
  // ============================================================================
  describe('5. Error Handling, Bot Kicked & Partial Group Failures', () => {
    it('handles partial group failure: 1 group succeeds, 1 group fails with 500 error', async () => {
      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);

      BatchAnnouncementService.setMockDispatcher(async (chatId, _text) => {
        if (chatId === '-100444555666') {
          return {
            success: false,
            error: 'Internal Telegram Gateway Error',
            error_code: 'DISPATCH_ERROR',
          };
        }
        return { success: true, message_id: 8888 };
      });

      const result = await BatchAnnouncementService.publishBatch(adminTgId);

      expect(result.status).toBe('partial');
      expect(result.succeeded_groups).toBe(1);
      expect(result.failed_groups).toBe(1);

      const deliveries = result.deliveries || [];
      const failedDel = deliveries.find((d) => d.status === 'failed');
      const succDel = deliveries.find((d) => d.status === 'succeeded');

      expect(failedDel).toBeDefined();
      expect(succDel).toBeDefined();
      expect(failedDel?.error_code).toBe('DISPATCH_ERROR');
    });

    it('detects 403 / bot kicked: flags BOT_KICKED error and disables bot_can_post for group', async () => {
      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);

      BatchAnnouncementService.setMockDispatcher(async (chatId, _text) => {
        if (chatId === '-100111222333') {
          return {
            success: false,
            error: 'Forbidden: bot was kicked from the supergroup chat',
            error_code: 'BOT_KICKED',
            permanent: true,
          };
        }
        return { success: true, message_id: 9999 };
      });

      const result = await BatchAnnouncementService.publishBatch(adminTgId);

      const kickedDel = result.deliveries?.find((d) => d.error_code === 'BOT_KICKED');
      expect(kickedDel).toBeDefined();

      // Group in DataStore must have bot_can_post set to false
      const group = DataStore.getRegisteredGroupByChatId('-100111222333');
      expect(group?.bot_can_post).toBe(false);
    });
  });

  // ============================================================================
  // 6. RETRY WORKFLOW (TARGETS ONLY FAILED GROUPS)
  // ============================================================================
  describe('6. Retry Failed Groups Workflow', () => {
    it('retries ONLY failed deliveries, reconstructs from snapshot, and does not re-dispatch to succeeded groups', async () => {
      // Step A: Initial publish where group 1 succeeds and group 2 fails
      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);

      const dispatchCalls: string[] = [];
      BatchAnnouncementService.setMockDispatcher(async (chatId, _text) => {
        dispatchCalls.push(chatId);
        if (chatId === '-100444555666') {
          return {
            success: false,
            error: 'Temporary gateway timeout',
            error_code: 'AMBIGUOUS_TIMEOUT',
          };
        }
        return { success: true, message_id: 5555 };
      });

      const initialPublish = await BatchAnnouncementService.publishBatch(adminTgId);
      expect(initialPublish.status).toBe('partial');
      expect(initialPublish.failed_groups).toBe(1);
      const batchId = initialPublish.batch_id!;

      // Step B: Now retry the failed batch (group 2 now succeeds)
      dispatchCalls.length = 0; // reset call log
      BatchAnnouncementService.setMockDispatcher(async (chatId, _text) => {
        dispatchCalls.push(chatId);
        return { success: true, message_id: 6666 };
      });

      const retryResult = await BatchAnnouncementService.retryFailedGroups(adminTgId, batchId);

      expect(retryResult.success).toBe(true);
      expect(retryResult.status).toBe('succeeded');
      expect(retryResult.succeeded_groups).toBe(2);
      expect(retryResult.failed_groups).toBe(0);

      // Verify ONLY the failed group was called on retry!
      expect(dispatchCalls).toEqual(['-100444555666']);
      expect(dispatchCalls).not.toContain('-100111222333');

      // Verify batch in DataStore is now fully succeeded
      const updatedBatch = DataStore.getStockBatch(batchId);
      expect(updatedBatch?.status).toBe('succeeded');
      expect(updatedBatch?.failed_groups).toBe(0);
      expect(updatedBatch?.succeeded_groups).toBe(2);
    });

    it('returns early when there are no failed deliveries to retry', async () => {
      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);
      BatchAnnouncementService.setMockDispatcher(async () => ({
        success: true,
        message_id: 1111,
      }));

      const initialPublish = await BatchAnnouncementService.publishBatch(adminTgId);
      const batchId = initialPublish.batch_id!;

      const retryResult = await BatchAnnouncementService.retryFailedGroups(adminTgId, batchId);
      expect(retryResult.success).toBe(true);
      expect(retryResult.message).toContain('No failed deliveries found');
    });
  });

  // ============================================================================
  // 7. ADMIN REST API: AUTHORIZATION & VALIDATION
  // ============================================================================
  describe('7. Admin REST API Endpoints & Protection', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/stock-batch/preview');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin role tokens with 401', async () => {
      const res = await request(app)
        .get('/api/admin/stock-batch/preview')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(401);
    });

    it('allows authorized admin to GET /api/admin/stock-batch/preview', async () => {
      const res = await request(app)
        .get('/api/admin/stock-batch/preview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grouped_preview).toBeDefined();
    });

    it('allows authorized admin to manage registered groups CRUD via REST API', async () => {
      // POST: Register new group
      const postRes = await request(app)
        .post('/api/admin/stock-batch/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          chat_id: '-100999888777',
          title: 'New REST Registered Group',
          chat_type: 'supergroup',
        });

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      const createdGroupId = postRes.body.data.id;
      expect(createdGroupId).toBeDefined();

      // GET: List groups
      const getRes = await request(app)
        .get('/api/admin/stock-batch/groups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.some((g: any) => g.id === createdGroupId)).toBe(true);

      // PATCH: Update group
      const patchRes = await request(app)
        .patch(`/api/admin/stock-batch/groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated Group Title', is_active: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.title).toBe('Updated Group Title');
      expect(patchRes.body.data.is_active).toBe(false);

      // DELETE: Delete group
      const delRes = await request(app)
        .delete(`/api/admin/stock-batch/groups/${createdGroupId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it('validates required fields when registering a group', async () => {
      const res = await request(app)
        .post('/api/admin/stock-batch/groups')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Missing Chat ID' });

      expect(res.status).toBe(400);
    });

    it('rejects adding out of stock or draft product to announcement batch', async () => {
      // Out of stock product
      const outOfStockRes = await request(app)
        .post(`/api/admin/stock-batch/pending/${mockSoldOutProdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(outOfStockRes.status).toBe(400);

      // Draft product
      const draftRes = await request(app)
        .post(`/api/admin/stock-batch/pending/${mockDraftProdId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(draftRes.status).toBe(400);
    });
  });

  // ============================================================================
  // 8. TELEGRAM ADMIN BOT INTEGRATION
  // ============================================================================
  describe('8. Telegram Admin Bot /stockbatch & Actions', () => {
    it('handles admin:stock_batch callback showing pending count and action buttons', async () => {
      const view = await handleAdminCallback(
        'admin:stock_batch',
        { id: adminTgId },
        'https://uchiro.store',
        'https://admin.uchiro.store'
      );

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Stock Announcement Batch');
      expect(view?.text).toContain('Eligible Products:');
      expect(view?.replyMarkup.inline_keyboard.length).toBeGreaterThan(0);
    });

    it('handles admin:stock_batch:preview callback returning formatted preview text', async () => {
      const view = await handleAdminCallback(
        'admin:stock_batch:preview',
        { id: adminTgId },
        'https://uchiro.store',
        'https://admin.uchiro.store'
      );

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Consolidated Announcement Preview');
      expect(view?.replyMarkup.inline_keyboard.some((r: any) =>
        r.some((b: any) => b.callback_data === 'admin:stock_batch:publish')
      )).toBe(true);
    });

    it('handles admin:stock_batch:publish callback triggering dispatch', async () => {
      BatchAnnouncementService.setMockDispatcher(async () => ({
        success: true,
        message_id: 3333,
      }));

      DataStore.recordPendingStockEvent(mockProduct1Id, 'manual', 3);

      const view = await handleAdminCallback(
        'admin:stock_batch:publish',
        { id: adminTgId },
        'https://uchiro.store',
        'https://admin.uchiro.store'
      );

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Stock Announcement Result');
      expect(view?.text).toContain('SUCCEEDED');
    });
  });
});
