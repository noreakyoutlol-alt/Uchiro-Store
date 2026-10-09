import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { DataStore } from '../database/data-store';
import { OrderService } from '../services/order.service';
import { buildReceiptPdfBuffer } from '../services/receipt-pdf.service';
import { env } from '../config/env';

describe('Order Receipt & Secure Delivery System Test Suite', () => {
  const customerTelegramId = 88880001;
  const customerToken = jwt.sign(
    {
      telegram_id: customerTelegramId,
      first_name: 'ReceiptTester',
      username: 'receipt_test_user',
      role: 'customer',
    },
    env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  const otherCustomerToken = jwt.sign(
    {
      telegram_id: 99990002,
      first_name: 'Intruder',
      username: 'intruder_user',
      role: 'customer',
    },
    env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  let createdOrder: any = null;

  it('sets up a test customer order with automatic account delivery and fulfills it', async () => {
    const productsRes = await request(app).get('/api/products/in-stock');
    expect(productsRes.status).toBe(200);

    const testProduct =
      productsRes.body.data.find((p: any) => p.delivery_mode === 'auto_account') ||
      productsRes.body.data[0];

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: testProduct.id,
        idempotencyKey: `RECEIPT-TEST-${Date.now()}`,
      });

    expect(orderRes.status).toBe(201);
    createdOrder = orderRes.body.data.order;
    const paymentId = orderRes.body.data.payment.id;

    // Simulate payment to trigger fulfillment & delivery
    const payRes = await request(app).post(`/api/payments/${paymentId}/simulate-paid`);
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.isPaid).toBe(true);

    const freshOrder = DataStore.getOrderById(createdOrder.id);
    expect(freshOrder?.status).toBe('delivered');
    expect(freshOrder?.receipt_notified).toBe(true);
    createdOrder = freshOrder;
  });

  describe('Section A & B: Official Order Receipt Data & Zero Credential Leakage', () => {
    it('returns official receipt details for authorized customer', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrder.id}/receipt`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const receipt = res.body.data;
      expect(receipt.order_id).toBe(createdOrder.id);
      expect(receipt.order_number).toBe(createdOrder.order_number);
      expect(receipt.store_name).toBe('UCHIRO STORE');
      expect(receipt.product_name).toBeDefined();
      expect(receipt.product_type).toBe('Gaming Account');
      expect(receipt.amount).toBe(createdOrder.total_amount);
      expect(receipt.currency).toBe('USD');
      expect(receipt.payment_method).toBe('Bakong KHQR');
      expect(receipt.payment_status).toBe('paid');
      expect(receipt.delivery_status).toBe('delivered');
      expect(receipt.warranty_duration).toBe('14 Days');

      // STRICT REQUIREMENT: MUST NEVER contain passwords, secrets, or recovery codes!
      expect(receipt.password).toBeUndefined();
      expect(receipt.delivery_credentials).toBeUndefined();
      expect(receipt.secret).toBeUndefined();
      expect(receipt.authenticator_secret).toBeUndefined();
      expect(receipt.manual_setup_key).toBeUndefined();
      expect(receipt.totp).toBeUndefined();
      expect(receipt.backup_codes).toBeUndefined();
    });

    it('rejects unauthorized customers from accessing another order receipt', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrder.id}/receipt`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests to order receipt', async () => {
      const res = await request(app).get(`/api/orders/${createdOrder.id}/receipt`);
      expect(res.status).toBe(401);
    });
  });

  describe('Section B: PDF Receipt Binary Buffer Generation & Download', () => {
    it('generates a 100% compliant PDF-1.4 binary document for the receipt', () => {
      const receipt = OrderService.getOrderReceipt(createdOrder.id, customerTelegramId);
      const pdfBuffer = buildReceiptPdfBuffer(receipt);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      const pdfHeader = pdfBuffer.slice(0, 8).toString('ascii');
      expect(pdfHeader).toContain('%PDF-1.4');

      const pdfTail = pdfBuffer.slice(pdfBuffer.length - 20).toString('ascii');
      expect(pdfTail).toContain('%%EOF');
    });

    it('serves downloadable PDF file via GET /api/orders/:id/receipt/download', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrder.id}/receipt/download`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain(`UCHIRO-Receipt-${createdOrder.order_number}.pdf`);
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.slice(0, 8).toString('ascii')).toContain('%PDF-1.4');
    });
  });

  describe('Section D & E: Account Delivery with & without Authenticator', () => {
    it('returns delivery credentials with manual_setup_key and live code when 2FA is present', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrder.id}/delivery`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const delivery = res.body.data;
      expect(delivery.username).toBeDefined();
      expect(delivery.password).toBeDefined();

      if (delivery.authenticator?.available) {
        expect(delivery.authenticator.manual_setup_key).toBeDefined();
        expect(typeof delivery.authenticator.manual_setup_key).toBe('string');
        expect(delivery.authenticator.code).toMatch(/^\d{6}$/);
        expect(delivery.authenticator.otpauth_url).toContain('otpauth://totp/');
        expect(delivery.authenticator.qr).toContain('data:image/png;base64');
      }
    });

    it('verifies that manual_setup_key and live 6-digit TOTP are distinct values', async () => {
      const res = await request(app)
        .get(`/api/orders/${createdOrder.id}/delivery`)
        .set('Authorization', `Bearer ${customerToken}`);

      const delivery = res.body.data;
      if (delivery.authenticator?.available) {
        expect(delivery.authenticator.manual_setup_key).not.toBe(delivery.authenticator.code);
        expect(delivery.authenticator.manual_setup_key.length).toBeGreaterThan(6);
      }
    });
  });
});
