import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { Product } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

export type ProductTier = 'mythical' | 'rare' | 'special' | 'standard';

export interface ProductTierInfo {
  tier: ProductTier;
  badgeLabel: string | null;
  accentColor: 'violet' | 'blue' | 'gold' | 'slate';
  isSpecial: boolean;
}

export function getProductTierInfo(product: Product): ProductTierInfo {
  const badgeRaw = (product.badge || '').trim();
  const badgeUpper = badgeRaw.toUpperCase();
  const specs = product.specifications || {};
  const raritySpec = String(specs.Rarity || specs.rarity || '').toUpperCase();
  const tierSpec = String(specs.Tier || specs.tier || '').toUpperCase();
  const petSpec = String(specs.Pet || specs.pet || '').toUpperCase();
  const titleLower = (product.title || '').toLowerCase();

  // 1. Mythical tier
  if (
    badgeUpper === 'MYTHICAL' ||
    raritySpec === 'MYTHICAL' ||
    tierSpec.includes('MYTHIC') ||
    petSpec.includes('MYTHICAL') ||
    titleLower.includes('mythical')
  ) {
    return {
      tier: 'mythical',
      badgeLabel: badgeRaw || 'MYTHICAL',
      accentColor: 'violet',
      isSpecial: true,
    };
  }

  // 2. Rare / Ancient / Legendary tier
  if (
    badgeUpper.includes('RARE') ||
    badgeUpper.includes('ANCIENT') ||
    badgeUpper === 'LEGENDARY' ||
    raritySpec === 'LEGENDARY' ||
    raritySpec === 'ANCIENT' ||
    raritySpec === 'RARE' ||
    titleLower.includes('ancient')
  ) {
    return {
      tier: 'rare',
      badgeLabel: badgeRaw || (titleLower.includes('ancient') ? 'ANCIENT' : 'RARE'),
      accentColor: 'blue',
      isSpecial: true,
    };
  }

  // 3. Special / Bestseller / VIP / Hot / Event / Featured tier
  if (
    badgeUpper === 'SPECIAL' ||
    badgeUpper === 'BESTSELLER' ||
    badgeUpper === 'HOT' ||
    badgeUpper === 'EVENT' ||
    tierSpec.includes('VIP') ||
    badgeUpper === 'POPULAR' ||
    badgeUpper === 'NEW' ||
    badgeUpper === 'INSTANT' ||
    product.is_featured
  ) {
    return {
      tier: 'special',
      badgeLabel: badgeRaw || (product.is_featured ? 'FEATURED' : 'SPECIAL'),
      accentColor: 'gold',
      isSpecial: true,
    };
  }

  return {
    tier: 'standard',
    badgeLabel: badgeRaw || null,
    accentColor: 'slate',
    isSpecial: false,
  };
}

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickBuy?: (product: Product) => void;
}

