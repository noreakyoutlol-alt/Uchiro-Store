import React from 'react';
import { Product } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onQuickBuy?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
}) => {
  const { language } = useLanguage();

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

  return (
    <div
      onClick={() => onSelect(product)}
      className={`group flex flex-col bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-white/10 rounded-xl overflow-hidden hover:border-amber-400/60 dark:hover:border-amber-400/40 transition-colors duration-150 cursor-pointer select-none shadow-sm ${
        isSoldOut ? 'opacity-85 grayscale-[20%]' : ''
      }`}
    >
      {/* 4:3 compact cover image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-[#181E30]">
        <img
          src={primaryImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
        />
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
            <span className="px-1.5 py-0.5 rounded bg-black/80 border border-white/20 text-rose-300 text-[9px] font-bold uppercase tracking-wider">
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

          {/* Product Title: text-xs font-bold (2-line clamp) */}
          <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors leading-snug">
            {product.title}
          </h3>
        </div>

        {/* Pricing + Buy button: py-1.5 px-2 text-xs font-bold rounded-lg */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-1.5">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xs sm:text-sm font-bold text-amber-500 dark:text-amber-400">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase">
              USD
            </span>
          </div>

          <button
            type="button"
            disabled={isSoldOut}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(product);
            }}
            className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-colors shrink-0 ${
              isSoldOut
                ? 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-amber-400 dark:bg-amber-400 text-black hover:bg-amber-300 active:scale-95'
            }`}
          >
            {isSoldOut
              ? (language === 'km' ? 'អស់ស្តុក' : 'Sold Out')
              : (language === 'km' ? 'ទិញភ្លាមៗ' : 'Buy Now')}
          </button>
        </div>
      </div>
    </div>
  );
};
