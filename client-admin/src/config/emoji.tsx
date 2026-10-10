/**
 * Client-side (Admin Mini App) Telegram Premium Custom Emoji Registry
 * Re-exports EMOJI from shared/config/emoji.ts — single source of truth.
 * Adds React component for <tg-emoji> rendering in Mini Apps.
 */

import React from 'react';
import { EMOJI, tgEmoji } from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export { EMOJI, tgEmoji, AppIcon };

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
 */
export const inlineEmoji = (_emojiId: string | null | undefined, fallback: string): string => {
  return fallback;
};
