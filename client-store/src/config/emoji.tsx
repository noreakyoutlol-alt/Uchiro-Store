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

export interface TgEmojiProps {
  emoji?: string | null;
  emojiId?: string | null;
  fallback: string;
  className?: string;
}

/**
 * Universal emoji renderer: Guarantees 100% visible glyphs on all mobile devices.
 * If Telegram Premium custom emoji ID exists:
 *   - Renders as a clean inline image using Telegram's web sticker CDN (WebP).
 *   - Falls back gracefully to Unicode emoji fallback if offline or load fails.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  emoji,
  emojiId,
  fallback,
  className = 'inline-block w-4 h-4 align-middle',
}) => {
  const [hasError, setHasError] = React.useState(false);

  let id = emojiId || emoji;
  if (id && id in EMOJI) {
    id = (EMOJI as Record<string, string | null>)[id];
  }

  // Graceful inline fallback if no ID or asset failed to load
  if (!id || typeof id !== 'string' || !id.trim() || hasError) {
    return <span className="inline-block align-middle">{fallback}</span>;
  }

  return (
    <span className="inline-flex items-center align-middle">
      <img
        src={`https://t.me/i/emoji/${id.trim()}.webp`}
        alt="emoji"
        className={className}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          setHasError(true);
        }}
      />
    </span>
  );
};

/**
 * Inline string helper for JSX text content.
 * In Mini App webviews, always use clean Unicode emoji strings.
 */
export const inlineEmoji = (_emojiId: string | null | undefined, fallback: string): string => {
  return fallback;
};
