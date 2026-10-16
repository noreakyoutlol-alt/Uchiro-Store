import React, { useState, useEffect, useRef } from 'react';
import {
  TELEGRAM_EMOJIS,
  WEBM_EMOJI_IDS,
  WEBM_EMOJI_NAMES,
  WEBP_EMOJI_IDS,
  WEBP_EMOJI_NAMES,
  LOCAL_SVG_ICONS,
  TelegramEmojiKey,
} from '../../config/emoji';

export type { TelegramEmojiKey };

export interface TgEmojiProps {
  name: TelegramEmojiKey | string;
  size?: number | string;
  className?: string;
  fallback?: string;
  animated?: boolean;
  alt?: string;
  title?: string;
}

interface ResolvedAsset {
  format: 'webm' | 'webp' | 'icon' | 'unicode';
  src?: string;
  fallbackChar: string;
  iconKey?: string;
}

/**
 * Resolves any Telegram emoji key, customEmojiId, or alias name to the best local asset.
 */
export function resolveEmojiAsset(keyOrIdOrName: string, fallback?: string): ResolvedAsset {
  if (!keyOrIdOrName) {
    return { format: 'unicode', fallbackChar: fallback || '✨' };
  }

  const raw = String(keyOrIdOrName).trim();
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  let emojiDef = (TELEGRAM_EMOJIS as Record<string, any>)[upper];
  let customId = emojiDef?.customEmojiId;

  if (!emojiDef) {
    for (const [k, def] of Object.entries(TELEGRAM_EMOJIS)) {
      if (def.customEmojiId === raw) {
        emojiDef = def;
        customId = def.customEmojiId;
        break;
      }
    }
  }

  if (!customId && /^\d{15,22}$/.test(raw)) {
    customId = raw;
  }

  const fallbackChar = fallback || emojiDef?.fallback || '✨';

  if (customId && WEBM_EMOJI_IDS.has(customId)) {
    return {
      format: 'webm',
      src: `/emojis/${customId}.webm`,
      fallbackChar,
      iconKey: upper,
    };
  }
  if (WEBM_EMOJI_NAMES.has(upper) || WEBM_EMOJI_NAMES.has(lower)) {
    return {
      format: 'webm',
      src: `/emojis/${lower}.webm`,
      fallbackChar,
      iconKey: upper,
    };
  }

  if (customId && WEBP_EMOJI_IDS.has(customId)) {
    return {
      format: 'webp',
      src: `/emojis/${customId}.webp`,
      fallbackChar,
      iconKey: upper,
    };
  }
  if (WEBP_EMOJI_NAMES.has(upper) || WEBP_EMOJI_NAMES.has(lower)) {
    return {
      format: 'webp',
      src: `/emojis/${lower}.webp`,
      fallbackChar,
      iconKey: upper,
    };
  }

  if (LOCAL_SVG_ICONS[upper]) {
    return {
      format: 'icon',
      fallbackChar,
      iconKey: upper,
    };
  }

  return {
    format: 'unicode',
    fallbackChar,
    iconKey: upper,
  };
}

/**
 * TgEmoji component for React Admin Dashboard.
 * Renders animated WebM video, high-DPI WebP image, crisp SVG icon, or Unicode character.
 * Prevents layout shifts, respects prefers-reduced-motion, and fails safely.
 */
export const TgEmoji: React.FC<TgEmojiProps> = ({
  name,
  size = 20,
  className = '',
  fallback,
  animated = true,
  alt,
  title,
}) => {
  const [loadFailed, setLoadFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => {
        setPrefersReducedMotion(e.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', mediaQuery.matches ? undefined : (handleChange as any));
        return () => mediaQuery.removeEventListener('change', handleChange as any);
      }
    }
  }, []);

  const asset = resolveEmojiAsset(name, fallback);
  const sizePx = typeof size === 'number' ? `${size}px` : size;
  const dimensionStyle: React.CSSProperties = {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    minHeight: sizePx,
  };

  const handleMediaError = () => {
    setLoadFailed(true);
  };

  useEffect(() => {
    if (asset.format === 'webm' && videoRef.current && !loadFailed && !prefersReducedMotion) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [asset.format, asset.src, loadFailed, prefersReducedMotion]);

  if (asset.format === 'webm' && asset.src && !loadFailed && animated && !prefersReducedMotion) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 align-middle select-none ${className}`}
        style={dimensionStyle}
        title={title || alt || String(name)}
      >
        <video
          ref={videoRef}
          src={asset.src}
          autoPlay
          loop
          muted
          playsInline
          {...({ 'webkit-playsinline': 'true' } as any)}
          preload="auto"
          className="w-full h-full object-contain pointer-events-none"
          onError={handleMediaError}
          aria-label={alt || String(name)}
        />
      </span>
    );
  }

  if (asset.format === 'webp' && asset.src && !loadFailed) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 align-middle select-none ${className}`}
        style={dimensionStyle}
        title={title || alt || String(name)}
      >
        <img
          src={asset.src}
          alt={alt || String(name)}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain pointer-events-none"
          onError={handleMediaError}
        />
      </span>
    );
  }

  if (asset.iconKey && LOCAL_SVG_ICONS[asset.iconKey]) {
    const SvgIcon = LOCAL_SVG_ICONS[asset.iconKey];
    const numSize = typeof size === 'number' ? size : parseInt(sizePx, 10) || 20;
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
        style={dimensionStyle}
        title={title || alt || String(name)}
      >
        <SvgIcon size={numSize} className="w-full h-full object-contain" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle leading-none select-none ${className}`}
      style={{
        ...dimensionStyle,
        fontSize: sizePx,
      }}
      role="img"
      aria-label={alt || String(name)}
      title={title || alt || String(name)}
    >
      {asset.fallbackChar}
    </span>
  );
};

export default TgEmoji;
