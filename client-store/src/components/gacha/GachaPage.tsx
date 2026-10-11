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
// RARITY CONFIGURATION (Exact Probabilities & Luxury Neon Accents)
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
  },
  RARE: {
    label: 'RARE',
    badgeStyle: 'bg-blue-950/90 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/20',
    cardBorder: 'border-blue-500/50',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    accentColor: '#3B82F6',
    textColor: 'text-blue-400',
    dropRate: '28.0%',
    bgGradient: 'from-blue-950/80 to-slate-950',
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
  },
};

// Scaled down by ~20% for compact mobile WebView footprint
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

  // Compact Drop Rates Bottom Sheet Modal
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
  }, [poolPrizes]);

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
          : '1 Ticket acquired (+100 pts exchanged)!'
      );
      onRefreshProfile();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        'Failed to exchange tickets. Check your points total.';
      setErrorMsg(msg);
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
      return;
    }
    if (tickets < spinsCount) {
      setErrorMsg(
        spinsCount > 1
          ? `You need ${spinsCount} tickets for 10x Spin.`
          : 'You need at least 1 ticket to spin.'
      );
      return;
    }

    setIsSpinning(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setWinningPrize(null);
    setShowRevealModal(false);

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

      // 4. Smooth spin animation with cubic deceleration (compact duration 3.8s)
      const duration = 3800;
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
              particleCount: 65,
              spread: 60,
              origin: { y: 0.55 },
              colors: ['#F59E0B', '#EF4444', '#A855F7', '#3B82F6', '#10B981'],
            });
          } catch {
            // ignore
          }

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
      loadGachaStatus();
    }
  };

  const copyVoucherCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore
    }
  };

  const currentRarityConfig = currentPrize
    ? RARITY_CONFIG[currentPrize.rarity] || RARITY_CONFIG.COMMON
    : null;

  return (
    <div className="space-y-2.5 pb-24 max-w-md mx-auto px-2.5 sm:px-3 animate-fadeIn select-none">
      {/* ========================================================= */}
      {/* 1. COMPACT HEADER & LUXURY TICKET PILL */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0D111D]/90 backdrop-blur-md border border-amber-500/20 p-2.5 shadow-lg relative overflow-hidden">
        {/* Subtle Luxury Gradient Accent */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between gap-2">
          {/* Title Banner */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400/20 to-yellow-500/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white tracking-wider truncate">
                  UCHIRO GACHA
                </h1>
                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
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

          {/* Ticket Balance Badge Pill & Quick Convert */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Elegant Ticket Pill */}
            <div className="py-1 px-2.5 rounded-full bg-[#151A2B] border border-amber-500/30 text-xs font-semibold text-white flex items-center gap-1.5 shadow-sm shadow-amber-500/10">
              <img
                src="/emojis/ticket.webp"
                alt="Ticket"
                className="w-4 h-4 object-contain inline-block shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-black text-amber-400 text-xs">
                {tickets}
              </span>
              <span className="text-[9px] text-zinc-400 font-bold uppercase">
                {language === 'km' ? 'សំបុត្រ' : 'TICKETS'}
              </span>
            </div>

            {/* Quick 100 Pts Convert Pill */}
            {currentPoints >= 100 && (
              <button
                type="button"
                disabled={isConverting}
                onClick={() => handleConvertPoints(1)}
                title="Exchange 100 Points for 1 Ticket"
                className="py-1 px-2 rounded-full bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                {isConverting ? (
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                ) : (
                  <>
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span>+1</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Global Inline Alerts */}
        {errorMsg && (
          <div className="mt-2 p-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-[11px] text-rose-200 flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-2 p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-[11px] text-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 2. COMPACT CURRENT GRAND PRIZE SPOTLIGHT */}
      {/* ========================================================= */}
      {currentPrize && (
        <div
          className={`rounded-2xl bg-[#0D111D] border ${
            currentRarityConfig?.cardBorder || 'border-amber-500/30'
          } p-2.5 shadow-md relative overflow-hidden flex items-center justify-between gap-2`}
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            className="absolute -right-10 -top-10 w-32 h-32 rounded-full pointer-events-none opacity-20 blur-xl"
            style={{ backgroundColor: currentRarityConfig?.accentColor || '#F59E0B' }}
          />

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Compact Prize Image */}
            <div
              className={`w-12 h-12 rounded-xl overflow-hidden bg-black/50 border ${
                currentRarityConfig?.cardBorder || 'border-white/10'
              } shrink-0 relative flex items-center justify-center`}
            >
              <PrizeImage
                src={currentPrize.image || currentPrize.icon_url}
                alt={currentPrize.name || currentPrize.title}
                className="w-full h-full"
                iconSize="w-5 h-5"
              />
            </div>

            {/* Info Column */}
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-400/90 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-amber-400" />
                  GRAND PRIZE
                </span>
                <span
                  className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full border ${
                    currentRarityConfig?.badgeStyle || ''
                  }`}
                >
                  {currentRarityConfig?.label || currentPrize.rarity}
                </span>
              </div>

              <h2 className="text-xs font-black text-white truncate max-w-[190px]">
                {currentPrize.name || currentPrize.title}
              </h2>

              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span>
                  Stock: <strong className="text-amber-400">{currentPrize.stock}</strong> left
                </span>
                <span>•</span>
                <span>Drop: <strong>{currentPrize.probability_percent}%</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Odds / Drawer Button */}
          <button
            type="button"
            onClick={() => setShowDropRatesModal(true)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-zinc-400 hover:text-white border border-white/10 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden xs:inline">Odds</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. COMPACT REEL CENTERPIECE & STREAMLINED SPIN BUTTONS */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#090C15] border border-amber-500/25 p-2.5 sm:p-3 space-y-2.5 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
        {/* Subtle Glowing Rim Borders */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent pointer-events-none" />

        {/* Reel Viewport (Scaled down to h-32 / 128px) */}
        <div
          ref={viewportRef}
          className="relative h-32 w-full rounded-xl bg-[#06080E] border border-white/10 overflow-hidden shadow-inner flex items-center"
        >
          {/* Subtle edge vignetting */}
          <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#06080E] via-[#06080E]/70 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#06080E] via-[#06080E]/70 to-transparent pointer-events-none z-10" />

          {/* Center Target Indicator (Laser Guide - Crisp & Centered) */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none z-20 flex flex-col items-center justify-between">
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] border-t-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
            <div className="w-full h-full bg-gradient-to-b from-amber-400/90 via-amber-400/40 to-amber-400/90 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[7px] border-b-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
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
                  className={`h-28 shrink-0 rounded-xl bg-[#0F1322] border ${
                    rConfig.cardBorder
                  } p-1.5 flex flex-col items-center justify-between text-center select-none transition-all ${
                    isWinnerSelected
                      ? 'ring-2 ring-amber-400 scale-105 shadow-xl bg-gradient-to-b from-amber-950/40 to-[#0F1322]'
                      : 'opacity-90'
                  }`}
                >
                  {/* Prize Image (Compact 44x44px) */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-black/50 border border-white/10 shrink-0 mt-0.5 relative flex items-center justify-center">
                    <PrizeImage
                      src={prize.image || prize.icon_url}
                      alt={prize.name || prize.title}
                      className="w-full h-full"
                      iconSize="w-4 h-4"
                    />
                  </div>

                  {/* Prize Title */}
                  <div className="w-full px-1">
                    <span className="text-[10px] font-bold text-white line-clamp-1 truncate block">
                      {prize.name || prize.title}
                    </span>
                  </div>

                  {/* Rarity Pill & Drop Rate */}
                  <div className="space-y-0.5 w-full">
                    <span
                      className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full border inline-block ${rConfig.badgeStyle}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[8px] text-zinc-500 block">
                      {prize.probability_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Points & Cooldown Mini Bar */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1 font-medium">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3 h-3 text-amber-400" />
            <span>Balance:</span>
            <strong className="text-white font-bold">{currentPoints} pts</strong>
          </div>

          <div className="flex items-center gap-1.5">
            {cooldownSeconds > 0 ? (
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Clock className="w-3 h-3" />
                {formatCountdown(cooldownSeconds)}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready to Spin
              </span>
            )}
          </div>
        </div>

        {/* STREAMLINED ACTION BUTTONS (Clean side-by-side: Spin 1x & Spin 10x) */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {/* Spin 1x Button (Gold Luxury Gradient, h-10 / h-11) */}
          <button
            type="button"
            disabled={isSpinning || cooldownSeconds > 0 || tickets < 1}
            onClick={() => handleRoll(1)}
            className={`h-10.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
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
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>Spinning...</span>
              </>
            ) : cooldownSeconds > 0 ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatCountdown(cooldownSeconds)}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-black fill-black" />
                <span>SPIN 1X</span>
                <span className="text-[10px] font-bold opacity-80">(1 🎟️)</span>
              </>
            )}
          </button>

          {/* Spin 10x Button (Purple Neon Luxury Gradient, h-10 / h-11) */}
          <button
            type="button"
            disabled={isSpinning || cooldownSeconds > 0 || tickets < 10}
            onClick={() => handleRoll(10)}
            className={`h-10.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
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
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Spinning...</span>
              </>
            ) : (
              <>
                <Ticket className="w-3.5 h-3.5 text-purple-300" />
                <span>SPIN 10X</span>
                <span className="text-[10px] font-bold opacity-80">(10 🎟️)</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Convert Helper Pill Bar if tickets are low */}
        {tickets < 1 && currentPoints >= 100 && (
          <div className="pt-0.5">
            <button
              type="button"
              disabled={isConverting}
              onClick={() => handleConvertPoints(1)}
              className="w-full h-8 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 active:scale-[0.99] border border-blue-500/30 text-blue-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                  <span>Converting Points...</span>
                </>
              ) : (
                <>
                  <Coins className="w-3 h-3 text-blue-400" />
                  <span>Exchange 100 Points for 1 Ticket</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. COMPACT REWARD POOL PREVIEW STRIP & ODDS TRIGGER */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0D111D] border border-white/10 p-2.5 space-y-2 shadow-md">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Gift className="w-3 h-3 text-amber-400" />
            REWARD POOL ({poolPrizes.length})
          </span>
          <button
            type="button"
            onClick={() => setShowDropRatesModal(true)}
            className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            <span>Drop Rates & Odds</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Compact Mini Preview Tiles (h-12 w-12 / h-13 w-13) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-0.5">
          {poolPrizes.map((prize) => {
            const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
            return (
              <button
                key={prize.id}
                type="button"
                onClick={() => setShowDropRatesModal(true)}
                className={`w-13 h-13 shrink-0 rounded-xl bg-[#141828] border ${rConfig.cardBorder} p-1 flex flex-col items-center justify-center relative group active:scale-95 transition-all hover:brightness-110 cursor-pointer`}
                title={`${prize.name || prize.title} (${rConfig.label} - ${prize.probability_percent}%)`}
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                  <PrizeImage
                    src={prize.image || prize.icon_url}
                    alt={prize.name || prize.title}
                    className="w-full h-full"
                    iconSize="w-4 h-4"
                  />
                </div>
                <div
                  className="w-2 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: rConfig.accentColor }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. COMPACT RECENT WINNERS FEED */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0D111D] border border-white/10 p-2.5 space-y-2 shadow-md">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-amber-400" />
            RECENT WINNERS
          </span>
          <span className="text-[9px] text-zinc-500">Live Feed</span>
        </div>

        {recentWinners && recentWinners.length > 0 ? (
          <div className="space-y-1.5">
            {recentWinners.slice(0, 3).map((winner) => {
              const rConfig = RARITY_CONFIG[winner.rarity] || RARITY_CONFIG.COMMON;
              return (
                <div
                  key={winner.id}
                  className="p-1.5 rounded-xl bg-[#131726] border border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      <PrizeImage
                        src={winner.image || winner.icon_url}
                        alt={winner.prize_name}
                        className="w-full h-full"
                        iconSize="w-3 h-3"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-white block truncate leading-tight">
                        {winner.username ? `@${winner.username}` : winner.first_name}
                      </span>
                      <span className="text-[9px] text-zinc-400 block truncate leading-tight">
                        Won {winner.prize_name}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${rConfig.badgeStyle}`}
                  >
                    {rConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#131726] border border-white/5 text-center">
            <p className="text-[11px] font-bold text-zinc-400">No recent winners yet</p>
            <p className="text-[9px] text-zinc-500">
              Be the first to spin and win an exclusive prize!
            </p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 6. COMPACT DROP RATES BOTTOM SHEET / DRAWER */}
      {/* ========================================================= */}
      {showDropRatesModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowDropRatesModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#0D111E] border border-white/15 p-3.5 space-y-3 shadow-2xl text-white max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close */}
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  DROP RATES & PROBABILITIES
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDropRatesModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rarity Grid (5 Columns) */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {(
                ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL'] as GachaRarity[]
              ).map((rarity) => {
                const rConfig = RARITY_CONFIG[rarity];
                return (
                  <div
                    key={rarity}
                    className="p-1 rounded-lg bg-[#141828] border border-white/5 space-y-0.5"
                  >
                    <span
                      className={`text-[7px] font-black block truncate ${rConfig.textColor}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[9px] font-bold text-white block">
                      {rConfig.dropRate}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Prize List Items */}
            <div className="space-y-1 pt-1 max-h-60 overflow-y-auto pr-1">
              {poolPrizes.map((prize) => {
                const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
                return (
                  <div
                    key={prize.id}
                    className="p-1.5 rounded-lg bg-[#131726] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-black/50 border border-white/10 shrink-0 overflow-hidden flex items-center justify-center">
                        <PrizeImage
                          src={prize.image || prize.icon_url}
                          alt={prize.name || prize.title}
                          className="w-full h-full"
                          iconSize="w-3 h-3"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-white truncate">
                        {prize.name || prize.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${rConfig.badgeStyle}`}
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

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowDropRatesModal(false)}
              className="w-full h-9 rounded-xl font-black text-xs uppercase tracking-wider bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. COMPACT REWARD REVEAL POPUP (SLEEK CENTRED MODAL) */}
      {/* ========================================================= */}
      {showRevealModal && winningPrize && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowRevealModal(false)}
        >
          <div
            className={`w-full max-w-[320px] rounded-2xl bg-[#0D111E] border ${
              RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-amber-500/40'
            } p-4 text-center relative shadow-2xl text-white space-y-3 overflow-hidden`}
            style={{
              boxShadow: `0 0 35px ${
                RARITY_CONFIG[winningPrize.rarity]?.glowColor || 'rgba(245,158,11,0.3)'
              }`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="absolute top-2.5 right-2.5 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-0.5 pt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                <Sparkles className="w-2.5 h-2.5" />
                CONGRATULATIONS!
              </span>
              <h2 className="text-lg font-black tracking-tight text-white">
                YOU WON!
              </h2>
            </div>

            {/* Prize Image Container (Compact 80x80px / w-20 h-20) */}
            <div
              className={`w-20 h-20 mx-auto rounded-2xl overflow-hidden bg-black/60 border-2 ${
                RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-white/20'
              } p-1.5 shadow-xl relative flex items-center justify-center`}
            >
              <PrizeImage
                src={winningPrize.image || winningPrize.icon_url}
                alt={winningPrize.name || winningPrize.title}
                className="w-full h-full rounded-xl"
                iconSize="w-8 h-8"
              />
            </div>

            {/* Prize Info & Rarity */}
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-white truncate px-1">
                {winningPrize.name || winningPrize.title}
              </h3>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.2 rounded-full border ${
                    RARITY_CONFIG[winningPrize.rarity]?.badgeStyle || ''
                  }`}
                >
                  {RARITY_CONFIG[winningPrize.rarity]?.label || winningPrize.rarity}
                </span>
                <span className="text-[9px] text-zinc-400">
                  {winningPrize.probability_percent}% Drop Chance
                </span>
              </div>
            </div>

            {/* Optional Voucher Code Alert */}
            {revealedClaim?.delivery_data?.code && (
              <div className="p-2 rounded-xl bg-black/40 border border-white/10 space-y-1 text-left">
                <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider block">
                  Voucher Code:
                </span>
                <div className="flex items-center justify-between gap-1.5 bg-[#141828] p-1.5 rounded-lg border border-white/10">
                  <code className="text-xs font-mono font-bold text-amber-400 truncate">
                    {revealedClaim.delivery_data.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyVoucherCode(revealedClaim.delivery_data.code)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors shrink-0 cursor-pointer"
                  >
                    {copiedCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
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

            {/* Single, Clean "Claim / Continue" Button (h-10) */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="w-full h-10 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              Claim / Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
