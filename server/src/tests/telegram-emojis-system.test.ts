import { describe, it, expect } from 'vitest';
import {
  TELEGRAM_EMOJIS,
  renderTgEmoji,
  enrichWithTgEmojis,
  TelegramEmojiDef,
} from '../config/telegram-emojis';
import { FulfillmentService } from '../services/fulfillment.service';
import { getWelcomeMessage } from '../bots/store-bot';

describe('Dedicated Telegram Custom Emoji System Setup', () => {
  it('defines the complete TELEGRAM_EMOJIS registry with all required keys', () => {
    const requiredKeys = [
      'LIGHTNING',
      'KEY',
      'SHIELD',
      'LOCK',
      'RECEIPT',
      'REFRESH',
      'PHONE',
      'SUPPORT',
      'SUCCESS',
      'ALERT',
      'FIRE',
      'PACKAGE',
      'USER',
    ];

    for (const key of requiredKeys) {
      expect(TELEGRAM_EMOJIS[key]).toBeDefined();
      expect(TELEGRAM_EMOJIS[key].fallback).toBeDefined();
      expect(typeof TELEGRAM_EMOJIS[key].fallback).toBe('string');
      expect(typeof TELEGRAM_EMOJIS[key].customEmojiId).toBe('string');
    }

    expect(TELEGRAM_EMOJIS.LIGHTNING.fallback).toBe('⚡');
    expect(TELEGRAM_EMOJIS.KEY.fallback).toBe('🔑');
    expect(TELEGRAM_EMOJIS.SHIELD.fallback).toBe('🛡️');
    expect(TELEGRAM_EMOJIS.LOCK.fallback).toBe('🔐');
    expect(TELEGRAM_EMOJIS.RECEIPT.fallback).toBe('🧾');
    expect(TELEGRAM_EMOJIS.REFRESH.fallback).toBe('🔄');
    expect(TELEGRAM_EMOJIS.PHONE.fallback).toBe('📲');
    expect(TELEGRAM_EMOJIS.SUPPORT.fallback).toBe('💬');
    expect(TELEGRAM_EMOJIS.SUCCESS.fallback).toBe('✅');
    expect(TELEGRAM_EMOJIS.ALERT.fallback).toBe('⚠️');
    expect(TELEGRAM_EMOJIS.FIRE.fallback).toBe('🔥');
    expect(TELEGRAM_EMOJIS.PACKAGE.fallback).toBe('📦');
    expect(TELEGRAM_EMOJIS.USER.fallback).toBe('👤');
  });

  it('renders <tg-emoji emoji-id="..."> when customEmojiId is configured', () => {
    const lightningHtml = renderTgEmoji('LIGHTNING');
    expect(lightningHtml).toContain('<tg-emoji emoji-id="');
    expect(lightningHtml).toContain('⚡</tg-emoji>');

    const keyHtml = renderTgEmoji('KEY');
    expect(keyHtml).toContain('<tg-emoji emoji-id="');
    expect(keyHtml).toContain('🔑</tg-emoji>');

    const shieldHtml = renderTgEmoji('SHIELD');
    expect(shieldHtml).toContain('<tg-emoji emoji-id="');
    expect(shieldHtml).toContain('🛡️</tg-emoji>');
  });

  it('renders plain fallback emoji when customEmojiId is empty or blank', () => {
    const originalLightningId = TELEGRAM_EMOJIS.LIGHTNING.customEmojiId;
    TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = '';
    expect(renderTgEmoji('LIGHTNING')).toBe('⚡');
    TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = originalLightningId;
  });

  it('returns empty string for non-existent emoji key', () => {
    expect(renderTgEmoji('NON_EXISTENT_KEY' as any)).toBe('');
  });

  it('enriches text with Telegram custom emojis', () => {
    const text = 'Order ready ⚡ Key: 🔑';
    const enriched = enrichWithTgEmojis(text);
    expect(enriched).toContain('<tg-emoji emoji-id="5456140674028019486">⚡</tg-emoji>');
    expect(enriched).toContain('<tg-emoji emoji-id="5193070340850327783">🔑</tg-emoji>');
  });

  it('integrates with Store Bot welcome message', () => {
    const welcome = getWelcomeMessage('en');
    expect(welcome).toContain('WELCOME TO UCHIRO STORE');
    expect(welcome).toContain('Features:');
  });

  it('integrates with Fulfillment Service delivery and warranty sub-screens', () => {
    const dummyOrderId = 'ORD-EMOJI-TEST';
    // Test that delivery card text generation includes emojis
    const cardText = FulfillmentService.getMainDeliveryCardText(dummyOrderId);
    expect(cardText).toContain('ACCOUNT DELIVERY — UCHIRO STORE');
    expect(cardText).toContain('Product:');
    expect(cardText).toContain('Username:');
    expect(cardText).toContain('Password:');
    expect(cardText).toContain('2FA Secret:');

    // Test with configured custom emoji
    const origKey = TELEGRAM_EMOJIS.KEY.customEmojiId;
    TELEGRAM_EMOJIS.KEY.customEmojiId = '999111222';
    const cardWithCustom = FulfillmentService.getMainDeliveryCardText(dummyOrderId);
    expect(cardWithCustom).toContain('<tg-emoji emoji-id="999111222">🔑</tg-emoji>');
    TELEGRAM_EMOJIS.KEY.customEmojiId = origKey;
  });
});
