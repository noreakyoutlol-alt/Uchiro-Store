import React, { useState, useEffect } from 'react';
import { ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { TelegramUser, Profile } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { SettingsModal } from '../settings/SettingsModal';
import { StoreAPI } from '../../services/api';

export interface HeaderTopBarProps {
  user: TelegramUser | null;
  profile: Profile | null;
  onOpenProfile: () => void;
}

/**
 * Custom 3D-styled gold coin SVG with amber glow filter
 */
export const GoldCoin3DIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 18,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    style={{ filter: 'drop-shadow(0 0 6px #F59E0B)' }}
  >
    <defs>
      <radialGradient id="hdrCoinGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="25%" stopColor="#FCD34D" />
        <stop offset="65%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </radialGradient>
      <linearGradient id="hdrCoinRim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FDE68A" />
        <stop offset="50%" stopColor="#D97706" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>
      <linearGradient id="hdrCoinInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#92400E" stopOpacity="0.8" />
      </linearGradient>
    </defs>
    {/* Outer 3D Bevel Rim */}
    <circle cx="12" cy="12" r="10.5" fill="url(#hdrCoinRim)" stroke="#FDE68A" strokeWidth="0.75" />
    {/* Coin Face */}
    <circle cx="12" cy="12" r="9" fill="url(#hdrCoinGrad)" />
    {/* Inner Minting Ridges */}
    <circle cx="12" cy="12" r="7.5" stroke="url(#hdrCoinInner)" strokeWidth="0.75" strokeDasharray="1.5 1" fill="none" opacity="0.85" />
    {/* Central Embossed 3D Star/Diamond Insignia */}
    <path
      d="M12 6.5L13.5 10.2L17.5 10.8L14.6 13.6L15.3 17.5L12 15.7L8.7 17.5L9.4 13.6L6.5 10.8L10.5 10.2L12 6.5Z"
      fill="#FEF3C7"
      stroke="#78350F"
      strokeWidth="0.5"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="1.5" fill="#D97706" opacity="0.6" />
  </svg>
);

export const HeaderTopBar: React.FC<HeaderTopBarProps> = ({
  user,
  profile,
  onOpenProfile,
}) => {
  const { language, setLanguage } = useLanguage();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Telegram User';
  const hasUsername = Boolean(user?.username && user.username.trim().length > 0);
  const userInitial = (user?.first_name || displayName || 'T').charAt(0).toUpperCase();

  // Reactive points state subscribed to /api/store/me/stats
  const [userPoints, setUserPoints] = useState<number>(profile?.points ?? 0);

  // Sync whenever prop profile updates
  useEffect(() => {
    if (typeof profile?.points === 'number') {
      setUserPoints(profile.points);
    }
  }, [profile?.points]);

  // Reactive subscription: fetch /api/store/me/stats on mount and poll
  useEffect(() => {
    let isMounted = true;

    const fetchLivePoints = async () => {
      // Pause polling when WebApp tab/window is hidden or in background
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      try {
        const stats = await StoreAPI.getMeStats();
        if (isMounted && stats && typeof stats.points === 'number') {
          setUserPoints(stats.points);
        }
      } catch {
        // Silently preserve current balance when not authenticated or offline
      }
    };

    fetchLivePoints();
    // Throttled polling to 25 seconds (20-30s range)
    const intervalId = setInterval(fetchLivePoints, 25000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchLivePoints();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // Reactive window event listener for immediate updates across components
    const handlePointsEvent = (e: any) => {
      if (typeof e.detail?.points === 'number') {
        setUserPoints(e.detail.points);
      } else {
        fetchLivePoints();
      }
    };

    window.addEventListener('uchiro_points_updated', handlePointsEvent);
    window.addEventListener('uchiro_points_sync', handlePointsEvent);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.removeEventListener('uchiro_points_updated', handlePointsEvent);
      window.removeEventListener('uchiro_points_sync', handlePointsEvent);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/85 dark:bg-[#0B0E14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 px-3 py-2 transition-colors">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* User Profile Card */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 text-left group shrink-0"
        >
          <div className="relative shrink-0">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-slate-200 dark:border-white/20 group-hover:border-amber-400 transition-colors"
              />
            ) : (
              <div className="w-9 h-9 rounded-full border-2 border-slate-200 dark:border-white/20 bg-slate-100 dark:bg-[#1E2538] flex items-center justify-center text-xs font-black text-slate-800 dark:text-white group-hover:border-amber-400 transition-colors">
                {userInitial}
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0B0E14]" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-900 dark:text-white max-w-[100px] truncate">
                {displayName}
              </span>
              <ShieldCheck className="w-3 h-3 text-amber-500 dark:text-[#FFD166] shrink-0" />
            </div>
            {hasUsername && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[100px]">
                @{user!.username}
              </span>
            )}
          </div>
        </button>

        {/* Center / Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Language Switcher with Flag Icons */}
          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'km' : 'en')}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-400/50 flex items-center justify-center transition-all active:scale-95 shadow-sm text-base leading-none select-none"
            title={language === 'en' ? 'Switch to Khmer (🇰🇭)' : 'Switch to English (🇺🇸)'}
            aria-label="Switch Language"
          >
            {language === 'en' ? '🇺🇸' : '🇰🇭'}
          </button>

          {/* Settings & BGM Audio Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-amber-400/50 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 transition-all active:scale-95 shadow-sm"
            title="Settings & Audio"
            aria-label="Settings"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Luxury Cyberpunk Points Badge */}
          <button
            onClick={onOpenProfile}
            type="button"
            className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-slate-950/90 border border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:border-amber-400 transition-all active:scale-95 group shrink-0"
            title="Uchiro Reward Points"
          >
            <GoldCoin3DIcon size={15} />
            <span className="text-amber-400 font-bold text-xs tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {userPoints.toLocaleString()}
            </span>
            <span className="text-amber-500 font-bold text-[10px] tracking-wider uppercase">
              PTS
            </span>
          </button>
        </div>
      </div>

      {/* Settings & Audio Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </header>
  );
};
