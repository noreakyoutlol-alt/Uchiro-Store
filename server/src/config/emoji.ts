/**
 * UCHIRO STORE — Telegram Premium Custom Emoji Registry
 *
 * Single canonical source of truth for all Telegram Premium Custom Emoji IDs.
 *
 * SEMANTIC NAMES CONFIGURED:
 *   Navigation / Pages: HOME, SHOP, GACHA, POINTS, ACTIVITY, PROFILE, SETTINGS, SUPPORT
 *   Product Types:      ACCOUNT, GIFT, TRADE, DIGITAL_CODE
 *   Actions & Status:   PAYMENT, DELIVERY, ORDER, SUCCESS, WARNING, ERROR, SECURITY
 *   Economy:            COIN, TICKET, SALE
 *   Admin & Roles:      ADMIN, CROWN, KEY, SHIELD
 *
 * CONFIGURATION STATUS:
 *   All IDs are currently null (NOT YET CONFIGURED).
 *   Real Telegram Premium custom emoji IDs must be obtained from Telegram sticker packs
 *   (via @Stickers or @like_a_bot) and pasted here once available.
 *   DO NOT invent fake or placeholder numeric IDs.
 *
 * USAGE IN TELEGRAM BOT HTML:
 *   tgEmoji('SUCCESS', '✅')  →  '<tg-emoji emoji-id="...">✅</tg-emoji>' (or fallback '✅' if unconfigured)
 */

export const EMOJI = {
  // ─── Navigation / Pages ──────────────────────────────────────────────
  HOME: null,
  SHOP: null,
  GACHA: null,
  POINTS: null,
  ACTIVITY: null,
  PROFILE: null,
  SETTINGS: null,
  SUPPORT: null,

  // ─── Product Types ───────────────────────────────────────────────────
  ACCOUNT: null,
  GIFT: null,
  TRADE: null,
  DIGITAL_CODE: null,

  // ─── Actions & Flow ──────────────────────────────────────────────────
  PAYMENT: null,
  DELIVERY: null,
  ORDER: null,
  SUCCESS: null,
  WARNING: null,
  ERROR: null,
  SECURITY: null,

  // ─── Economy ─────────────────────────────────────────────────────────
  COIN: null,
  TICKET: null,
  SALE: null,

  // ─── Admin / Staff ───────────────────────────────────────────────────
  ADMIN: null,
  CROWN: null,
  KEY: null,
  SHIELD: null,
} as const satisfies Record<string, string | null>;

export type EmojiKey = keyof typeof EMOJI;

/**
 * Format a Telegram custom emoji for HTML parse_mode messages.
 * Falls back to plain emoji text if ID is not configured.
 *
 * @param key       semantic key from EMOJI registry
 * @param fallback  plain emoji character(s) to show when custom emoji is unavailable
 * @returns         '<tg-emoji emoji-id="...">fallback</tg-emoji>' or just fallback
 */
export function tgEmoji(key: EmojiKey, fallback: string): string {
  const id = EMOJI[key];
  if (!id) return fallback;
  return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
}
