import QRCode from 'qrcode';
import { env } from '../config/env';
import { Order, CustomerDeliveryResponse } from '../types';
import { TOTPService } from '../security/totp';
import { formatTelegramHtml } from '../bots/store-bot';

export interface AccountDeliveryData {
  username: string;
  password: string;
  has2FA?: boolean;
  twoFactorSecret?: string | null;
  authenticator_secret?: string | null;
  two_factor?: string | null;
}

export interface ReceiptFormatOptions {
  orderId: string;
  orderNumber?: string;
  productName: string;
  amount: number;
  dateTime?: string;
  username: string;
  password: string;
  has2FA?: boolean;
  twoFactorSecret?: string | null;
  liveCode?: string | null;
  supportUsername?: string;
  warrantyDays?: number;
}

export class DeliveryService {
  /**
   * Evaluates whether an account credential contains active 2FA.
   * If account.has2FA === false or secret is missing/empty, returns false.
   */
  public static hasActive2Fa(account: {
    has2FA?: boolean;
    twoFactorSecret?: string | null;
    authenticator_secret?: string | null;
    two_factor?: string | null;
  }): boolean {
    if (account.has2FA === false) {
      return false;
    }
    const secret = account.twoFactorSecret || account.authenticator_secret || account.two_factor;
    return Boolean(secret && secret.trim().length > 0 && secret.trim() !== 'null');
  }

  /**
   * Resolves the 2FA secret for an account if active.
   */
  public static get2FaSecret(account: {
    has2FA?: boolean;
    twoFactorSecret?: string | null;
    authenticator_secret?: string | null;
    two_factor?: string | null;
  }): string | null {
    if (!this.hasActive2Fa(account)) {
      return null;
    }
    return (account.twoFactorSecret || account.authenticator_secret || account.two_factor || '').trim() || null;
  }

