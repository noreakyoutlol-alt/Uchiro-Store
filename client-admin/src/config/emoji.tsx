import React from 'react';
import { EMOJI, tgEmoji, TELEGRAM_EMOJIS, getWebEmojiChar } from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export { EMOJI, tgEmoji, AppIcon, TELEGRAM_EMOJIS, getWebEmojiChar };

export interface TgEmojiProps {
  id?: string;
  name?: string;
  fallback?: string;
  className?: string;
  emoji?: string | null;
  emojiId?: string | null;
}

/**
 * Universal web-safe emoji renderer for React Admin Mini App:
 * Renders web-safe character spans so no raw/broken <tg-emoji> tags or broken image squares
 * are rendered into the DOM.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  id,
  name,
  fallback,
  emoji,
  emojiId,
  className = 'inline-block align-middle',
}) => {
  const resolvedId = id || emojiId || emoji || undefined;
  const key = name?.toUpperCase();
  const def = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e) => e.customEmojiId === resolvedId);
  const displayEmoji = def?.fallback || fallback || '✨';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center select-none font-emoji ${className}`}
      style={{ verticalAlign: '-0.15em' }}
    >
      {displayEmoji}
    </span>
  );
};

export const inlineEmoji = (_emojiId: string | null | undefined, fallback: string): string => {
  return fallback;
};
