import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  KeyRound,
  UserCheck,
  Gift,
  Repeat,
  PackageOpen,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { ProductCard } from '../product/ProductCard';
import { useLanguage } from '../../context/LanguageContext';
import {
  CollectionsGrid,
  GAME_COLLECTIONS,
  matchProductToCollection,
} from '../home/CollectionsGrid';
import { CategoryIcon } from '../../config/emoji';

interface ShopPageProps {
  products: Product[];
  categories: Category[];
  selectedCategorySlug: string | null;
  onSelectCategory: (slug: string | null) => void;
  onSelectProduct: (product: Product) => void;
  onQuickBuy: (product: Product) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

type ProductTypeKey = 'all' | 'account' | 'gift' | 'trade' | 'digital_code';
type SortOption = 'default' | 'price_asc' | 'price_desc';

export const PRIMARY_COLLECTIONS = GAME_COLLECTIONS;

export const ShopPage: React.FC<ShopPageProps> = ({
  products,
  categories,
  selectedCategorySlug,
  onSelectCategory,
  onSelectProduct,
  onQuickBuy,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<ProductTypeKey>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // Active collection metadata
  const activeCollectionMeta = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return (
      PRIMARY_COLLECTIONS.find(
        (c) =>
          c.slug === selectedCategorySlug ||
          (selectedCategorySlug === 'mm2' && c.slug === 'murder-mystery-2') ||
          (selectedCategorySlug === 'murder-mystery-2' && c.slug === 'mm2')
      ) || null
    );
  }, [selectedCategorySlug]);

  // Products belonging to the selected collection
  const collectionProducts = useMemo(() => {
    if (!selectedCategorySlug) return [];
    return products.filter((p) =>
      matchProductToCollection(p, selectedCategorySlug, categories)
    );
  }, [products, categories, selectedCategorySlug]);

  // Compute ONLY product types that ACTUALLY EXIST in this collection
  const availableProductTypes = useMemo(() => {
    if (!selectedCategorySlug || collectionProducts.length === 0) return [];

    const accountCount = collectionProducts.filter(
      (p) => p.delivery_mode === 'auto_account' || p.product_type === 'account'
    ).length;

    const giftCount = collectionProducts.filter(
      (p) => p.delivery_mode === 'manual_service' || p.product_type === 'gift'
    ).length;

    const tradeCount = collectionProducts.filter(
      (p) => p.delivery_mode === 'trade_item' || p.product_type === 'trade'
    ).length;

    const codeCount = collectionProducts.filter(
      (p) => p.delivery_mode === 'digital_code' || p.product_type === 'digital_code'
    ).length;

    const types: Array<{ key: ProductTypeKey; label: string; icon: any; count: number }> = [
      { key: 'all', label: t('filter_all'), icon: null, count: collectionProducts.length },
    ];

    if (accountCount > 0) {
      types.push({ key: 'account', label: t('filter_accounts'), icon: UserCheck, count: accountCount });
    }
    if (giftCount > 0) {
      types.push({ key: 'gift', label: t('filter_gifts'), icon: Gift, count: giftCount });
    }
    if (tradeCount > 0) {
      types.push({ key: 'trade', label: t('filter_trades'), icon: Repeat, count: tradeCount });
    }
    if (codeCount > 0) {
      types.push({ key: 'digital_code', label: t('filter_codes'), icon: KeyRound, count: codeCount });
    }

    return types;
  }, [collectionProducts, selectedCategorySlug, t]);

  // Global search results across all collections when on main screen
  const globalSearchResults = useMemo(() => {
    if (selectedCategorySlug || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    let list = products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.badge && p.badge.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.short_description && p.short_description.toLowerCase().includes(q))
    );

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [products, searchQuery, selectedCategorySlug, sortBy]);

