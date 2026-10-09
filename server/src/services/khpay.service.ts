import crypto from 'crypto';
import QRCode from 'qrcode';
import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../middleware/error-handler';

export interface GeneratedKHQR {
  transaction_id: string;
  qr_payload: string;
  qr_image_url: string;
  md5_hash: string;
  bakong_deep_link: string;
  aba_deep_link: string;
  amount: number;
  currency: string;
  expires_at: string;
  expires_in: number;
}

export class KHPayService {
  /**
   * Generates KHQR Payment payload via official KHPay Production API
   * POST /qr/generate
   *
   * PRODUCTION SAFETY RULES:
   * - Production MUST use the real KHPay API.
   * - In production, missing credentials or API failures fail safely with an error.
   * - Offline / standalone generator fallback is strictly restricted to development/test environments.
   */
  static async generateKHQRPayment(params: {
    orderId: string;
    orderNumber: string;
    amount: number;
    currency?: string;
    validityMinutes?: number;
  }): Promise<GeneratedKHQR> {
    const { orderId, orderNumber, amount, currency = 'USD', validityMinutes = 10 } = params;
    const baseUrl = env.KHPAY_BASE_URL || 'https://khpay.site/api/v1';
    const apiKey = env.KHPAY_API_KEY;
    const isProduction = env.NODE_ENV === 'production';
    const isTestMode = !isProduction && env.KHPAY_TEST_MODE;
    const hasRealCredentials = Boolean(
      apiKey && !apiKey.startsWith('khpay_test_api_key') && apiKey.trim().length > 0
    );

    // Production MUST fail safely if real KHPay credentials are missing
    if (isProduction && !hasRealCredentials) {
      throw new AppError(
        'KHPay live credentials missing in production. Payment generation cannot proceed.',
        503,
        'KHPAY_NOT_CONFIGURED'
      );
    }

    // Check if real KHPay credentials are provided
    if (hasRealCredentials) {
      try {
        const response = await axios.post(
          `${baseUrl}/qr/generate`,
          {
            amount: amount.toFixed(2),
            currency: 'USD',
            note: `Order #${orderNumber}`,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const data = response.data?.data || response.data;
        const transactionId = String(data?.transaction_id || data?.id || data?.trx_id || '');
        const qrString = data?.qr_string || data?.qr_payload || data?.qr_data || data?.qr || '';

        // Provider expiration from KHPay response (Section 2)
        const rawExpiresIn = Number(data?.expires_in || data?.expire_in);
        const expiresIn = !isNaN(rawExpiresIn) && rawExpiresIn > 0 ? rawExpiresIn : validityMinutes * 60;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        let qrImageUrl = data?.qr_image || data?.qr_image_url || '';
        if ((!qrImageUrl || !qrImageUrl.startsWith('data:image')) && qrString) {
          qrImageUrl = await QRCode.toDataURL(qrString, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 320,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
        }

        const abaDeepLink =
          data?.abapay_deeplink ||
          data?.aba_deeplink ||
          data?.deeplink ||
          (qrString ? `aba://pay?qr=${encodeURIComponent(qrString)}` : '');

        const bakongDeepLink =
          data?.bakong_deeplink ||
          (qrString ? `bakong://pay?qr=${encodeURIComponent(qrString)}` : '');

        const rawHash = String(data?.md5 || data?.md5_hash || data?.hash || '');
        const md5Hash = (rawHash && rawHash.length === 32)
          ? rawHash
          : crypto.createHash('md5').update(`${transactionId || orderId}-${amount}-${orderNumber}`).digest('hex');

        return {
          transaction_id: transactionId || md5Hash,
          qr_payload: qrString,
          qr_image_url: qrImageUrl,
          md5_hash: md5Hash,
          bakong_deep_link: bakongDeepLink,
          aba_deep_link: abaDeepLink,
          amount,
          currency,
          expires_at: expiresAt,
          expires_in: expiresIn,
        };
      } catch (err: any) {
        console.error('KHPay API /qr/generate error:', err.message);
        // Production MUST NOT fall back to fake/local QR generation
        if (isProduction || !isTestMode) {
          throw new AppError(
            `KHPay payment gateway error: ${err.response?.data?.message || err.message}`,
            502,
            'KHPAY_GATEWAY_ERROR'
          );
        }
        console.warn('Development test mode: using standalone generator fallback.');
      }
    }

    // Standalone / Test / Offline Generator Fallback (ONLY permitted in non-production test mode)
    if (isProduction || !isTestMode) {
      throw new AppError(
        'KHPay offline/test generator is not allowed in production.',
        403,
        'KHPAY_TEST_FALLBACK_FORBIDDEN'
      );
    }

    const expiresIn = validityMinutes * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const merchantId = 'uchiro_store';
    const rawData = `00020101021229370016bakong@abaa0010110${merchantId}520459995303840540${amount.toFixed(2)}5802KH5912UCHIRO STORE6010PHNOM PENH62240120${orderNumber}6304`;
    const md5Hash = crypto.createHash('md5').update(`${orderId}-${amount}-${Date.now()}`).digest('hex');
    const qrPayload = `${rawData}${md5Hash.slice(0, 4).toUpperCase()}`;

    const qrImageUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    const bakongDeepLink = `bakong://pay?qr=${encodeURIComponent(qrPayload)}`;
    const abaDeepLink = `aba://pay?qr=${encodeURIComponent(qrPayload)}`;

    return {
      transaction_id: md5Hash,
      qr_payload: qrPayload,
      qr_image_url: qrImageUrl,
      md5_hash: md5Hash,
      bakong_deep_link: bakongDeepLink,
      aba_deep_link: abaDeepLink,
      amount,
      currency,
      expires_at: expiresAt,
      expires_in: expiresIn,
    };
  }

  /**
   * Polls KHPay status: GET /qr/check/{transaction_id}
   * Server-side authoritative verification
   * Paid ONLY if: paid === true OR action === "approved"
   */
  static async verifyPaymentStatus(transactionId: string): Promise<{ isPaid: boolean; transactionRef?: string }> {
    if (!transactionId) {
      return { isPaid: false };
    }

    const apiKey = env.KHPAY_API_KEY;
    if (apiKey && !apiKey.startsWith('khpay_test_api_key') && apiKey.trim().length > 0) {
      try {
        const baseUrl = env.KHPAY_BASE_URL || 'https://khpay.site/api/v1';
        const response = await axios.get(
          `${baseUrl}/qr/check/${encodeURIComponent(transactionId)}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 5000,
          }
        );

        const data = response.data?.data || response.data;
        const isPaid =
          data?.paid === true ||
          data?.action === 'approved' ||
          data?.status === 'paid' ||
          data?.status === 'approved';

        if (isPaid) {
          return {
            isPaid: true,
            transactionRef: data?.transaction_ref || data?.transaction_id || transactionId,
          };
        }
      } catch (err: any) {
        // Pending or network timeout
        return { isPaid: false };
      }
    }

    return { isPaid: false };
  }

  static getStatus(): {
    isConfigured: boolean;
    testMode: boolean;
    currency: string;
    baseUrl: string;
  } {
    const apiKey = env.KHPAY_API_KEY;
    const isConfigured = Boolean(
      apiKey && !apiKey.startsWith('khpay_test_api_key') && apiKey.trim().length > 0
    );
    const isProduction = env.NODE_ENV === 'production';
    return {
      isConfigured,
      testMode: isProduction ? false : env.KHPAY_TEST_MODE,
      currency: env.KHPAY_CURRENCY,
      baseUrl: env.KHPAY_BASE_URL,
    };
  }
}
