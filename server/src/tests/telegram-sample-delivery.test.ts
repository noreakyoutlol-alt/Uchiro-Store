import { describe, it, expect, afterAll } from 'vitest';
import { DataStore } from '../database/data-store';
import { FulfillmentService } from '../services/fulfillment.service';
import { generateReceiptPdf } from '../utils/receipt.util';

describe('Telegram Account Delivery & Sample Dispatch Verification', () => {
  const targetTelegramId = 6594079594;
  const sampleOrderId = `ORD-SAMPLE-${Date.now()}`;
  const sampleOrderNumber = 'UCH-998877';
  const sampleUsername = 'UchiroLuxuryGod';
  const samplePassword = 'P@ssword2026!Secure';
  const sample2FaSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const sampleProductTitle = 'Blox Fruits Level 2550 + Godhuman + Kitsune Perm';
  const samplePrice = 15.00;
  const sampleWarrantyDays = 7;
  const sampleWarrantyExpiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

  it('registers sample order with auto_account credentials in DataStore', () => {
    const order: any = {
      id: sampleOrderId,
      order_number: sampleOrderNumber,
      customer_id: `cust-${targetTelegramId}`,
      telegram_id: targetTelegramId,
      product_title: sampleProductTitle,
      delivery_mode: 'auto_account',
      status: 'delivered',
      total_amount: samplePrice,
      warranty_days: sampleWarrantyDays,
      warranty_status: 'active',
      warranty_starts_at: new Date().toISOString(),
      warranty_expires_at: sampleWarrantyExpiresAt,
      delivery_credentials: [
        {
          type: 'account',
          username: sampleUsername,
          password: samplePassword,
          two_factor: sample2FaSecret,
          authenticator_secret: sample2FaSecret,
          warranty_days: sampleWarrantyDays,
        },
      ],
      items: [
        {
          product_id: 'prod-blox-001',
          product_title: sampleProductTitle,
          price: samplePrice,
          quantity: 1,
        },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    DataStore.saveOrder(order);
    const saved = DataStore.getOrderById(sampleOrderId);
    expect(saved).toBeDefined();
    expect(saved?.telegram_id).toBe(targetTelegramId);
    expect(saved?.delivery_credentials?.[0]?.username).toBe(sampleUsername);
  });

  it('generates a luxury PDF receipt buffer with order and warranty details', async () => {
    const pdfBuffer = await generateReceiptPdf({
      id: sampleOrderId,
      order_number: sampleOrderNumber,
      created_at: new Date().toISOString(),
      total_amount: samplePrice,
      product_title: sampleProductTitle,
      delivery_mode: 'auto_account',
      telegram_id: targetTelegramId,
      roblox_username: sampleUsername,
      warranty_days: sampleWarrantyDays,
    });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic bytes %PDF
    expect(pdfBuffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates Main Delivery Card with credentials and 4 interactive button rows', () => {
    const cardText = FulfillmentService.getMainDeliveryCardText(sampleOrderId);
    expect(cardText).toContain(sampleUsername);
    expect(cardText).toContain(samplePassword);
    expect(cardText).toContain(sample2FaSecret);
    expect(cardText).toContain(sampleOrderId);
    expect(cardText).toContain('15.00');

    const keyboard = FulfillmentService.getMainDeliveryKeyboard(sampleOrderId);
    expect(keyboard.inline_keyboard).toHaveLength(4);

    // Row 1: [ 🔢 Live 2FA Code ] (callback: sub_2fa:{order_id})
    const row1 = keyboard.inline_keyboard[0][0] as any;
    expect(row1.text).toContain('Live 2FA Code');
    expect(row1.callback_data).toBe(`sub_2fa:${sampleOrderId}`);

    // Row 2: [ 📷 Show 2FA QR ] (callback: send_qr:{order_id})
    const row2 = keyboard.inline_keyboard[1][0] as any;
    expect(row2.text).toContain('Show 2FA QR');
    expect(row2.callback_data).toBe(`send_qr:${sampleOrderId}`);

    // Row 3: [ 🛡️ Check Warranty ] (callback: sub_warranty:{order_id})
    const row3 = keyboard.inline_keyboard[2][0] as any;
    expect(row3.text).toContain('Check Warranty');
    expect(row3.callback_data).toBe(`sub_warranty:${sampleOrderId}`);

    // Row 4: [ 💬 Contact Support ] (url: https://t.me/admin_support_handle)
    const row4 = keyboard.inline_keyboard[3][0] as any;
    expect(row4.text).toContain('Contact Support');
    expect(row4.url).toMatch(/^https:\/\/t\.me\//);
  });

  it('renders interactive 2FA sub-screen with live 6-digit TOTP via otplib and rotation countdown', async () => {
    const sub2Fa = await FulfillmentService.get2FaSubScreen(sampleOrderId);
    expect(sub2Fa.code).toMatch(/^\d{6}$/);
    expect(sub2Fa.text).toContain(sampleUsername);
    expect(sub2Fa.text).toContain(sub2Fa.code);
    expect(sub2Fa.text).toContain('Expires in:');

    expect(sub2Fa.keyboard.inline_keyboard).toHaveLength(3);
    // Row 1: Refresh Code ({code})
    const subRow1 = sub2Fa.keyboard.inline_keyboard[0][0] as any;
    expect(subRow1.text).toContain(sub2Fa.code);
    expect(subRow1.callback_data).toBe(`sub_2fa:${sampleOrderId}`);

    // Row 2: Auto-Add to Authenticator
    const subRow2 = sub2Fa.keyboard.inline_keyboard[1][0] as any;
    expect(subRow2.url).toMatch(/^otpauth:\/\/totp\//);

    // Row 3: « Back to Delivery
    const subRow3 = sub2Fa.keyboard.inline_keyboard[2][0] as any;
    expect(subRow3.callback_data).toBe(`sub_main:${sampleOrderId}`);
  });

  it('generates on-demand 2FA setup QR code buffer', async () => {
    const qrBuffer = await FulfillmentService.generate2FaQrBuffer(sampleOrderId);
    expect(Buffer.isBuffer(qrBuffer)).toBe(true);
    expect(qrBuffer.length).toBeGreaterThan(100);
    // PNG Magic bytes
    expect(qrBuffer[0]).toBe(0x89);
    expect(qrBuffer[1]).toBe(0x50); // P
    expect(qrBuffer[2]).toBe(0x4E); // N
    expect(qrBuffer[3]).toBe(0x47); // G
  });

  it('renders Warranty Protection sub-screen with strict terms and back button', () => {
    const subWarranty = FulfillmentService.getWarrantySubScreen(sampleOrderId);
    expect(subWarranty.text).toContain('7 Days Official Coverage');
    expect(subWarranty.text).toContain('Warranty active while 2FA/Email remain untouched.');
    expect(subWarranty.text).toContain('NO WARRANTY if 2FA is removed or original security email is changed.');
    expect(subWarranty.text).toContain('If you encounter login failure or account revert during warranty');

    expect(subWarranty.keyboard.inline_keyboard).toHaveLength(2);
    // Row 1: Back to Delivery
    const wRow1 = subWarranty.keyboard.inline_keyboard[0][0] as any;
    expect(wRow1.callback_data).toBe(`sub_main:${sampleOrderId}`);
    // Row 2: Contact Support
    const wRow2 = subWarranty.keyboard.inline_keyboard[1][0] as any;
    expect(wRow2.url).toMatch(/^https:\/\/t\.me\//);
  });

  afterAll(() => {
    DataStore.deleteOrder(sampleOrderId);
  });
});
