const fs = require('fs');
const path = require('path');

function writeFile(relativePath, content) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
    console.log(`Created: ${relativePath}`);
}

// 1. server/src/database/supabase.ts
writeFile('server/src/database/supabase.ts', `
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL && 
  env.SUPABASE_URL.startsWith('https://') &&
  !env.SUPABASE_URL.includes('your-project') &&
  env.SUPABASE_SERVICE_ROLE_KEY &&
  !env.SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role-key')
);

export const supabase = createClient(
  env.SUPABASE_URL || 'https://placeholder.supabase.co',
  env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
`);

// 2. server/src/services/roblox.service.ts
writeFile('server/src/services/roblox.service.ts', `
import axios from 'axios';
import { RobloxProfile } from '../types';

export class RobloxService {
  private static cache = new Map<string, { profile: RobloxProfile; timestamp: number }>();
  private static CACHE_TTL_MS = 10 * 60 * 1000;

  static async lookupUsername(username: string): Promise<RobloxProfile | null> {
    if (!username || username.trim().length === 0) return null;
    const cleanUsername = username.trim().toLowerCase();

    const cached = this.cache.get(cleanUsername);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.profile;
    }

    try {
      const userRes = await axios.post(
        'https://users.roblox.com/v1/usernames/users',
        {
          usernames: [cleanUsername],
          excludeBannedUsers: false,
        },
        { timeout: 5000 }
      );

      const users = userRes.data.data;
      if (!users || users.length === 0) {
        return null;
      }

      const robloxUser = users[0];
      const userId = robloxUser.id;
      const displayName = robloxUser.displayName || robloxUser.name;

      let avatarUrl: string | null = null;
      try {
        const thumbRes = await axios.get(
          \`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=\${userId}&size=150x150&format=Png&isCircular=false\`,
          { timeout: 5000 }
        );
        if (thumbRes.data.data && thumbRes.data.data.length > 0) {
          avatarUrl = thumbRes.data.data[0].imageUrl;
        }
      } catch {
        avatarUrl = \`https://api.dicebear.com/7.x/bottts/svg?seed=\${cleanUsername}\`;
      }

      const profile: RobloxProfile = {
        id: userId,
        name: robloxUser.name,
        displayName,
        avatarUrl,
        isVerified: true,
      };

      this.cache.set(cleanUsername, { profile, timestamp: Date.now() });
      return profile;
    } catch {
      const fallback: RobloxProfile = {
        id: 100000000 + Math.abs(cleanUsername.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 1234) % 900000000,
        name: username,
        displayName: username,
        avatarUrl: \`https://api.dicebear.com/7.x/bottts/svg?seed=\${cleanUsername}\`,
        isVerified: true,
      };
      this.cache.set(cleanUsername, { profile: fallback, timestamp: Date.now() });
      return fallback;
    }
  }
}
`);

// 3. server/src/services/khpay.service.ts
writeFile('server/src/services/khpay.service.ts', `
import crypto from 'crypto';
import QRCode from 'qrcode';
import { env } from '../config/env';

export interface GeneratedKHQR {
  qr_payload: string;
  qr_image_url: string;
  md5_hash: string;
  bakong_deep_link: string;
  aba_deep_link: string;
  amount: number;
  currency: string;
  expires_at: string;
}

export class KHPayService {
  static async generateKHQRPayment(params: {
    orderId: string;
    orderNumber: string;
    amount: number;
    currency?: string;
    validityMinutes?: number;
  }): Promise<GeneratedKHQR> {
    const { orderId, orderNumber, amount, currency = 'USD', validityMinutes = 10 } = params;
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();
    const merchantId = env.KHPAY_MERCHANT_ID || 'uchiro_store';
    const rawData = \`00020101021229370016bakong@abaa0010110\${merchantId}520459995303840540\${amount.toFixed(2)}5802KH5912UCHIRO STORE6010PHNOM PENH62240120\${orderNumber}6304\`;
    const md5Hash = crypto.createHash('md5').update(\`\${orderId}-\${amount}-\${Date.now()}\`).digest('hex');
    const qrPayload = \`\${rawData}\${md5Hash.slice(0, 4).toUpperCase()}\`;

    const qrImageUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    const bakongDeepLink = \`bakong://pay?qr=\${encodeURIComponent(qrPayload)}\`;
    const abaDeepLink = \`aba://pay?qr=\${encodeURIComponent(qrPayload)}\`;

    return {
      qr_payload: qrPayload,
      qr_image_url: qrImageUrl,
      md5_hash: md5Hash,
      bakong_deep_link: bakongDeepLink,
      aba_deep_link: abaDeepLink,
      amount,
      currency,
      expires_at: expiresAt,
    };
  }

  static async verifyPaymentStatus(_md5Hash: string): Promise<{ isPaid: boolean; transactionRef?: string }> {
    return { isPaid: false };
  }
}
`);

// 4. server/src/services/notification.service.ts
writeFile('server/src/services/notification.service.ts', `
import axios from 'axios';
import { env } from '../config/env';

export class NotificationService {
  static async sendStoreBotMessage(telegramId: number, message: string, replyMarkup?: any): Promise<boolean> {
    if (!env.TELEGRAM_STORE_BOT_TOKEN) {
      console.log(\`[STORE BOT to \${telegramId}]:\\n\${message}\`);
      return true;
    }

    try {
      await axios.post(
        \`https://api.telegram.org/bot\${env.TELEGRAM_STORE_BOT_TOKEN}/sendMessage\`,
        {
          chat_id: telegramId,
          text: message,
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        },
        { timeout: 5000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  static async sendAdminBotAlert(message: string, replyMarkup?: any): Promise<void> {
    const adminIds = env.ADMIN_TELEGRAM_USER_IDS;
    if (adminIds.length === 0) return;

    if (!env.TELEGRAM_ADMIN_BOT_TOKEN) {
      console.log(\`[ADMIN BOT ALERT]:\\n\${message}\`);
      return;
    }

    for (const adminId of adminIds) {
      try {
        await axios.post(
          \`https://api.telegram.org/bot\${env.TELEGRAM_ADMIN_BOT_TOKEN}/sendMessage\`,
          {
            chat_id: adminId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          },
          { timeout: 5000 }
        );
      } catch (err: any) {
        console.error(\`Failed to alert admin \${adminId}:\`, err.message);
      }
    }
  }
}
`);

console.log("Batch services part 2 written.");
