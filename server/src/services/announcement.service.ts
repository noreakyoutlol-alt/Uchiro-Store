import { pgPool, isPostgresConfigured } from '../database/postgres';
import { tgEmoji } from '../config/telegram-emojis';
import { env } from '../config/env';
import { Markup } from 'telegraf';
import { v4 as uuidv4 } from 'uuid';

export type AnnouncementEventType = 'new_product' | 'restock' | 'order_success' | 'stock_update' | 'sold_out';

export interface AnnouncementSettings {
  target_chat_id: string;
  enabled_events: {
    new_product: boolean;
    restock: boolean;
    order_success: boolean;
    stock_update: boolean;
    sold_out: boolean;
  };
  show_exact_stock: boolean;
}

export interface GroupAnnouncementRecord {
  id: string;
  chat_id: string;
  telegram_message_id?: number | null;
  event_type: AnnouncementEventType;
  event_id: string;
  announcement_state: 'published' | 'edited' | 'failed' | 'dismissed';
  metadata: Record<string, any>;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export class AnnouncementService {
  private static memSettings: AnnouncementSettings = {
    target_chat_id: process.env.TELEGRAM_ANNOUNCEMENT_GROUP_ID || '',
    enabled_events: {
      new_product: true,
      restock: true,
      order_success: true,
      stock_update: true,
      sold_out: true,
    },
    show_exact_stock: true,
  };

  private static memAnnouncements = new Map<string, GroupAnnouncementRecord>();

  /**
   * Reset in-memory state for unit testing
   */
  static _resetForTesting(): void {
    this.memAnnouncements.clear();
    this.memSettings = {
      target_chat_id: '',
      enabled_events: {
        new_product: true,
        restock: true,
        order_success: true,
        stock_update: true,
        sold_out: true,
      },
      show_exact_stock: true,
    };
  }

  /**
   * Mask buyer name for privacy (e.g. "Nor####", "user****")
   */
  static maskBuyerName(rawName?: string): string {
    if (!rawName) return 'Customer####';
    const clean = rawName.replace(/^@/, '').trim();
    if (clean.length <= 3) {
      return `${clean[0] || 'C'}###`;
    }
    const prefix = clean.slice(0, 3);
    return `${prefix}####`;
  }

  /**
   * Get Announcement Settings
   */
  static async getSettings(): Promise<AnnouncementSettings> {
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT value FROM settings WHERE key = 'announcement_settings' LIMIT 1`
        );
        if (rows.length > 0 && rows[0].value) {
          const val = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
          return { ...this.memSettings, ...val };
        }
      } catch (err: any) {
        console.warn('[AnnouncementService] Failed to fetch settings from DB:', err?.message);
      }
    }
    return { ...this.memSettings };
  }

  /**
   * Update Announcement Settings
   */
  static async updateSettings(settings: Partial<AnnouncementSettings>): Promise<AnnouncementSettings> {
    this.memSettings = {
      ...this.memSettings,
      ...settings,
      enabled_events: {
        ...this.memSettings.enabled_events,
        ...(settings.enabled_events || {}),
      },
    };

    if (isPostgresConfigured()) {
      try {
        await pgPool.query(
          `INSERT INTO settings (key, value, updated_at)
           VALUES ('announcement_settings', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [JSON.stringify(this.memSettings)]
        );
      } catch (err: any) {
        console.warn('[AnnouncementService] Failed to persist settings to DB:', err?.message);
      }
    }

