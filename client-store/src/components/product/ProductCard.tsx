import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickBuy?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onQuickBuy,
}) => {
  const isAccount =
    product.delivery_mode === 'auto_account' || product.product_type === 'account';
  const isGift =
    product.delivery_mode === 'manual_service' || product.product_type === 'gift';
  const isTrade =
    product.delivery_mode === 'trade_item' || product.product_type === 'trade';

  // Real-time stock status check
  const isConsumedOrDelivered =
    (product as any).is_delivered === true ||
    (product as any).status === 'consumed' ||
    (product as any).status === 'sold';

  const isSoldOut = product.stock <= 0 || isConsumedOrDelivered;

  const primaryImage =
    product.media?.find((m) => m.is_primary)?.url ||
    product.media?.[0]?.url ||
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80';

  // Delivery Mode Pill (Sleek inline pill positioned below the clean image, single clean icon)
  const renderDeliveryPill = () => {
    if (isAccount) {
      if (isSoldOut) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 text-[10px] font-bold">
            <span>🔒 SOLD OUT</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
          <span>⚡ Available • Instant Delivery</span>
        </span>
      );
    }

    if (isGift) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
          <span>🎁 Roblox Gift</span>
        </span>
      );
    }

    if (isTrade) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
          <span>🤝 In-Game Trade</span>
        </span>
      );
    }

    // Default to Digital Code
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold">
        <span>🔑 Digital Code</span>
      </span>
    );
  };

  // Stock status indicator with subtle pulse
  // STRICT RULE: If delivery_mode === 'auto_account', completely hide right-hand numeric badge
  const renderStockIndicator = () => {
    if (isAccount) {
      return null;
    }

    if (isSoldOut) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 dark:text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span>Sold Out</span>
        </span>
      );
    }

    if (product.stock <= 5) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <span>🟡 {product.stock} left</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <span>🟢 In Stock</span>
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group flex flex-col bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-white/10 rounded-xl overflow-hidden hover:border-amber-400/60 dark:hover:border-[#FFD166]/40 transform-gpu transition-transform duration-200 hover:scale-[1.01] shadow-sm hover:shadow-md cursor-pointer select-none ${
        isSoldOut ? 'opacity-85 grayscale-[25%] hover:grayscale-[10%]' : ''
      }`}
    >
      {/* 100% Clean Product Preview Image Frame (Zero Overlaid Badges) */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-[#181E30]">
        <img
          src={primaryImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />

        {/* Minimal Sold Out watermark blur only if sold out */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="px-2.5 py-1 rounded bg-black/80 border border-white/20 text-rose-300 text-[10px] font-black tracking-wider uppercase">
              Sold Out
            </div>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2.5">
        <div className="space-y-1.5">
          {/* Sleek inline row BELOW the image: Delivery Mode on Left, Stock status on Right */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {renderDeliveryPill()}
            {renderStockIndicator()}
          </div>

          {/* Product Title */}
          <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-amber-500 dark:group-hover:text-[#FFD166] transition-colors pt-0.5">
            {product.title}
          </h3>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-snug">
            {product.short_description || product.description || 'Exclusive gaming account & item'}
          </p>

          {/* Warranty tag if applicable */}
          {product.warranty_days ? (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-400 pt-0.5">
              <ShieldCheck className="w-3 h-3 text-amber-500 dark:text-[#FFD166]" />
              <span>{product.warranty_days}d Warranty</span>
            </div>
          ) : null}
        </div>

        {/* Price & Clean Buy Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${product.price.toFixed(2)}
              </span>
              {product.compare_at_price && product.compare_at_price > product.price ? (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 line-through">
                  ${product.compare_at_price.toFixed(2)}
                </span>
              ) : null}
            </div>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">
              {(product as any).currency || 'USD'}
            </span>
          </div>

          <button
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation();
              if (isSoldOut) return;
              if (onQuickBuy) {
                onQuickBuy(product);
              } else {
                onSelect(product);
              }
            }}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all shrink-0 ${
              isSoldOut
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-80'
                : 'bg-amber-400 dark:bg-[#FFD166] text-black hover:bg-amber-300 dark:hover:bg-[#ffe082] shadow-sm active:scale-95'
            }`}
          >
            {isSoldOut ? 'Sold Out' : 'Buy Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
