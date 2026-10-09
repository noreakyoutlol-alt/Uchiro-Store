import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { TOTPService } from '../security/totp';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';

describe('Delivery & Authenticator RFC 6238 Security Test Suite', () => {
  // =========================================================================
  // 1. RFC 6238 Standard TOTP Algorithm & Known Vectors Verification
  // =========================================================================
  describe('RFC 6238 Test Vectors (HMAC-SHA1, 30s period, 6 digits)', () => {
    // Secret: ASCII "12345678901234567890" -> Base32 "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    const rfcBase32Secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    it('produces correct TOTP code at T = 59s (vector 1)', () => {
      const res = TOTPService.generateCode(rfcBase32Secret, 59 * 1000, {
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
      });
      expect(res.code).toBe('287082');
      expect(res.period).toBe(30);
      expect(res.secondsRemaining).toBe(1);
    });

    it('produces correct TOTP code at T = 1111111109s (vector 2)', () => {
      const res = TOTPService.generateCode(rfcBase32Secret, 1111111109 * 1000, {
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
      });
      expect(res.code).toBe('081804');
    });

    it('produces correct TOTP code at T = 1111111111s (vector 3)', () => {
      const res = TOTPService.generateCode(rfcBase32Secret, 1111111111 * 1000, {
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
      });
      expect(res.code).toBe('050471');
    });

    it('produces correct TOTP code at T = 1234567890s (vector 4)', () => {
      const res = TOTPService.generateCode(rfcBase32Secret, 1234567890 * 1000, {
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
      });
      expect(res.code).toBe('005924');
    });

    it('produces correct TOTP code at T = 2000000000s (vector 5)', () => {
      const res = TOTPService.generateCode(rfcBase32Secret, 2000000000 * 1000, {
        period: 30,
        digits: 6,
        algorithm: 'SHA1',
      });
      expect(res.code).toBe('279037');
    });

    it('generates standard valid otpauth:// URI and QR data URL', async () => {
      const uri = TOTPService.buildOtpAuthUri({
        accountName: 'BloxMaster77',
        secretBase32: rfcBase32Secret,
        issuer: 'Uchiro Store',
      });

      expect(uri).toContain('otpauth://totp/Uchiro%20Store:BloxMaster77');
      expect(uri).toContain('secret=' + rfcBase32Secret);
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');

      const qrDataUrl = await TOTPService.generateQrDataUrl(uri);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  // =========================================================================
  // 2. Customer Order Delivery Lifecycle & Security Isolation
  // =========================================================================
  describe('Customer Order Delivery Security & Sanitization', () => {
    let customerToken1: string;
    let customerToken2: string;
    let deliveredOrderId: string;

    it('setup: create customer tokens and fulfill order', async () => {
      // Customer 1
      const user1 = DataStore.findOrCreateTelegramUser({
        telegram_id: 11110001,
        username: 'customer_one',
        first_name: 'Customer One',
      });
      customerToken1 = jwt.sign(
        {
          user_id: user1.user.id,
          telegram_id: user1.user.telegram_id,
          username: user1.user.username,
          role: 'customer',
        },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Customer 2
      const user2 = DataStore.findOrCreateTelegramUser({
        telegram_id: 22220002,
        username: 'customer_two',
        first_name: 'Customer Two',
      });
      customerToken2 = jwt.sign(
        {
          user_id: user2.user.id,
          telegram_id: user2.user.telegram_id,
          username: user2.user.username,
          role: 'customer',
        },
        env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Get account product
      const productsRes = await request(app).get('/api/products/in-stock');
      const accountProduct = productsRes.body.data.find(
        (p: any) => p.delivery_mode === 'auto_account'
      );
      expect(accountProduct).toBeDefined();

      // Create order as customer 1
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken1}`)
        .send({
          productId: accountProduct.id,
          idempotencyKey: `DELIV-TEST-${Date.now()}`,
        });

      expect(orderRes.status).toBe(201);
      deliveredOrderId = orderRes.body.data.order.id;
      const paymentId = orderRes.body.data.payment.id;

      // Simulate payment to trigger fulfillment & delivery
      const payRes = await request(app).post(`/api/payments/${paymentId}/simulate-paid`);
      expect(payRes.status).toBe(200);
      expect(payRes.body.data.isPaid).toBe(true);
    });

    it('1. Unauthorized user (no token) cannot access delivery (401)', async () => {
      const res = await request(app).get(`/api/orders/${deliveredOrderId}/delivery`);
      expect(res.status).toBe(401);
    });

    it('2. Customer cannot access another customer delivery (403)', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/delivery`)
        .set('Authorization', `Bearer ${customerToken2}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('3. Customer cannot access another customer TOTP code (403)', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/delivery/totp`)
        .set('Authorization', `Bearer ${customerToken2}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('4. Authorized customer can access their delivered order', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/delivery`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const delivery = res.body.data;

      // Username & Password are provided
      expect(delivery.username).toBeDefined();
      expect(delivery.password).toBeDefined();

      // Authenticator is available with server-authoritative fields
      expect(delivery.authenticator).toBeDefined();
      expect(delivery.authenticator.available).toBe(true);
      expect(delivery.authenticator.code).toMatch(/^\d{6}$/);
      expect(delivery.authenticator.expiresAt).toBeDefined();
      expect(delivery.authenticator.serverTime).toBeDefined();
      expect(delivery.authenticator.period).toBe(30);
      expect(typeof delivery.authenticator.secondsRemaining).toBe('number');
      expect(delivery.authenticator.qr).toMatch(/^data:image\/png;base64,/);
      expect(delivery.authenticator.otpauth_url).toContain('otpauth://totp/');
    });

    it('5. STRICT SANITIZATION: email, email_password, raw secret NOT returned in delivery', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/delivery`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      const delivery = res.body.data;

      // STRICT PROMPT REQUIREMENT: DO NOT show or deliver email, email address, email delivery, customer email, email password
      expect(delivery.email).toBeUndefined();
      expect(delivery.email_password).toBeUndefined();
      expect(delivery.emailPassword).toBeUndefined();
      expect(delivery.customerEmail).toBeUndefined();
      expect(delivery.emailAddress).toBeUndefined();
      expect(delivery.recovery_email).toBeUndefined();
      expect(delivery.backup_codes).toBeUndefined();
      expect(delivery.backupCodes).toBeUndefined();

      // STRICT SECURITY REQUIREMENT: Never expose raw TOTP secret as normal text
      expect(delivery.secret).toBeUndefined();
      expect(delivery.two_factor).toBeUndefined();
      expect(delivery.twoFactor).toBeUndefined();
      expect(delivery.setupKey).toBeUndefined();
      expect(delivery.authenticator?.setupKey).toBeUndefined();
      expect(delivery.authenticator?.secret).toBeUndefined();
    });

    it('6. STRICT SANITIZATION: GET /api/orders/:id strips email and secret from delivery_credentials', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      const order = res.body.data;
      expect(order.delivery_credentials).toBeDefined();
      expect(Array.isArray(order.delivery_credentials)).toBe(true);

      for (const cred of order.delivery_credentials) {
        expect(cred.username).toBeDefined();
        expect(cred.password).toBeDefined();
        // Email and secrets must never exist in customer output
        expect(cred.email).toBeUndefined();
        expect(cred.email_password).toBeUndefined();
        expect(cred.two_factor).toBeUndefined();
        expect(cred.backup_codes).toBeUndefined();
      }
    });

    it('7. Live TOTP Refresh endpoint returns updated server-authoritative code & expiry', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/delivery/totp`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const totp = res.body.data;

      expect(totp.code).toMatch(/^\d{6}$/);
      expect(totp.expiresAt).toBeDefined();
      expect(totp.serverTime).toBeDefined();
      expect(totp.period).toBe(30);
      expect(totp.secondsRemaining).toBeGreaterThanOrEqual(0);
      expect(totp.secondsRemaining).toBeLessThanOrEqual(30);

      // Verify serverTime and expiresAt are valid ISO timestamps
      expect(new Date(totp.serverTime).getTime()).toBeGreaterThan(0);
      expect(new Date(totp.expiresAt).getTime()).toBeGreaterThan(new Date(totp.serverTime).getTime());
    });

    it('8. Backward compatible /api/orders/:id/totp also returns strictly sanitized data', async () => {
      const res = await request(app)
        .get(`/api/orders/${deliveredOrderId}/totp`)
        .set('Authorization', `Bearer ${customerToken1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toMatch(/^\d{6}$/);
      expect(res.body.data.email).toBeUndefined();
      expect(res.body.data.setupKey).toBeUndefined();
    });

    it('9. Delivery Access Audit: logs delivery_viewed & totp_requested without passwords or secrets', () => {
      const auditLogs = DataStore.getDeliveryAccessLogs(deliveredOrderId);
      expect(auditLogs.length).toBeGreaterThan(0);

      for (const log of auditLogs) {
        expect(log.order_id).toBe(deliveredOrderId);
        expect(log.action).toMatch(/^(delivery_viewed|totp_requested|totp_refresh|authenticator_qr_requested)$/);
        expect(typeof log.success).toBe('boolean');

        // CRITICAL AUDIT RULE: Passwords, TOTP secrets, and codes are NEVER stored in logs
        const logString = JSON.stringify(log);
        expect(logString).not.toContain('KitsuneV3_Secret2025!');
        expect(logString).not.toContain('Pass_');
        expect(logString).not.toContain('JBSWY3DPEHPK3PXP');
      }
    });
  });
});
