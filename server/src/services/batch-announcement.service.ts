import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { resolveStoreUrl } from '../config/app-url';
import { getStoreBotMiniAppLink } from '../bots/store-bot';
import { formatTelegramHtml } from '../bots/store-bot';
import { enrichWithTgEmojis } from '../config/telegram-emojis';
import { isPostgresConfigured, pgPool } from '../database/postgres';
import { AppError } from '../middleware/error-handler';
import {
  RegisteredGroup,
  StockAnnouncementEvent,
  StockAnnouncementBatch,
  StockBatchDelivery,
  BatchStatus,
  GroupDeliveryStatus,
  BatchPreviewResponse,
  BatchPreviewCategoryGroup,
  BatchPreviewProductItem,
  BatchPreviewExcludedItem,
  BatchPublishResult,
  ProductType,
  Product,
} from '../types';

// ── Telegram message size limit threshold ──────────────────────────────────────
const MAX_TELEGRAM_CHUNK_CHARS = 3800;

// ── Text & HTML escaping helper ────────────────────────────────────────────────
export function escapeTelegramHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Dynamic quantity label formatter ───────────────────────────────────────────
export function formatQuantityLabel(qty: number, productType?: ProductType | string): string {
  const count = Math.max(0, Number(qty) || 0);
  const isSingular = count === 1;
  const normalized = String(productType || '').toLowerCase().trim();

  if (normalized === 'account') {
    return `${count} ${isSingular ? 'account' : 'accounts'} available`;
  }
  if (normalized === 'digital_code' || normalized === 'code') {
    return `${count} ${isSingular ? 'code' : 'codes'} available`;
  }
  // gift, trade, or default item
  return `${count} ${isSingular ? 'item' : 'items'} available`;
}

// ── Dynamic category & product-type group label ────────────────────────────────
export function formatGroupHeader(categoryName: string, productType?: ProductType | string): string {
  const cleanCategory = (categoryName || 'General').trim();
  const normalizedType = String(productType || '').toLowerCase().trim();

  // If category already describes the type (e.g. "Robux", "Roblox Accounts")
  const lowerCat = cleanCategory.toLowerCase();
  if (lowerCat.includes('account') || lowerCat.includes('item') || lowerCat.includes('code') || lowerCat.includes('robux')) {
    return cleanCategory;
  }

  if (normalizedType === 'account') {
    return `${cleanCategory} Accounts`;
  }
  if (normalizedType === 'digital_code' || normalizedType === 'code') {
    return `${cleanCategory} Codes`;
  }
  return `${cleanCategory} Items`;
}

// ── Telegram Dispatcher Type & Test Hook ───────────────────────────────────────
export type TelegramDispatchFn = (
  chatId: string,
  htmlText: string
) => Promise<{
  success: boolean;
  message_id?: number;
  error?: string;
  error_code?: string;
  rate_limited?: boolean;
  retry_after?: number;
  permanent?: boolean;
}>;

export class BatchAnnouncementService {
  private static mockDispatcher: TelegramDispatchFn | null = null;
  private static isPublishingLocked = false;

  /** Test hook to override Telegram network sending with a mock function */
  static setTelegramDispatcher(dispatcher: TelegramDispatchFn | null): void {
    this.mockDispatcher = dispatcher;
  }

  static setMockDispatcher(dispatcher: TelegramDispatchFn | null): void {
    this.mockDispatcher = dispatcher;
  }

  /** Reset internal testing state */
  static _resetForTesting(): void {
    this.mockDispatcher = null;
    this.isPublishingLocked = false;
    DataStore.resetStockAnnouncementStateForTesting();
  }

  // ── Canonical Buy Link Resolver ──────────────────────────────────────────────
  static resolveBuyHereUrl(productId: string): string {
    const storeUrl = resolveStoreUrl();
    if (storeUrl && (storeUrl.startsWith('https://') || storeUrl.startsWith('http://'))) {
      return `${storeUrl.replace(/\/+$/, '')}/product/${productId}`;
    }
    return getStoreBotMiniAppLink(`prod_${productId}`);
  }

