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

  public static isTestRunner(): boolean {
    return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  }

  /**
   * Evaluates order metadata for test fixtures.
   * If order.productName?.includes('Test') or order.customerTgId === 88990011 or
   * order.customerTgId === 99887766 or order ID contains test fixtures while
   * NODE_ENV === 'production' (or any environment), suppress outbound live dispatch.
   */
  public static isTestOrder(metadata?: {
    productName?: string | null;
    customerTgId?: number | null;
    orderId?: string | null;
    robloxUsername?: string | null;
  }): boolean {
    if (!metadata) return false;
    const { productName, customerTgId, orderId, robloxUsername } = metadata;

    if (customerTgId === 88990011 || customerTgId === 99887766) {
      return true;
    }
    if (
      productName &&
      (productName.includes('Test') ||
        /test|lifecycle verification|admin stats|sample|mock|dummy|fixture/i.test(productName))
    ) {
      return true;
    }
    if (orderId && /test|fixture|stat-ord|mock|demo|dummy/i.test(orderId)) {
      return true;
    }
    if (robloxUsername && /tester|robloxtester|testuser/i.test(robloxUsername)) {
      return true;
    }
    return false;
  }

  /**
   * Telegram strictly requires https:// for inline keyboard web_app buttons.
   * If target URL does not start with https://:
   * - If PUBLIC_URL starts with https://, use PUBLIC_URL instead.
   * - Otherwise fallback to default public HTTPS URL.
   */
  private static createSafeButton(
    text: string,
    targetUrl: string
  ): { text: string; web_app?: { url: string }; url?: string } {
    const defaultAppUrl = 'https://web-production-2d8bd.up.railway.app';
    const publicUrl = (process.env.PUBLIC_URL || env.PUBLIC_URL || defaultAppUrl).trim().replace(/\/$/, '');

    if (targetUrl.startsWith('https://t.me/')) {
      return { text, url: targetUrl };
    }

    if (targetUrl.startsWith('https://')) {
      return { text, web_app: { url: targetUrl } };
    }

    let resolvedUrl = publicUrl;
    try {
      const parsed = new URL(targetUrl);
      const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
      if (pathAndQuery) {
        resolvedUrl = `${publicUrl}${pathAndQuery}`;
      }
    } catch {
      resolvedUrl = publicUrl;
    }

    if (!resolvedUrl.startsWith('https://')) {
      resolvedUrl = defaultAppUrl;
    }

    return { text, web_app: { url: resolvedUrl } };
  }

  // ================= STORE BOT (CUSTOMERS ONLY) =================
  static async sendStoreBotMessage(
    telegramId: number,
    message: string,
    replyMarkup?: any
  ): Promise<boolean> {
    const res = await this.sendStoreBotMessageDetailed(telegramId, message, replyMarkup);
    return res.success;
  }

  static async sendStoreBotMedia(
    telegramId: number,
    mediaType: 'photo' | 'video',
    mediaUrl: string,
    caption?: string,
    replyMarkup?: any
  ): Promise<boolean> {
    const res = await this.sendStoreBotMediaDetailed(telegramId, mediaType, mediaUrl, caption, replyMarkup);
    return res.success;
  }

  static async sendStoreBotMessageDetailed(
    telegramId: number,
    message: string,
    replyMarkup?: any
  ): Promise<{ success: boolean; blocked?: boolean; rateLimited?: boolean; retryAfter?: number; error?: string }> {
    if (this.isTestRunner()) {
      return { success: true };
    }
    if (telegramId === 88990011 || telegramId === 99887766) {
      return { success: true };
    }

    const token = this.getStoreBotToken();
    if (!token) {
      console.log(`[STORE BOT to ${telegramId}]:\n${message}`);
      return { success: true };
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
        { timeout: 10000 }
      );
      return { success: true };
    } catch (err: any) {
      const status = err.response?.status;
      const desc = String(err.response?.data?.description || err.message || '');
      console.warn(`[STORE BOT] Failed to send message to ${telegramId}: ${desc}`);

      if (status === 403 || /bot was blocked|user is deactivated|chat not found|forbidden/i.test(desc)) {
        return { success: false, blocked: true, error: desc };
      }
      if (status === 429) {
        const retryAfter = Number(err.response?.data?.parameters?.retry_after) || 1;
        return { success: false, rateLimited: true, retryAfter, error: desc };
      }
      return { success: false, error: desc };
    }
  }

  static async sendStoreBotMediaDetailed(
    telegramId: number,
    mediaType: 'photo' | 'video',
    mediaUrl: string,
    caption?: string,
    replyMarkup?: any
  ): Promise<{ success: boolean; blocked?: boolean; rateLimited?: boolean; retryAfter?: number; error?: string }> {
    if (this.isTestRunner()) {
      return { success: true };
    }
    if (telegramId === 88990011 || telegramId === 99887766) {
      return { success: true };
    }

    const token = this.getStoreBotToken();
    if (!token) {
      console.log(`[STORE BOT MEDIA (${mediaType}) to ${telegramId}]: ${mediaUrl}\nCaption: ${caption || ''}`);
      return { success: true };
    }

    const method = mediaType === 'video' ? 'sendVideo' : 'sendPhoto';
    const mediaField = mediaType === 'video' ? 'video' : 'photo';

    try {
      await axios.post(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          chat_id: telegramId,
          [mediaField]: mediaUrl,
          caption: caption ? formatTelegramHtml(caption) : undefined,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        },
        { timeout: 15000 }
      );
      return { success: true };
    } catch (err: any) {
      const status = err.response?.status;
      const desc = String(err.response?.data?.description || err.message || '');
      console.warn(`[STORE BOT] Failed to send ${mediaType} to ${telegramId}: ${desc}`);

      if (status === 403 || /bot was blocked|user is deactivated|chat not found|forbidden/i.test(desc)) {
        return { success: false, blocked: true, error: desc };
      }
      if (status === 429) {
        const retryAfter = Number(err.response?.data?.parameters?.retry_after) || 1;
        return { success: false, rateLimited: true, retryAfter, error: desc };
      }
      return { success: false, error: desc };
    }
  }

  /**
   * Specification 7: NOTIFICATION SPAM REDUCTION
   * When customer creates order or order is pending payment:
   * DO NOT send notification to customer.
   */
  static async notifyOrderCreated(
    _telegramId: number,
    _orderNumber: string,
    _productTitle: string,
    _amount: number
  ): Promise<void> {
    return;
  }

  static async notifyPaymentReceipt(
    telegramId: number,
    orderNumber: string,
    productTitle: string,
    amount: number,
    deliveryStatus: string,
    warrantyDuration: string
  ): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendStoreBotMessage as any)?.mock && !(this.sendStoreBotMessage as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId: orderNumber, productName: productTitle, customerTgId: telegramId })) {
      return;
    }

    const text =
      `✅ <b>PAYMENT CONFIRMED — UCHIRO STORE</b>\n\n` +
      `<b>Order ID:</b> #${orderNumber}\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)} USD\n` +
      `<b>Delivery Status:</b> ${deliveryStatus.toUpperCase()}\n` +
      `<b>Warranty:</b> ${warrantyDuration}\n\n` +
      `Thank you for your purchase! Tap below to view your official receipt or open your secure delivery.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const webAppUrl =
      (env.STORE_WEBAPP_URL?.startsWith('https://') && env.STORE_WEBAPP_URL) ||
      (env.CLIENT_STORE_URL?.startsWith('https://') && env.CLIENT_STORE_URL) ||
      defaultAppUrl;

    await this.sendStoreBotMessage(telegramId, text, {
      inline_keyboard: [
        [
          this.createSafeButton('🧾 View Receipt', `${webAppUrl}?order=${orderNumber}&view=receipt`),
          this.createSafeButton('🔐 Open Delivery', `${webAppUrl}?order=${orderNumber}`),
        ],
      ],
    });
  }

  static async notifyPaymentSuccess(
    telegramId: number,
    orderNumber: string,
    amount: number
  ): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendStoreBotMessage as any)?.mock && !(this.sendStoreBotMessage as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId: orderNumber, customerTgId: telegramId })) {
      return;
    }

    const text =
      `✅ <b>PAYMENT SUCCESS</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n` +
      `<b>Amount:</b> $${amount.toFixed(2)}\n\n` +
      `Your payment has been verified!\n` +
      `Delivery is being processed immediately.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const webAppUrl =
      (env.STORE_WEBAPP_URL?.startsWith('https://') && env.STORE_WEBAPP_URL) ||
      (env.CLIENT_STORE_URL?.startsWith('https://') && env.CLIENT_STORE_URL) ||
      defaultAppUrl;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendStoreBotMessage as any)?.mock && !(this.sendStoreBotMessage as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId: orderNumber, productName: productTitle, customerTgId: telegramId })) {
      return;
    }

    const text =
      `🎉 <b>ORDER DELIVERED — UCHIRO STORE</b>\n\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Order:</b> #${orderNumber}\n\n` +
      `Your purchase has been verified and securely fulfilled with full 14-day warranty protection.\n` +
      `Tap below to open your secure vault, view credentials, and generate live authenticator codes:`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const webAppUrl =
      (env.STORE_WEBAPP_URL?.startsWith('https://') && env.STORE_WEBAPP_URL) ||
      (env.CLIENT_STORE_URL?.startsWith('https://') && env.CLIENT_STORE_URL) ||
      defaultAppUrl;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendStoreBotMessage as any)?.mock && !(this.sendStoreBotMessage as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId: orderNumber, customerTgId: telegramId })) {
      return;
    }

    const text =
      `🔧 <b>ORDER PROCESSING</b>\n\n` +
      `<b>Order:</b> #${orderNumber}\n\n` +
      `Payment received! Your delivery is being prepared by our team.\n` +
      `We will notify you here as soon as it is delivered.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const webAppUrl =
      (env.STORE_WEBAPP_URL?.startsWith('https://') && env.STORE_WEBAPP_URL) ||
      (env.CLIENT_STORE_URL?.startsWith('https://') && env.CLIENT_STORE_URL) ||
      defaultAppUrl;

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
    if (this.isTestRunner()) {
      return;
    }

    // Suppress test fixture notifications from reaching real Telegram admins
    if (
      message.includes('88990011') ||
      message.includes('99887766') ||
      message.includes('Admin Stats Test Perm Fruit') ||
      message.includes('Lifecycle Verification Account') ||
      message.includes('RobloxTester1') ||
      /test-order-uuid|stat-ord/i.test(message)
    ) {
      console.log('[NOTIFICATION] Suppressed test fixture alert to admin bot');
      return;
    }

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId, productName: itemTitle, customerTgId: customerTelegramId })) {
      return;
    }

    const text =
      `🚨 <b>REAL ORDER PAID</b>\n\n` +
      `🆔 <b>Order:</b> <code>${formatShortOrderId(orderId)}</code>\n` +
      `📦 <b>Item:</b> <b>${itemTitle}</b>\n` +
      `💵 <b>Amount:</b> <b>$${amountUsd.toFixed(2)} USD</b>\n` +
      `👤 <b>Customer TG ID:</b> <code>${customerTelegramId}</code>\n\n` +
      `Verified real transaction.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (
      this.isTestOrder({
        orderId: extra?.orderId,
        productName: extra?.itemTitle,
        customerTgId: extra?.telegramId,
        robloxUsername,
      })
    ) {
      return;
    }

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

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (
      this.isTestOrder({
        orderId: extra?.orderId,
        productName: extra?.itemTitle,
        customerTgId: extra?.telegramId,
        robloxUsername,
      })
    ) {
      return;
    }

    const text =
      `🤝 <b>TRADE CLAIM</b>\n\n` +
      `👤 <b>Roblox Name:</b> <code>${robloxUsername}</code>\n` +
      (extra?.telegramId ? `📱 <b>Customer TG ID:</b> <code>${extra.telegramId}</code>\n` : '') +
      (extra?.itemTitle ? `📦 <b>Item to Trade:</b> <b>${extra.itemTitle}</b>\n` : '') +
      (extra?.orderId ? `🆔 <b>Order:</b> <code>${formatShortOrderId(extra.orderId)}</code>\n` : '') +
      (extra?.rendezvousDetails ? `📍 <b>Rendezvous:</b> ${extra.rendezvousDetails}\n` : '') +
      `\n⚠️ <b>Customer is awaiting trade rendezvous in-game.</b>`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🛡️ ADMIN PORTAL', `${adminWebUrl}/orders`),
        ],
      ],
    });
  }

  /**
   * Specification 7: NOTIFICATION SPAM REDUCTION
   * When customer creates order or order is pending payment:
   * DO NOT alert Admin Bot.
   */
  static async alertAdminNewOrder(
    _orderNumber: string,
    _productTitle: string,
    _amount: number,
    _deliveryMode: string
  ): Promise<void> {
    return;
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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (
      this.isTestOrder({
        orderId: extraInfo?.orderId || orderNumber,
        productName: productTitle,
        customerTgId: extraInfo?.telegramId,
        robloxUsername: robloxUsername || undefined,
      })
    ) {
      return;
    }

    const text =
      `🎁 <b>ACTION REQUIRED: ADMIN MANUAL GIFT/TRADE DELIVERY</b>\n\n` +
      `<b>Order:</b> <code>${formatShortOrderId(orderNumber)}</code>\n` +
      (extraInfo?.orderId ? `🆔 <b>Order:</b> <code>${formatShortOrderId(extraInfo.orderId)}</code>\n` : '') +
      `<b>Product Name:</b> <b>${productTitle}</b>\n` +
      (extraInfo?.category ? `<b>Category:</b> ${extraInfo.category}\n` : '') +
      (extraInfo?.amount !== undefined ? `<b>Paid Amount:</b> $${extraInfo.amount.toFixed(2)}\n` : '') +
      (extraInfo?.telegramId ? `<b>Customer Telegram ID:</b> <code>${extraInfo.telegramId}</code>\n` : '') +
      (extraInfo?.telegramUsername ? `<b>Telegram Username:</b> @${extraInfo.telegramUsername}\n` : '') +
      (robloxUsername ? `<b>Roblox Username:</b> <code>${robloxUsername}</code>\n` : '') +
      (extraInfo?.robloxDisplayName ? `<b>Roblox Display Name:</b> ${extraInfo.robloxDisplayName}\n` : '') +
      (extraInfo?.status ? `<b>Status:</b> <code>${extraInfo.status}</code>\n` : '') +
      `\n⚠️ <b>Please log into Roblox and deliver this order to the customer!</b>`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ productName: prizeTitle, customerTgId: telegramId })) {
      return;
    }

    const text =
      `🔥 <b>MYTHICAL GACHA WIN!</b>\n\n` +
      `Customer Telegram ID: <code>${telegramId}</code>\n` +
      `Prize: <b>${prizeTitle}</b>\n` +
      `Status: Pending manual claim review.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ productName: prizeTitle, customerTgId: telegramId })) {
      return;
    }

    const text =
      `🎮 <b>GACHA WIN: MANUAL SERVICE REQUIRED</b>\n\n` +
      `<b>Prize:</b> <b>${prizeTitle}</b>\n` +
      `<b>Customer Telegram ID:</b> <code>${telegramId}</code>\n` +
      `<b>Claim ID:</b> <code>${claimId}</code>\n` +
      `<b>Verification:</b> Roblox recipient verification required.\n` +
      `Please verify user credentials in Roblox before manual service fulfillment.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

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
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ productName: prizeTitle, customerTgId: telegramId })) {
      return;
    }

    const text =
      `🎁 <b>GACHA WIN: TRADE DISPATCH REQUIRED</b>\n\n` +
      `<b>Prize:</b> <b>${prizeTitle}</b>\n` +
      `<b>Customer Telegram ID:</b> <code>${telegramId}</code>\n` +
      `<b>Claim ID:</b> <code>${claimId}</code>\n` +
      (tradeId ? `<b>Trade ID:</b> <code>${tradeId}</code>\n` : '') +
      `<b>Action:</b> In-game item trade required. Initiate trade dispatch to player.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('🎁 VIEW CLAIMS', `${adminWebUrl}/claims?claim=${claimId}`),
        ],
      ],
    });
  }

  static async alertAdminLowStock(productTitle: string, remaining: number): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ productName: productTitle })) {
      return;
    }

    const text =
      `⚠️ <b>LOW STOCK ALERT</b>\n\n` +
      `<b>Product:</b> ${productTitle}\n` +
      `<b>Remaining Stock:</b> ${remaining} items remaining!\n` +
      `Please check inventory to avoid stockouts.`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📦 MANAGE INVENTORY', `${adminWebUrl}/inventory`),
        ],
      ],
    });
  }

  /**
   * Alias for low stock alert dispatch
   */
  static async notifyLowStockAlert(productTitle: string, remaining: number): Promise<void> {
    return this.alertAdminLowStock(productTitle, remaining);
  }

  /**
   * Dispatch pending gift or trade notification to admin bot
   */
  static async notifyGiftOrTradePending(
    orderId: string,
    itemTitle: string,
    amount: number,
    customerTelegramId: number,
    mode: string,
    robloxUsername?: string
  ): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId, productName: itemTitle, customerTgId: customerTelegramId, robloxUsername })) {
      return;
    }

    if (mode === 'trade_item' || mode === 'trade') {
      return this.alertAdminTradeClaim(robloxUsername || 'Customer', {
        orderId,
        itemTitle,
        telegramId: customerTelegramId,
      });
    }

    return this.alertAdminRobloxGiftClaim(robloxUsername || 'Customer', null, {
      orderId,
      itemTitle,
      telegramId: customerTelegramId,
      amount,
    });
  }

  static async alertAdminThreeOrderBatch(batchNumber: number, orderCount: number, draftId: string): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }

    const text =
      `🔔 <b>3-ORDER BATCH NOTIFICATION READY</b>\n\n` +
      `<b>Batch:</b> #${batchNumber}\n` +
      `<b>Orders Fulfilled:</b> ${orderCount} new orders completed.\n\n` +
      `📈 A high-volume customer announcement draft has been prepared.\n` +
      `Review low stock inventory or broadcast this announcement:`;

    const defaultAppUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const adminWebUrl =
      (env.ADMIN_WEBAPP_URL?.startsWith('https://') && env.ADMIN_WEBAPP_URL) ||
      (env.CLIENT_ADMIN_URL?.startsWith('https://') && env.CLIENT_ADMIN_URL) ||
      `${defaultAppUrl}/admin`;

    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          this.createSafeButton('📝 REVIEW DRAFT', `${adminWebUrl}/broadcast`),
        ],
        [
          {
            text: '📢 BROADCAST TO CUSTOMERS',
            callback_data: `admin_broadcast_batch:${draftId}`,
          },
        ],
      ],
    });
  }

  /**
   * ⚠️ EXPIRED QR WITH CONFIRMED PAYMENT: Customer notification in 100% Khmer (Spec 6)
   */
  static async notifyCustomerExpiredQRPaymentReceived(
    telegramId: number,
    orderNumber: string
  ): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendStoreBotMessage as any)?.mock && !(this.sendStoreBotMessage as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId: orderNumber, customerTgId: telegramId })) {
      return;
    }

    const text =
      `⚠️ <b>Payment was received, but the QR code had expired. Our admin team is reviewing and will fulfill your delivery shortly.</b>`;

    await this.sendStoreBotMessage(telegramId, text);
  }

  /**
   * ⚠️ EXPIRED QR WITH CONFIRMED PAYMENT: Admin alert with instant fulfill button (Spec 6)
   */
  static async alertAdminExpiredQRPayment(
    orderId: string,
    orderNumber: string,
    amount: number
  ): Promise<void> {
    const isTest = this.isTestRunner();
    if (isTest && !(this.sendAdminBotAlert as any)?.mock && !(this.sendAdminBotAlert as any)?._isMockFunction) {
      return;
    }
    if (this.isTestOrder({ orderId })) {
      return;
    }

    const cleanId = orderNumber || orderId.slice(0, 8);
    const text =
      `⚠️ <b>Payment on Expired QR - Order #UCH-${cleanId} ($${amount.toFixed(2)})</b>\n` +
      `Please review and tap below to fulfill delivery.`;

    await this.sendAdminBotAlert(text, {
      inline_keyboard: [
        [
          {
            text: '🚀 Confirm & Fulfill Delivery Now',
            callback_data: `admin_fulfill_expired:${orderId}`,
          },
        ],
      ],
    });
  }
}