  /**
   * Generates formatted order receipt for Telegram dispatch and customer delivery.
   * Specification 4 & 5: Clean format with conditional 2FA block.
   */
  public static formatOrderReceiptText(opts: ReceiptFormatOptions): string {
    const rawSupport = opts.supportUsername || process.env.SUPPORT_TELEGRAM_USERNAME || env.TELEGRAM_SUPPORT_USERNAME || 'UchiroSupport';
    const supportHandle = rawSupport.replace(/^@/, '');
    const cleanOrderId = opts.orderNumber || opts.orderId.slice(0, 8);
    const dateTime = opts.dateTime || new Date().toISOString();

    const has2FA = opts.has2FA !== false && Boolean(opts.twoFactorSecret && opts.twoFactorSecret.trim().length > 0);

    let twoFaBlock = '';
    if (has2FA && opts.twoFactorSecret) {
      const secret = opts.twoFactorSecret.trim();
      let liveCode = opts.liveCode;
      if (!liveCode) {
        try {
          liveCode = TOTPService.generateCode(secret).code;
        } catch {
          liveCode = null;
        }
      }
      twoFaBlock = `• កូដសម្ងាត់ 2FA: <code>${secret}</code>\n` +
        (liveCode ? `• កូដផ្ទៀងផ្ទាត់ 2FA: <code>${liveCode}</code>\n` : '');
    }

    const text =
      `🧾 <b>វិក្កយបត្របញ្ជាទិញ UCHIRO STORE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>លេខកូដបញ្ជាទិញ:</b> #UCH-${cleanOrderId}\n` +
      `📦 <b>ទំនិញ:</b> ${opts.productName}\n` +
      `💵 <b>តម្លៃសរុប:</b> $${opts.amount.toFixed(2)} USD\n` +
      `⏱️ <b>កាលបរិច្ឆេទ:</b> ${dateTime}\n` +
      `🔐 <b>ព័ត៌មានគណនី / ទំនិញ:</b>\n` +
      `• គណនី: <code>${opts.username}</code>\n` +
      `• ពាក្យសម្ងាត់: <code>${opts.password}</code>\n` +
      twoFaBlock +
      `🛡️ <b>ការធានា:</b> ១៤ ថ្ងៃពេញ (ជំនួយ: @${supportHandle})\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    return text;
  }

  /**
   * Prepares customer delivery response payload.
   * Specification 4:
   * - If account.has2FA === false or !account.twoFactorSecret:
   *   Deliver ONLY Username and Password.
   *   Strictly omit 2FA generator tokens, Authenticator QR buttons, and "Refresh 6-digit code".
   * - If account.has2FA === true and secret exists:
   *   Deliver Username, Password, and 2FA codes.
   */
  public static async prepareCustomerDeliveryPayload(
    account: AccountDeliveryData,
    order: Order
  ): Promise<CustomerDeliveryResponse> {
    const has2FA = this.hasActive2Fa(account);
    const secret = this.get2FaSecret(account);

    if (!has2FA || !secret) {
      // STRICTLY omit 2FA generator tokens and setup key
      return {
        username: account.username,
        password: account.password,
        authenticator: {
          available: false,
          manual_setup_key: null,
          qr: null,
          otpauth_url: null,
          code: null,
        },
        warranty_days: order.warranty_days || 14,
        warranty_status: order.warranty_status || 'active',
        warranty_expires_at: order.warranty_expires_at,
      };
    }

    // Account has 2FA enabled: deliver username, password, and live 2FA
    let code: string | null = null;
    let secondsRemaining = 30;
    try {
      const generated = TOTPService.generateCode(secret);
      code = generated.code;
      secondsRemaining = generated.secondsRemaining;
    } catch {
      code = null;
    }

    const otpauthUrl = TOTPService.generateOtpauthUri(
      secret,
      account.username,
      'UchiroStore'
    );

    let qr: string | null = null;
    try {
      qr = await QRCode.toDataURL(otpauthUrl, {
        margin: 2,
        width: 320,
      });
    } catch {
      qr = null;
    }

    return {
      username: account.username,
      password: account.password,
      authenticator: {
        available: true,
        manual_setup_key: secret,
        qr,
        otpauth_url: otpauthUrl,
        code,
        secondsRemaining,
        expiresAt: new Date(Date.now() + secondsRemaining * 1000).toISOString(),
        serverTime: new Date().toISOString(),
        period: 30,
      },
      warranty_days: order.warranty_days || 14,
      warranty_status: order.warranty_status || 'active',
      warranty_expires_at: order.warranty_expires_at,
    };
  }

  /**
   * Generates interactive Telegram Main Delivery inline keyboard.
   * If has2FA is false: strictly omits "Live 2FA Code" and "Show 2FA QR" buttons.
   */
  public static getDeliveryKeyboard(orderId: string, has2FA: boolean, supportUsername: string = 'UchiroSupport'): any {
    const cleanSupport = supportUsername.replace(/^@/, '');
    if (!has2FA) {
      return {
        inline_keyboard: [
          [
            {
              text: '🛡️ ពិនិត្យការធានា (Check Warranty)',
              callback_data: `sub_warranty:${orderId}`,
            },
          ],
          [
            {
              text: '💬 ទាក់ទងផ្នែកជំនួយ (Contact Support)',
              url: `https://t.me/${cleanSupport}`,
            },
          ],
        ],
      };
    }

    return {
      inline_keyboard: [
        [
          {
            text: '🔢 Live 2FA Code',
            callback_data: `sub_2fa:${orderId}`,
          },
        ],
        [
          {
            text: '📷 Show 2FA QR',
            callback_data: `send_qr:${orderId}`,
          },
        ],
        [
          {
            text: '🛡️ Check Warranty',
            callback_data: `sub_warranty:${orderId}`,
          },
        ],
        [
          {
            text: '💬 Contact Support',
            url: `https://t.me/${cleanSupport}`,
          },
        ],
      ],
    };
  }
}
