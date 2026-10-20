import React from 'react';
import { Product, Category } from '../../types';
import { CategoryIcon } from '../../config/emoji';

export interface GameCollectionItem {
  name: string;
  slug: string;
  emoji: string;
  asset?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  auraColor: string;
  glowClass: string;
  containerClass: string;
  iconClass: string;
  borderHoverClass: string;
  desc?: string;
}

export function matchProductToCollection(
  product: Product,
  collectionSlug: string,
  categories: Category[] = []
): boolean {
  const cat = categories.find((c) => c.id === product.category_id);
  const catSlug = cat?.slug || product.category?.slug || '';
  const titleLower = (product.title || '').toLowerCase();

  switch (collectionSlug) {
    case 'blox-fruits':
      return catSlug === 'blox-fruits' || titleLower.includes('blox fruits');
    case 'murder-mystery-2':
    case 'mm2':
      return (
        catSlug === 'murder-mystery-2' ||
        catSlug === 'mm2' ||
        titleLower.includes('mm2') ||
        titleLower.includes('murder mystery')
      );
    case 'rivals':
      return catSlug === 'rivals' || titleLower.includes('rivals');
    case 'blade-ball':
      return catSlug === 'blade-ball' || titleLower.includes('blade ball');
    case 'evade':
      return catSlug === 'evade' || titleLower.includes('evade');
    case 'steal-egg':
      return (
        catSlug === 'steal-egg' ||
        titleLower.includes('steal egg') ||
        titleLower.includes('pet')
      );
    case 'gamepasses':
      return (
        catSlug === 'gamepasses' ||
        titleLower.includes('gamepass') ||
        titleLower.includes('pass')
      );
    case 'other':
      if (catSlug === 'other') return true;
      const matchesTop7 = [
        'blox-fruits',
        'murder-mystery-2',
        'rivals',
        'blade-ball',
        'evade',
        'steal-egg',
        'gamepasses',
      ].some((slug) => matchProductToCollection(product, slug, categories));
      return !matchesTop7;
    default:
      return catSlug === collectionSlug;
  }
}

export const GAME_COLLECTIONS: GameCollectionItem[] = [
  {
    name: 'Blox Fruits',
    slug: 'blox-fruits',
    emoji: '⚔️',
    asset: '/emojis/sword.webp',
    auraColor: '#F59E0B',
    glowClass: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    containerClass: 'bg-amber-950/40 border border-amber-500/50 text-amber-400',
    iconClass: 'text-amber-400',
    borderHoverClass: 'hover:border-amber-400/80',
    desc: 'Max Accounts, Mythical Fruits & Fast Trades',
  },
  {
    name: 'MM2',
    slug: 'murder-mystery-2',
    emoji: '🔪',
    asset: '/emojis/knife.webp',
    auraColor: '#EF4444',
    glowClass: 'shadow-[0_0_20px_rgba(239,68,68,0.35)]',
    containerClass: 'bg-red-950/40 border border-red-500/50 text-red-400',
    iconClass: 'text-red-400',
    borderHoverClass: 'hover:border-red-400/80',
    desc: 'Godly Weapons, Harvester & Ancient Knives',
  },
  {
    name: 'Rivals',
    slug: 'rivals',
    emoji: '🎯',
    asset: '/emojis/target.webp',
    auraColor: '#06B6D4',
    glowClass: 'shadow-[0_0_20px_rgba(6,182,212,0.35)]',
    containerClass: 'bg-cyan-950/40 border border-cyan-500/50 text-cyan-400',
    iconClass: 'text-cyan-400',
    borderHoverClass: 'hover:border-cyan-400/80',
    desc: 'Sniper Builds, Rare Skins & Bundles',
  },
  {
    name: 'Blade Ball',
    slug: 'blade-ball',
    emoji: '⚡',
    asset: '/emojis/lightning.webp',
    auraColor: '#A855F7',
    glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.35)]',
    containerClass: 'bg-purple-950/40 border border-purple-500/50 text-purple-400',
    iconClass: 'text-purple-400',
    borderHoverClass: 'hover:border-purple-400/80',
    desc: 'Infinity Abilities & Dual Cosmos Swords',
  },
  {
    name: 'Evade',
    slug: 'evade',
    emoji: '🏃',
    asset: '/emojis/runner.webp',
    auraColor: '#10B981',
    glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]',
    containerClass: 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-400',
    iconClass: 'text-emerald-400',
    borderHoverClass: 'hover:border-emerald-400/80',
    desc: 'VIP Passes, Pro Cosmetics & Radios',
  },
  {
    name: 'Steal Egg',
    slug: 'steal-egg',
    emoji: '🥚',
    asset: '/emojis/egg.webp',
    auraColor: '#EAB308',
    glowClass: 'shadow-[0_0_20px_rgba(234,179,8,0.35)]',
    containerClass: 'bg-yellow-950/40 border border-yellow-500/50 text-yellow-400',
    iconClass: 'text-yellow-400',
    borderHoverClass: 'hover:border-yellow-400/80',
    desc: 'Mythical Pets, Boosts & Trade Items',
  },
  {
    name: 'Gamepasses',
    slug: 'gamepasses',
    emoji: '🎟️',
    asset: '/emojis/ticket.webp',
    auraColor: '#EC4899',
    glowClass: 'shadow-[0_0_20px_rgba(236,72,153,0.35)]',
    containerClass: 'bg-pink-950/40 border border-pink-500/50 text-pink-400',
    iconClass: 'text-pink-400',
    borderHoverClass: 'hover:border-pink-400/80',
    desc: 'Direct In-Game Passes & Special Gifts',
  },
  {
    name: 'Other',
    slug: 'other',
    emoji: '🎮',
    asset: '/emojis/gamepad.webp',
    auraColor: '#818CF8',
    glowClass: 'shadow-[0_0_20px_rgba(129,140,248,0.35)]',
    containerClass: 'bg-indigo-950/40 border border-indigo-500/50 text-indigo-400',
    iconClass: 'text-indigo-400',
    borderHoverClass: 'hover:border-indigo-400/80',
    desc: 'Exclusive Gaming Items & Custom Services',
  },
];

