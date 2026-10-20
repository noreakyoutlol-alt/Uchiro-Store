import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { DataStore } from '../database/data-store';
import { isSupabaseConfigured, supabase } from '../database/supabase';
import { NotificationService } from './notification.service';
import { createWebAppOrUrlButton } from '../bots/store-bot';
import {
  BroadcastCampaign,
  CreateBroadcastParams,
  BroadcastPreview,
  BroadcastAudience,
  TelegramUser,
} from '../types';

export interface BroadcastStockArrivalParams {
  title: string;
  stockCount: number;
  price: number;
  productId: string;
  messageText?: string;
}

export interface BroadcastResult {
  total: number;
  sent: number;
  failed: number;
  productId: string;
}

// ── Validation helpers ─────────────────────────────────────────────────────────

/** Returns the store/mini-app URL from environment */
export function getStoreUrl(): string {
  const url = (
    process.env.STORE_MINIAPP_URL ||
    env.STORE_WEBAPP_URL ||
    env.CLIENT_STORE_URL ||
    process.env.PUBLIC_URL ||
    env.PUBLIC_URL ||
    'https://uchiro.store'
  ).trim();
  return url.replace(/\/+$/, '');
}

/** Validates a button URL: must be HTTP or HTTPS, no dangerous schemes */
export function validateButtonUrl(url: string): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use http:// or https://' };
    }
    const dangerous = /^(javascript|data|vbscript|file|blob):/i;
    if (dangerous.test(trimmed)) {
      return { valid: false, error: 'URL scheme not allowed' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Malformed URL' };
  }
}

