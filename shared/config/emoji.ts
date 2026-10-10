/**
 * UCHIRO STORE — Telegram Premium Custom Emoji Registry (Single Source of Truth)
 *
 * This is the ONLY registry file for custom emoji IDs.
 * All consumers import from here:
 *   - Store Bot (server/src/bots/store-bot)
 *   - Admin Bot (server/src/bots/admin-bot)
 *   - Store Mini App (client-store)
 *   - Admin Mini App (client-admin)
 *
 * Do NOT duplicate IDs in other files.
 * Fill in real IDs once obtained from Telegram sticker packs.
 */

export const EMOJI = {
  // ─── Core Navigation / Pages ──────────────────────────────────────────────
  HOME: null,
  SHOP: null,
  GACHA: null,
  POINTS: null,
  ACTIVITY: null,
  ORDERS: null,
  PROFILE: null,
  SETTINGS: null,
  SUPPORT: null,

  // ─── Product Types ────────────────────────────────────────────────────────
  ACCOUNT: null,
  GIFT: null,
  TRADE: null,
  DIGITAL_CODE: null,

  // ─── Actions / Flow ───────────────────────────────────────────────────────
  PAYMENT: null,
  DELIVERY: null,
  ORDER: null,
  SUCCESS: null,
  WARNING: null,
  ERROR: null,
  SECURITY: null,

  // ─── Economy ──────────────────────────────────────────────────────────────
  COIN: null,
  TICKET: null,
  SALE: null,

  // ─── Admin / Staff ────────────────────────────────────────────────────────
  ADMIN: null,
  CROWN: null,
  KEY: null,
  SHIELD: null,
} as const satisfies Record<string, string | null>;

/**
 * Format a Telegram custom emoji for HTML parse_mode messages.
 * Falls back to plain emoji text if ID is not configured.
 *
 * @param key  semantic key from EMOJI
 * @param fallback  plain emoji character(s) to show when custom emoji unavailable
 * @returns  string like '<tg-emoji emoji-id="5368324170671202286">🔥</tg-emoji>' or just '🔥'
 */
export function tgEmoji(key: keyof typeof EMOJI, fallback: string): string {
  const id = EMOJI[key];
  if (!id) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}

/**
 * Build a map of semantic keys → Telegram entity objects for sendMessage entities.
 * Useful when you need the full entity structure instead of inline HTML.
 */
export function buildEmojiEntities(text: string): Array<{ type: 'custom_emoji'; offset: number; length: number; custom_emoji_id: string }> {
  // This is a helper for bot code that uses the entities array format.
  // Implementation depends on your specific text template.
  // The HTML tgEmoji() helper above is simpler and sufficient for most cases.
  return [];
}