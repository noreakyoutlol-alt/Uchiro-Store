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
 * Universal High-Speed Local Telegram Premium & Unicode Emoji Renderer:
 * - Loads static .webp and animated video .webm assets directly from /emojis/
 * - Instantaneous fallback to native crisp Unicode emoji character glyphs
 * - Supports Lucide SVG rendering when asSvg={true}
 * - 100% backward compatible with all props (id, emojiId, emoji, name, fallback, size, className, asSvg)
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  id,
  emojiId,
  name,
  fallback,
  emoji,
  className = 'inline-block align-middle',
  asSvg = false,
  size = 20,
}) => {
  const resolvedId = id || emojiId || (typeof emoji === 'string' && (emoji.startsWith('5') || emoji.startsWith('6')) ? emoji : undefined);
  const rawKey = name || (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : undefined);
  const key = rawKey?.toUpperCase();

  const entry = key
    ? TELEGRAM_EMOJIS[key]
    : Object.values(TELEGRAM_EMOJIS).find((e: any) => e.customEmojiId === resolvedId);

  const targetId = resolvedId || entry?.customEmojiId;
  const displayFallback =
    entry?.fallback ||
    fallback ||
    (typeof emoji === 'string' && !emoji.startsWith('5') && !emoji.startsWith('6') ? emoji : '✨');

  const sizeNumber = typeof size === 'number' ? size : parseInt(String(size), 10) || 20;
  const sizeCss = typeof size === 'number' || /^\d+$/.test(String(size)) ? `${size}px` : String(size);

  if (asSvg && key && LOCAL_SVG_ICONS[key]) {
    const IconComponent = LOCAL_SVG_ICONS[key];
    return <IconComponent size={sizeNumber} className={className} />;
  }

  const [failedTarget, setFailedTarget] = useState<string | null>(null);
  const imgFailed = targetId ? failedTarget === targetId : false;

  // If no customEmojiId or asset failed to load, render native crisp Unicode emoji
  if (!targetId || imgFailed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center select-none ${className}`}
        style={{ fontSize: sizeCss, lineHeight: 1 }}
      >
        {displayFallback}
      </span>
    );
  }

  const cleanTarget = targetId.replace(/^\/?emojis\//, '');
  const isExplicitWebm = cleanTarget.endsWith('.webm');
  const isExplicitWebp = cleanTarget.endsWith('.webp');

  const isVideo =
    isExplicitWebm ||
    (!isExplicitWebp && (
      WEBM_EMOJI_IDS.has(cleanTarget) ||
      WEBM_EMOJI_NAMES.has(cleanTarget) ||
      (Boolean(key) && WEBM_EMOJI_NAMES.has(key!))
    ));

  const assetSrc = isExplicitWebm || isExplicitWebp
    ? `/emojis/${cleanTarget}`
    : (isVideo ? `/emojis/${cleanTarget}.webm` : `/emojis/${cleanTarget}.webp`);

  return (
    <span
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ width: sizeCss, height: sizeCss, verticalAlign: '-0.15em' }}
    >
      {isVideo ? (
        <video
          src={assetSrc}
          autoPlay
          loop
          muted
          playsInline
          width={sizeNumber}
          height={sizeNumber}
          className="w-full h-full object-contain pointer-events-none"
          onError={() => setFailedTarget(targetId)}
        />
      ) : (
        <img
          src={assetSrc}
          alt={displayFallback}
          width={sizeNumber}
          height={sizeNumber}
          loading="lazy"
          className="w-full h-full object-contain pointer-events-none"
          onError={() => setFailedTarget(targetId)}
        />
      )}
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
