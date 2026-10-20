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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#070A14]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10 px-2 min-h-[58px] py-1.5 flex items-center pb-[max(env(safe-area-inset-bottom),0.375rem)] transition-colors shadow-lg">
      <div className="max-w-md w-full mx-auto flex items-center justify-around relative">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const theme = tabThemes[tab.id];

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="relative flex flex-col items-center justify-center min-w-[56px] min-h-[46px] py-1 px-1.5 transition-all select-none active:scale-95 group"
              type="button"
              aria-label={tab.label}
            >
              {tab.highlight && !isActive && (
                <span className="absolute 1 top-0.5 right-3 w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              )}

              <div className="relative">
                <div
                  className={`p-1.5 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? `${theme.activeColor} ${theme.bg} ${theme.glow}`
                      : 'border-transparent text-slate-400 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                  }`}
                >
                  <AppIcon
                    name={tab.iconKey}
                    size={20}
                    className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
                    strokeWidth={isActive ? 2.4 : 1.8}
                  />
                </div>

                {/* Badge for Orders or Alerts */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(244,63,94,0.8)] border border-white/20 leading-none">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>

              <motion.span
                className={`text-[10px] font-bold leading-tight mt-0.5 transition-colors ${
                  isActive
                    ? theme.activeColor
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
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
