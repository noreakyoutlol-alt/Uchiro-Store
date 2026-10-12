import React, { useState, useEffect, useRef } from 'react';
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
  emojiName?: string;
}

export const GAME_CATEGORY_ASSETS: Record<string, GameCategoryAssetDef> = {
  'blox-fruits': {
    asset: '/emojis/sword.webp',
    fallbackEmoji: '⚔️',
    fallbackIcon: Sword,
    alt: 'Blox Fruits',
    emojiName: 'sword',
  },
  'mm2': {
    asset: '/emojis/knife.webp',
    fallbackEmoji: '🔪',
    fallbackIcon: Sword,
    alt: 'Murder Mystery 2',
    emojiName: 'knife',
  },
  'murder-mystery-2': {
    asset: '/emojis/knife.webp',
    fallbackEmoji: '🔪',
    fallbackIcon: Sword,
    alt: 'Murder Mystery 2',
    emojiName: 'knife',
  },
  'rivals': {
    asset: '/emojis/target.webp',
    fallbackEmoji: '🎯',
    fallbackIcon: Target,
    alt: 'Rivals',
    emojiName: 'target',
  },
  'blade-ball': {
    asset: '/emojis/lightning.webp',
    fallbackEmoji: '⚡',
    fallbackIcon: Zap,
    alt: 'Blade Ball',
    emojiName: 'lightning',
  },
  'evade': {
    asset: '/emojis/runner.webp',
    fallbackEmoji: '🏃',
    fallbackIcon: Zap,
    alt: 'Evade',
    emojiName: 'runner',
  },
  'steal-egg': {
    asset: '/emojis/egg.webp',
    fallbackEmoji: '🥚',
    fallbackIcon: Sparkles,
    alt: 'Steal Egg',
    emojiName: 'egg',
  },
  'gamepasses': {
    asset: '/emojis/ticket.webp',
    fallbackEmoji: '🎟️',
    fallbackIcon: Ticket,
    alt: 'Gamepasses',
    emojiName: 'ticket',
  },
  'other': {
    asset: '/emojis/gamepad.webp',
    fallbackEmoji: '🎮',
    fallbackIcon: Package,
    alt: 'Other',
    emojiName: 'gamepad',
  },
};

export interface AnimatedWebmVideoProps {
  src: string;
  className?: string;
  onError: () => void;
}

export const AnimatedWebmVideo: React.FC<AnimatedWebmVideoProps> = ({
  src,
  className = 'w-full h-full object-contain pointer-events-none',
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [src]);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      loop
      muted
      playsInline
      {...({ 'webkit-playsinline': 'true' } as any)}
      preload="auto"
      className={className}
      onError={onError}
    />
  );
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
    else if (normalized.includes('other')) def = GAME_CATEGORY_ASSETS['other'];
  }

  const asset = def?.asset;
  const emoji = fallbackEmoji || def?.fallbackEmoji || '🎮';
  const FallbackIcon = def?.fallbackIcon;

  if (hasError || !asset) {
    if (def?.emojiName) {
      return (
        <TgEmoji
          name={def.emojiName}
          fallback={emoji}
          className={className}
          size={24}
        />
      );
    }
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

  if (asset.endsWith('.webm')) {
    return (
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <AnimatedWebmVideo
          src={asset}
          className={imgClassName}
          onError={() => setHasError(true)}
        />
      </div>
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
  name?: string;
  className?: string;
  fallback?: string;
  id?: string;
  emojiId?: string;
  emoji?: string | null;
  asSvg?: boolean;
  size?: number | string;
}

export const TgEmoji: React.FC<TgEmojiProps> = ({
  name = 'sparkles',
  className = 'w-6 h-6 inline-block',
  fallback = '✨',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  if (error) {
    return <span className={className}>{fallback}</span>;
  }

  return (
    <video
      ref={videoRef}
      src={`/emojis/${name}.webm`}
      className={`${className} object-contain inline-block pointer-events-none select-none`}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      onError={() => setError(true)}
    />
  );
};

export const AnimatedEmoji = TgEmoji;

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
