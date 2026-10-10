/**
 * Client-side Standard Unicode Emojis & Lucide Icons (Zero Broken Telegram Emojis)
 * Replaces any custom <tg-emoji> tags with universal emojis: ⚡ 🎁 💎 🛡️ 🔑 🔥 📦 🎮
 * Guarantees 100% visible icons on all mobile devices.
 */

import React from 'react';
import { EMOJI, tgEmoji } from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export { EMOJI, tgEmoji, AppIcon };

export const STANDARD_EMOJIS = {
  LIGHTNING: '⚡',
  GIFT: '🎁',
  DIAMOND: '💎',
  SHIELD: '🛡️',
  KEY: '🔑',
  FIRE: '🔥',
  PACKAGE: '📦',
  GAME: '🎮',
} as const;

/**
 * Universal emoji renderer: Guarantees 100% visible glyphs on all mobile devices
 * without broken or invisible <tg-emoji> custom tags.
 */
export const TgEmoji: React.FC<{ emoji?: string | null; fallback: string }> = ({
  fallback,
}) => {
  return <>{fallback}</>;
};

/**
 * Inline string helper for JSX text content.
 * In Mini App webviews, always use clean Unicode emoji strings.
 */
export const inlineEmoji = (_emojiId: string | null | undefined, fallback: string): string => {
  return fallback;
};
