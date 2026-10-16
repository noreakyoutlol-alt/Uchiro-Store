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

export type TelegramEmojiKey = keyof typeof TELEGRAM_EMOJIS;

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

// Known animated WebM sticker names from downloader registry
export const ANIMATED_WEBM_SET = new Set([
  'hourglass', 'camera', 'black_star', 'flag_cambodia', 'pin',
  'megaphone', 'yellow_circle', 'key', 'package',
  // Known Telegram Custom Emoji IDs for animated WebM
  '5193070340850327783', '5213452215527677338', '5260623291583831521',
  '5292291996717690768', '5294018354527353443', '5337156404752966663',
  '5854908544712707500', '6138465764518138820', '6300742299114541958',
]);

export const TgEmoji: React.FC<TgEmojiProps> = ({
  id,
  emojiId,
  name,
  fallback,
  emoji,
  className = "inline-flex items-center justify-center select-none",
  asSvg = false,
  size = 20,
}) => {
  const targetId = id || emojiId || (typeof emoji === 'string' && (emoji.startsWith('5') || emoji.startsWith('6')) ? emoji : undefined);
  const cleanName = (name || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : '')).toLowerCase().trim();
  const rawKey = name || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : undefined);
  const key = rawKey?.toUpperCase();

  const numericSize = typeof size === 'number' ? size : (parseInt(String(size), 10) || 20);

  if (asSvg && key && LOCAL_SVG_ICONS[key]) {
    const IconComponent = LOCAL_SVG_ICONS[key];
    return <IconComponent size={numericSize} className={className} />;
  }

  const entry = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === targetId);

  const assetKey = cleanName || (entry ? Object.keys(TELEGRAM_EMOJIS).find(k => TELEGRAM_EMOJIS[k] === entry)?.toLowerCase() : '');
  const displayFallback = entry?.fallback || fallback || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : '✨');
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{ fontSize: `${numericSize}px`, lineHeight: 1, verticalAlign: '-0.1em' }}
      >
        {displayFallback}
      </span>
    );
  }

  const isAnimatedWebm = assetKey ? ANIMATED_WEBM_SET.has(assetKey) : (targetId ? ANIMATED_WEBM_SET.has(targetId) : false);

  if (isAnimatedWebm && (assetKey || targetId)) {
    const videoSrc = (assetKey && ANIMATED_WEBM_SET.has(assetKey))
      ? `/emojis/${assetKey}.webm`
      : `/emojis/${targetId}.webm`;

    return (
      <span
        className={className}
        style={{ width: `${numericSize}px`, height: `${numericSize}px`, verticalAlign: '-0.15em' }}
      >
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain pointer-events-none"
          onError={() => setHasError(true)}
        />
      </span>
    );
  }

  const targetSrc = assetKey ? `/emojis/${assetKey}.webp` : (targetId ? `/emojis/${targetId}.webp` : '');

  if (!targetSrc) {
    return (
      <span
        aria-hidden="true"
        className={className}
        style={{ fontSize: `${numericSize}px`, lineHeight: 1, verticalAlign: '-0.1em' }}
      >
        {displayFallback}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ width: `${numericSize}px`, height: `${numericSize}px`, verticalAlign: '-0.15em' }}
    >
      <img
        src={targetSrc}
        alt={displayFallback}
        width={numericSize}
        height={numericSize}
        loading="lazy"
        className="w-full h-full object-contain pointer-events-none"
        onError={() => setHasError(true)}
      />
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
