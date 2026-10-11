import React, { useState } from 'react';
import {
  Zap,
  Gift,
  Shield,
  Key,
  Flame,
  Package,
  Crown,
  Diamond,
  Ticket,
  CheckCircle,
  AlertTriangle,
  Sword,
  Target,
  Sparkles,
  Coins,
  Receipt,
  LucideProps,
} from 'lucide-react';
import {
  EMOJI,
  tgEmoji,
  TELEGRAM_EMOJIS,
  getWebEmojiChar,
  WEBM_EMOJI_IDS,
  WEBM_EMOJI_NAMES,
  WEBP_EMOJI_IDS,
  WEBP_EMOJI_NAMES,
} from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export {
  EMOJI,
  tgEmoji,
  AppIcon,
  TELEGRAM_EMOJIS,
  getWebEmojiChar,
  WEBM_EMOJI_IDS,
  WEBM_EMOJI_NAMES,
  WEBP_EMOJI_IDS,
  WEBP_EMOJI_NAMES,
};

export const LOCAL_SVG_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  LIGHTNING: Zap,
  GIFT: Gift,
  DIAMOND: Diamond,
  GEM: Diamond,
  SHIELD: Shield,
  KEY: Key,
  FIRE: Flame,
  PACKAGE: Package,
  CROWN: Crown,
  TICKET: Ticket,
  CHECK: CheckCircle,
  SUCCESS: CheckCircle,
  ALERT: AlertTriangle,
  WARNING: AlertTriangle,
  SWORD: Sword,
  TARGET: Target,
  SPARKLES: Sparkles,
  COIN: Coins,
  POINTS: Coins,
  RECEIPT: Receipt,
};

export interface TgEmojiProps {
  id?: string;
  emojiId?: string;
  name?: string;
  fallback?: string;
  className?: string;
  emoji?: string | null;
  asSvg?: boolean;
  size?: number | string;
}

/**
 * Universal Bulletproof Unicode Emoji Renderer for Admin:
 * Eliminates broken <img> / <video> tags and renders crisp 100% visible Unicode emojis
 * using the master TELEGRAM_EMOJIS registry with zero latency and zero broken icons.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  id,
  emojiId,
  name,
  fallback,
  emoji,
  className = "inline-flex items-center justify-center select-none",
  asSvg = false,
  size,
}) => {
  const targetId = id || emojiId || (typeof emoji === 'string' && (emoji.startsWith('5') || emoji.startsWith('6')) ? emoji : undefined);
  const rawKey = name || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : undefined);
  const key = rawKey?.toUpperCase();

  const sizeNumber = typeof size === 'number' ? size : parseInt(String(size), 10) || undefined;

  if (asSvg && key && LOCAL_SVG_ICONS[key]) {
    const IconComponent = LOCAL_SVG_ICONS[key];
    return <IconComponent size={sizeNumber || 20} className={className} />;
  }

  const entry = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === targetId);

  const displayChar = entry?.fallback || fallback || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : '✨');

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: 'inline-block',
        lineHeight: 1,
        verticalAlign: '-0.1em',
        fontSize: size ? (typeof size === 'number' ? `${size}px` : size) : undefined,
      }}
    >
      {displayChar}
    </span>
  );
};

export const inlineEmoji = (
  emojiIdOrKey: string | null | undefined,
  fallback: string
): string => {
  if (!emojiIdOrKey) return fallback;
  const key = emojiIdOrKey.toUpperCase();
  if (TELEGRAM_EMOJIS[key]) {
    return TELEGRAM_EMOJIS[key].fallback;
  }
  const match = Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === emojiIdOrKey);
  return match?.fallback || fallback;
};
