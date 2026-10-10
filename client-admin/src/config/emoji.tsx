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
  className = 'inline-block select-none',
}) => {
  const resolvedId = id || emojiId || emoji || undefined;
  const key = name?.toUpperCase();
  const entry = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === resolvedId);
  const char = entry?.fallback || fallback || '✨';

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ verticalAlign: '-0.1em' }}
    >
      {char}
    </span>
  );
};

export const inlineEmoji = (_emojiId: string | null | undefined, fallback: string): string => {
  return fallback;
};
