import React from 'react';
import { Product } from '../../types';

export interface GameCollectionItem {
  name: string;
  slug: string;
  emoji: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  auraColor: string;
  glowClass: string;
  containerClass: string;
  iconClass: string;
  borderHoverClass: string;
  desc?: string;
}

export const GAME_COLLECTIONS: GameCollectionItem[] = [
  {
    name: 'Blox Fruits',
    slug: 'blox-fruits',
    emoji: '⚔️',
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
    auraColor: '#818CF8',
    glowClass: 'shadow-[0_0_20px_rgba(129,140,248,0.35)]',
    containerClass: 'bg-indigo-950/40 border border-indigo-500/50 text-indigo-400',
    iconClass: 'text-indigo-400',
    borderHoverClass: 'hover:border-indigo-400/80',
    desc: 'Exclusive Gaming Items & Custom Services',
  },
];

interface CollectionsGridProps {
  onSelectCollection: (slug: string) => void;
  products?: Product[];
  className?: string;
  variant?: 'grid' | 'cards';
}

export const CollectionsGrid: React.FC<CollectionsGridProps> = ({
  onSelectCollection,
  className = '',
  variant = 'grid',
}) => {
  // Full detailed card view (Shop Page)
  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`}>
        {GAME_COLLECTIONS.map((c) => {
          return (
            <button
              type="button"
              key={c.slug}
              onClick={() => onSelectCollection(c.slug)}
              className={`group flex items-center justify-between p-3.5 rounded-2xl border border-white/10 bg-[#0F1422]/90 dark:bg-[#0B0F19]/90 backdrop-blur-xl hover:border-white/25 transition-all duration-300 text-left active:scale-[0.98] shadow-lg ${c.borderHoverClass}`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Modern Glowing Rounded Container */}
                <div
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${c.containerClass} ${c.glowClass}`}
                >
                  <span className="text-2xl select-none" role="img" aria-label={c.name}>
                    {c.emoji}
                  </span>
                </div>

                <div className="min-w-0">
                  <h3 className="font-black text-sm text-white group-hover:text-amber-400 transition-colors truncate">
                    {c.name}
                  </h3>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-all shrink-0 ml-2">
                <span className="text-sm font-bold">→</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // Default compact 4-col grid layout (Used on Home Page)
  return (
    <div className={`grid grid-cols-4 gap-2.5 ${className}`}>
      {GAME_COLLECTIONS.map((c) => {
        return (
          <button
            type="button"
            key={c.slug}
            onClick={() => onSelectCollection(c.slug)}
            className={`group flex flex-col items-center justify-center p-2.5 rounded-2xl border border-white/10 bg-[#0F1422]/70 dark:bg-[#0B0F19]/80 backdrop-blur-xl hover:border-white/25 transition-all duration-300 active:scale-95 text-center shadow-lg ${c.borderHoverClass}`}
          >
            {/* Modern Glowing Rounded Container */}
            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-1.5 transition-transform duration-300 group-hover:scale-110 ${c.containerClass} ${c.glowClass}`}
            >
              <span className="text-xl sm:text-2xl select-none" role="img" aria-label={c.name}>
                {c.emoji}
              </span>
            </div>

            <span className="text-[10px] sm:text-[11px] font-black text-white text-center truncate max-w-full group-hover:text-amber-400 transition-colors">
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};
