import crypto from 'crypto';

export interface TelegramParsedInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
  start_param?: string;
  [key: string]: any;
}

export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAgeSeconds: number = 86400
): { isValid: boolean; data?: TelegramParsedInitData; error?: string } {
  // Test environment bypass helper
  if (process.env.NODE_ENV === 'test') {
    let user = { id: 999000001, first_name: 'Test Customer', username: 'test_customer' };
    if (initDataRaw) {
      try {
        const params = new URLSearchParams(initDataRaw);
        const userStr = params.get('user');
        if (userStr) user = JSON.parse(userStr);
      } catch {
        // use default
      }
    }
    return {
      isValid: true,
      data: {
        user,
        auth_date: Math.floor(Date.now() / 1000),
        hash: 'test_hash',
      },
    };
  }

  if (!initDataRaw) {
    return { isValid: false, error: 'INIT_DATA_MISSING' };
  }

  // Development bypass helper if token is demo
  if (botToken === '' || botToken.startsWith('mock_')) {
    try {
      const params = new URLSearchParams(initDataRaw);
      const userStr = params.get('user');
      const user = userStr ? JSON.parse(userStr) : { id: 999000001, first_name: 'Dev User' };
      return {
        isValid: true,
        data: {
          user,
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'mock_hash',
          start_param: params.get('start_param') || undefined,
        },
      };
    } catch {
      return { isValid: true, data: { user: { id: 999000001, first_name: 'Dev User' }, auth_date: 0, hash: '' } };
    }
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      return { isValid: false, error: 'HASH_MISSING' };
    }

    params.delete('hash');

    // Sort parameters alphabetically
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

    // Telegram HMAC calculation:
    // secret_key = HMAC_SHA256("WebAppData", botToken)
    // calculated_hash = HMAC_SHA256(secret_key, dataCheckString)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { isValid: false, error: 'HASH_MISMATCH' };
    }

    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds) {
      return { isValid: false, error: 'AUTH_DATE_EXPIRED' };
    }

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : undefined;

    return {
      isValid: true,
      data: {
        query_id: params.get('query_id') || undefined,
        user,
        auth_date: authDate,
        hash,
        start_param: params.get('start_param') || undefined,
      },
    };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'VALIDATION_EXCEPTION' };
  }
}
