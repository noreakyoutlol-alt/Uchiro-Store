import React, { useMemo } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Zap,
  ShieldCheck,
  ChevronRight,
  Gamepad2,
} from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from '../product/ProductCard';
import { useLanguage } from '../../context/LanguageContext';
import { CollectionsGrid } from './CollectionsGrid';

export interface HomePageProps {
  inStockProducts: Product[];
  onSelectProduct: (product: Product) => void;
  onQuickBuy: (product: Product) => void;
  onNavigateToShop: (categorySlug?: string) => void;
  onNavigateToGacha: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  inStockProducts,
  onSelectProduct,
  onQuickBuy,
  onNavigateToShop,
  onNavigateToGacha,
}) => {
  const { t } = useLanguage();

  const featuredProducts = useMemo(() => {
    return inStockProducts.slice(0, 6);
  }, [inStockProducts]);

  return (
    <div className="space-y-2.5 pb-20 animate-fadeIn">
      {/* ========================================================= */}
      {/* 1. HERO (Using original owner asset: banner.jpg) */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm bg-slate-900 group">
        <div className="relative h-40 sm:h-48 w-full overflow-hidden">
          <img
            src="/banner.jpg"
            alt="Uchiro Store Banner"
            className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Fallback to assets folder if needed
              (e.target as HTMLImageElement).src = '/assets/banners/banner.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

          {/* Hero text overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/90 text-black text-[10px] font-black uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-black" />
                Official Store
              </span>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow-sm">
                UCHIRO STORE
              </h1>
              <p className="text-[11px] text-slate-300 font-medium">
                Instant Delivery • 14-Day Warranty • 100% Safe
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToShop()}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-md text-xs font-bold shrink-0 transition-colors"
            >
              Shop Now
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. 8 COLLECTIONS */}
      {/* ========================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            <Gamepad2 className="w-3.5 h-3.5 text-amber-500 dark:text-[#FFD166]" />
            <span>{t('collections')}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToShop()}
            className="text-[11px] text-amber-600 dark:text-[#FFD166] font-bold flex items-center hover:underline"
          >
            <span>{t('view_all')}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* 8 Collection Badges in AAA Glowing Grid */}
        <CollectionsGrid
          products={inStockProducts}
          onSelectCollection={(slug) => onNavigateToShop(slug)}
          variant="grid"
        />
      </div>

      {/* ========================================================= */}
      {/* 3. FEATURED PRODUCTS (Clean In-Stock Products) */}
      {/* ========================================================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-[#FFD166]" />
            <h2 className="font-black text-xs text-slate-900 dark:text-white tracking-wider uppercase">
              {t('featured_products')}
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
              {inStockProducts.length} {t('in_stock_badge')}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToShop()}
            className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {t('all_products')}
          </button>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
                onQuickBuy={onSelectProduct}
              />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center rounded-xl bg-white/80 dark:bg-[#121624]/80 border border-slate-200 dark:border-white/10 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              មិនទាន់មានទំនិញក្នុងស្តុកនៅឡើយទេ (No products available in stock)
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. SMALL GACHA SHORTCUT */}
      {/* ========================================================= */}
      <div
        onClick={onNavigateToGacha}
        className="cursor-pointer rounded-xl bg-white/90 dark:bg-[#121624]/90 border border-slate-200/90 dark:border-white/10 p-3 flex items-center justify-between hover:border-amber-400/50 dark:hover:border-[#FFD166]/40 transition-all group shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-500 dark:text-[#FFD166]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Gacha Rewards
              </h3>
              <span className="text-[9px] font-extrabold text-amber-600 dark:text-[#FFD166] bg-amber-500/10 px-1 rounded">
                100 Pts / Ticket
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Spin for verified gaming accounts & store vouchers
            </p>
          </div>
        </div>

        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-amber-500 dark:group-hover:text-[#FFD166] shrink-0 ml-2">
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. FOOTER */}
      {/* ========================================================= */}
      <footer className="pt-4 pb-2 text-center space-y-1.5 border-t border-slate-200/60 dark:border-white/5">
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>14-Day Warranty on Accounts • Verified Payments</span>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Uchiro Store • Built for Gamers
        </p>
      </footer>
    </div>
  );
};
