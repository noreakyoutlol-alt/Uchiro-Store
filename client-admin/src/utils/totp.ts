const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 16): string {
  const bytes = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE32_CHARS[bytes[i] % BASE32_CHARS.length];
  }
  return result;
}

export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export function buildOtpAuthUri(params: {
  accountName: string;
  secret: string;
  issuer?: string;
  period?: number;
  digits?: number;
  algorithm?: string;
}): string {
  const issuer = params.issuer || 'Uchiro Store';
  const cleanSecret = params.secret.toUpperCase().replace(/[\s-]/g, '');
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(params.accountName || 'Account');
  const period = params.period || 30;
  const digits = params.digits || 6;
  const algo = (params.algorithm || 'SHA1').toUpperCase();

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=${algo}&digits=${digits}&period=${period}`;
}

export async function computeTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  period = 30,
  digits = 6
): Promise<{ code: string; secondsRemaining: number }> {
  const timeStep = Math.floor(timestampMs / 1000 / period);
  const stepEndMs = (timeStep + 1) * period * 1000;
  const secondsRemaining = Math.max(0, Math.ceil((stepEndMs - timestampMs) / 1000));

  try {
    const keyBytes = base32ToBytes(secretBase32);
    if (keyBytes.length === 0) {
      return { code: '------', secondsRemaining };
    }

    const key = await window.crypto.subtle.importKey(
      'raw',
      keyBytes.buffer as ArrayBuffer,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, timeStep, false);

    const signature = await window.crypto.subtle.sign('HMAC', key, counterBuffer);
    const sigBytes = new Uint8Array(signature);

    const offset = sigBytes[sigBytes.length - 1] & 0x0f;
    const binary =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const mod = Math.pow(10, digits);
    const otp = binary % mod;
    return {
      code: otp.toString().padStart(digits, '0'),
      secondsRemaining,
    };
  } catch (err) {
    return { code: '------', secondsRemaining };
  }
}