  // ── Preview Generation (Side-Effect Free) ────────────────────────────────────
  static async previewBatch(): Promise<BatchPreviewResponse> {
    const pendingEvents = DataStore.getPendingStockEvents();
    const categories = DataStore.getCategories();
    const catMap = new Map<string, string>();
    for (const c of categories) {
      catMap.set(c.id, c.name);
    }

    const eligibleItems: BatchPreviewProductItem[] = [];
    const excludedItems: BatchPreviewExcludedItem[] = [];
    const seenProductIds = new Set<string>();

    for (const event of pendingEvents) {
      if (seenProductIds.has(event.product_id)) continue;
      seenProductIds.add(event.product_id);

      const product = DataStore.getProductById(event.product_id);
      if (!product) {
        excludedItems.push({
          id: event.product_id,
          title: `Product #${event.product_id}`,
          reason: 'PRODUCT_NOT_FOUND',
          current_stock: 0,
        });
        continue;
      }

      if (!product.is_active) {
        excludedItems.push({
          id: product.id,
          title: product.title,
          reason: 'INACTIVE_PRODUCT',
          current_stock: DataStore.getProductAvailableStock(product.id),
        });
        continue;
      }

      if (product.is_draft) {
        excludedItems.push({
          id: product.id,
          title: product.title,
          reason: 'DRAFT_PRODUCT',
          current_stock: DataStore.getProductAvailableStock(product.id),
        });
        continue;
      }

      const liveStock = DataStore.getProductAvailableStock(product.id);
      if (liveStock <= 0) {
        excludedItems.push({
          id: product.id,
          title: product.title,
          reason: 'OUT_OF_STOCK',
          current_stock: liveStock,
        });
        continue;
      }

      if (product.price === undefined || product.price === null || product.price < 0 || isNaN(product.price)) {
        excludedItems.push({
          id: product.id,
          title: product.title,
          reason: 'INVALID_PRICE',
          current_stock: liveStock,
        });
        continue;
      }

      const catName = catMap.get(product.category_id) || 'General';
      const buyUrl = this.resolveBuyHereUrl(product.id);
      const qtyLabel = formatQuantityLabel(liveStock, product.product_type);

      eligibleItems.push({
        id: product.id,
        title: product.title,
        product_type: product.product_type || 'item',
        category_id: product.category_id,
        category_name: catName,
        price: Number(product.price) || 0,
        stock: liveStock,
        quantity_label: qtyLabel,
        buy_url: buyUrl,
      });
    }

    // Group eligible items by (category_name + product_type)
    const groupedMap = new Map<string, BatchPreviewCategoryGroup>();
    for (const item of eligibleItems) {
      const key = `${item.category_id}__${item.product_type}`;
      if (!groupedMap.has(key)) {
        const groupLabel = formatGroupHeader(item.category_name, item.product_type);
        groupedMap.set(key, {
          category_id: item.category_id,
          category_name: item.category_name,
          product_type: item.product_type,
          group_label: groupLabel,
          products: [],
        });
      }
      groupedMap.get(key)!.products.push(item);
    }

    const groupedPreview = Array.from(groupedMap.values());
    const activeGroups = DataStore.getActiveRegisteredGroups();

    // Build consolidated message chunks
    const chunks = this.formatConsolidatedMessageChunks(groupedPreview);
    const previewText = chunks.length > 0 ? chunks[0] : '<i>No eligible stock to announce.</i>';

    return {
      total_pending: pendingEvents.length,
      eligible_count: eligibleItems.length,
      excluded_count: excludedItems.length,
      groups_count: activeGroups.length,
      grouped_preview: groupedPreview,
      excluded_products: excludedItems,
      authorized_groups: activeGroups.map((g) => ({
        id: g.id,
        title: g.title,
        chat_type: g.chat_type,
        is_active: g.is_active,
      })),
      preview_text: previewText,
      chunks_count: chunks.length,
    };
  }

