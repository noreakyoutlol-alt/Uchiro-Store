import axios from 'axios';
import { env } from '../config/env';
import { formatTelegramHtml } from '../bots/store-bot';
import { formatShortOrderId } from '../utils/order.util';

export class NotificationService {
  private static getStoreBotToken(): string {
    return env.STORE_BOT_TOKEN || '';
  }

  private static getAdminBotToken(): string {
    return env.ADMIN_BOT_TOKEN || '';
  }

  /**
   * Telegram strictly requires https:// for inline keyboard web_app buttons.
   * If target URL does not start with https://:
   * - If PUBLIC_URL starts with https://, use PUBLIC_URL instead.
   * - Otherwise fallback to standard link button ({ url: targetUrl }).
   */
  private static createSafeButton(text: string, targetUrl: string): { text: string; web_app?: { url: string }; url?: string } {
    const publicUrl = (process.env.PUBLIC_URL || env.PUBLIC_URL || '').trim();

    if (targetUrl.startsWith('https://')) {
      return { text, web_app: { url: targetUrl } };
    }

    if (publicUrl.startsWith('https://')) {
      let resolvedUrl = publicUrl;
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        if (pathAndQuery) {
          resolvedUrl = `${publicUrl.replace(/\/+$/, '')}${pathAndQuery}`;
        }
      } catch {
        resolvedUrl = publicUrl;
      }
      return { text, web_app: { url: resolvedUrl } };
    }