export interface CollectionsGridProps {
  onSelectCollection: (slug: string) => void;
  products?: Product[];
  categories?: Category[];
  className?: string;
  variant?: 'grid' | 'cards';
  selectedSlug?: string | null;
}

export const CollectionsGrid: React.FC<CollectionsGridProps> = ({
  onSelectCollection,
  products = [],
  categories = [],
  className = '',
  variant = 'grid',
  selectedSlug = null,
}) => {
  // Full detailed card view (Shop Page)
  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 ${className}`}>
        {GAME_COLLECTIONS.map((c) => {
          const isSelected = selectedSlug === c.slug;
          const count = products.length > 0
            ? products.filter((p) => matchProductToCollection(p, c.slug, categories)).length
            : null;

          return (
            <button
              type="button"
              key={c.slug}
              onClick={() => onSelectCollection(c.slug)}
              className={`group flex items-center justify-between p-3 rounded-2xl border transition-all duration-200 text-left active:scale-[0.98] card-3d ${
                isSelected
                  ? 'border-amber-400 dark:border-[#FFD166] bg-amber-50/80 dark:bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : `border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#0E1322] hover:border-amber-400/60 ${c.borderHoverClass}`
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Modern Rounded Container with Matching Aura */}
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${c.containerClass} ${c.glowClass}`}
                >
                  <CategoryIcon
                    slug={c.slug}
                    name={c.name}
                    fallbackEmoji={c.emoji}
                    className="w-6 h-6"
                    imgClassName="w-6 h-6 object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-amber-400 transition-colors truncate">
                      {c.name}
                    </h3>
                    {count !== null && count > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                        {count}
                      </span>
                    )}
                  </div>
                  {c.desc && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                      {c.desc}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors shrink-0 ml-2 ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-400 font-black'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 group-hover:text-amber-400'
                }`}
              >
                <span className="text-sm font-bold">{isSelected ? '✓' : '→'}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Default compact 4-col grid layout (Used on Home Page)
  return (
    <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 ${className}`}>
      {GAME_COLLECTIONS.map((c) => {
        return (
          <button
            type="button"
            key={c.slug}
            onClick={() => onSelectCollection(c.slug)}
            className={`group flex flex-col items-center justify-center p-1.5 sm:p-2 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0E1322]/90 backdrop-blur-sm hover:border-amber-400/50 transition-all duration-200 active:scale-[0.96] text-center card-3d min-w-0 ${c.borderHoverClass}`}
          >
            {/* Modern Rounded Container with Matching Aura */}
            <div
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border flex items-center justify-center mb-1.5 transition-transform duration-200 group-hover:scale-105 shrink-0 ${c.containerClass} ${c.glowClass}`}
            >
              <CategoryIcon
                slug={c.slug}
                name={c.name}
                fallbackEmoji={c.emoji}
                className="w-6 h-6 sm:w-7 sm:h-7"
                imgClassName="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-sm"
              />
            </div>

            <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center truncate w-full px-0.5 leading-tight group-hover:text-amber-400 transition-colors">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
