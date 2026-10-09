import crypto from 'crypto';
import QRCode from 'qrcode';

/**
 * RFC 6238 TOTP Generator
 * Standard Time-based One-Time Password algorithm using HMAC-SHA1/SHA256/SHA512
 */
export class TOTPService {
  private static readonly BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Generate cryptographically secure Base32 TOTP Secret
   */
  public static generateSecret(length = 16): string {
    const bytes = crypto.randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += this.BASE32_ALPHABET[bytes[i] % this.BASE32_ALPHABET.length];
    }
    return result;
  }

  /**
   * Decode base32 string into Buffer
   */
  public static base32ToBuffer(base32: string): Buffer {
    const cleanBase32 = base32.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < cleanBase32.length; i++) {
      const val = this.BASE32_ALPHABET.indexOf(cleanBase32.charAt(i));
      if (val === -1) {
        continue; // ignore invalid characters
      }
      bits += val.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
  }

  /**
   * Generate RFC 6238 TOTP code for a given base32 secret and timestamp
   */
  public static generateCode(
    secretBase32: string,
    timestampMs = Date.now(),
    options: {
      period?: number;
      digits?: number;
      algorithm?: string;
    } = {}
  ): {
    code: string;
    secondsRemaining: number;
    period: number;
    expiresAt: string;
    serverTime: string;
    generatedAt: string;
  } {
    const periodSeconds = options.period || 30;
    const digits = options.digits || 6;
    const algorithm = (options.algorithm || 'SHA1').toLowerCase();

    const timeStep = Math.floor(timestampMs / 1000 / periodSeconds);
    const stepStartMs = timeStep * periodSeconds * 1000;
    const stepEndMs = stepStartMs + periodSeconds * 1000;
    const secondsRemaining = Math.max(0, Math.ceil((stepEndMs - timestampMs) / 1000));

    const expiresAt = new Date(stepEndMs).toISOString();
    const serverTime = new Date(timestampMs).toISOString();
    const generatedAt = serverTime;

    const secretBuffer = this.base32ToBuffer(secretBase32);
    if (secretBuffer.length === 0) {
      return {
        code: '0'.repeat(digits),
        secondsRemaining,
        period: periodSeconds,
        expiresAt,
        serverTime,
        generatedAt,
      };
    }

    // 8-byte big-endian counter
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(timeStep));

    const hmacAlgo = algorithm.replace('-', '');
    const hmac = crypto.createHmac(hmacAlgo, secretBuffer);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    // Dynamic truncation
    const offset = digest[digest.length - 1] & 0xf;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const mod = Math.pow(10, digits);
    const otp = binary % mod;
    const code = otp.toString().padStart(digits, '0');

    return {
      code,
      secondsRemaining,
      period: periodSeconds,
      expiresAt,
      serverTime,
      generatedAt,
    };
  }

  /**
   * Build standard otpauth:// URI for authenticator apps (Google Authenticator, Microsoft, 1Password)
   */
  public static buildOtpAuthUri(params: {
    accountName: string;
    secretBase32: string;
    issuer?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
  }): string {
    const issuer = params.issuer || 'Uchiro Store';
    const algorithm = (params.algorithm || 'SHA1').toUpperCase();
    const digits = params.digits || 6;
    const period = params.period || 30;

    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(params.accountName);
    const cleanSecret = params.secretBase32.replace(/[\s-]/g, '').toUpperCase();

    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
  }

  /**
   * Convenience helper to generate standard otpauth:// URI with positional arguments
   */
  public static generateOtpauthUri(
    secretBase32: string,
    accountName: string,
    issuer = 'Uchiro Store'
  ): string {
    return this.buildOtpAuthUri({
      secretBase32,
      accountName,
      issuer,
    });
  }

  /**
   * Generate QR Code as Data URL server-side (Base64 PNG)
   */
  public static async generateQrDataUrl(otpauthUri: string): Promise<string> {
    return QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }
}

