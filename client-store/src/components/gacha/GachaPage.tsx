import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Ticket,
  Clock,
  Coins,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Gift,
  Copy,
  Check,
  Trophy,
  Info,
  ChevronRight,
  Flame,
  Crown,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  GachaPool,
  GachaPrize,
  GachaRarity,
  GachaStatus,
  RecentGachaWinner,
} from '../../types';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface GachaPageProps {
  pools: GachaPool[];
  userPoints: number;
  onRefreshProfile: () => void;
}

// =========================================================================
// RARITY CONFIGURATION (Exact Probabilities & Dark Space Accents)
// =========================================================================
export const RARITY_CONFIG: Record<
  GachaRarity,
  {
    label: string;
    badgeStyle: string;
    cardBorder: string;
    glowColor: string;
    accentColor: string;
    textColor: string;
    dropRate: string;
    bgGradient: string;
    pillBg: string;
  }
> = {
  COMMON: {
    label: 'COMMON',
    badgeStyle: 'bg-zinc-800/90 text-zinc-300 border-zinc-600/50',
    cardBorder: 'border-zinc-700/60',
    glowColor: 'rgba(113, 113, 122, 0.25)',
    accentColor: '#71717A',
    textColor: 'text-zinc-400',
    dropRate: '50.0%',
    bgGradient: 'from-zinc-900 to-zinc-950',
    pillBg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
  },
  RARE: {
    label: 'RARE',
    badgeStyle: 'bg-blue-950/90 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/20',
    cardBorder: 'border-blue-500/50',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    accentColor: '#3B82F6',
    textColor: 'text-blue-400',
    dropRate: '28.0%',
    bgGradient: 'from-blue-950/80 to-slate-950',
    pillBg: 'bg-blue-950/80 text-blue-300 border-blue-500/40',
  },
  EPIC: {
    label: 'EPIC',
    badgeStyle: 'bg-purple-950/90 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/25',
    cardBorder: 'border-purple-500/50',
    glowColor: 'rgba(168, 85, 247, 0.40)',
    accentColor: '#A855F7',
    textColor: 'text-purple-400',
    dropRate: '14.0%',
    bgGradient: 'from-purple-950/80 to-slate-950',
    pillBg: 'bg-purple-950/80 text-purple-300 border-purple-500/40',
  },
  LEGENDARY: {
    label: 'LEGENDARY',
    badgeStyle: 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-500/30',
    cardBorder: 'border-amber-500/60',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    accentColor: '#F59E0B',
    textColor: 'text-amber-400',
    dropRate: '6.5%',
    bgGradient: 'from-amber-950/80 to-slate-950',
    pillBg: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
  },
  MYTHICAL: {
    label: 'MYTHICAL',
    badgeStyle: 'bg-rose-950/90 text-rose-300 border-rose-500/70 shadow-md shadow-rose-500/35',
    cardBorder: 'border-rose-500/70',
    glowColor: 'rgba(239, 68, 68, 0.55)',
    accentColor: '#EF4444',
    textColor: 'text-rose-400',
    dropRate: '1.5%',
    bgGradient: 'from-rose-950/80 to-slate-950',
    pillBg: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
  },
};

// Scaled mobile-optimized roulette reel pitch
const ITEM_WIDTH = 104;
const ITEM_GAP = 8;
const ITEM_PITCH = ITEM_WIDTH + ITEM_GAP; // 112px
const TOTAL_REEL_ITEMS = 40;
const TARGET_INDEX = 30;

const PrizeImage: React.FC<{
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
}> = ({ src, alt, className = 'w-full h-full', iconSize = 'w-5 h-5' }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`${className} flex items-center justify-center bg-zinc-900/80`}>
        <Gift className={`${iconSize} text-zinc-500`} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      className={`${className} object-cover`}
      loading="lazy"
      decoding="async"
    />
  );
};