  // ── Consolidated Message Formatter with Chunking ─────────────────────────────
  static formatConsolidatedMessageChunks(groups: BatchPreviewCategoryGroup[]): string[] {
    if (groups.length === 0) return [];

    const storeUrl = resolveStoreUrl() || 'https://uchiro.store';
    const MAX_CHUNK_LIMIT = 3800; // Telegram hard limit is 4096

    // Pre-format and enrich product blocks so character counts are accurate including custom emojis
    const buildHeader = (totalParts: number, partNum: number) => {
      const headerTitle = totalParts > 1
        ? `🔥 <b>NEW STOCK ARRIVAL — UCHIRO STORE (Part ${partNum}/${totalParts})</b>`
        : `🔥 <b>NEW STOCK ARRIVAL — UCHIRO STORE</b>`;
      return enrichWithTgEmojis(formatTelegramHtml(`${headerTitle}\n━━━━━━━━━━━━━━━━━━━━\n\n`));
    };

    const buildFooter = () => {
      return enrichWithTgEmojis(
        formatTelegramHtml(
          `\n\n━━━━━━━━━━━━━━━━━━━━\n` +
          `⚡ <i>Instant automated delivery 24/7 via Uchiro Store Bot.</i>\n` +
          `🛍️ <a href="${escapeTelegramHtml(storeUrl)}">Open Uchiro Store</a>`
        )
      );
    };

    const sampleHeader = buildHeader(2, 1);
    const sampleFooter = buildFooter();
    const fixedOverhead = sampleHeader.length + sampleFooter.length + 50;
    const maxBodyChars = Math.max(1000, MAX_CHUNK_LIMIT - fixedOverhead);

    const rawChunks: string[][] = [[]];
    let currentLength = 0;

    for (const grp of groups) {
      const headerLine = enrichWithTgEmojis(formatTelegramHtml(`📁 <b>${escapeTelegramHtml(grp.group_label)}</b>`));
      let grpHeaderAddedToCurrentChunk = false;

      for (let pIdx = 0; pIdx < grp.products.length; pIdx++) {
        const prod = grp.products[pIdx];
        const prodBlock = enrichWithTgEmojis(
          formatTelegramHtml(
            `• <b>${escapeTelegramHtml(prod.title)}</b>\n` +
            `  💵 Price: <b>$${prod.price.toFixed(2)} USD</b>\n` +
            `  📦 Stock: <b>${escapeTelegramHtml(prod.quantity_label)}</b>\n` +
            `  👉 <a href="${escapeTelegramHtml(prod.buy_url)}">Buy Here / ទិញទីនេះ</a>`
          )
        );

        const needHeader = !grpHeaderAddedToCurrentChunk;
        const addition = needHeader ? `${headerLine}\n${prodBlock}` : prodBlock;
        const additionLen = addition.length + 2;

        if (currentLength + additionLen > maxBodyChars && rawChunks[rawChunks.length - 1].length > 0) {
          const contHeader = enrichWithTgEmojis(
            formatTelegramHtml(`📁 <b>${escapeTelegramHtml(grp.group_label)}${pIdx > 0 ? ' (Cont.)' : ''}</b>`)
          );
          const newChunkFirstItem = `${contHeader}\n${prodBlock}`;
          rawChunks.push([newChunkFirstItem]);
          currentLength = newChunkFirstItem.length;
          grpHeaderAddedToCurrentChunk = true;
        } else {
          rawChunks[rawChunks.length - 1].push(addition);
          currentLength += additionLen;
          grpHeaderAddedToCurrentChunk = true;
        }
      }
    }

    const totalParts = rawChunks.length;
    const finalChunks: string[] = [];

    for (let i = 0; i < totalParts; i++) {
      const header = buildHeader(totalParts, i + 1);
      const footer = buildFooter();
      const body = rawChunks[i].join('\n\n');
      finalChunks.push(`${header}${body}${footer}`);
    }

    return finalChunks;
  }

  /** Reconstruct message chunks from a batch snapshot */
  static reconstructChunksFromSnapshot(snapshot: any[]): string[] {
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      return [];
    }

    const groupedMap = new Map<string, BatchPreviewCategoryGroup>();
    for (const item of snapshot) {
      const key = `${item.category_id || 'default'}__${item.product_type || 'item'}`;
      if (!groupedMap.has(key)) {
        const catName = item.category_name || 'General';
        const groupLabel = formatGroupHeader(catName, item.product_type);
        groupedMap.set(key, {
          category_id: item.category_id || 'default',
          category_name: catName,
          product_type: item.product_type || 'item',
          group_label: groupLabel,
          products: [],
        });
      }

      const stock = Number(item.stock_at_preview ?? item.stock) || 1;
      groupedMap.get(key)!.products.push({
        id: item.product_id,
        title: item.title,
        product_type: item.product_type || 'item',
        category_id: item.category_id || 'default',
        category_name: item.category_name || 'General',
        price: Number(item.price) || 0,
        stock,
        quantity_label: formatQuantityLabel(stock, item.product_type),
        buy_url: item.buy_url || this.resolveBuyHereUrl(item.product_id),
      });
    }

