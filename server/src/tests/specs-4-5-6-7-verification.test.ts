import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeliveryService } from '../services/delivery.service';
import { PaymentService } from '../services/payment.service';
import { NotificationService } from '../services/notification.service';
import { DataStore } from '../database/data-store';
import { KHPayService } from '../services/khpay.service';

describe('Specification 4 & 5: Conditional Account Credential Delivery & Receipt Formatting', () => {
  it('delivers ONLY username and password when account.has2FA is false or twoFactorSecret is missing', async () => {
    const mockOrder: any = {
      id: 'ord-test-no-2fa',
      order_number: '998877',
      total_amount: 15.0,
      warranty_days: 14,
      warranty_status: 'active',
      warranty_expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    };

    const payloadNo2Fa = await DeliveryService.prepareCustomerDeliveryPayload(
      {
        username: 'RobloxUser123',
        password: 'PasswordSafe123!',
        has2FA: false,
        twoFactorSecret: null,
      },
      mockOrder
    );

    // Strictly delivers username and password
    expect(payloadNo2Fa.username).toBe('RobloxUser123');
    expect(payloadNo2Fa.password).toBe('PasswordSafe123!');
    // Strictly omits 2FA tokens and codes
    expect(payloadNo2Fa.authenticator.available).toBe(false);
    expect(payloadNo2Fa.authenticator.manual_setup_key).toBeNull();
    expect(payloadNo2Fa.authenticator.code).toBeNull();
    expect(payloadNo2Fa.authenticator.qr).toBeNull();
    expect(payloadNo2Fa.authenticator.otpauth_url).toBeNull();

    // Verify keyboard strictly omits 2FA buttons
    const keyboard = DeliveryService.getDeliveryKeyboard('ord-test-no-2fa', false, 'UchiroSupport');
    const allButtons = keyboard.inline_keyboard.flat();
    const has2FaButton = allButtons.some((b: any) =>
      b.text.includes('Live 2FA') || b.text.includes('2FA QR') || b.text.includes('Refresh')
    );
    expect(has2FaButton).toBe(false);
  });

  it('delivers username, password, and live 2FA codes when account.has2FA is true and secret exists', async () => {
    const mockOrder: any = {
      id: 'ord-test-with-2fa',
      order_number: '112233',
      total_amount: 25.0,
      warranty_days: 14,
      warranty_status: 'active',
      warranty_expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    };

    const secret = 'JBSWY3DPEHPK3PXP';
    const payloadWith2Fa = await DeliveryService.prepareCustomerDeliveryPayload(
      {
        username: 'RobloxGamerPro',
        password: 'GamerPassword!',
        has2FA: true,
        twoFactorSecret: secret,
      },
      mockOrder
    );

    expect(payloadWith2Fa.username).toBe('RobloxGamerPro');
    expect(payloadWith2Fa.password).toBe('GamerPassword!');
    expect(payloadWith2Fa.authenticator.available).toBe(true);
    expect(payloadWith2Fa.authenticator.manual_setup_key).toBe(secret);
    expect(payloadWith2Fa.authenticator.code).toMatch(/^\d{6}$/);
    expect(payloadWith2Fa.authenticator.otpauth_url).toContain('otpauth://totp/');

    // Keyboard includes 2FA buttons
    const keyboard = DeliveryService.getDeliveryKeyboard('ord-test-with-2fa', true, 'UchiroSupport');
    const allButtons = keyboard.inline_keyboard.flat();
    const hasLive2Fa = allButtons.some((b: any) => b.text.includes('Live 2FA Code'));
    const hasQr = allButtons.some((b: any) => b.text.includes('Show 2FA QR'));
    expect(hasLive2Fa).toBe(true);
    expect(hasQr).toBe(true);
  });

  it('formats clean Khmer receipts for Telegram and customer delivery matching specification', () => {
    const receiptWithout2Fa = DeliveryService.formatOrderReceiptText({
      orderId: 'uuid-12345',
      orderNumber: '554433',
      productName: 'Blox Fruits 2450 Godhuman Account',
      amount: 15.0,
      dateTime: '2026-03-30 14:00:00',
      username: 'BloxHero99',
      password: 'SafePass99!',
      has2FA: false,
      twoFactorSecret: null,
      supportUsername: 'UchiroSupport',
    });

    expect(receiptWithout2Fa).toContain('🧾 <b>វិក្កយបត្របញ្ជាទិញ UCHIRO STORE</b>');
    expect(receiptWithout2Fa).toContain('🆔 <b>លេខកូដបញ្ជាទិញ:</b> #UCH-554433');
    expect(receiptWithout2Fa).toContain('📦 <b>ទំនិញ:</b> Blox Fruits 2450 Godhuman Account');
    expect(receiptWithout2Fa).toContain('💵 <b>តម្លៃសរុប:</b> $15.00 USD');
    expect(receiptWithout2Fa).toContain('• គណនី: <code>BloxHero99</code>');
    expect(receiptWithout2Fa).toContain('• ពាក្យសម្ងាត់: <code>SafePass99!</code>');
    expect(receiptWithout2Fa).toContain('🛡️ <b>ការធានា:</b> ១៤ ថ្ងៃពេញ (ជំនួយ: @UchiroSupport)');
    // Strictly omits 2FA
    expect(receiptWithout2Fa).not.toContain('2FA');

    const receiptWith2Fa = DeliveryService.formatOrderReceiptText({
      orderId: 'uuid-67890',
      orderNumber: '778899',
      productName: 'Blox Fruits Kitsune Account',
      amount: 30.0,
      dateTime: '2026-03-30 14:00:00',
      username: 'KitsuneKing',
      password: 'KingPassword!',
      has2FA: true,
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      supportUsername: 'UchiroSupport',
    });

    expect(receiptWith2Fa).toContain('• កូដសម្ងាត់ 2FA: <code>JBSWY3DPEHPK3PXP</code>');
    expect(receiptWith2Fa).toContain('🛡️ <b>ការធានា:</b> ១៤ ថ្ងៃពេញ (ជំនួយ: @UchiroSupport)');
  });
});

