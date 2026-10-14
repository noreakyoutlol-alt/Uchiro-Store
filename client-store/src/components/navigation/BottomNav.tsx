import React from 'react';
import { motion } from 'framer-motion';
import { AppIcon, SemanticIconKey } from '../common/AppIcon';
import { useLanguage } from '../../context/LanguageContext';

export type TabType = 'home' | 'shop' | 'gacha' | 'orders' | 'profile' | 'vault';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  ordersBadgeCount?: number;
}

interface TabItem {
  id: TabType;
  label: string;
  iconKey: SemanticIconKey;
  highlight?: boolean;
  badge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  ordersBadgeCount = 0,
}) => {
  const { language } = useLanguage();
  const isKm = language === 'km';

  // The 4th tab MUST be "Orders" (📦) with Package icon navigating directly to Order History
  const tabs: TabItem[] = [
    { id: 'home', label: 'Home', iconKey: 'HOME' },
    { id: 'shop', label: 'Shop', iconKey: 'SHOP' },
    { id: 'gacha', label: 'Gacha', iconKey: 'GACHA', highlight: true },
    { id: 'orders', label: 'Orders', iconKey: 'ORDERS', badge: ordersBadgeCount },
    { id: 'profile', label: 'Profile', iconKey: 'PROFILE' },
  ];

  const tabThemes: Record<TabType, { activeColor: string; glow: string; bg: string }> = {
    home: {
      activeColor: 'text-amber-400 dark:text-[#FFD166]',
      glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.65)]',
      bg: 'bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    },
    shop: {
      activeColor: 'text-cyan-400',
      glow: 'drop-shadow-[0_0_8px_rgba(6,182,212,0.65)]',
      bg: 'bg-cyan-500/15 border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]',
    },
    gacha: {
      activeColor: 'text-purple-400',
      glow: 'drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]',
      bg: 'bg-purple-500/15 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]',
    },
    orders: {
      activeColor: 'text-emerald-400',
      glow: 'drop-shadow-[0_0_8px_rgba(16,185,129,0.65)]',
      bg: 'bg-emerald-500/15 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]',
    },
    profile: {
      activeColor: 'text-rose-400',
      glow: 'drop-shadow-[0_0_8px_rgba(244,63,94,0.65)]',
      bg: 'bg-rose-500/15 border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]',
    },
    vault: {
      activeColor: 'text-amber-400',
      glow: 'drop-shadow-[0_0_8px_rgba(245,158,11,0.65)]',
      bg: 'bg-amber-500/15 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]',
    },
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0B0E14]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 px-2 h-14 py-1.5 flex items-center pb-safe transition-colors">
      <div className="max-w-md w-full mx-auto flex items-center justify-around relative">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const theme = tabThemes[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="relative flex flex-col items-center justify-center py-0.5 px-2 min-w-[50px] transition-all select-none"
            >
              {tab.highlight && (
                <span className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              )}

              <div
                className={`p-1 rounded-lg border transition-all duration-200 ${
                  isActive
                    ? `${theme.activeColor} ${theme.bg} ${theme.glow}`
                    : 'border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <AppIcon
                  name={tab.iconKey}
                  size={20}
                  className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </div>

              {/* Badge */}
              {tab.badge !== undefined && tab.badge > 0 && !isActive && (
                <span className="absolute top-0 right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center shadow-[0_0_6px_rgba(244,63,94,0.8)]">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}

              <motion.span
                className={`text-[10px] font-medium leading-none mt-0.5 transition-colors ${
                  isActive
                    ? theme.activeColor
                    : 'text-slate-400 dark:text-slate-500'
                }`}
                animate={{ scale: isActive ? 1.05 : 1 }}
                transition={{ duration: 0.15 }}
              >
                {tab.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