const FALLBACK_IMAGE = '/placeholder.svg';

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onQuickBuy,
}) => {
  const { language } = useLanguage();
  const tierInfo = getProductTierInfo(product);

  const isAccount =
    product.delivery_mode === 'auto_account' || product.product_type === 'account';
  const isGift =
    product.delivery_mode === 'manual_service' || product.product_type === 'gift';
  const isTrade =
    product.delivery_mode === 'trade_item' || product.product_type === 'trade';

  // Real-time stock status check
  // A product with positive available stock is never sold out; sold out only when stock <= 0.
  // Legacy records without a numeric stock field fall back to status/is_delivered flags.
  const isConsumedOrDelivered =
    (product as any).is_delivered === true ||
    (product as any).status === 'consumed' ||
    (product as any).status === 'sold';

  const isSoldOut =
    typeof product.stock === 'number'
      ? product.stock <= 0
      : isConsumedOrDelivered;

  // Resolve cover image with backwards-compatibility for older single-image records
  const legacyImageUrl = (product as any).image_url || (product as any).imageUrl || (product as any).image;
  const primaryImage =
    product.media?.find((m) => m.is_primary)?.url ||
    product.media?.[0]?.url ||
    legacyImageUrl ||
    FALLBACK_IMAGE;

  const [imgSrc, setImgSrc] = useState(primaryImage);

  useEffect(() => {
    setImgSrc(primaryImage);
  }, [primaryImage]);

  // Safe fallback handler that avoids infinite retry loops if the fallback itself errors
  const handleImageError = () => {
    if (imgSrc !== FALLBACK_IMAGE) {
      setImgSrc(FALLBACK_IMAGE);
    }
  };

  // Discount calculation
  const hasDiscount = Boolean(
    product.compare_at_price && product.compare_at_price > product.price
  );
  const discountPercent = hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0;

  // Badges: text-[9px] px-1.5 py-0.5
  const renderDeliveryChip = () => {
    if (isAccount) {
      if (isSoldOut) {
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 text-[9px] font-bold">
            🔒 {language === 'km' ? 'អស់ស្តុក' : 'Sold Out'}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
          ⚡ {language === 'km' ? 'ផ្ញើភ្លាមៗ (Auto)' : 'Instant (Auto)'}
        </span>
      );
    }

    if (isGift) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[9px] font-bold">
          🎁 {language === 'km' ? 'កាដូហ្គេម' : 'Gift'}
        </span>
      );
    }

    if (isTrade) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold">
          🤝 {language === 'km' ? 'ដោះដូរ' : 'Trade'}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] font-bold">
        🔑 {language === 'km' ? 'កូដឌីជីថល' : 'Code'}
      </span>
    );
  };

  const renderStockChip = () => {
    if (isAccount) return null;

    if (isSoldOut) {
      return (
        <span className="text-[9px] font-semibold text-rose-500 dark:text-rose-400">
          {language === 'km' ? 'អស់ស្តុក' : 'Sold Out'}
        </span>
      );
    }

    if (product.stock <= 5) {
      return (
        <span className="text-[9px] font-semibold text-amber-500 dark:text-amber-400">
          {language === 'km' ? `នៅសល់ ${product.stock}` : `${product.stock} left`}
        </span>
      );
    }

    return (
      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
        {language === 'km' ? 'មានស្តុក' : 'In Stock'}
      </span>
    );
  };

  // Card container styling based on tier with 3D depth
  let containerTierClasses = 'card-3d border-slate-200/90 dark:border-white/10 hover:border-amber-400/60 dark:hover:border-amber-400/40 shadow-sm';
  let topHighlight = null;

  if (tierInfo.tier === 'mythical') {
    containerTierClasses =
      'card-3d card-3d-purple border-purple-500/40 dark:border-purple-500/50 hover:border-purple-400 dark:hover:border-purple-300 shadow-[0_4px_20px_-4px_rgba(168,85,247,0.18)] dark:shadow-[0_4px_24px_-4px_rgba(168,85,247,0.22)]';
    topHighlight = (
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-purple-400/80 to-transparent shrink-0" />
    );
  } else if (tierInfo.tier === 'rare') {
    containerTierClasses =
      'card-3d card-3d-cyan border-cyan-500/35 dark:border-cyan-500/45 hover:border-cyan-400 dark:hover:border-cyan-300 shadow-[0_4px_20px_-4px_rgba(6,182,212,0.14)] dark:shadow-[0_4px_24px_-4px_rgba(6,182,212,0.18)]';
    topHighlight = (
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent shrink-0" />
    );
  } else if (tierInfo.tier === 'special') {
    containerTierClasses =
      'card-3d card-3d-gold border-amber-500/35 dark:border-amber-500/45 hover:border-amber-400 dark:hover:border-amber-300 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.12)] dark:shadow-[0_4px_20px_-4px_rgba(245,158,11,0.16)]';
    topHighlight = (
      <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-400/80 to-transparent shrink-0" />
    );
  }

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group flex flex-col h-full bg-white dark:bg-[#0E1322] border rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${containerTierClasses} ${
        isSoldOut ? 'opacity-85 grayscale-[20%]' : ''
      }`}
    >
      {topHighlight}

      {/* 4:3 compact cover image with depth overlay */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-[#161C2E]">
        <img
          src={imgSrc}
          alt={product.title}
          onError={handleImageError}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />

        {/* Ambient bottom contrast vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

        {/* Discount Badge */}
        {hasDiscount && discountPercent > 0 && !isSoldOut && (
          <div className="absolute top-1.5 left-1.5 z-10">
            <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black tracking-wider uppercase shadow-sm">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* Rarity / Special / Badge Label */}
        {tierInfo.badgeLabel && !isSoldOut && (
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center">
            {tierInfo.tier === 'mythical' ? (
              <span className="px-1.5 py-0.5 rounded-md bg-purple-950/90 text-purple-200 border border-purple-400/50 text-[9px] font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-1 shadow-md">
                <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span>{tierInfo.badgeLabel}</span>
              </span>
            ) : tierInfo.tier === 'rare' ? (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-950/90 text-cyan-200 border border-cyan-400/50 text-[9px] font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-1 shadow-md">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-300 shrink-0" />
                <span>{tierInfo.badgeLabel}</span>
              </span>
            ) : tierInfo.tier === 'special' ? (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-950/90 text-amber-200 border border-amber-400/50 text-[9px] font-black tracking-wider uppercase backdrop-blur-md flex items-center gap-1 shadow-md">
                <Zap className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                <span>{tierInfo.badgeLabel}</span>
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-900/85 text-slate-200 border border-white/15 text-[9px] font-bold tracking-wider uppercase backdrop-blur-md shadow-sm">
                {tierInfo.badgeLabel}
              </span>
            )}
          </div>
        )}

        {isSoldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-20">
            <span className="px-2 py-0.5 rounded bg-black/85 border border-white/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider">
              {language === 'km' ? 'អស់ពីស្តុក' : 'Sold Out'}
            </span>
          </div>
        )}
      </div>

      {/* Content area: card padding p-2 */}
      <div className="p-2 flex flex-col flex-1 justify-between gap-1.5">
        <div className="space-y-1">
          {/* Badges: text-[9px] px-1.5 py-0.5 */}
          <div className="flex items-center justify-between gap-1">
            {renderDeliveryChip()}
            {renderStockChip()}
          </div>

          {/* Product Title: text-xs font-bold (2-line clamp with min-height for uniform cards) */}
          <div className="min-h-[2.25rem] flex items-start">
            <h3
              className={`font-bold text-xs text-slate-900 dark:text-white line-clamp-2 transition-colors leading-snug ${
                tierInfo.tier === 'mythical'
                  ? 'group-hover:text-purple-400 dark:group-hover:text-purple-300'
                  : 'group-hover:text-amber-500 dark:group-hover:text-amber-400'
              }`}
            >
              {product.title}
            </h3>
          </div>
        </div>

        {/* Pricing + Buy button: py-1.5 px-2 text-xs font-bold rounded-lg */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-1.5">
          <div className="flex flex-col">
            {hasDiscount && (
              <span className="text-[10px] text-slate-400 line-through leading-none font-mono">
                ${product.compare_at_price!.toFixed(2)}
              </span>
            )}
            <div className="flex items-baseline gap-0.5">
              <span
                className={`text-xs sm:text-sm font-black ${
                  tierInfo.tier === 'mythical'
                    ? 'text-amber-400 dark:text-[#FFD166]'
                    : 'text-amber-500 dark:text-[#FFD166]'
                }`}
              >
                ${product.price.toFixed(2)}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase font-mono">
                USD
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation();
              if (onQuickBuy) {
                onQuickBuy(product);
              } else {
                onSelect(product);
              }
            }}
            className={`py-1.5 px-3 min-h-[30px] text-xs font-black rounded-lg transition-all shrink-0 cursor-pointer ${
              isSoldOut
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'btn-3d-gold hover:brightness-110 active:scale-95'
            }`}
          >
            {isSoldOut ? 'Sold Out' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