    return this.formatConsolidatedMessageChunks(Array.from(groupedMap.values()));
  }

  // ── Dispatch Outbound Telegram Message Safely ────────────────────────────────
  private static async dispatchTelegramMessage(
    chatId: string,
    htmlText: string
  ): Promise<{
    success: boolean;
    message_id?: number;
    error?: string;
    error_code?: string;
    rate_limited?: boolean;
    retry_after?: number;
    permanent?: boolean;
  }> {
    // 1. If mock dispatcher is injected (for tests/fakes), use it strictly
    if (this.mockDispatcher) {
      return this.mockDispatcher(chatId, htmlText);
    }

    // 2. Prevent real Telegram API calls during tests
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
      return { success: true, message_id: Math.floor(Math.random() * 100000) + 1000 };
    }

    const token = (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim();
    if (!token) {
      console.warn(`[BatchAnnouncement] No STORE_BOT_TOKEN configured, logging message for ${chatId}`);
      return { success: true, message_id: 1 };
    }

    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chatId,
          text: htmlText,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        },
        { timeout: 12000 }
      );

      const msgId = response.data?.result?.message_id;
      return { success: true, message_id: msgId };
    } catch (err: any) {
      const status = err.response?.status;
      const desc = String(err.response?.data?.description || err.message || '');
      const sanitizedDesc = desc.replace(token, '[REDACTED_BOT_TOKEN]');

      // Rate limited
      if (status === 429) {
        const retryAfter = Number(err.response?.data?.parameters?.retry_after) || 2;
        return {
          success: false,
          rate_limited: true,
          retry_after: retryAfter,
          error_code: 'RATE_LIMITED',
          error: `Telegram 429: Too Many Requests. Retry after ${retryAfter}s`,
        };
      }

      // Permanent group/bot permission errors
      if (
        status === 403 ||
        /bot was kicked|bot is not a member|chat not found|forbidden|have no rights|not enough rights/i.test(desc)
      ) {
        return {
          success: false,
          permanent: true,
          error_code: 'BOT_KICKED',
          error: `Bot kicked or lacking send rights in chat: ${sanitizedDesc}`,
        };
      }

      // Timeout or connection abort
      if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) {
        return {
          success: false,
          error_code: 'AMBIGUOUS_TIMEOUT',
          error: `Telegram dispatch timed out: ambiguous delivery status`,
        };
      }

      return {
        success: false,
        error_code: 'DISPATCH_ERROR',
        error: sanitizedDesc.slice(0, 200),
      };
    }
  }

  // ── Publish All New Stock ────────────────────────────────────────────────────
  static async publishBatch(
    adminId: string | number,
    idempotencyKey?: string
  ): Promise<BatchPublishResult> {
    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = DataStore.getStockBatchByIdempotencyKey(idempotencyKey);
      if (existing) {
        const deliveries = DataStore.getStockBatchDeliveries(existing.id);
        return {
          success: existing.status === 'succeeded' || existing.status === 'partial',
          batch_id: existing.id,
          status: existing.status,
          total_groups: existing.total_groups,
          succeeded_groups: existing.succeeded_groups,
          failed_groups: existing.failed_groups,
          deliveries: deliveries.map((d) => ({
            id: d.id,
            group_title: d.group_title,
            chunk_index: d.chunk_index,
            total_chunks: d.total_chunks,
            status: d.status,
            error_message: d.error_message,
            error_code: d.error_code,
            delivered_at: d.delivered_at,
          })),
          published_products_count: existing.published_products,
          skipped_products_count: existing.skipped_products,
        };
      }
    }

    // 2. Concurrency Lock Guard
    if (this.isPublishingLocked) {
      return {
        success: false,
        error: 'PUBLISH_IN_PROGRESS',
        message: 'A stock announcement batch publish is currently in progress. Please wait.',
      };
    }

    this.isPublishingLocked = true;
    try {
      // 3. Re-validate Live Stock and Eligibility at Publish Time
      const preview = await this.previewBatch();
      if (preview.eligible_count === 0) {
        return {
          success: false,
          error: 'NO_ELIGIBLE_PRODUCTS',
          message: 'No eligible products with positive stock available to announce.',
        };
      }

      const activeGroups = DataStore.getActiveRegisteredGroups();
      if (activeGroups.length === 0) {
        return {
          success: false,
          error: 'NO_AUTHORIZED_GROUPS',
          message: 'No active authorized Telegram groups are registered to receive announcements.',
        };
      }

      // 4. Format Message Chunks
      const chunks = this.formatConsolidatedMessageChunks(preview.grouped_preview);
      if (chunks.length === 0) {
        return {
          success: false,
          error: 'MESSAGE_FORMAT_ERROR',
          message: 'Failed to format consolidated stock announcement.',
        };
      }

      // 5. Create Batch Record
      const batchId = uuidv4();
      const now = new Date().toISOString();

      const batchSnapshot = preview.grouped_preview.flatMap((grp) =>
        grp.products.map((p) => ({
          product_id: p.id,
          title: p.title,
          product_type: p.product_type,
          category_id: p.category_id,
          category_name: p.category_name,
          price: p.price,
          stock_at_preview: p.stock,
          buy_url: p.buy_url,
          is_eligible: true,
        }))
      );

      const batchRecord: StockAnnouncementBatch = {
        id: batchId,
        status: 'publishing',
        created_by_admin: adminId,
        idempotency_key: idempotencyKey,
        total_groups: activeGroups.length,
        succeeded_groups: 0,
        failed_groups: 0,
        total_products: preview.eligible_count,
        published_products: 0,
        skipped_products: preview.excluded_count,
        snapshot: batchSnapshot,
        created_at: now,
        updated_at: now,
      };

      DataStore.createStockBatch(batchRecord);

      // 6. Pre-create Delivery Records
      const deliveryRecords: StockBatchDelivery[] = [];
      for (const group of activeGroups) {
        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const delivery: StockBatchDelivery = {
            id: uuidv4(),
            batch_id: batchId,
            chat_id: group.chat_id,
            group_title: group.title,
            chunk_index: chunkIdx,
            total_chunks: chunks.length,
            status: 'pending',
            attempt_count: 0,
            created_at: now,
            updated_at: now,
          };
          deliveryRecords.push(delivery);
          DataStore.saveStockBatchDelivery(delivery);
        }
      }

      // 7. Dispatch to Each Group and Chunk
      let overallSucceededDeliveries = 0;
      let overallFailedDeliveries = 0;
      const groupSuccessMap = new Map<string, boolean>();

      for (const group of activeGroups) {
        let groupAllChunksSucceeded = true;

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
          const delivery = deliveryRecords.find(
            (d) => d.chat_id === group.chat_id && d.chunk_index === chunkIdx
          );
          if (!delivery) continue;

          delivery.status = 'sending';
          delivery.attempt_count += 1;
          delivery.updated_at = new Date().toISOString();
          DataStore.updateStockBatchDelivery(delivery.id, delivery);

          const htmlText = chunks[chunkIdx];
          let dispatchRes = await this.dispatchTelegramMessage(group.chat_id, htmlText);

          // If rate limited, bounded retry
          if (dispatchRes.rate_limited && dispatchRes.retry_after) {
            const delayMs = Math.min(dispatchRes.retry_after * 1000, 3000);
            await new Promise((r) => setTimeout(r, delayMs));
            delivery.attempt_count += 1;
            dispatchRes = await this.dispatchTelegramMessage(group.chat_id, htmlText);
          }

          if (dispatchRes.success) {
            delivery.status = 'succeeded';
            delivery.telegram_message_id = dispatchRes.message_id || null;
            delivery.delivered_at = new Date().toISOString();
            delivery.error_code = null;
            delivery.error_message = null;
            overallSucceededDeliveries++;
          } else {
            groupAllChunksSucceeded = false;
            delivery.status = 'failed';
            delivery.error_code = dispatchRes.error_code || 'FAILED';
            delivery.error_message = dispatchRes.error || 'Unknown Telegram delivery failure';
            overallFailedDeliveries++;

            // If permanent bot removal, disable posting flag for group
            if (dispatchRes.permanent) {
              DataStore.updateRegisteredGroup(group.id, { bot_can_post: false });
            }
          }

          delivery.updated_at = new Date().toISOString();
          DataStore.updateStockBatchDelivery(delivery.id, delivery);

          // Delay slightly between group sends to avoid burst flood
          await new Promise((r) => setTimeout(r, 60));
        }

        groupSuccessMap.set(group.chat_id, groupAllChunksSucceeded);
      }

      // 8. Calculate Final Batch Status
      const totalSucceededGroups = Array.from(groupSuccessMap.values()).filter(Boolean).length;
      const totalFailedGroups = activeGroups.length - totalSucceededGroups;

      let finalBatchStatus: BatchStatus = 'failed';
      if (totalSucceededGroups === activeGroups.length) {
        finalBatchStatus = 'succeeded';
      } else if (totalSucceededGroups > 0) {
        finalBatchStatus = 'partial';
      } else {
        finalBatchStatus = 'failed';
      }

      // Mark pending events as published if at least one group received announcement
      const announcedProductIds = preview.grouped_preview.flatMap((g) => g.products.map((p) => p.id));
      if (finalBatchStatus === 'succeeded' || finalBatchStatus === 'partial') {
        DataStore.markEventsAsPublished(announcedProductIds, batchId);
      }

      DataStore.updateStockBatch(batchId, {
        status: finalBatchStatus,
        succeeded_groups: totalSucceededGroups,
        failed_groups: totalFailedGroups,
        published_products: announcedProductIds.length,
        completed_at: new Date().toISOString(),
      });

      return {
        success: finalBatchStatus === 'succeeded' || finalBatchStatus === 'partial',
        batch_id: batchId,
        status: finalBatchStatus,
        total_groups: activeGroups.length,
        succeeded_groups: totalSucceededGroups,
        failed_groups: totalFailedGroups,
        deliveries: deliveryRecords.map((d) => ({
          id: d.id,
          group_title: d.group_title,
          chunk_index: d.chunk_index,
          total_chunks: d.total_chunks,
          status: d.status,
          error_message: d.error_message,
          error_code: d.error_code,
          delivered_at: d.delivered_at,
        })),
        published_products_count: announcedProductIds.length,
        skipped_products_count: preview.excluded_count,
      };
    } finally {
      this.isPublishingLocked = false;
    }
  }

  // ── Retry Failed Groups Only ─────────────────────────────────────────────────
  static async retryFailedGroups(
    _adminId: string | number,
    batchId: string
  ): Promise<BatchPublishResult> {
    const batch = DataStore.getStockBatch(batchId);
    if (!batch) {
      return { success: false, error: 'BATCH_NOT_FOUND', message: `Batch ${batchId} not found.` };
    }

    const failedDeliveries = DataStore.getFailedDeliveries(batchId);
    if (failedDeliveries.length === 0) {
      return {
        success: true,
        batch_id: batchId,
        status: batch.status,
        message: 'No failed deliveries found to retry for this batch.',
      };
    }

    // Reconstruct chunks from batch snapshot
    let chunks = this.reconstructChunksFromSnapshot(batch.snapshot);
    if (chunks.length === 0) {
      const preview = await this.previewBatch();
      chunks = this.formatConsolidatedMessageChunks(preview.grouped_preview);
    }

    let newlySucceeded = 0;
    for (const delivery of failedDeliveries) {
      // Skip permanent failures if bot was kicked
      if (delivery.error_code === 'BOT_KICKED') {
        continue;
      }

      delivery.attempt_count += 1;
      delivery.status = 'sending';
      DataStore.updateStockBatchDelivery(delivery.id, delivery);

      const htmlText = chunks[delivery.chunk_index] || chunks[0] || '🔥 <b>NEW STOCK ARRIVAL — UCHIRO STORE</b>';
      const dispatchRes = await this.dispatchTelegramMessage(delivery.chat_id, htmlText);

      if (dispatchRes.success) {
        delivery.status = 'succeeded';
        delivery.telegram_message_id = dispatchRes.message_id || null;
        delivery.delivered_at = new Date().toISOString();
        delivery.error_code = null;
        delivery.error_message = null;
        newlySucceeded++;
      } else {
        delivery.status = 'failed';
        delivery.error_code = dispatchRes.error_code || 'RETRY_FAILED';
        delivery.error_message = dispatchRes.error || 'Retry delivery failed';

        // If permanent bot removal, disable posting flag for group
        if (dispatchRes.permanent) {
          delivery.error_code = 'BOT_KICKED';
          const group = DataStore.getRegisteredGroupByChatId(delivery.chat_id);
          if (group) {
            DataStore.updateRegisteredGroup(group.id, { bot_can_post: false });
          }
        }
      }

      delivery.updated_at = new Date().toISOString();
      DataStore.updateStockBatchDelivery(delivery.id, delivery);
    }

    // Recompute distinct groups success/failure
    const allDeliveries = DataStore.getStockBatchDeliveries(batchId);
    const uniqueChatIds = Array.from(new Set(allDeliveries.map((d) => d.chat_id)));
    let succeededGroupCount = 0;
    let failedGroupCount = 0;

    for (const chatId of uniqueChatIds) {
      const groupDeliveries = allDeliveries.filter((d) => d.chat_id === chatId);
      const isGroupSucceeded = groupDeliveries.every((d) => d.status === 'succeeded');
      if (isGroupSucceeded) {
        succeededGroupCount++;
      } else {
        failedGroupCount++;
      }
    }

    const totalGroups = uniqueChatIds.length || batch.total_groups;
    const allSucceeded = failedGroupCount === 0;

    const newStatus: BatchStatus = allSucceeded
      ? 'succeeded'
      : succeededGroupCount > 0
      ? 'partial'
      : 'failed';

    DataStore.updateStockBatch(batchId, {
      status: newStatus,
      total_groups: totalGroups,
      failed_groups: failedGroupCount,
      succeeded_groups: succeededGroupCount,
      updated_at: new Date().toISOString(),
    });

    return {
      success: allSucceeded || newlySucceeded > 0,
      batch_id: batchId,
      status: newStatus,
      total_groups: totalGroups,
      succeeded_groups: succeededGroupCount,
      failed_groups: failedGroupCount,
      deliveries: allDeliveries.map((d) => ({
        id: d.id,
        group_title: d.group_title,
        chunk_index: d.chunk_index,
        total_chunks: d.total_chunks,
        status: d.status,
        error_message: d.error_message,
        error_code: d.error_code,
        delivered_at: d.delivered_at,
      })),
      published_products_count: batch.published_products,
      skipped_products_count: batch.skipped_products,
    };
  }

  // ── Batch History & Detail ───────────────────────────────────────────────────
  static getBatchHistory(limit: number = 20): StockAnnouncementBatch[] {
    return DataStore.listStockBatches(limit);
  }

  static getBatchDetail(batchId: string): {
    batch: StockAnnouncementBatch;
    deliveries: StockBatchDelivery[];
  } | null {
    const batch = DataStore.getStockBatch(batchId);
    if (!batch) return null;
    const deliveries = DataStore.getStockBatchDeliveries(batchId);
    return { batch, deliveries };
  }

  // ── Explicit Admin Controls for Pending Batch ────────────────────────────────
  static markProductPending(productId: string): StockAnnouncementEvent {
    const product = DataStore.getProductById(productId);
    if (!product) {
      throw new AppError('Product not found', 404);
    }
    if (!product.is_active) {
      throw new AppError('Cannot add inactive product to announcement batch', 400);
    }
    if (product.is_draft) {
      throw new AppError('Cannot add draft product to announcement batch', 400);
    }
    const liveStock = DataStore.getProductAvailableStock(productId);
    if (liveStock <= 0) {
      throw new AppError('Cannot add product with 0 stock to announcement batch', 400);
    }
    return DataStore.recordPendingStockEvent(productId, 'manual', liveStock);
  }

  static removeProductPending(productId: string): boolean {
    return DataStore.removePendingStockEvent(productId);
  }

  // ── Registered Groups CRUD ───────────────────────────────────────────────────
  static listRegisteredGroups(): RegisteredGroup[] {
    return DataStore.getRegisteredGroups();
  }

  static registerGroup(data: {
    chat_id: string;
    title: string;
    chat_type?: 'group' | 'supergroup' | 'channel';
  }): RegisteredGroup {
    if (!data.chat_id || !data.title) {
      throw new AppError('chat_id and title are required to register a group', 400);
    }
    return DataStore.registerGroup(data);
  }

  static updateGroup(
    id: string,
    updates: Partial<RegisteredGroup>
  ): RegisteredGroup | null {
    return DataStore.updateRegisteredGroup(id, updates);
  }

  static deleteGroup(id: string): boolean {
    return DataStore.deleteRegisteredGroup(id);
  }
}
