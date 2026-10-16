import { enrichWithTgEmojis as enrichCanonical } from '../../../config/telegram-emojis';

export interface TelegramCustomEmoji {
  name: string;
  emoji: string;
  id: string;
}

export const TG_PREMIUM_EMOJI_REGISTRY: Record<string, string> = {
  '⚡': '5456140674028019486', // LIGHTNING
  '🔑': '5193070340850327783', // KEY
  '🛡️': '5197288647275071607', // SHIELD
  '🛡': '5197288647275071607',
  '🔥': '6106937569239372743', // FIRE
  '👑': '5433758796289685818', // CROWN
  '💵': '6301016442582081020', // MONEY
  '💰': '6301016442582081020',
  '💸': '6301016442582081020',
  '💎': '6107301563422740787', // GEM / DIAMOND
  '🎟️': '5291994784980813319', // TICKET
  '🎟': '5291994784980813319',
  '🎫': '5291994784980813319',
  '🎁': '5203996991054432397', // GIFT
  '🎰': '5235989279024373566', // SLOT_MACHINE
  '✨': '5852724394928905160', // SPARKLES
  '🛍️': '5373052667671093676', // SHOPPING_BAGS
  '🛍': '5373052667671093676',
  '📦': '5854908544712707500', // PACKAGE
  '💬': '6106980145250177382', // SUPPORT
  '⏳': '5213452215527677338', // HOURGLASS
  '⌛': '5213452215527677338',
  '📜': '5217939515754174728', // SCROLL
  '✅': '6109293985866453915', // CHECK
  '⚠️': '5420323339723881652', // ALERT
  '⚠': '5420323339723881652',
  '❌': '6300696192640620174', // CROSS
  '🎮': '5224737297932503025', // GAMEPAD
  '🔐': '5836690092306992715', // LOCK
};

/**
 * Wraps standard emoji icons with <tg-emoji emoji-id="..."> tags.
 * Preserves text already wrapped and avoids altering button titles.
 * Uses canonical idempotent implementation.
 */
export function enrichWithTgEmojis(text: string): string {
  return enrichCanonical(text);
}