    return { ...this.memSettings };
  }

  /**
   * Build Buy Here Telegram deep-link URL opening the store bot
   */
  static getBuyHereUrl(productId?: string): string {
    const botUser = (process.env.STORE_BOT_USERNAME || env.STORE_BOT_USERNAME || 'UchiroStore_BOT').replace(/^@/, '');
    if (productId) {
      return `https://t.me/${botUser}?start=prod_${productId}`;
    }
    return `https://t.me/${botUser}?start=shop`;
  }

  /**
   * Build message text and inline keyboard for an announcement
   */
  static formatAnnouncement(
    eventType: AnnouncementEventType,
    data: {
      productTitle?: string;
      productId?: string;
      priceUsd?: number;
      stockCount?: number;
      buyerName?: string;
      orderCode?: string;
    }
  ): { text: string; keyboard: any } {
    const fire = tgEmoji('FIRE', '🔥');
    const lightning = tgEmoji('LIGHTNING', '⚡');
    const pkg = tgEmoji('PACKAGE', '📦');
    const check = tgEmoji('CHECK', '✅');
    const alert = tgEmoji('ALERT', '⚠️');
    const buyUrl = this.getBuyHereUrl(data.productId);

    let text = '';
    const buyButtonLabel = '🛍️ Buy Here / ទិញទីនេះ';

    switch (eventType) {
      case 'new_product':
        text =
          `${fire} <b>NEW ARRIVAL / ទំនិញទើបមកដល់ថ្មី!</b>\n\n` +
          `${pkg} <b>Product:</b> ${data.productTitle || 'Exclusive Gaming Account'}\n` +
          `${lightning} <b>Price:</b> $${(data.priceUsd ?? 0).toFixed(2)}\n` +
          `📦 <b>Stock:</b> ${data.stockCount ?? 1} available\n\n` +
          `<i>Instant auto-delivery 24/7 via Uchiro Store Bot.</i>`;
        break;

      case 'restock':
        text =
          `${lightning} <b>RESTOCKED / បានបំពេញស្តុកថ្មី!</b>\n\n` +
          `${pkg} <b>Product:</b> ${data.productTitle}\n` +
          `📦 <b>Available Now:</b> ${data.stockCount ?? 1} in stock\n` +
          `${lightning} <b>Price:</b> $${(data.priceUsd ?? 0).toFixed(2)}\n\n` +
          `<i>Grab yours before it sells out!</i>`;
        break;

      case 'order_success':
        text =
          `${check} <b>NEW PURCHASE / ការបញ្ជាទិញជោគជ័យ!</b>\n\n` +
          `👤 <b>Customer:</b> ${this.maskBuyerName(data.buyerName)}\n` +
          `${pkg} <b>Item:</b> ${data.productTitle || 'Gaming Item'}\n` +
          `🧾 <b>Status:</b> Verified & Delivered ${check}\n\n` +
          `<i>Thank you for trusting Uchiro Store!</i>`;
        break;

      case 'stock_update':
        text =
          `🔄 <b>STOCK UPDATE / ព័ត៌មានស្តុក</b>\n\n` +
          `${pkg} <b>Product:</b> ${data.productTitle}\n` +
          `📦 <b>Remaining:</b> ${data.stockCount ?? 0} available\n` +
          `${lightning} <b>Price:</b> $${(data.priceUsd ?? 0).toFixed(2)}`;
        break;

      case 'sold_out':
        text =
          `${alert} <b>SOLD OUT / អស់ពីស្តុកហើយ!</b>\n\n` +
          `${pkg} <b>Product:</b> ${data.productTitle}\n` +
          `❌ <i>This item is currently sold out. Stay tuned for the next restock announcement!</i>`;
        break;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(buyButtonLabel, buyUrl)],
    ]);

    return { text, keyboard };
  }

  /**
   * Publish an announcement to the target group via the Store Bot or Admin Bot
   */
  static async publishAnnouncement(
    botInstance: any,
    eventType: AnnouncementEventType,
    eventId: string,
    data: {
      productTitle?: string;
      productId?: string;
      priceUsd?: number;
      stockCount?: number;
      buyerName?: string;
      orderCode?: string;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const settings = await this.getSettings();

    // Verify event is enabled in settings
    if (!settings.enabled_events[eventType]) {
      return { success: false, error: 'EVENT_TYPE_DISABLED' };
    }

    const chatId = settings.target_chat_id;
    if (!chatId) {
      return { success: false, error: 'NO_TARGET_CHAT_ID' };
    }

    // Check duplicate event_id in database / memory
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT id, telegram_message_id FROM group_announcements WHERE event_id = $1 LIMIT 1`,
          [eventId]
        );
        if (rows.length > 0) {
          return { success: true, messageId: rows[0].telegram_message_id, error: 'ALREADY_ANNOUNCED' };
        }
      } catch (err: any) {
        console.warn('[AnnouncementService] DB deduplication check warning:', err?.message);
      }
    } else if (this.memAnnouncements.has(eventId)) {
      const existing = this.memAnnouncements.get(eventId)!;
      return { success: true, messageId: existing.telegram_message_id || undefined, error: 'ALREADY_ANNOUNCED' };
    }

    const { text, keyboard } = this.formatAnnouncement(eventType, data);

    try {
      let sentMsg: any = null;
      if (botInstance && typeof botInstance.telegram?.sendMessage === 'function') {
        sentMsg = await botInstance.telegram.sendMessage(chatId, text, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }

      const telegramMessageId = sentMsg?.message_id || null;
      const record: GroupAnnouncementRecord = {
        id: uuidv4(),
        chat_id: chatId,
        telegram_message_id: telegramMessageId,
        event_type: eventType,
        event_id: eventId,
        announcement_state: 'published',
        metadata: data,
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isPostgresConfigured()) {
        try {
          await pgPool.query(
            `INSERT INTO group_announcements (id, chat_id, telegram_message_id, event_type, event_id, announcement_state, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             ON CONFLICT (event_id) DO NOTHING`,
            [
              record.id,
              record.chat_id,
              record.telegram_message_id,
              record.event_type,
              record.event_id,
              record.announcement_state,
              JSON.stringify(record.metadata),
            ]
          );
        } catch (err: any) {
          console.warn('[AnnouncementService] Failed to record announcement to PostgreSQL:', err?.message);
        }
      }

      this.memAnnouncements.set(eventId, record);
      return { success: true, messageId: telegramMessageId };
    } catch (err: any) {
      console.error('[AnnouncementService] Failed to send announcement to group:', err?.message);
      return { success: false, error: err?.message || 'SEND_FAILED' };
    }
  }

  /**
   * Edit an existing stock announcement when inventory changes
   */
  static async updateProductStockAnnouncement(
    botInstance: any,
    productId: string,
    productTitle: string,
    newStock: number,
    priceUsd: number
  ): Promise<boolean> {
    const isSoldOut = newStock <= 0;
    const eventType: AnnouncementEventType = isSoldOut ? 'sold_out' : 'stock_update';
    const eventId = `stock-update-${productId}-${Date.now()}`;

    // Look for previous announcement message for this product
    let prevMsgId: number | null = null;
    let targetChatId = '';

    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT chat_id, telegram_message_id FROM group_announcements
           WHERE metadata->>'productId' = $1 AND telegram_message_id IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [productId]
        );
        if (rows.length > 0) {
          prevMsgId = rows[0].telegram_message_id;
          targetChatId = rows[0].chat_id;
        }
      } catch (err) {}
    }

    if (prevMsgId && targetChatId && botInstance?.telegram?.editMessageText) {
      try {
        const { text, keyboard } = this.formatAnnouncement(eventType, {
          productId,
          productTitle,
          stockCount: newStock,
          priceUsd,
        });

        await botInstance.telegram.editMessageText(targetChatId, prevMsgId, undefined, text, {
          parse_mode: 'HTML',
          ...keyboard,
        });
        return true;
      } catch (editErr: any) {
        console.warn('[AnnouncementService] Could not edit message, will post new one:', editErr?.message);
      }
    }

    // If edit not possible, publish new status announcement
    const pubRes = await this.publishAnnouncement(botInstance, eventType, eventId, {
      productId,
      productTitle,
      stockCount: newStock,
      priceUsd,
    });
    return pubRes.success;
  }
}
