/**
 * Client-side (Store Mini App) Telegram Premium Custom Emoji Registry
 * Re-exports EMOJI from shared/config/emoji.ts — single source of truth.
 * Adds React component for <tg-emoji> rendering in Mini Apps.
 */

import React from 'react';
import { EMOJI, tgEmoji } from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export { EMOJI, tgEmoji, AppIcon };

/**
 * Renders a <tg-emoji> element (works in Telegram WebView) with a
 * standard emoji text fallback for regular browsers.
 *
 * @example
 *   <TgEmoji emoji={EMOJI.GACHA} fallback="🎰" />
 */
export const TgEmoji: React.FC<{ emoji: string | null; fallback: string }> = ({
  emoji,
  fallback,
}) => {
  if (!emoji) return <>{fallback}</>;
  // tg-emoji is a non-standard element recognised only by Telegram WebView.
  // TypeScript doesn't know it; the cast keeps the build clean.
  const CustomTag = 'tg-emoji' as any;
  return <CustomTag emoji-id={emoji}>{fallback}</CustomTag>;
};

/**
 * Inline string helper for JSX text content.
 * @example
 *   <span>{inlineEmoji(EMOJI.PAYMENT, '💳')} Payment</span>
 */
export const inlineEmoji = tgEmoji;