/** Validates button label: English-only (ASCII printable), max 64 chars */
export function validateButtonLabel(label: string): { valid: boolean; error?: string } {
  if (!label || typeof label !== 'string') {
    return { valid: false, error: 'Button label is required' };
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Button label cannot be empty' };
  if (trimmed.length > 64) return { valid: false, error: 'Button label must be 64 characters or fewer' };
  // Allow ASCII printable chars only, plus common punctuation/emojis at Unicode plane 0/1
  if (/[^\x20-\x7E -˿ -⟿︀-️\u{1F300}-\u{1FFFF}]/u.test(trimmed)) {
    return { valid: false, error: 'Button label must use English characters' };
  }
  return { valid: true };
}

/** Validates broadcast message text (non-empty, ≤4096 chars) */
export function validateMessageText(text: string | undefined, fieldName = 'text'): { valid: boolean; error?: string } {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (text.trim().length === 0) return { valid: false, error: `${fieldName} cannot be empty` };
  if (text.length > 4096) return { valid: false, error: `${fieldName} must be 4096 characters or fewer` };
  return { valid: true };
}

/** Full server-side validation of CreateBroadcastParams */
export function validateBroadcastParams(params: CreateBroadcastParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const { type, text, text_km, text_en, media_type, media_url, button } = params;

  const validTypes = ['text_only', 'text_shop_now', 'text_custom_button', 'media_caption'];
  if (!validTypes.includes(type)) {
    errors.push(`Invalid broadcast type: ${type}`);
  }

  // Text-only and text_shop_now require a simple text
  if (type === 'text_only' || type === 'text_shop_now') {
    // Accept common single text OR bilingual pair
    const hasCommon = Boolean(text && text.trim());
    const hasBilingual = Boolean(text_km?.trim() || text_en?.trim());
    if (!hasCommon && !hasBilingual) {
      errors.push('text is required for this broadcast type');
    }
    if (hasCommon) {
      const v = validateMessageText(text, 'text');
      if (!v.valid) errors.push(v.error!);
    }
    if (text_km) {
      const v = validateMessageText(text_km, 'text_km');
      if (!v.valid) errors.push(v.error!);
    }
    if (text_en) {
      const v = validateMessageText(text_en, 'text_en');
      if (!v.valid) errors.push(v.error!);
    }
  }

  if (type === 'text_custom_button') {
    const hasCommon = Boolean(text && text.trim());
    const hasBilingual = Boolean(text_km?.trim() || text_en?.trim());
    if (!hasCommon && !hasBilingual) {
      errors.push('text is required for custom button broadcast');
    }
    if (!button) {
      errors.push('button configuration is required for custom button broadcast');
    } else {
      const lv = validateButtonLabel(button.label);
      if (!lv.valid) errors.push(lv.error!);
      const uv = validateButtonUrl(button.url);
      if (!uv.valid) errors.push(uv.error!);
    }
  }

  if (type === 'media_caption') {
    if (!media_type || !['photo', 'video'].includes(media_type)) {
      errors.push('media_type must be "photo" or "video"');
    }
    if (!media_url || typeof media_url !== 'string' || !media_url.startsWith('https://')) {
      errors.push('media_url must be a valid https:// URL');
    }
    // caption is optional but validated if provided
    if (text) {
      const v = validateMessageText(text, 'caption');
      if (!v.valid) errors.push(v.error!);
    }
    if (button) {
      const lv = validateButtonLabel(button.label);
      if (!lv.valid) errors.push(lv.error!);
      const uv = validateButtonUrl(button.url);
      if (!uv.valid) errors.push(uv.error!);
    }
  }

  const validAudiences = ['all', 'km', 'en'];
  if (params.audience && !validAudiences.includes(params.audience)) {
    errors.push(`Invalid audience: ${params.audience}`);
  }

  return { valid: errors.length === 0, errors };
}

// ── Target recipient resolution ────────────────────────────────────────────────

interface RecipientInfo {
  telegram_id: number;
  language_preference: string | null;
}

async function resolveRecipients(audience: BroadcastAudience): Promise<RecipientInfo[]> {
  const idMap = new Map<number, RecipientInfo>();

  const localUsers = DataStore.getAllRegisteredUsers();
  for (const u of localUsers) {
    if (u.telegram_id && !u.is_bot && !u.is_blocked) {
      const lang = u.language_preference || u.language_code || null;
      idMap.set(u.telegram_id, { telegram_id: u.telegram_id, language_preference: lang });
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('telegram_id, is_blocked, language_preference, language_code')
        .eq('is_blocked', false);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (row.telegram_id) {
            const tid = Number(row.telegram_id);
            const existing = idMap.get(tid);
            const lang = row.language_preference || row.language_code || existing?.language_preference || null;
            idMap.set(tid, { telegram_id: tid, language_preference: lang });
          }
        }
      }
    } catch (err: any) {
      console.warn('[BROADCAST] Failed to fetch users from Supabase, using DataStore:', err.message);
    }
  }

  const all = Array.from(idMap.values());

  if (audience === 'all') return all;
  if (audience === 'km') {
    return all.filter((r) => r.language_preference === 'km');
  }
  if (audience === 'en') {
    return all.filter((r) => r.language_preference === 'en' || r.language_preference === null || r.language_preference === '');
  }
  return all;
}

// ── Message builder ────────────────────────────────────────────────────────────

export function buildBroadcastMessageForRecipient(
  campaign: BroadcastCampaign,
  recipientLang: string | null
): { text?: string; caption?: string; mediaType?: 'photo' | 'video'; mediaUrl?: string; replyMarkup?: any } {
  const storeUrl = getStoreUrl();

  const resolvedText = (() => {
    const isBilingual = Boolean(campaign.text_km?.trim() || campaign.text_en?.trim());
    if (isBilingual) {
      const prefersKm = recipientLang === 'km';
      return prefersKm
        ? (campaign.text_km || campaign.text_en || campaign.text || '')
        : (campaign.text_en || campaign.text_km || campaign.text || '');
    }
    return campaign.text || '';
  })();

  const buildMarkup = (): any | undefined => {
    if (campaign.type === 'text_shop_now') {
      const btn = createWebAppOrUrlButton('🛍️ Shop Now', storeUrl, 'SHOPPING_BAGS');
      return { inline_keyboard: [[btn]] };
    }
    if (campaign.type === 'text_custom_button' && campaign.button) {
      const btn = { text: campaign.button.label, url: campaign.button.url };
      return { inline_keyboard: [[btn]] };
    }
    if (campaign.type === 'media_caption' && campaign.button) {
      const btn = campaign.button.url.startsWith('https://t.me/')
        ? { text: campaign.button.label, url: campaign.button.url }
        : { text: campaign.button.label, url: campaign.button.url };
      return { inline_keyboard: [[btn]] };
    }
    return undefined;
  };

  const markup = buildMarkup();

  if (campaign.type === 'media_caption') {
    return {
      caption: resolvedText || undefined,
      mediaType: campaign.media_type,
      mediaUrl: campaign.media_url,
      replyMarkup: markup,
    };
  }

  return { text: resolvedText, replyMarkup: markup };
}

