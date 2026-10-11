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

export interface GameCategoryAssetDef {
  asset: string;
  fallbackEmoji: string;
  fallbackIcon: React.ComponentType<LucideProps>;
  alt: string;
}

export const GAME_CATEGORY_ASSETS: Record<string, GameCategoryAssetDef> = {
  'blox-fruits': {
    asset: '/emojis/sword.webp',
    fallbackEmoji: '⚔️',
    fallbackIcon: Sword,
    alt: 'Blox Fruits',
  },
  'mm2': {
    asset: '/emojis/knife.webp',
    fallbackEmoji: '🔪',
    fallbackIcon: Sword,
    alt: 'Murder Mystery 2',
  },
  'murder-mystery-2': {
    asset: '/emojis/knife.webp',
    fallbackEmoji: '🔪',
    fallbackIcon: Sword,
    alt: 'Murder Mystery 2',
  },
  'rivals': {
    asset: '/emojis/target.webp',
    fallbackEmoji: '🎯',
    fallbackIcon: Target,
    alt: 'Rivals',
  },
  'blade-ball': {
    asset: '/emojis/lightning.webp',
    fallbackEmoji: '⚡',
    fallbackIcon: Zap,
    alt: 'Blade Ball',
  },
  'evade': {
    asset: '/emojis/runner.webp',
    fallbackEmoji: '🏃',
    fallbackIcon: Zap,
    alt: 'Evade',
  },
  'steal-egg': {
    asset: '/emojis/egg.webp',
    fallbackEmoji: '🥚',
    fallbackIcon: Sparkles,
    alt: 'Steal Egg',
  },
  'gamepasses': {
    asset: '/emojis/ticket.webp',
    fallbackEmoji: '🎟️',
    fallbackIcon: Ticket,
    alt: 'Gamepasses',
  },
  'other': {
    asset: '/emojis/package.webm',
    fallbackEmoji: '🎮',
    fallbackIcon: Package,
    alt: 'Other',
  },
};

export interface CategoryIconProps {
  slug?: string;
  name?: string;
  fallbackEmoji?: string;
  className?: string;
  imgClassName?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  slug,
  name,
  fallbackEmoji,
  className = 'w-7 h-7 sm:w-8 sm:h-8',
  imgClassName = 'w-full h-full object-contain select-none',
}) => {
  const [hasError, setHasError] = useState(false);
  const normalized = (slug || name || '').toLowerCase().replace(/_/g, '-');

  let def = GAME_CATEGORY_ASSETS[normalized];
  if (!def) {
    if (normalized.includes('blox')) def = GAME_CATEGORY_ASSETS['blox-fruits'];
    else if (normalized.includes('mm2') || normalized.includes('murder')) def = GAME_CATEGORY_ASSETS['mm2'];
    else if (normalized.includes('rival')) def = GAME_CATEGORY_ASSETS['rivals'];
    else if (normalized.includes('blade')) def = GAME_CATEGORY_ASSETS['blade-ball'];
    else if (normalized.includes('evade')) def = GAME_CATEGORY_ASSETS['evade'];
    else if (normalized.includes('egg') || normalized.includes('pet')) def = GAME_CATEGORY_ASSETS['steal-egg'];
    else if (normalized.includes('pass')) def = GAME_CATEGORY_ASSETS['gamepasses'];
  }

  const asset = def?.asset;
  const emoji = fallbackEmoji || def?.fallbackEmoji || '🎮';
  const FallbackIcon = def?.fallbackIcon;

  if (hasError || !asset) {
    if (FallbackIcon) {
      return (
        <div className={`flex items-center justify-center ${className}`}>
          <FallbackIcon className="w-5 h-5 text-current" />
        </div>
      );
    }
    return (
      <span className="text-lg sm:text-xl select-none" role="img" aria-label={name || 'Category'}>
        {emoji}
      </span>
    );
  }

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={asset}
        alt={def?.alt || name || 'Category'}
        className={imgClassName}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
      />
    </div>
  );
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
 * Universal Bulletproof Unicode Emoji Renderer:
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
