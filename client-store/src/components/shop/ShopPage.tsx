import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowLeft,
  KeyRound,
  UserCheck,
  Gift,
  Repeat,
  ChevronRight,
  Sword,
} from 'lucide-react';
import { Product, Category } from '../../types';
import { ProductCard } from '../product/ProductCard';
import { useLanguage } from '../../context/LanguageContext';
import { CollectionsGrid, GAME_COLLECTIONS } from '../home/CollectionsGrid';
import { CategoryIcon } from '../../config/emoji';

interface ShopPageProps {
  products: Product[];
  categories: Category[];
  selectedCategorySlug: string | null;
  onSelectCategory: (slug: string | null) => void;
  onSelectProduct: (product: Product) => void;
  onQuickBuy: (product: Product) => void;
}

type ProductTypeKey = 'all' | 'account' | 'gift' | 'trade' | 'digital_code';

export const PRIMARY_COLLECTIONS = GAME_COLLECTIONS;

export const ShopPage: React.FC<ShopPageProps> = ({
  products,
  categories,
  selectedCategorySlug,
  onSelectCategory,
  onSelectProduct,
  onQuickBuy,
}) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductType, setSelectedProductType] = useState<ProductTypeKey>('all');

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

  const activeCategory = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return (
      categories.find(
        (c) =>
          c.slug === selectedCategorySlug ||
          (selectedCategorySlug === 'murder-mystery-2' && c.slug === 'mm2') ||
          (selectedCategorySlug === 'mm2' && c.slug === 'murder-mystery-2')
      ) || null
    );
  }, [categories, selectedCategorySlug]);

  // Products belonging to the selected collection
  const collectionProducts = useMemo(() => {
    if (!selectedCategorySlug) return [];

    return products.filter((p) => {
      if (activeCategory && p.category_id === activeCategory.id) return true;
      const cat = categories.find((c) => c.id === p.category_id);
      if (cat?.slug === selectedCategorySlug) return true;

      if (
        (selectedCategorySlug === 'murder-mystery-2' || selectedCategorySlug === 'mm2') &&
        (cat?.slug === 'mm2' || cat?.slug === 'murder-mystery-2')
      ) {
        return true;
      }

      // Fallback matching by title/specs for collections
      const titleLower = p.title.toLowerCase();
      if (selectedCategorySlug === 'blox-fruits' && titleLower.includes('blox fruits')) return true;
      if (
        (selectedCategorySlug === 'murder-mystery-2' || selectedCategorySlug === 'mm2') &&
        (titleLower.includes('mm2') || titleLower.includes('murder mystery'))
      )
        return true;
      if (selectedCategorySlug === 'rivals' && titleLower.includes('rivals')) return true;
      if (selectedCategorySlug === 'blade-ball' && titleLower.includes('blade ball')) return true;
      if (selectedCategorySlug === 'evade' && titleLower.includes('evade')) return true;
      if (selectedCategorySlug === 'steal-egg' && (titleLower.includes('steal egg') || titleLower.includes('pet'))) return true;
      if (selectedCategorySlug === 'gamepasses' && (titleLower.includes('gamepass') || titleLower.includes('pass'))) return true;
      if (selectedCategorySlug === 'other') return true;

      return false;
    });
  }, [products, categories, selectedCategorySlug, activeCategory]);

  // Compute ONLY product types that ACTUALLY EXIST in this collection (Prompt Section 3)
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
  }, [collectionProducts, selectedCategorySlug]);

  // Filter products by selected product type and search query
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
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.short_description && p.short_description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [collectionProducts, selectedProductType, searchQuery]);

  // Precomputed collection counts for selector view to eliminate frame drops during scrolling
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const slugs = [
      'blox-fruits',
      'murder-mystery-2',
      'rivals',
      'blade-ball',
      'evade',
      'steal-egg',
      'gamepasses',
      'other',
    ];

    for (const p of products) {
      const cat = categories.find((c) => c.id === p.category_id);
      const titleLower = p.title.toLowerCase();

      for (const slug of slugs) {
        let match = false;
        if (cat?.slug === slug) match = true;
        else if (
          (slug === 'murder-mystery-2' || slug === 'mm2') &&
          (cat?.slug === 'mm2' || cat?.slug === 'murder-mystery-2')
        )
          match = true;
        else if (slug === 'blox-fruits' && titleLower.includes('blox fruits')) match = true;
        else if (slug === 'murder-mystery-2' && (titleLower.includes('mm2') || titleLower.includes('murder mystery')))
          match = true;
        else if (slug === 'rivals' && titleLower.includes('rivals')) match = true;
        else if (slug === 'blade-ball' && titleLower.includes('blade ball')) match = true;
        else if (slug === 'evade' && titleLower.includes('evade')) match = true;
        else if (
          slug === 'steal-egg' &&
          (titleLower.includes('steal egg') || titleLower.includes('pet'))
        )
          match = true;
        else if (
          slug === 'gamepasses' &&
          (titleLower.includes('gamepass') || titleLower.includes('pass'))
        )
          match = true;

        if (match) {
          counts[slug] = (counts[slug] || 0) + 1;
        }
      }
    }
    return counts;
  }, [products, categories]);

  const getCollectionCount = (slug: string) => collectionCounts[slug] || 0;

  // =========================================================================
  // 1. INITIAL SHOP SCREEN: ONLY 8 GAME COLLECTIONS (NO DUMPED CATALOG)
  // =========================================================================
  if (!selectedCategorySlug) {
    return (
      <div className="space-y-4 pb-20 animate-fadeIn">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            Game Collections
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select a game to view verified accounts, gifts, and trade items
          </p>
        </div>

        {/* 8 Premium Game Collection Selectors with Glowing Aura & Neon Typography */}
        <CollectionsGrid
          variant="cards"
          products={products}
          onSelectCollection={(slug) => {
            setSelectedProductType('all');
            setSearchQuery('');
            onSelectCategory(slug);
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // 2. COLLECTION OPENED: SHOW ONLY PRODUCT TYPES THAT ACTUALLY EXIST
  // =========================================================================
  const CollectionIcon = activeCollectionMeta?.icon || Sword;

  return (
    <div className="space-y-2.5 pb-20 animate-fadeIn">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onSelectCategory(null);
            setSelectedProductType('all');
            setSearchQuery('');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-amber-400 transition-all active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Collections</span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
              activeCollectionMeta?.containerClass || 'bg-amber-950/40 border-amber-500/50'
            } ${activeCollectionMeta?.glowClass || ''}`}
          >
            <CategoryIcon
              slug={activeCollectionMeta?.slug}
              name={activeCollectionMeta?.name}
              fallbackEmoji={activeCollectionMeta?.emoji}
              className="w-5 h-5"
              imgClassName="w-5 h-5 object-contain"
            />
          </div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
            {activeCollectionMeta?.name || 'Collection'}
          </h2>
        </div>
      </div>

      {/* Search Input within this Collection */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search in ${activeCollectionMeta?.name || 'collection'}...`}
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400 shadow-sm"
        />
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
                    : 'bg-white dark:bg-[#121624] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:border-amber-400/50'
                }`}
              >
                {TabIcon && <TabIcon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-black/20 text-black' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Products Grid (Compact 2-Column Layout) */}
      {displayedProducts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={onSelectProduct}
              onQuickBuy={onSelectProduct}
            />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center rounded-xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/10 p-6 space-y-2">
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            មិនទាន់មានទំនិញក្នុងស្តុកនៅឡើយទេ (No products available in stock)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {searchQuery
              ? 'Try modifying your search keywords'
              : 'Products in this category will be available soon.'}
          </p>
        </div>
      )}
    </div>
  );
};
