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
