import React from 'react';
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
import { EMOJI, tgEmoji, TELEGRAM_EMOJIS, getWebEmojiChar } from '../../../shared/config/emoji';
import { AppIcon } from '../components/common/AppIcon';

export { EMOJI, tgEmoji, AppIcon, TELEGRAM_EMOJIS, getWebEmojiChar };

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
  name?: string;
  fallback?: string;
  className?: string;
  emoji?: string | null;
  emojiId?: string | null;
  asSvg?: boolean;
  size?: number | string;
}

/**
 * Universal High-Speed Local SVG & Unicode Emoji Renderer for React Mini Apps:
 * Replaces unrendered <tg-emoji> tags and broken remote CDN URLs with
 * 100% visible, high-speed local SVG vector assets or crisp Unicode character glyphs.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  id,
  name,
  fallback,
  emoji,
  emojiId,
  className = 'inline-block select-none',
  asSvg = false,
  size = 16,
}) => {
  const resolvedId = id || emojiId || emoji || undefined;
  const rawKey = name || (emoji && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : undefined);
  const key = rawKey?.toUpperCase();

  const entry = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === resolvedId);
  const char = entry?.fallback || fallback || '✨';

  if (asSvg && key && LOCAL_SVG_ICONS[key]) {
    const IconComponent = LOCAL_SVG_ICONS[key];
    return <IconComponent size={size} className={className} />;
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-block select-none font-emoji ${className}`}
      style={{ verticalAlign: '-0.1em' }}
    >
      {char}
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
