import { env } from '../config/env';
import { DataStore } from '../database/data-store';
import { isSupabaseConfigured, supabase } from '../database/supabase';
import { NotificationService } from './notification.service';
import { createWebAppOrUrlButton } from '../bots/store-bot';

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
    if (isSupabaseConfigured) {
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

    // Deep link targeting ?product=productId
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
    const BATCH_SIZE = 25;
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
        await new Promise((resolve) => setTimeout(resolve, 1050));
      }
    }

    return {
      total: recipientIds.length,
      sent,
      failed,
      productId,
    };
  }
}