// ── Core delivery engine ───────────────────────────────────────────────────────

const BATCH_SIZE = 25;        // Telegram allows up to ~30 msg/s per bot
const BATCH_DELAY_MS = 1050;  // Stay safely under 30/sec

/** Delivers one campaign to all resolved recipients. Runs in background. */
export async function executeBroadcastDelivery(campaignId: string): Promise<void> {
  const campaign = DataStore.getBroadcastCampaign(campaignId);
  if (!campaign) {
    console.error(`[BROADCAST] Campaign ${campaignId} not found – delivery aborted`);
    return;
  }
  if (campaign.status !== 'pending') {
    console.warn(`[BROADCAST] Campaign ${campaignId} is in state ${campaign.status}, skipping delivery`);
    return;
  }

  DataStore.updateBroadcastCampaign(campaignId, {
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const recipients = await resolveRecipients(campaign.audience);
  DataStore.updateBroadcastCampaign(campaignId, { target_count: recipients.length });

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  try {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const outcomes = await Promise.allSettled(
        batch.map(async (r) => {
          const msg = buildBroadcastMessageForRecipient(campaign, r.language_preference);

          if (msg.mediaType && msg.mediaUrl) {
            const res = await NotificationService.sendStoreBotMediaDetailed(
              r.telegram_id,
              msg.mediaType,
              msg.mediaUrl,
              msg.caption,
              msg.replyMarkup
            );
            return res;
          } else {
            const res = await NotificationService.sendStoreBotMessageDetailed(
              r.telegram_id,
              msg.text || '',
              msg.replyMarkup
            );
            return res;
          }
        })
      );

      for (const result of outcomes) {
        if (result.status === 'fulfilled') {
          const r = result.value;
          if (r.success) {
            sent++;
          } else if (r.blocked) {
            blocked++;
            failed++;
          } else if (r.rateLimited && r.retryAfter) {
            // Honour Telegram's retry_after for rate limited cases
            await new Promise((resolve) => setTimeout(resolve, (r.retryAfter! + 1) * 1000));
            failed++; // Count as failed for now; advanced retry loop is out of scope
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      }

      // Persist progress after each batch
      DataStore.updateBroadcastCampaign(campaignId, {
        sent_count: sent,
        failed_count: failed,
        blocked_count: blocked,
      });

      // Wait between batches to respect rate limits
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    DataStore.updateBroadcastCampaign(campaignId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
      blocked_count: blocked,
      target_count: recipients.length,
    });
  } catch (err: any) {
    console.error(`[BROADCAST] Delivery error for campaign ${campaignId}:`, err.message);
    DataStore.updateBroadcastCampaign(campaignId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: String(err.message || 'Unknown error').slice(0, 500),
    });
  }
}

/** Build a preview without sending anything */
export async function previewBroadcast(params: CreateBroadcastParams): Promise<BroadcastPreview> {
  const audience = params.audience || 'all';
  const recipients = await resolveRecipients(audience);

  const draftCampaign: BroadcastCampaign = {
    id: 'preview',
    type: params.type,
    audience,
    text: params.text,
    text_km: params.text_km,
    text_en: params.text_en,
    media_type: params.media_type,
    media_url: params.media_url,
    button: params.button,
    status: 'draft',
    created_at: new Date().toISOString(),
    created_by_admin: 'preview',
    target_count: recipients.length,
    sent_count: 0,
    failed_count: 0,
    blocked_count: 0,
    skipped_count: 0,
  };

  const enMsg = buildBroadcastMessageForRecipient(draftCampaign, 'en');
  const kmMsg = buildBroadcastMessageForRecipient(draftCampaign, 'km');

  const isBilingual = Boolean(params.text_km?.trim() || params.text_en?.trim());

  return {
    type: params.type,
    audience,
    target_count: recipients.length,
    is_bilingual: isBilingual,
    preview_en: {
      text: enMsg.text || '',
      caption: enMsg.caption,
      media_type: enMsg.mediaType,
      media_url: enMsg.mediaUrl,
      button: params.type === 'text_shop_now'
        ? { label: '🛍️ Shop Now', url: getStoreUrl() }
        : params.button,
    },
    preview_km: {
      text: kmMsg.text || '',
      caption: kmMsg.caption,
      media_type: kmMsg.mediaType,
      media_url: kmMsg.mediaUrl,
      button: params.type === 'text_shop_now'
        ? { label: '🛍️ Shop Now', url: getStoreUrl() }
        : params.button,
    },
  };
}

export class BroadcastService {
  /**
   * Fetch all registered customer Telegram IDs from database / DataStore
   */
  static async getAllTargetTelegramIds(): Promise<number[]> {
    const idSet = new Set<number>();

    // 1. From in-memory repository
    const localUsers = DataStore.getAllRegisteredUsers();
    for (const u of localUsers) {
      if (u.telegram_id && !u.is_bot && !u.is_blocked) {
        idSet.add(u.telegram_id);
      }
    }

    // 2. From Postgres / Supabase users table if connected
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('telegram_id, is_blocked')
          .eq('is_blocked', false);

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            if (row.telegram_id) {
              idSet.add(Number(row.telegram_id));
            }
          }
        }
      } catch (err: any) {
        console.warn('[BROADCAST] Failed to fetch users from Supabase, using DataStore:', err.message);
      }
    }

    return Array.from(idSet);
  }

  /**
   * Broadcast New Stock Arrival to all registered users with strict rate-limiting (max 25 msgs/sec)
   */
  static async broadcastStockArrival(
    params: BroadcastStockArrivalParams
  ): Promise<BroadcastResult> {
    const { title, stockCount, price, productId, messageText } = params;

    const defaultBody =
      `🔥 <b>NEW STOCK ARRIVAL — UCHIRO STORE</b>\n\n` +
      `📦 <b>${title}</b>\n` +
      `⚡ Available Units: <b>${stockCount}</b>\n` +
      `💵 Price: <b>$${Number(price).toFixed(2)} USD</b>\n\n` +
      `Tap below to secure yours instantly before it sells out!`;

    const fullMessage = messageText ? `${messageText}\n\n${defaultBody}` : defaultBody;

    const publicUrl = (
      process.env.PUBLIC_URL ||
      env.PUBLIC_URL ||
      env.STORE_WEBAPP_URL ||
      env.CLIENT_STORE_URL ||
      'http://localhost:3000'
    ).trim();
    const deepLinkUrl = `${publicUrl.replace(/\/+$/, '')}?product=${productId}`;

    const button = createWebAppOrUrlButton(`⚡ Buy Now ($${Number(price).toFixed(2)})`, deepLinkUrl);
    const replyMarkup = {
      inline_keyboard: [[button]],
    };

    const recipientIds = await this.getAllTargetTelegramIds();
    let sent = 0;
    let failed = 0;

    // Rate-limiting engine: Dispatch concurrently in batches of max 25 messages per second
    for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
      const batch = recipientIds.slice(i, i + BATCH_SIZE);

      const outcomes = await Promise.allSettled(
        batch.map((tgId) =>
          NotificationService.sendStoreBotMessage(tgId, fullMessage, replyMarkup)
        )
      );

      for (const res of outcomes) {
        if (res.status === 'fulfilled' && res.value === true) {
          sent++;
        } else {
          failed++;
        }
      }

      // Wait 1050ms before dispatching next batch to respect Telegram 429 threshold
      if (i + BATCH_SIZE < recipientIds.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return {
      total: recipientIds.length,
      sent,
      failed,
      productId,
    };
  }

  // ── Unified Broadcast Center API ────────────────────────────────────────────

  /** Create a campaign record (does not send). Returns { campaign, preview }. */
  static async createCampaign(
    adminId: string | number,
    params: CreateBroadcastParams,
    idempotencyKey?: string
  ): Promise<{ campaign: BroadcastCampaign; preview: BroadcastPreview }> {
    const key = idempotencyKey || params.idempotency_key;

    // Idempotency guard: return existing if same key already exists
    if (key) {
      const existing = DataStore.getBroadcastByIdempotencyKey(key);
      if (existing) {
        const previewData = await previewBroadcast(params);
        return { campaign: existing, preview: previewData };
      }
    }

    const validation = validateBroadcastParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid broadcast parameters: ${validation.errors.join('; ')}`);
    }

    const recipients = await resolveRecipients(params.audience || 'all');

    const campaign: BroadcastCampaign = {
      id: uuidv4(),
      type: params.type,
      audience: params.audience || 'all',
      text: params.text,
      text_km: params.text_km,
      text_en: params.text_en,
      media_type: params.media_type,
      media_url: params.media_url,
      button: params.button,
      status: 'draft',
      created_at: new Date().toISOString(),
      created_by_admin: String(adminId),
      idempotency_key: key,
      target_count: recipients.length,
      sent_count: 0,
      failed_count: 0,
      blocked_count: 0,
      skipped_count: 0,
    };

    DataStore.saveBroadcastCampaign(campaign);
    DataStore.logAdminAction(Number(adminId) || 0, 'BROADCAST_CREATED', {
      id: campaign.id,
      type: campaign.type,
      audience: campaign.audience,
    });

    const preview = await previewBroadcast(params);
    return { campaign, preview };
  }

  /** Confirm and start delivery. Only acts on status === 'draft'. Background execution. */
  static async confirmAndDispatch(
    adminId: string | number,
    campaignId: string
  ): Promise<BroadcastCampaign> {
    const campaign = DataStore.getBroadcastCampaign(campaignId);
    if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
    if (campaign.status !== 'draft') {
      // Already dispatched or running — return current state (idempotent)
      return campaign;
    }

    // Transition to pending immediately (prevents duplicate confirms)
    const updated = DataStore.updateBroadcastCampaign(campaignId, { status: 'pending' });
    if (!updated) throw new Error('CAMPAIGN_NOT_FOUND');

    DataStore.logAdminAction(Number(adminId) || 0, 'BROADCAST_DISPATCHED', {
      id: campaignId,
      type: campaign.type,
    });

    // Fire-and-forget delivery — does not block the HTTP response
    setImmediate(() => {
      executeBroadcastDelivery(campaignId).catch((err) => {
        console.error(`[BROADCAST] Unhandled error for campaign ${campaignId}:`, err);
      });
    });

    return { ...updated, status: 'pending' };
  }

  /** Cancel a draft campaign */
  static cancelCampaign(adminId: string | number, campaignId: string): BroadcastCampaign {
    const campaign = DataStore.getBroadcastCampaign(campaignId);
    if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
    if (campaign.status !== 'draft') {
      throw new Error(`Cannot cancel campaign in state: ${campaign.status}`);
    }
    const updated = DataStore.updateBroadcastCampaign(campaignId, { status: 'cancelled' });
    DataStore.logAdminAction(Number(adminId) || 0, 'BROADCAST_CANCELLED', { id: campaignId });
    return updated!;
  }

  /** Retrieve all campaigns (most recent first) */
  static listCampaigns(): BroadcastCampaign[] {
    return DataStore.getAllBroadcastCampaigns();
  }

  /** Retrieve one campaign by id */
  static getCampaign(campaignId: string): BroadcastCampaign | null {
    return DataStore.getBroadcastCampaign(campaignId);
  }

  /** Preview only – never dispatches */
  static async preview(params: CreateBroadcastParams): Promise<BroadcastPreview> {
    const validation = validateBroadcastParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid broadcast parameters: ${validation.errors.join('; ')}`);
    }
    return previewBroadcast(params);
  }
}