    return { text, url: targetUrl };
  }

  // ================= STORE BOT (CUSTOMERS ONLY) =================
  static async sendStoreBotMessage(
    telegramId: number,
    message: string,
    replyMarkup?: any
  ): Promise<boolean> {
    const token = this.getStoreBotToken();
    if (!token) {
      console.log(`[STORE BOT to ${telegramId}]:\n${message}`);
      return true;
    }

    try {
      await axios.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: telegramId,
          text: formatTelegramHtml(message),
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        },
        { timeout: 5000 }
      );
      return true;
    } catch (err: any) {
      console.warn(`[STORE BOT] Failed to send message to ${telegramId}:`, err.message);
      return false;
    }
  }

  static async notifyOrderCreated(
    telegramId: number,
    orderNumber: string,
    productTitle: string,
    amount: number
  ): Promise<void> {
    const text = `🛒 <b>ORDER CREATED</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)}\n` +
      `<b>Status:</b> Waiting for payment\n\n` +
      `Please complete your KHQR payment to receive your items.`;

    const webAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';
    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('🛒 VIEW ORDER', `${webAppUrl}?order=${orderNumber}`),
        ],
      ],
    });
  }

  static async notifyPaymentReceipt(
    telegramId: number,
    orderNumber: string,
    productTitle: string,
    amount: number,
    deliveryStatus: string,
    warrantyDuration: string
  ): Promise<void> {
    const text = `✅ <b>PAYMENT CONFIRMED — UCHIRO STORE</b>\n\n` +
      `<b>Order ID:</b> #${orderNumber}\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)} USD\n` +
      `<b>Delivery Status:</b> ${deliveryStatus.toUpperCase()}\n` +
      `<b>Warranty:</b> ${warrantyDuration}\n\n` +
      `Thank you for your purchase! Tap below to view your official receipt or open your secure delivery.`;

    const webAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';
    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('🧾 View Receipt', `${webAppUrl}?order=${orderNumber}&view=receipt`),
          this.createSafeButton('🔐 Open Delivery', `${webAppUrl}?order=${orderNumber}&view=delivery`),
        ],
      ],
    });
  }

  static async notifyPaymentSuccess(
    telegramId: number,
    orderNumber: string,
    amount: number
  ): Promise<void> {
    const text = `✅ <b>PAYMENT SUCCESS</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)}\n\n` +
      `Your payment has been verified!\n` +
      `Delivery is being processed immediately.`;

    const webAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';
    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('📦 VIEW ORDER', `${webAppUrl}?order=${orderNumber}`),
        ],
      ],
    });
  }

  static async notifyOrderDelivered(
    telegramId: number,
    orderNumber: string,
    productTitle: string,
    _credentialsSummary?: string
  ): Promise<void> {
    const text = `🎉 <b>ORDER DELIVERED — UCHIRO STORE</b>\n\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Order:</b> #${orderNumber}\n\n` +
      `Your purchase has been verified and securely fulfilled with full 14-day warranty protection.\n` +
      `Tap below to open your secure vault, view credentials, and generate live authenticator codes:`;

    const webAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';
    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('🔐 OPEN SECURE DELIVERY', `${webAppUrl}?order=${orderNumber}`),
        ],
      ],
    });
  }

  static async notifyManualProcessing(
    telegramId: number,
    orderNumber: string
  ): Promise<void> {
    const text = `🔧 <b>ORDER PROCESSING</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n\n` +
      `Payment received! Your delivery is being prepared by our team.\n` +
      `We will notify you here as soon as it is delivered.`;

    const webAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';
    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('🔍 TRACK STATUS', `${webAppUrl}?order=${orderNumber}`),
        ],
      ],
    });
  }

  // ================= ADMIN BOT (REAL TRANSACTIONS ONLY — ZERO FAKES) =================
  static async sendAdminBotAlert(message: string, replyMarkup?: any): Promise<void> {
    const adminIds = env.ADMIN_TELEGRAM_USER_IDS;
    if (adminIds.length === 0) return;

    const token = this.getAdminBotToken();
    if (!token) {
      console.log(`[ADMIN BOT ALERT]:\n${message}`);
      return;
    }

    const formatted = formatTelegramHtml(message);

    for (const adminId of adminIds) {
      try {
        await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            chat_id: adminId,
            text: formatted,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
          { timeout: 5000 }
        );
      } catch (err: any) {
        console.warn(`[ADMIN BOT] Failed to alert admin ${adminId}:`, err.message);
      }
    }
  }

  /**
   * 🚨 REAL ORDER PAID: Real Postgres / database transaction alert
   */
  static async alertAdminRealOrderPaid(
    orderId: string,
    itemTitle: string,
    amountUsd: number,
    customerTelegramId: number
  ): Promise<void> {
    const text =
      `🚨 <b>REAL ORDER PAID</b>\n\n` +
      `🆔 <b>Order:</b> <code>${formatShortOrderId(orderId)}</code>\n` +
      `📦 <b>Item:</b> <b>${itemTitle}</b>\n` +
      `💵 <b>Amount:</b> <b>$${amountUsd.toFixed(2)} USD</b>\n` +
      `👤 <b>Customer TG ID:</b> <code>${customerTelegramId}</code>\n\n` +
      `Verified real transaction.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🛡️ OPEN ADMIN PORTAL', `${adminWebUrl}/orders?order=${orderId}`),
        ],
      ],
    });
  }

  /**
   * 🎁 ROBLOX GIFT CLAIM: User Roblox Name + Profile Link awaiting admin friending
   */
  static async alertAdminRobloxGiftClaim(
    robloxUsername: string,
    robloxUserId?: string | number | null,
    extra?: { orderId?: string; itemTitle?: string; telegramId?: number; amount?: number }
  ): Promise<void> {
    const profileUrl = robloxUserId
      ? `https://www.roblox.com/users/${robloxUserId}/profile`
      : `https://www.roblox.com/search/users?keyword=${encodeURIComponent(robloxUsername)}`;

    const text =
      `🎁 <b>ROBLOX GIFT CLAIM</b>\n\n` +
      `👤 <b>Roblox Name:</b> <code>${robloxUsername}</code>\n` +
      `🔗 <b>Profile Link:</b> <a href="${profileUrl}">${profileUrl}</a>\n` +
      (extra?.itemTitle ? `📦 <b>Item:</b> <b>${extra.itemTitle}</b>\n` : '') +
      (extra?.amount !== undefined ? `💵 <b>Paid:</b> $${extra.amount.toFixed(2)} USD\n` : '') +
      (extra?.orderId ? `🆔 <b>Order:</b> <code>${formatShortOrderId(extra.orderId)}</code>\n` : '') +
      (extra?.telegramId ? `📱 <b>Customer TG ID:</b> <code>${extra.telegramId}</code>\n` : '') +
      `\n⚠️ <b>Awaiting admin friending on Roblox to deliver gift!</b>`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          { text: '👤 Friend on Roblox', url: profileUrl },
          this.createSafeButton('🛡️ ADMIN PORTAL', `${adminWebUrl}/orders`),
        ],
      ],
    });
  }

  /**
   * 🤝 TRADE CLAIM: Customer awaiting trade rendezvous
   */
  static async alertAdminTradeClaim(
    robloxUsername: string,
    extra?: { orderId?: string; itemTitle?: string; telegramId?: number; rendezvousDetails?: string }
  ): Promise<void> {
    const text =
      `🤝 <b>TRADE CLAIM</b>\n\n` +
      `👤 <b>Roblox Name:</b> <code>${robloxUsername}</code>\n` +
      (extra?.telegramId ? `📱 <b>Customer TG ID:</b> <code>${extra.telegramId}</code>\n` : '') +
      (extra?.itemTitle ? `📦 <b>Item to Trade:</b> <b>${extra.itemTitle}</b>\n` : '') +
      (extra?.orderId ? `🆔 <b>Order:</b> <code>${formatShortOrderId(extra.orderId)}</code>\n` : '') +
      (extra?.rendezvousDetails ? `📍 <b>Rendezvous:</b> ${extra.rendezvousDetails}\n` : '') +
      `\n⚠️ <b>Customer is awaiting trade rendezvous in-game.</b>`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🛡️ OPEN ADMIN PORTAL', `${adminWebUrl}/orders`),
        ],
      ],
    });
  }

  static async alertAdminNewOrder(
    orderNumber: string,
    productTitle: string,
    amount: number,
    deliveryMode: string
  ): Promise<void> {
    const text = `🛒 <b>NEW ORDER CREATED</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)}\n` +
      `<b>Mode:</b> <code>${deliveryMode}</code>`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🛡️ OPEN ADMIN ORDERS', `${adminWebUrl}/orders`),
        ],
      ],
    });
  }

  static async alertAdminManualFulfillmentRequired(
    orderNumber: string,
    productTitle: string,
    robloxUsername?: string | null,
    extraInfo?: {
      orderId?: string;
      category?: string;
      amount?: number;
      telegramId?: number;
      telegramUsername?: string;
      robloxDisplayName?: string;
      robloxUserId?: number | string;
      timestamp?: string;
      status?: string;
    }
  ): Promise<void> {
    const text = `🎁 <b>ACTION REQUIRED: ADMIN MANUAL GIFT/TRADE DELIVERY</b>\n\n` +
      `<b>Order:</b> <code>${formatShortOrderId(orderNumber)}</code>\n` +
      (extraInfo?.orderId ? `🆔 <b>Order:</b> <code>${formatShortOrderId(extraInfo.orderId)}</code>\n` : '') +
      `<b>Product Name:</b> <b>${productTitle}</b>\n` +
      (extraInfo?.category ? `<b>Category:</b> ${extraInfo.category}\n` : '') +
      (extraInfo?.amount !== undefined ? `<b>Paid Amount:</b> $${extraInfo.amount.toFixed(2)}\n` : '') +
      (extraInfo?.telegramId ? `<b>Customer Telegram ID:</b> <code>${extraInfo.telegramId}</code>\n` : '') +
      (extraInfo?.telegramUsername ? `<b>Telegram Username:</b> @${extraInfo.telegramUsername}\n` : '') +
      (robloxUsername ? `<b>Roblox Username:</b> <code>@${robloxUsername}</code>\n` : '') +
      (extraInfo?.robloxDisplayName ? `<b>Roblox Display Name:</b> ${extraInfo.robloxDisplayName}\n` : '') +
      (extraInfo?.robloxUserId ? `<b>Roblox User ID:</b> <code>${extraInfo.robloxUserId}</code>\n` : '') +
      `<b>Order Status:</b> <code>${extraInfo?.status || 'awaiting_fulfillment'}</code>\n` +
      `<b>Timestamp:</b> ${extraInfo?.timestamp || new Date().toISOString()}\n\n` +
      `⚠️ <b>Customer has paid.</b> Admin must manually gift/trade the item to the verified Roblox recipient in-game, then mark this order as fulfilled.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📦 OPEN ORDER IN ADMIN PANEL', `${adminWebUrl}/orders?order=${orderNumber}`),
        ],
      ],
    });
  }

  static async alertAdminMythicalGachaWin(
    telegramId: number,
    prizeTitle: string
  ): Promise<void> {
    const text = `🔥 <b>MYTHICAL GACHA WIN!</b>\n\n` +
      `Customer Telegram ID: <code>${telegramId}</code>\n` +
      `Prize: <b>${prizeTitle}</b>\n` +
      `Status: Pending manual claim review.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🎁 VIEW CLAIMS', `${adminWebUrl}/claims`),
        ],
      ],
    });
  }

  static async alertAdminManualServiceGachaWin(
    telegramId: number,
    prizeTitle: string,
    claimId: string
  ): Promise<void> {
    const text = `🎮 <b>GACHA WIN: MANUAL SERVICE REQUIRED</b>\n\n` +
      `<b>Prize:</b> <b>${prizeTitle}</b>\n` +
      `<b>Customer Telegram ID:</b> <code>${telegramId}</code>\n` +
      `<b>Claim ID:</b> <code>${claimId}</code>\n` +
      `<b>Verification:</b> Roblox recipient verification required.\n` +
      `Please verify user credentials in Roblox before manual service fulfillment.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🎁 VIEW CLAIM', `${adminWebUrl}/claims?claim=${claimId}`),
        ],
      ],
    });
  }

  static async alertAdminTradeItemGachaWin(
    telegramId: number,
    prizeTitle: string,
    claimId: string,
    tradeId?: string
  ): Promise<void> {
    const text = `🎁 <b>GACHA WIN: TRADE DISPATCH ALERT</b>\n\n` +
      `<b>Prize:</b> <b>${prizeTitle}</b>\n` +
      `<b>Customer Telegram ID:</b> <code>${telegramId}</code>\n` +
      `<b>Claim ID:</b> <code>${claimId}</code>\n` +
      `<b>Claim ID:</b> <code>${claimId}</code>\n` +
      (tradeId ? `<b>Trade ID:</b> <code>${tradeId}</code>\n` : '') +
      `<b>Action:</b> In-game item trade required. Initiate trade dispatch to player.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🎁 VIEW CLAIMS', `${adminWebUrl}/claims?claim=${claimId}`),
        ],
      ],
    });
  }

  static async alertAdminLowStock(productTitle: string, remaining: number): Promise<void> {
    const text = `⚠️ <b>LOW STOCK ALERT</b>\n\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Remaining Stock:</b> ${remaining} items remaining!\n` +
      `Please check inventory to avoid stockouts.`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📦 MANAGE INVENTORY', `${adminWebUrl}/inventory`),
        ],
      ],
    });
  }

  static async alertAdminThreeOrderBatch(batchNumber: number, orderCount: number, draftId: string): Promise<void> {
    const text = `🔔 <b>3-ORDER BATCH NOTIFICATION READY</b>\n\n` +
      `<b>Batch:</b> #${batchNumber}\n` +
      `<b>Orders Fulfilled:</b> ${orderCount} new orders completed.\n\n` +
      `📈 A high-volume customer announcement draft has been prepared.\n` +
      `Review low stock inventory or broadcast this announcement:`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📝 REVIEW DRAFT', `${adminWebUrl}/broadcast`),
        ],
        [
          {
            text: '📢 BROADCAST TO CUSTOMERS',
            callback_data: `broadcast_draft:${draftId}`,
          },
          {
            text: '❌ DISMISS',
            callback_data: `dismiss_draft:${draftId}`,
          },
        ],
      ],
    });
  }

  static async alertAdminNewStock(productTitle: string, addedStock: number, totalStock: number): Promise<void> {
    const text = `🟢 <b>NEW STOCK ADDED</b>\n\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Added:</b> +${addedStock} units\n` +
      `<b>Total In Stock:</b> ${totalStock} units\n\n` +
      `Would you like to broadcast a restock alert to customers?`;

    const adminWebUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';
    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📢 CREATE RESTOCK BROADCAST', `${adminWebUrl}/broadcast`),
        ],
      ],
    });
  }

  static async broadcastToAllCustomers(
    title: string,
    message: string,
    ctaUrl?: string,
    customerTelegramIds?: number[]
  ): Promise<{ sent: number; failed: number }> {
    const targetIds = customerTelegramIds && customerTelegramIds.length > 0
      ? customerTelegramIds
      : [123456789]; // default test pool

    let sent = 0;
    let failed = 0;

    const formatted = `📢 <b>${title}</b>\n\n${message}`;
    const markup = ctaUrl
      ? {
          inline_keyboard: [
            [
              this.createSafeButton('🚀 OPEN STORE', ctaUrl),
            ],
          ],
        }
      : undefined;

    for (const tgId of targetIds) {
      try {
        await this.sendStoreBotMessage(tgId, formatted, markup);
        sent += 1;
      } catch {
        failed += 1;
      }
    }

    return { sent, failed };
  }
}