describe('Specification 6: Expired QR with Confirmed Payment Flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('marks order as pending_admin_review, notifies customer in Khmer, and alerts Admin Bot with instant fulfill button', async () => {
    const expiredPayment: any = {
      id: 'pay-exp-001',
      order_id: 'ord-exp-001',
      status: 'expired',
      amount: 18.5,
      expires_at: new Date(Date.now() - 60000).toISOString(),
    };

    const mockOrder: any = {
      id: 'ord-exp-001',
      order_number: '990011',
      telegram_id: 12345678,
      status: 'expired',
      total_amount: 18.5,
      items: [{ product_id: 'p1', product_title: 'Kitsune Fruit', price: 18.5, quantity: 1 }],
    };

    DataStore.savePayment(expiredPayment);
    DataStore.saveOrder(mockOrder);

    const customerNotifySpy = vi.spyOn(NotificationService, 'notifyCustomerExpiredQRPaymentReceived').mockResolvedValue();
    const adminAlertSpy = vi.spyOn(NotificationService, 'alertAdminExpiredQRPayment').mockResolvedValue();

    await PaymentService.handleExpiredQrConfirmedPayment(expiredPayment, 'TX-TEST-LATE-123');

    const updatedOrder = DataStore.getOrderById('ord-exp-001');
    expect(updatedOrder?.status).toBe('pending_admin_review');

    expect(customerNotifySpy).toHaveBeenCalledWith(12345678, '990011');
    expect(adminAlertSpy).toHaveBeenCalledWith('ord-exp-001', '990011', 18.5);
  });
});

describe('Specification 7: Notification Spam Reduction', () => {
  it('suppresses outbound customer or admin notifications on order creation / pending payment', async () => {
    const sendSpy = vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);
    const adminSpy = vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();

    await NotificationService.notifyOrderCreated(123456, 'ORD-999', 'Blox Account', 10);
    await NotificationService.alertAdminNewOrder('ORD-999', 'Blox Account', 10, 'auto_account');

    expect(sendSpy).not.toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });
});
