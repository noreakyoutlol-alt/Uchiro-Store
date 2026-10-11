import { describe, test, expect, beforeAll } from 'vitest';
import { DataStore } from '../database/data-store';
import { TOTPService } from '../security/totp';
import {
  buildVaultListKeyboard,
  buildEmptyVaultKeyboard,
  buildAccountDetailKeyboard,
  buildTwoFactorKeyboard,
} from '../bots/store-bot/keyboards';
import {
  escapeHtml,
  getCustomerDeliveredAccounts,
  getCustomerDeliveredAccountById,
} from '../bots/store-bot/handlers/orders';

describe('Vault & Orders Delivery Automation Integration', () => {
  const testTelegramId = 987654321;
  const storeUrl = 'https://web-production-2d8bd.up.railway.app';

  beforeAll(() => {
    // Seed an order with delivered credentials for testTelegramId
    DataStore.saveOrder({
      id: 'test-order-vault-1',
      order_number: 'ORD-TEST-VAULT-1',
      customer_id: 'cust-vault-1',
      telegram_id: testTelegramId,
      status: 'delivered',
      subtotal: 15.0,
      discount_amount: 0,
      total_amount: 15.0,
      coupon_id: null,
      roblox_username: null,
      roblox_display_name: null,
      roblox_user_id: null,
      delivery_mode: 'auto_account',
      delivery_credentials: [
        {
          account_id: 'acc_vault_1',
          username: 'blox_master_99',
          password: 'SecretPassword123!',
          two_factor: 'JBSWY3DPEHPK3PXP',
          backup_codes: ['BK-1111', 'BK-2222', 'BK-3333'],
          notes: 'Safe account warranty 14 days',
        },
      ],
      fulfillment_notes: 'Delivered automatically via inventory',
      product_title: 'Blox Fruits Max Level + Kitsune',
      delivered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      idempotency_key: 'idemp-vault-1',
    });
  });

  test('DataStore correctly extracts delivered accounts for a customer', () => {
    const accounts = DataStore.getDeliveredAccountsByTelegramId(testTelegramId);
    expect(accounts).toBeDefined();
    expect(accounts.length).toBeGreaterThanOrEqual(1);

    const target = accounts.find((a) => a.account_id === 'acc_vault_1');
    expect(target).toBeDefined();
    expect(target?.username).toBe('blox_master_99');
    expect(target?.password).toBe('SecretPassword123!');
    expect(target?.two_factor_secret).toBe('JBSWY3DPEHPK3PXP');
    expect(target?.backup_codes).toEqual(['BK-1111', 'BK-2222', 'BK-3333']);
    expect(target?.game_title).toBe('Blox Fruits Max Level + Kitsune');
  });

  test('getCustomerDeliveredAccounts and getCustomerDeliveredAccountById work seamlessly', async () => {
    const accounts = await getCustomerDeliveredAccounts(testTelegramId);
    expect(accounts.length).toBeGreaterThanOrEqual(1);

    const single = await getCustomerDeliveredAccountById(testTelegramId, 'acc_vault_1');
    expect(single).not.toBeNull();
    expect(single?.username).toBe('blox_master_99');
  });

  test('TOTPService generates valid 6-digit RFC 6238 codes', () => {
    const totp = TOTPService.generateCode('JBSWY3DPEHPK3PXP', Date.now());
    expect(totp).toBeDefined();
    expect(totp.code).toMatch(/^\d{6}$/);
    expect(totp.secondsRemaining).toBeGreaterThanOrEqual(0);
    expect(totp.secondsRemaining).toBeLessThanOrEqual(30);
  });

  test('buildVaultListKeyboard includes account button and webApp vault deep link', () => {
    const accounts = DataStore.getDeliveredAccountsByTelegramId(testTelegramId);
    const keyboard = buildVaultListKeyboard(accounts, storeUrl);

    expect(keyboard).toBeDefined();
    expect(keyboard.reply_markup.inline_keyboard.length).toBeGreaterThan(0);

    // Verify presence of account button
    const flatButtons = keyboard.reply_markup.inline_keyboard.flat() as any[];
    const accBtn = flatButtons.find((b: any) => b.callback_data?.includes('cb_view_acc_acc_vault_1'));
    expect(accBtn).toBeDefined();
    expect(accBtn?.text).toContain('ORD-TEST-VAULT-1');

    // Verify Mini App vault deep-link
    const miniAppBtn = flatButtons.find((b: any) => b.web_app?.url?.includes('tab=vault'));
    expect(miniAppBtn).toBeDefined();
    expect(miniAppBtn?.web_app?.url).toBe(`${storeUrl}?tab=vault`);
  });

  test('buildAccountDetailKeyboard generates direct deep link with accountId and orderId', () => {
    const account = DataStore.getDeliveredAccountById(testTelegramId, 'acc_vault_1')!;
    const keyboard = buildAccountDetailKeyboard(account, storeUrl);

    const flatButtons = keyboard.reply_markup.inline_keyboard.flat() as any[];
    const deepLinkBtn = flatButtons.find((b: any) =>
      b.web_app?.url?.includes('tab=vault') &&
      b.web_app?.url?.includes('accountId=acc_vault_1')
    );
    expect(deepLinkBtn).toBeDefined();

    // Verify live 2FA button is present when 2FA secret exists
    const gen2faBtn = flatButtons.find((b: any) => b.callback_data?.includes('cb_gen_2fa_acc_vault_1'));
    expect(gen2faBtn).toBeDefined();
  });

  test('escapeHtml handles dangerous characters gracefully', () => {
    expect(escapeHtml('<script>alert("test")</script>')).toBe('&lt;script&gt;alert("test")&lt;/script&gt;');
    expect(escapeHtml('User & Pass')).toBe('User &amp; Pass');
  });
});
