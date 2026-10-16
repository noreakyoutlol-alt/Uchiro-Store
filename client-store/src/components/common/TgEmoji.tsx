import React from 'react';
import { TELEGRAM_EMOJIS } from '../../config/emoji';

export type TelegramEmojiKey = keyof typeof TELEGRAM_EMOJIS;

export interface TgEmojiProps {
  name: TelegramEmojiKey | string;
  className?: string;
  fallback?: string;
}

/**
 * TgEmoji component for React Mini App / Web View.
 * Renders the clean Unicode fallback character or specified glyph.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({ name, className = '', fallback }) => {
  const emojiDef = (TELEGRAM_EMOJIS as Record<string, any>)[name];
  const displayChar = fallback || emojiDef?.fallback || '✨';

  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {displayChar}
    </span>
  );
};

export default TgEmoji;
