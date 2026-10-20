import React, { useMemo } from 'react';
import {
  Sparkles,
  ShoppingBag,
  Zap,
  ShieldCheck,
  ChevronRight,
  Gamepad2,
  PackageOpen,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Product } from '../../types';
import { ProductCard } from '../product/ProductCard';
import { useLanguage } from '../../context/LanguageContext';
import { CollectionsGrid } from './CollectionsGrid';

export interface HomePageProps {
  inStockProducts: Product[];
  isLoadingProducts?: boolean;
  productsError?: string | null;
  onRetryProducts?: () => void;
  onSelectProduct: (product: Product) => void;
  onQuickBuy: (product: Product) => void;
  onNavigateToShop: (categorySlug?: string) => void;
  onNavigateToGacha: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  inStockProducts,
  isLoadingProducts = false,
  productsError = null,
  onRetryProducts,
  onSelectProduct,
  onQuickBuy,
  onNavigateToShop,
  onNavigateToGacha,
}) => {
  const { t, language } = useLanguage();

  const featuredProducts = useMemo(() => {
    return inStockProducts.slice(0, 6);
  }, [inStockProducts]);

  return (
    <div className="space-y-3 pb-24 animate-fadeIn">
      {/* ========================================================= */}
      {/* 1. HERO BANNER */}
      {/* ========================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm bg-slate-900 group">
        <div className="relative h-44 sm:h-52 w-full overflow-hidden">
          <img
            src="/banner.jpg"
            alt="Uchiro Store Banner"
            className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/banners/banner.jpg';
            }}
          />
          {/* Deep Navy/Space Gradient overlay for optimal readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070A14] via-[#070A14]/65 to-black/25" />

          {/* Hero text overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2.5">
            <div className="space-y-1 min-w-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Official Store
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md truncate">
                UCHIRO STORE
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-200 font-medium drop-shadow-sm line-clamp-1">
                Instant Delivery • 14-Day Warranty • 100% Safe
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToShop()}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Shop Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. COLLECTIONS */}
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
            className="text-[11px] text-amber-600 dark:text-[#FFD166] font-bold flex items-center gap-0.5 hover:underline"
          >
            <span>View All</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <CollectionsGrid
          products={inStockProducts}
          onSelectCollection={(slug) => onNavigateToShop(slug)}
          variant="grid"
        />
      </div>

      {/* ========================================================= */}
      {/* 3. FEATURED PRODUCTS */}
      {/* ========================================================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-[#FFD166]" />
            <h2 className="font-black text-xs text-slate-900 dark:text-white tracking-wider uppercase">
              {t('featured_products')}
            </h2>
            {inStockProducts.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                {inStockProducts.length} {language === 'km' ? 'មានក្នុងស្តុក' : 'In Stock'}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-500 dark:text-slate-400 text-[10px] font-semibold border border-slate-500/20">
                0 {language === 'km' ? 'ក្នុងស្តុក' : 'In Stock'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigateToShop()}
            className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            All Products →
          </button>
        </div>

        {/* Loading State */}
        {isLoadingProducts ? (
          <div className="py-10 text-center rounded-2xl bg-white/90 dark:bg-[#0E1322]/90 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === 'km' ? 'កំពុងទាញយកទិន្នន័យទំនិញ...' : 'Loading featured products...'}
            </p>
          </div>
        ) : productsError ? (
          /* Error State */
          <div className="py-7 px-4 text-center rounded-2xl bg-white/90 dark:bg-[#0E1322]/90 border border-rose-500/20 backdrop-blur-sm space-y-2.5">
            <div className="w-10 h-10 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'km' ? 'មិនអាចទាញយកទិន្នន័យទំនិញបានទេ' : 'Unable to Load Products'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                {language === 'km'
                  ? 'សូមពិនិត្យមើលការតភ្ជាប់អ៊ីនធឺណិត ឬព្យាយាមម្តងទៀត'
                  : 'Please check your connection and try again.'}
              </p>
            </div>
            {onRetryProducts && (
              <button
                type="button"
                onClick={onRetryProducts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        ) : featuredProducts.length > 0 ? (
          /* Products Grid */
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
                onQuickBuy={onQuickBuy}
              />
            ))}
          </div>
        ) : (
          /* Genuine Empty State (Clean & Localized) */
          <div className="py-8 px-4 text-center rounded-2xl bg-white/90 dark:bg-[#0E1322]/90 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm space-y-2.5">
            <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-[#FFD166]">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                {language === 'km' ? 'មិនទាន់មានទំនិញក្នុងស្តុកនៅឡើយទេ' : 'No Products Currently In Stock'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                {language === 'km'
                  ? 'ទំនិញថ្មីៗនឹងមកដល់ឆាប់ៗនេះ។ លោកអ្នកក៏អាចចូលមើលទំនិញទាំងអស់ក្នុងហាងបានផងដែរ។'
                  : 'New stock is arriving soon. You can also explore all categories in the shop.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToShop()}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-600 dark:text-amber-300 text-xs font-bold transition-all active:scale-95"
            >
              Browse Shop
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. GACHA REWARDS PROMOTIONAL CARD */}
      {/* ========================================================= */}
      <div
        onClick={onNavigateToGacha}
        className="cursor-pointer rounded-2xl bg-gradient-to-r from-amber-500/10 via-white dark:via-[#0E1322] to-violet-500/10 border border-amber-500/30 dark:border-amber-500/25 p-3 sm:p-3.5 flex items-center justify-between hover:border-amber-400/60 dark:hover:border-amber-400/50 transition-all group shadow-sm active:scale-[0.99] backdrop-blur-sm"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <Sparkles className="w-5 h-5 text-amber-500 dark:text-[#FFD166]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                Gacha Rewards
              </h3>
              <span className="text-[9px] font-extrabold text-amber-600 dark:text-[#FFD166] bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded-md shrink-0">
                100 Pts / Spin
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {language === 'km'
                ? 'បង្វិលយករង្វាន់គណនីហ្គេម និងប័ណ្ណបញ្ចុះតម្លៃ'
                : 'Spin for verified gaming accounts & store vouchers'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 group-hover:bg-amber-400 border border-amber-400/40 text-amber-600 dark:text-amber-300 group-hover:text-slate-950 text-xs font-bold transition-all flex items-center gap-1 shadow-sm">
            <span>Spin</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. WARRANTY & PAYMENT TRUST STRIP */}
      {/* ========================================================= */}
      <footer className="pt-3 pb-2 text-center space-y-2 border-t border-slate-200/60 dark:border-white/5">
        <div className="grid grid-cols-3 gap-1.5 py-1 text-center">
          <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
              14-Day Warranty
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
              Instant Delivery
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
            <CheckCircle2 className="w-4 h-4 text-cyan-500 shrink-0" />
            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">
              KHQR Verified
            </span>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Uchiro Store • Built for Gamers
        </p>
      </footer>
    </div>
  );
};