  // Filter products by selected product type, search query, and sort
  const displayedProducts = useMemo(() => {
    let list = [...collectionProducts];

    if (selectedProductType !== 'all') {
      list = list.filter((p) => {
        if (selectedProductType === 'account') {
          return p.delivery_mode === 'auto_account' || p.product_type === 'account';
        }
        if (selectedProductType === 'gift') {
          return p.delivery_mode === 'manual_service' || p.product_type === 'gift';
        }
        if (selectedProductType === 'trade') {
          return p.delivery_mode === 'trade_item' || p.product_type === 'trade';
        }
        if (selectedProductType === 'digital_code') {
          return p.delivery_mode === 'digital_code' || p.product_type === 'digital_code';
        }
        return true;
      });
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.badge && p.badge.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.short_description && p.short_description.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [collectionProducts, selectedProductType, searchQuery, sortBy]);

  // =========================================================================
  // LOADING STATE
  // =========================================================================
  if (isLoading && products.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-center animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-amber-500 dark:text-[#FFD166] animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {language === 'km' ? 'កំពុងផ្ទុកទំនិញក្នុងស្តុក...' : 'Loading verified catalog...'}
          </p>
          <p className="text-[11px] text-slate-400">
            {language === 'km' ? 'សូមរង់ចាំបន្តិច' : 'Fetching live inventory data'}
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ERROR STATE
  // =========================================================================
  if (error && products.length === 0) {
    return (
      <div className="py-14 px-4 flex flex-col items-center justify-center gap-3 text-center rounded-2xl bg-white dark:bg-[#0E1322] border border-rose-500/20 dark:border-rose-500/20 shadow-sm animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {language === 'km' ? 'មិនអាចទាញយកទិន្នន័យទំនិញបានទេ' : 'Failed to Load Products'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
            {error || (language === 'km' ? 'សូមពិនិត្យមើលការតភ្ជាប់អ៊ីនធឺណិត ហើយព្យាយាមម្តងទៀត' : 'Please check your connection and try again.')}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 dark:bg-[#FFD166] text-slate-950 text-xs font-bold hover:bg-amber-300 transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // 1. INITIAL SHOP SCREEN: GAME COLLECTIONS & SEARCH
  // =========================================================================
  if (!selectedCategorySlug) {
    return (
      <div className="space-y-3.5 pb-24 sm:pb-28 animate-fadeIn">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Game Collections
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select a game to view verified accounts, gifts, and trade items
          </p>
        </div>

        {/* Global Catalog Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all game items..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* If user is actively searching on main screen, show search results */}
        {searchQuery.trim().length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Found {globalSearchResults.length} items for "{searchQuery}"
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="font-bold text-amber-500 dark:text-amber-400 hover:underline"
              >
                Clear Search
              </button>
            </div>

            {globalSearchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
                {globalSearchResults.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    onQuickBuy={onQuickBuy}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center rounded-2xl bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-white/10 p-6 space-y-3 shadow-sm">
                <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400">
                  <PackageOpen className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'km' ? 'រកមិនឃើញទំនិញដែលត្រូវគ្នាទេ' : 'No Matching Items Found'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {language === 'km' ? 'សូមសាកល្បងស្វែងរកដោយពាក្យគន្លឹះផ្សេង' : 'Try searching with different keywords'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 dark:bg-[#FFD166] text-slate-950 text-xs font-bold hover:bg-amber-300 transition-all shadow-sm"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 8 Premium Game Collection Cards with Item Counts & Descriptions */
          <CollectionsGrid
            variant="cards"
            products={products}
            categories={categories}
            selectedSlug={selectedCategorySlug}
            onSelectCollection={(slug) => {
              setSelectedProductType('all');
              setSearchQuery('');
              setSortBy('default');
              onSelectCategory(slug);
            }}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. COLLECTION OPENED: QUICK-SWITCH BAR + FILTER + PRODUCTS GRID
  // =========================================================================
  return (
    <div className="space-y-3 pb-24 sm:pb-28 animate-fadeIn">
      {/* Top Header: Back Button + Active Collection Info */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectCategory(null);
            setSelectedProductType('all');
            setSearchQuery('');
            setSortBy('default');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-all active:scale-95 shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Collections</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
              activeCollectionMeta?.containerClass || 'bg-amber-950/40 border-amber-500/50'
            } ${activeCollectionMeta?.glowClass || ''}`}
          >
            <CategoryIcon
              slug={activeCollectionMeta?.slug}
              name={activeCollectionMeta?.name}
              fallbackEmoji={activeCollectionMeta?.emoji}
              className="w-4 h-4"
              imgClassName="w-4 h-4 object-contain"
            />
          </div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight truncate">
            {activeCollectionMeta?.name || 'Collection'}
          </h2>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
            {collectionProducts.length}
          </span>
        </div>
      </div>

      {/* Quick Collection Switcher Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {PRIMARY_COLLECTIONS.map((col) => {
          const isCurrent =
            selectedCategorySlug === col.slug ||
            (selectedCategorySlug === 'mm2' && col.slug === 'murder-mystery-2') ||
            (selectedCategorySlug === 'murder-mystery-2' && col.slug === 'mm2');

          return (
            <button
              type="button"
              key={col.slug}
              onClick={() => {
                setSelectedProductType('all');
                setSearchQuery('');
                setSortBy('default');
                onSelectCategory(col.slug);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                isCurrent
                  ? 'bg-amber-400 dark:bg-[#FFD166] text-slate-950 shadow-sm'
                  : 'bg-white dark:bg-[#0E1322] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-amber-400/50'
              }`}
            >
              <span>{col.emoji}</span>
              <span>{col.name}</span>
            </button>
          );
        })}
      </div>

      {/* Search Input & Sort Selector Row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search in ${activeCollectionMeta?.name || 'collection'}...`}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort Pill Dropdown/Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (sortBy === 'default') setSortBy('price_asc');
              else if (sortBy === 'price_asc') setSortBy('price_desc');
              else setSortBy('default');
            }}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${
              sortBy !== 'default'
                ? 'border-amber-400/80 bg-amber-400/10 text-amber-500 dark:text-[#FFD166]'
                : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#0E1322] text-slate-600 dark:text-slate-300 hover:border-amber-400/50'
            }`}
            title="Sort by price"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {sortBy === 'price_asc'
                ? 'Price: Low'
                : sortBy === 'price_desc'
                ? 'Price: High'
                : 'Sort'}
            </span>
          </button>
        </div>
      </div>

      {/* Product Type Filter Pills: SHOW ONLY PRODUCT TYPES THAT ACTUALLY EXIST */}
      {availableProductTypes.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {availableProductTypes.map((tab) => {
            const isSelected = selectedProductType === tab.key;
            const TabIcon = tab.icon;

            return (
              <button
                type="button"
                key={tab.key}
                onClick={() => setSelectedProductType(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-amber-400 dark:bg-[#FFD166] text-black shadow-sm'
                    : 'bg-white dark:bg-[#0E1322] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-amber-400/50'
                }`}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-black/20 text-black'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Products Grid (Compact 2-Column Responsive Layout) */}
      {displayedProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onQuickBuy={onQuickBuy}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center rounded-2xl bg-white dark:bg-[#0E1322] border border-slate-200 dark:border-white/10 p-6 space-y-3 shadow-sm animate-fadeIn">
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400">
            <PackageOpen className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'km'
                ? 'មិនទាន់មានទំនិញក្នុងស្តុកនៅឡើយទេ'
                : 'No Products Available in Stock'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {searchQuery
                ? (language === 'km' ? 'សូមសាកល្បងស្វែងរកដោយពាក្យគន្លឹះផ្សេង' : 'Try modifying your search keywords or clear the filter.')
                : (language === 'km' ? 'ទំនិញថ្មីៗនឹងមកដល់ក្នុងពេលឆាប់ៗនេះ' : 'Products in this category will be restocked soon.')}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/20 transition-all"
              >
                Clear Search
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectCategory(null);
                setSearchQuery('');
                setSelectedProductType('all');
                setSortBy('default');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-amber-400 dark:bg-[#FFD166] text-slate-950 text-xs font-bold hover:bg-amber-300 transition-all shadow-sm"
            >
              View All Collections
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