export const GachaPage: React.FC<GachaPageProps> = ({
  pools,
  userPoints,
  onRefreshProfile,
}) => {
  const { language } = useLanguage();
  const [selectedPoolId] = useState<string>(pools[0]?.id || '');
  const [gachaStatus, setGachaStatus] = useState<GachaStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [recentWinners, setRecentWinners] = useState<RecentGachaWinner[]>([]);

  // Current & Next Prize from backend slot_status
  const [currentPrize, setCurrentPrize] = useState<GachaPrize | null>(null);
  const [nextPrize, setNextPrize] = useState<GachaPrize | null>(null);

  // Reel State
  const [reelItems, setReelItems] = useState<GachaPrize[]>([]);
  const [reelTranslateX, setReelTranslateX] = useState<number>(0);
  const [winningPrize, setWinningPrize] = useState<GachaPrize | null>(null);
  const [showRevealModal, setShowRevealModal] = useState<boolean>(false);
  const [revealedClaim, setRevealedClaim] = useState<any | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Compact Drop Rates Modal
  const [showDropRatesModal, setShowDropRatesModal] = useState<boolean>(false);

  // Cooldown Timer
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const activePool = useMemo(() => {
    return pools.find((p) => p.id === selectedPoolId) || pools[0];
  }, [pools, selectedPoolId]);

  const poolPrizes = useMemo(() => {
    return activePool?.prizes || [];
  }, [activePool]);

  // Featured Grand Prize: fallback to highest tier prize in active pool if currentPrize not provided
  const featuredPrize = useMemo(() => {
    if (currentPrize) return currentPrize;
    if (poolPrizes.length === 0) return null;
    return (
      poolPrizes.find((p) => p.rarity === 'MYTHICAL') ||
      poolPrizes.find((p) => p.rarity === 'LEGENDARY') ||
      poolPrizes[0]
    );
  }, [currentPrize, poolPrizes]);

  // Load Status and Recent Winners
  useEffect(() => {
    loadGachaStatus();
    loadRecentWinners();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          loadGachaStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Recenter reel strip on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isSpinning) return;
      if (viewportRef.current) {
        const vw = viewportRef.current.clientWidth;
        const initialCenter = ITEM_WIDTH / 2;
        setReelTranslateX(vw / 2 - initialCenter);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSpinning]);

  // Initialize Reel Strip
  useEffect(() => {
    if (poolPrizes.length > 0 && reelItems.length === 0) {
      const initialStrip: GachaPrize[] = [];
      for (let i = 0; i < TOTAL_REEL_ITEMS; i++) {
        initialStrip.push(poolPrizes[i % poolPrizes.length]);
      }
      setReelItems(initialStrip);

      requestAnimationFrame(() => {
        if (viewportRef.current) {
          const vw = viewportRef.current.clientWidth;
          const initialCenter = ITEM_WIDTH / 2;
          setReelTranslateX(vw / 2 - initialCenter);
        }
      });
    }
  }, [poolPrizes, reelItems.length]);

  const loadGachaStatus = async () => {
    try {
      const data = await StoreAPI.getGachaStatus();
      setGachaStatus(data);
      setCurrentPrize(data.currentPrize || null);
      setNextPrize(data.nextPrize || data.nextDraftPrize || null);
      if (data.cooldownSecondsRemaining && data.cooldownSecondsRemaining > 0) {
        setCooldownSeconds(data.cooldownSecondsRemaining);
      } else {
        setCooldownSeconds(0);
      }
    } catch {
      setGachaStatus({
        points: userPoints,
        tickets: 0,
        ticketCost: 100,
        canRoll: false,
        cooldownSecondsRemaining: 0,
        nextRollAt: null,
        lastRollAt: null,
        userState: {
          points: userPoints,
          tickets: 0,
          cooldownUntil: null,
        },
        currentPrize: null,
        nextPrize: null,
      });
    }
  };

  const loadRecentWinners = async () => {
    try {
      const data = await StoreAPI.getRecentGachaWinners();
      setRecentWinners(Array.isArray(data) ? data : []);
    } catch {
      setRecentWinners([]);
    }
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'warning') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        if (type === 'success' || type === 'warning') {
          tg.HapticFeedback.notificationOccurred(type);
        } else {
          tg.HapticFeedback.impactOccurred(type);
        }
      }
    } catch {
      // ignore
    }
  };

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const tickets = gachaStatus?.tickets ?? 0;
  const currentPoints = gachaStatus?.points ?? userPoints;

  // =========================================================================
  // CONVERT POINTS TO TICKETS (100 PTS = 1 TICKET)
  // =========================================================================
  const handleConvertPoints = async (quantity: number = 1) => {
    if (isConverting) return;
    setIsConverting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    triggerHaptic('medium');

    try {
      const res = await StoreAPI.buyGachaTickets(quantity);
      setGachaStatus((prev) =>
        prev
          ? {
              ...prev,
              tickets: res.tickets,
              points: res.newBalance,
              userState: {
                ...prev.userState,
                tickets: res.tickets,
                points: res.newBalance,
              },
            }
          : null
      );
      setSuccessMsg(
        quantity > 1
          ? `+${quantity} Tickets acquired!`
          : '1 Ticket acquired (100 points exchanged)!'
      );
      triggerHaptic('success');
      onRefreshProfile();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to exchange tickets. Check your points total.';
      setErrorMsg(msg);
      triggerHaptic('warning');
    } finally {
      setIsConverting(false);
    }
  };

  // =========================================================================
  // SERVER-AUTHORITATIVE ROLL & ANIMATED REEL
  // =========================================================================
  const handleRoll = async (spinsCount: number = 1) => {
    if (!activePool || isSpinning) return;
    if (cooldownSeconds > 0) {
      setErrorMsg(`Cooldown active. Wait ${formatCountdown(cooldownSeconds)}.`);
      triggerHaptic('warning');
      return;
    }
    if (tickets < spinsCount) {
      setErrorMsg(
        spinsCount > 1
          ? `You need ${spinsCount} tickets for 10x Spin.`
          : 'You need at least 1 ticket to spin.'
      );
      triggerHaptic('warning');
      return;
    }

    setIsSpinning(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setWinningPrize(null);
    setShowRevealModal(false);
    triggerHaptic('medium');

    try {
      // 1. Request Server Roll (Server chooses authoritatively)
      const res = await StoreAPI.spinGacha({
        poolId: activePool.id,
        rollType: spinsCount > 1 ? 'multi' : 'single',
      });
      const serverWinningPrize: GachaPrize = res.prize;

      // 2. Build reel strip where TARGET_INDEX is strictly serverWinningPrize
      const newStrip: GachaPrize[] = [];
      for (let i = 0; i < TOTAL_REEL_ITEMS; i++) {
        if (i === TARGET_INDEX) {
          newStrip.push(serverWinningPrize);
        } else {
          const candidatePrize = poolPrizes[(i * 3 + 1) % poolPrizes.length];
          newStrip.push(candidatePrize);
        }
      }
      setReelItems(newStrip);

      // 3. Target viewport calculations (compact pitch 112px)
      const viewportWidth = viewportRef.current?.clientWidth || 340;
      const targetCenter = TARGET_INDEX * ITEM_PITCH + ITEM_WIDTH / 2;
      const targetX = viewportWidth / 2 - targetCenter;
      const startX = reelTranslateX;

      // Check reduced motion preference
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 4. Smooth spin animation with quartic deceleration
      const duration = prefersReducedMotion ? 600 : 3800;
      const startTime = performance.now();

      const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOut(progress);

        const currentX = startX + (targetX - startX) * easedProgress;
        setReelTranslateX(currentX);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Animation Complete
          setReelTranslateX(targetX);
          setIsSpinning(false);
          setWinningPrize(serverWinningPrize);
          setRevealedClaim(res.claim);

          // Confetti celebration
          try {
            confetti({
              particleCount: 75,
              spread: 65,
              origin: { y: 0.55 },
              colors: ['#F59E0B', '#EF4444', '#A855F7', '#3B82F6', '#10B981'],
            });
          } catch {
            // ignore
          }

          triggerHaptic('success');
          setShowRevealModal(true);
          loadGachaStatus();
          loadRecentWinners();
          onRefreshProfile();
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    } catch (err: any) {
      setIsSpinning(false);
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Gacha roll failed. Please try again.';
      setErrorMsg(msg);
      triggerHaptic('warning');
      loadGachaStatus();
    }
  };

  const copyVoucherCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      triggerHaptic('light');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const featuredRarityConfig = featuredPrize
    ? RARITY_CONFIG[featuredPrize.rarity] || RARITY_CONFIG.COMMON
    : null;

  return (
    <div className="space-y-3 pb-24 max-w-md mx-auto px-2.5 sm:px-3 animate-fadeIn select-none">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & TICKET RESOURCE BAR */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0B0F1D]/90 backdrop-blur-md border border-slate-800/80 dark:border-white/10 p-3 shadow-lg relative overflow-hidden">
        {/* Subtle Luxury Gradient Top Edge */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between gap-2">
          {/* Title Banner */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 via-purple-500/15 to-transparent border border-amber-400/30 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/15">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-black text-white tracking-wider truncate">
                  UCHIRO GACHA
                </h1>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LUCKY
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                {language === 'km'
                  ? 'បង្វិលយករង្វាន់ផ្តាច់មុខ'
                  : 'Spin to unlock exclusive rewards'}
              </p>
            </div>
          </div>

          {/* Quick Odds Trigger */}
          <button
            type="button"
            onClick={() => setShowDropRatesModal(true)}
            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-300 hover:text-white border border-white/10 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
          >
            <Info className="w-3 h-3 text-amber-400" />
            <span>ODDS</span>
          </button>
        </div>

        {/* RESOURCE CARDS: Tickets & Points Balance */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-white/10">
          {/* Card 1: Gacha Tickets */}
          <div className="p-2 rounded-xl bg-[#121626] border border-amber-500/25 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="/emojis/ticket.webp"
                alt="Ticket"
                className="w-5 h-5 object-contain inline-block shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block leading-tight">
                  {language === 'km' ? 'សំបុត្រ' : 'TICKETS'}
                </span>
                <span className="text-sm font-black text-amber-400 block leading-tight truncate">
                  {tickets}
                </span>
              </div>
            </div>
            <span className="text-[8px] font-bold text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/5 shrink-0">
              1x / Spin
            </span>
          </div>

          {/* Card 2: Points Balance & Quick Exchange */}
          <div className="p-2 rounded-xl bg-[#121626] border border-white/10 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Coins className="w-3 h-3 text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-zinc-400 block leading-tight">
                  POINTS
                </span>
                <span className="text-sm font-black text-white block leading-tight truncate">
                  {currentPoints}
                </span>
              </div>
            </div>

            {/* Quick 100 Pts Convert Button */}
            {currentPoints >= 100 && (
              <button
                type="button"
                disabled={isConverting}
                onClick={() => handleConvertPoints(1)}
                title="Exchange 100 Points for 1 Ticket"
                className="py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 text-[10px] font-black flex items-center gap-1 transition-all shrink-0 cursor-pointer"
              >
                {isConverting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <>
                    <span>+1 🎟️</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Inline Alerts */}
        {errorMsg && (
          <div className="mt-2.5 p-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-2.5 p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. ROULETTE REEL CASING & STREAMLINED SPIN CONTROLS */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#080B15] border border-amber-500/30 p-3 space-y-3 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden card-3d">
        {/* Glowing Rim Borders */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent pointer-events-none" />

        {/* Reel Viewport (Height 136px for comfortable card padding) */}
        <div
          ref={viewportRef}
          className="relative h-34 w-full rounded-xl bg-[#05070E] border border-white/10 overflow-hidden shadow-inner flex items-center"
        >
          {/* Edge Vignetting for smooth infinite visual feel */}
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#05070E] via-[#05070E]/80 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#05070E] via-[#05070E]/80 to-transparent pointer-events-none z-10" />

          {/* Center Target Indicator (Crisp Precision Reticle) */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none z-20 flex flex-col items-center justify-between">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
            <div className="w-full h-full bg-gradient-to-b from-amber-400 via-amber-300 to-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          </div>

          {/* Reel Track */}
          <div
            className="flex items-center h-full will-change-transform"
            style={{
              transform: `translate3d(${reelTranslateX}px, 0, 0)`,
              transition: isSpinning ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            {reelItems.map((prize, idx) => {
              const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
              const isWinnerSelected =
                winningPrize && winningPrize.id === prize.id && idx === TARGET_INDEX;

              return (
                <div
                  key={`${prize.id}-${idx}`}
                  style={{
                    width: `${ITEM_WIDTH}px`,
                    marginRight: `${ITEM_GAP}px`,
                  }}
                  className={`h-29 shrink-0 rounded-xl bg-[#0E1324] border ${
                    rConfig.cardBorder
                  } p-1.5 flex flex-col items-center justify-between text-center select-none transition-all ${
                    isWinnerSelected
                      ? 'ring-2 ring-amber-400 scale-105 shadow-xl bg-gradient-to-b from-amber-950/50 to-[#0E1324]'
                      : 'opacity-95'
                  }`}
                >
                  {/* Prize Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 mt-0.5 relative flex items-center justify-center p-1">
                    <PrizeImage
                      src={prize.image || prize.icon_url}
                      alt={prize.name || prize.title}
                      className="w-full h-full rounded"
                      iconSize="w-5 h-5"
                    />
                  </div>

                  {/* Prize Title */}
                  <div className="w-full px-0.5">
                    <span className="text-[10px] font-bold text-white line-clamp-1 truncate block leading-tight">
                      {prize.name || prize.title}
                    </span>
                  </div>

                  {/* Rarity Pill & Drop Rate */}
                  <div className="space-y-0.5 w-full">
                    <span
                      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border inline-block leading-none ${rConfig.badgeStyle}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[8px] text-zinc-400 block font-semibold">
                      {prize.probability_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini Status & Cooldown Strip */}
        <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-medium">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>Balance:</span>
            <strong className="text-white font-bold">{currentPoints} pts</strong>
          </div>

          <div className="flex items-center gap-1.5">
            {cooldownSeconds > 0 ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>Cooldown: {formatCountdown(cooldownSeconds)}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Ready to Spin
              </span>
            )}
          </div>
        </div>

        {/* PRIMARY SPIN CONTROLS: 1X & 10X */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Spin 1x Button (Gold Luxury Gradient) */}
          <button
            type="button"
            disabled={isSpinning || cooldownSeconds > 0 || tickets < 1}
            onClick={() => handleRoll(1)}
            className={`min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
              isSpinning
                ? 'bg-zinc-800 text-zinc-400 border border-white/10 cursor-wait'
                : cooldownSeconds > 0
                ? 'bg-[#151928] text-zinc-400 border border-white/10 cursor-not-allowed'
                : tickets >= 1
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black shadow-amber-500/25 active:scale-[0.98] hover:brightness-110'
                : 'bg-zinc-800/80 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>SPINNING...</span>
              </>
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{formatCountdown(cooldownSeconds)}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-black fill-black" />
                <span>SPIN 1X</span>
                <span className="text-[10px] font-bold opacity-80">(1 🎟️)</span>
              </>
            )}
          </button>

          {/* Spin 10x Button (Purple Neon Luxury Gradient) */}
          <button
            type="button"
            disabled={isSpinning || cooldownSeconds > 0 || tickets < 10}
            onClick={() => handleRoll(10)}
            className={`min-h-[44px] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
              isSpinning
                ? 'bg-zinc-800 text-zinc-400 border border-white/10 cursor-wait'
                : cooldownSeconds > 0
                ? 'bg-[#151928] text-zinc-400 border border-white/10 cursor-not-allowed'
                : tickets >= 10
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white shadow-purple-500/25 active:scale-[0.98] hover:brightness-110'
                : 'bg-zinc-800/50 text-zinc-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            {isSpinning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>SPINNING...</span>
              </>
            ) : (
              <>
                <Ticket className="w-4 h-4 text-purple-300" />
                <span>SPIN 10X</span>
                <span className="text-[10px] font-bold opacity-80">(10 🎟️)</span>
              </>
            )}
          </button>
        </div>

        {/* QUICK CONVERT CTA BAR (Appears when user has low tickets but has points) */}
        {tickets < 1 && currentPoints >= 100 && (
          <div className="pt-1">
            <button
              type="button"
              disabled={isConverting}
              onClick={() => handleConvertPoints(1)}
              className="w-full min-h-[40px] rounded-xl bg-blue-600/15 hover:bg-blue-600/25 active:scale-[0.99] border border-blue-500/30 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>Converting Points...</span>
                </>
              ) : (
                <>
                  <Coins className="w-3.5 h-3.5 text-blue-400" />
                  <span>EXCHANGE 100 POINTS FOR 1 TICKET</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* INSUFFICIENT POINTS GUIDANCE (When user has 0 tickets and < 100 points) */}
        {tickets < 1 && currentPoints < 100 && (
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5 text-[11px] text-zinc-400">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="leading-snug">
              Need 100 Points to exchange for 1 Gacha Ticket. Earn points from daily rewards and shop purchases!
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. FEATURED GRAND PRIZE SHOWCASE (BELOW GACHA MACHINE)     */}
      {/* ========================================================= */}
      {featuredPrize && (
        <div
          className={`rounded-2xl bg-gradient-to-b from-[#11162B] via-[#0B0F1E] to-[#070A14] border-2 ${
            featuredRarityConfig?.cardBorder || 'border-amber-500/40'
          } p-3.5 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)] relative overflow-hidden space-y-3 card-3d card-3d-gold`}
        >
          {/* Ambient Radial Nebula Lighting */}
          <div
            className="absolute -right-12 -top-12 w-56 h-56 rounded-full pointer-events-none opacity-20 blur-3xl"
            style={{
              backgroundColor: featuredRarityConfig?.accentColor || '#F59E0B',
            }}
          />
          <div
            className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full pointer-events-none opacity-15 blur-2xl"
            style={{
              backgroundColor: '#6366F1',
            }}
          />

          {/* Header Row with Badges & Real Drop Chance */}
          <div className="flex items-center justify-between gap-2 relative z-10">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 to-amber-600/20 text-amber-300 border border-amber-400/50 text-[10px] font-black uppercase tracking-wider shadow-sm">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                GRAND PRIZE
              </span>
              <span
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm ${
                  featuredRarityConfig?.badgeStyle || 'bg-purple-950/90 text-purple-200 border-purple-500/50'
                }`}
              >
                {featuredRarityConfig?.label || featuredPrize.rarity}
              </span>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-[10px] font-black text-amber-400 shadow-sm">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{featuredPrize.probability_percent}% Rate</span>
            </div>
          </div>

          {/* Large Clear Artwork Area (Vertical Mobile Layout with 3D Depth) */}
          <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-b from-[#182038] to-[#0A0E1C] border border-white/15 p-4 flex flex-col items-center justify-center min-h-[160px] sm:min-h-[190px] shadow-inner group">
            {/* Subtle Pedestal Lighting */}
            <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-60" />
            <div className="absolute bottom-0 inset-x-8 h-8 rounded-full bg-amber-400/15 blur-lg pointer-events-none" />

            <div className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <PrizeImage
                src={featuredPrize.image || featuredPrize.icon_url}
                alt={featuredPrize.name || featuredPrize.title}
                className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                iconSize="w-16 h-16 sm:w-20 sm:h-20"
              />
            </div>

            {/* Glowing Floor Rim */}
            <div className="absolute bottom-2 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none" />
          </div>

          {/* Reward Details & Metadata Strip */}
          <div className="space-y-2.5 relative z-10">
            <div className="text-center sm:text-left">
              <h2 className="text-base sm:text-lg font-black text-white tracking-wide leading-tight">
                {featuredPrize.name || featuredPrize.title}
              </h2>
              {featuredPrize.description && (
                <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                  {featuredPrize.description}
                </p>
              )}
            </div>

            {/* Structured Real Data Spec Strip */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Available Stock</span>
                <span className="text-xs font-black text-white flex items-center gap-1 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${featuredPrize.stock > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                  {featuredPrize.stock > 0 ? `${featuredPrize.stock} Units` : 'Out of Stock'}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Drop Odds</span>
                <span className="text-xs font-black text-amber-400 mt-0.5">
                  {featuredPrize.probability_percent}%
                </span>
              </div>

              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">Delivery</span>
                <span className="text-xs font-black text-cyan-300 capitalize truncate mt-0.5 max-w-full px-1">
                  {featuredPrize.delivery_mode ? featuredPrize.delivery_mode.replace('_', ' ') : 'Instant'}
                </span>
              </div>
            </div>

            {/* Standby Teaser (Real Data Next On Deck) */}
            {nextPrize && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Flame className="w-3 h-3 text-purple-400" />
                  Next on Deck: <strong className="text-white font-bold">{nextPrize.name || nextPrize.title}</strong>
                </span>
                <span className="text-purple-400 font-bold text-[9px] uppercase tracking-wider">
                  Auto-promotes at 0 stock
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. REWARD POOL PRIZE LIST */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0B0F1D]/90 border border-white/10 p-3 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              REWARD POOL ({poolPrizes.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowDropRatesModal(true)}
            className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            <span>Drop Rates & Odds</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Detailed Prize List Cards */}
        {poolPrizes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {poolPrizes.map((prize) => {
              const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
              return (
                <div
                  key={prize.id}
                  className={`p-2 rounded-xl bg-[#121626] border ${rConfig.cardBorder} flex items-center justify-between gap-2 transition-all hover:bg-[#151A2E]`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/50 border border-white/10 shrink-0 flex items-center justify-center p-1">
                      <PrizeImage
                        src={prize.image || prize.icon_url}
                        alt={prize.name || prize.title}
                        className="w-full h-full rounded"
                        iconSize="w-4 h-4"
                      />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 space-y-0.5">
                      <h4 className="text-xs font-bold text-white truncate leading-tight">
                        {prize.name || prize.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400">
                        <span className="font-semibold text-zinc-300">
                          {prize.stock} in stock
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          {prize.delivery_mode.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rarity & Drop Rate Pill */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${rConfig.badgeStyle}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-300">
                      {prize.probability_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#121626] border border-white/5 text-center">
            <Gift className="w-6 h-6 text-zinc-500 mx-auto mb-1" />
            <p className="text-xs font-bold text-zinc-400">No prizes currently active in this pool</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 5. RECENT WINNERS LIVE ACTIVITY FEED */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0B0F1D]/90 border border-white/10 p-3 space-y-2.5 shadow-md">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              RECENT WINNERS
            </h3>
          </div>
          <span className="text-[9px] text-zinc-500 font-semibold uppercase">
            Live Feed
          </span>
        </div>

        {recentWinners && recentWinners.length > 0 ? (
          <div className="space-y-1.5">
            {recentWinners.slice(0, 4).map((winner) => {
              const rConfig = RARITY_CONFIG[winner.rarity] || RARITY_CONFIG.COMMON;
              return (
                <div
                  key={winner.id}
                  className="p-2 rounded-xl bg-[#121626] border border-white/5 flex items-center justify-between gap-2 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      <PrizeImage
                        src={winner.image || winner.icon_url}
                        alt={winner.prize_name}
                        className="w-full h-full"
                        iconSize="w-3.5 h-3.5"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate leading-tight">
                        {winner.username ? `@${winner.username}` : winner.first_name}
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate leading-tight">
                        Won {winner.prize_name}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${rConfig.badgeStyle}`}
                  >
                    {rConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#121626] border border-white/5 text-center space-y-1">
            <Trophy className="w-6 h-6 text-zinc-500 mx-auto" />
            <p className="text-xs font-bold text-zinc-300">No recent winners yet</p>
            <p className="text-[10px] text-zinc-500">
              Be the first to spin and win an exclusive prize!
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 6. DROP RATES & PROBABILITIES MODAL */}
      {/* ========================================================= */}
      {showDropRatesModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowDropRatesModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0B0F1D] border border-white/15 p-4 space-y-3.5 shadow-2xl text-white max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  DROP RATES & PROBABILITIES
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDropRatesModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rarity Summary Grid (5 Columns) */}
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {(
                ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL'] as GachaRarity[]
              ).map((rarity) => {
                const rConfig = RARITY_CONFIG[rarity];
                return (
                  <div
                    key={rarity}
                    className="p-1.5 rounded-lg bg-[#121626] border border-white/5 space-y-0.5"
                  >
                    <span
                      className={`text-[8px] font-black block truncate ${rConfig.textColor}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[10px] font-bold text-white block">
                      {rConfig.dropRate}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Prize List Items */}
            <div className="space-y-1.5 pt-1 max-h-64 overflow-y-auto pr-1">
              {poolPrizes.map((prize) => {
                const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
                return (
                  <div
                    key={prize.id}
                    className="p-2 rounded-lg bg-[#121626] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded bg-black/50 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                        <PrizeImage
                          src={prize.image || prize.icon_url}
                          alt={prize.name || prize.title}
                          className="w-full h-full rounded"
                          iconSize="w-3.5 h-3.5"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-white block truncate leading-tight">
                          {prize.name || prize.title}
                        </span>
                        <span className="text-[9px] text-zinc-400 block leading-tight">
                          Stock: {prize.stock} left
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${rConfig.badgeStyle}`}
                      >
                        {rConfig.label}
                      </span>
                      <span className="text-[11px] font-bold text-zinc-200">
                        {prize.probability_percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Information Note */}
            <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
              All rolls are server-authoritative and mathematically provable. 1 Gacha Ticket = 100 Uchiro Points.
            </p>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowDropRatesModal(false)}
              className="w-full min-h-[40px] rounded-xl font-black text-xs uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. REWARD REVEAL POPUP (CONFIRMED SERVER RESULT ONLY) */}
      {/* ========================================================= */}
      {showRevealModal && winningPrize && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowRevealModal(false)}
        >
          <div
            className={`w-full max-w-[320px] rounded-2xl bg-[#0B0F1D] border ${
              RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-amber-500/40'
            } p-4 text-center relative shadow-2xl text-white space-y-3.5 overflow-hidden`}
            style={{
              boxShadow: `0 0 40px ${
                RARITY_CONFIG[winningPrize.rarity]?.glowColor || 'rgba(245,158,11,0.3)'
              }`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-0.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                <Sparkles className="w-3 h-3 text-amber-400" />
                CONGRATULATIONS!
              </span>
              <h2 className="text-xl font-black tracking-tight text-white">
                YOU WON!
              </h2>
            </div>

            {/* Prize Image Container */}
            <div
              className={`w-22 h-22 mx-auto rounded-2xl overflow-hidden bg-black/60 border-2 ${
                RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-white/20'
              } p-2 shadow-xl relative flex items-center justify-center`}
            >
              <PrizeImage
                src={winningPrize.image || winningPrize.icon_url}
                alt={winningPrize.name || winningPrize.title}
                className="w-full h-full rounded-xl"
                iconSize="w-8 h-8"
              />
            </div>

            {/* Prize Info & Rarity */}
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-black text-white truncate px-1">
                {winningPrize.name || winningPrize.title}
              </h3>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    RARITY_CONFIG[winningPrize.rarity]?.badgeStyle || ''
                  }`}
                >
                  {RARITY_CONFIG[winningPrize.rarity]?.label || winningPrize.rarity}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {winningPrize.probability_percent}% Drop Chance
                </span>
              </div>
            </div>

            {/* Voucher Code Alert */}
            {revealedClaim?.delivery_data?.code && (
              <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1 text-left">
                <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider block">
                  VOUCHER CODE:
                </span>
                <div className="flex items-center justify-between gap-1.5 bg-[#141828] p-2 rounded-lg border border-white/10">
                  <code className="text-xs font-mono font-bold text-amber-400 truncate">
                    {revealedClaim.delivery_data.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyVoucherCode(revealedClaim.delivery_data.code)}
                    className="p-1 px-2 rounded bg-white/10 hover:bg-white/20 text-zinc-300 text-[10px] font-bold transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {winningPrize.reward_type === 'points' && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Points credited to your balance!</span>
              </div>
            )}

            {winningPrize.delivery_mode === 'manual_review' && (
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Staff review claim logged.</span>
              </div>
            )}

            {/* Single "CLAIM / CONTINUE" Button */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="w-full min-h-[42px] rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              CLAIM / CONTINUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
