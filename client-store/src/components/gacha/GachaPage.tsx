import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Ticket,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  Gift,
  Copy,
  Check,
  Trophy,
  Info,
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
// RARITY CONFIGURATION (Exact Probabilities & Accent Colors)
// Common: #71717A (50%)
// Rare: #3B82F6 (28%)
// Epic: #A855F7 (14%)
// Legendary: #F59E0B (6.5%)
// Mythical: #EF4444 (1.5%)
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
  },
  RARE: {
    label: 'RARE',
    badgeStyle: 'bg-blue-950/90 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/20',
    cardBorder: 'border-blue-500/50',
    glowColor: 'rgba(59, 130, 246, 0.35)',
    accentColor: '#3B82F6',
    textColor: 'text-blue-400',
    dropRate: '28.0%',
  },
  EPIC: {
    label: 'EPIC',
    badgeStyle: 'bg-purple-950/90 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/25',
    cardBorder: 'border-purple-500/50',
    glowColor: 'rgba(168, 85, 247, 0.40)',
    accentColor: '#A855F7',
    textColor: 'text-purple-400',
    dropRate: '14.0%',
  },
  LEGENDARY: {
    label: 'LEGENDARY',
    badgeStyle: 'bg-amber-950/90 text-amber-300 border-amber-500/60 shadow-sm shadow-amber-500/30',
    cardBorder: 'border-amber-500/60',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    accentColor: '#F59E0B',
    textColor: 'text-amber-400',
    dropRate: '6.5%',
  },
  MYTHICAL: {
    label: 'MYTHICAL',
    badgeStyle: 'bg-rose-950/90 text-rose-300 border-rose-500/70 shadow-md shadow-rose-500/35',
    cardBorder: 'border-rose-500/70',
    glowColor: 'rgba(239, 68, 68, 0.55)',
    accentColor: '#EF4444',
    textColor: 'text-rose-400',
    dropRate: '1.5%',
  },
};

const ITEM_WIDTH = 136;
const ITEM_GAP = 12;
const ITEM_PITCH = ITEM_WIDTH + ITEM_GAP; // 148px
const TOTAL_REEL_ITEMS = 40;
const TARGET_INDEX = 30;

const PrizeImage: React.FC<{
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
}> = ({ src, alt, className = 'w-full h-full', iconSize = 'w-6 h-6' }) => {
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
  const { t, language } = useLanguage();
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

  // Expandable Prize Pool Details
  const [showOddsDetails, setShowOddsDetails] = useState<boolean>(false);

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
  // CONVERT 100 POINTS TO 1 TICKET
  // =========================================================================
  const handleConvertPoints = async () => {
    if (isConverting) return;
    setIsConverting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await StoreAPI.buyGachaTickets(1);
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
      setSuccessMsg('Successfully converted 100 Points to 1 Gacha Ticket!');
      onRefreshProfile();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to exchange tickets. Check your points total.';
      setErrorMsg(msg);
    } finally {
      setIsConverting(false);
    }
  };

  // =========================================================================
  // SERVER-AUTHORITATIVE ROLL & ANIMATED REEL
  // =========================================================================
  const handleRoll = async () => {
    if (!activePool || isSpinning) return;
    if (cooldownSeconds > 0) {
      setErrorMsg(`Cooldown active. Please wait ${formatCountdown(cooldownSeconds)}.`);
      return;
    }
    if (tickets < 1) {
      setErrorMsg('You need at least 1 ticket to roll.');
      return;
    }

    setIsSpinning(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setWinningPrize(null);
    setShowRevealModal(false);

    try {
      // 1. Request Server Roll (Server chooses authoritatively)
      const res = await StoreAPI.spinGacha(activePool.id);
      const serverWinningPrize: GachaPrize = res.prize;

      // 2. Build reel strip where index TARGET_INDEX is strictly serverWinningPrize
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

      // 3. Target viewport calculations
      const viewportWidth = viewportRef.current?.clientWidth || 360;
      const targetCenter = TARGET_INDEX * ITEM_PITCH + ITEM_WIDTH / 2;
      const targetX = viewportWidth / 2 - targetCenter;
      const startX = reelTranslateX;

      // 4. Smooth spin animation with cubic deceleration
      const duration = 4200;
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
          // Animation Complete: Snap exactly to target
          setReelTranslateX(targetX);
          setIsSpinning(false);
          setWinningPrize(serverWinningPrize);
          setRevealedClaim(res.claim);

          // Confetti celebration
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FFD166', '#EF4444', '#A855F7', '#3B82F6', '#10B981'],
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
      const msg = err.response?.data?.error?.message || err.message || 'Gacha roll failed. Please try again.';
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

  const nextRarityConfig = nextPrize
    ? RARITY_CONFIG[nextPrize.rarity] || RARITY_CONFIG.COMMON
    : null;

  return (
    <div className="space-y-4 pb-24 animate-fadeIn max-w-md mx-auto">
      {/* ========================================================= */}
      {/* A. HEADER */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0F1320] border border-white/10 p-4 space-y-2 relative overflow-hidden shadow-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-wider">GACHA</h1>
            <p className="text-xs text-zinc-400">
              Use your UCHIRO Points to unlock exclusive rewards.
            </p>
          </div>
        </div>

        {/* Global Alerts */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* B. CURRENT PRIZE HERO */}
      {/* ========================================================= */}
      {currentPrize && (
        <div
          className={`rounded-2xl bg-[#0F1320] border ${
            currentRarityConfig?.cardBorder || 'border-white/10'
          } p-4 space-y-3 shadow-xl relative overflow-hidden`}
        >
          {/* Header Row: Label + Rarity Badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                CURRENT PRIZE
              </span>
            </div>
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                currentRarityConfig?.badgeStyle || ''
              }`}
            >
              {currentRarityConfig?.label || currentPrize.rarity}
            </span>
          </div>

          {/* Details Row: Image + Name + Stock + Description */}
          <div className="flex items-start gap-3">
            <div
              className={`w-20 h-20 rounded-xl overflow-hidden bg-black/40 border ${
                currentRarityConfig?.cardBorder || 'border-white/10'
              } shrink-0 relative`}
            >
              <PrizeImage
                src={currentPrize.image || currentPrize.icon_url}
                alt={currentPrize.name || currentPrize.title}
                className="w-full h-full"
                iconSize="w-7 h-7"
              />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {currentPrize.name || currentPrize.title}
              </h3>

              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-zinc-400">Remaining Stock:</span>
                <span className="font-bold text-amber-400">
                  {currentPrize.stock} Available
                </span>
              </div>

              {currentPrize.description && (
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {currentPrize.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* C. REWARD REEL (MAIN CENTERPIECE) */}
      {/* ========================================================= */}
      <div className="rounded-2xl bg-[#0B0E17] border border-white/10 p-3.5 space-y-3 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            REWARD REEL
          </span>
          <span className="text-[10px] font-medium text-zinc-500">
            Server-Authoritative Selection
          </span>
        </div>

        {/* Carousel Viewport */}
        <div
          ref={viewportRef}
          className="relative h-44 w-full rounded-xl bg-[#080B12] border border-white/10 overflow-hidden shadow-inner flex items-center"
        >
          {/* Subtle edge vignetting */}
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#080B12] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#080B12] to-transparent pointer-events-none z-10" />

          {/* Center Target Indicator (Laser Guide) */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] pointer-events-none z-20 flex flex-col items-center justify-between">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
            <div className="w-full h-full bg-gradient-to-b from-amber-400/80 via-amber-400/40 to-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
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
                  className={`h-36 shrink-0 rounded-xl bg-[#111522] border ${
                    rConfig.cardBorder
                  } p-2 flex flex-col items-center justify-between text-center select-none transition-all ${
                    isWinnerSelected
                      ? 'ring-2 ring-amber-400 scale-105 shadow-xl'
                      : 'opacity-90'
                  }`}
                >
                  {/* Prize Image */}
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 shrink-0 mt-0.5 relative">
                    <PrizeImage
                      src={prize.image || prize.icon_url}
                      alt={prize.name || prize.title}
                      className="w-full h-full"
                      iconSize="w-5 h-5"
                    />
                  </div>

                  {/* Prize Title */}
                  <div className="w-full px-1">
                    <span className="text-[11px] font-bold text-white line-clamp-1 truncate block">
                      {prize.name || prize.title}
                    </span>
                  </div>

                  {/* Rarity Pill & Drop Rate */}
                  <div className="space-y-0.5">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${rConfig.badgeStyle}`}
                    >
                      {rConfig.label}
                    </span>
                    <span className="text-[9px] text-zinc-500 block">
                      {prize.probability_percent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* D. POINTS & ACTION BAR */}
        {/* ========================================================= */}
        <div className="space-y-3 pt-1">
          {/* Points & Tickets Grid */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-[#141825] border border-white/10">
              <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>{language === 'km' ? 'ពិន្ទុរបស់អ្នក' : 'YOUR POINTS'}</span>
              </div>
              <span className="text-lg font-black text-white">{currentPoints}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#141825] border border-white/10">
              <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <Ticket className="w-3.5 h-3.5 text-blue-400" />
                <span>{language === 'km' ? 'សំបុត្ររបស់អ្នក' : 'YOUR TICKETS'}</span>
              </div>
              <span className="text-lg font-black text-white">{tickets}</span>
            </div>
          </div>

          {/* Conversion Reference Tags */}
          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              {language === 'km' ? '១០០ ពិន្ទុ = ១ សំបុត្រ' : '100 POINTS = 1 TICKET'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {language === 'km' ? 'រង់ចាំ ១ ម៉ោង' : '1 HOUR COOLDOWN'}
            </span>
          </div>

          {/* Adaptive Action Button */}
          <div>
            {isSpinning ? (
              <button
                disabled
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/10 flex items-center justify-center gap-2 cursor-wait"
              >
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>{language === 'km' ? 'កំពុងបង្វិល...' : 'ROLLING...'}</span>
              </button>
            ) : cooldownSeconds > 0 ? (
              <button
                disabled
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-[#141824] text-zinc-400 border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  {language === 'km'
                    ? `រង់ចាំ — ${formatCountdown(cooldownSeconds)}`
                    : `COOLDOWN — ${formatCountdown(cooldownSeconds)}`}
                </span>
              </button>
            ) : tickets >= 1 ? (
              <button
                type="button"
                onClick={handleRoll}
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-black shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-black fill-black" />
                <span>{language === 'km' ? 'បង្វិល — ១ សំបុត្រ' : 'ROLL — 1 TICKET'}</span>
              </button>
            ) : currentPoints >= 100 ? (
              <button
                type="button"
                disabled={isConverting}
                onClick={handleConvertPoints}
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-60 cursor-pointer"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{language === 'km' ? 'កំពុងប្តូរ...' : 'CONVERTING...'}</span>
                  </>
                ) : (
                  <>
                    <Ticket className="w-4 h-4" />
                    <span>
                      {language === 'km'
                        ? 'ប្តូរ ១០០ ពិន្ទុជា ១ សំបុត្រ'
                        : 'CONVERT 100 PTS TO 1 TICKET'}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                disabled
                className="w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider bg-[#141824] text-zinc-500 border border-white/10 flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <AlertCircle className="w-4 h-4 text-zinc-500" />
                <span>
                  {language === 'km'
                    ? 'ពិន្ទុមិនគ្រប់គ្រាន់ (ត្រូវការ ១០០ ពិន្ទុ)'
                    : 'INSUFFICIENT POINTS'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* F. NEXT PRIZE TEASER & RECENT WINNERS */}
      {/* ========================================================= */}
      {/* Next Prize Teaser */}
      {nextPrize && (
        <div
          className={`rounded-2xl bg-[#0F1320] border ${
            nextRarityConfig?.cardBorder || 'border-white/10'
          } p-4 space-y-2.5 shadow-xl relative overflow-hidden`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-blue-400" />
              NEXT PRIZE TEASER
            </span>
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                nextRarityConfig?.badgeStyle || ''
              }`}
            >
              {nextRarityConfig?.label || nextPrize.rarity}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div
              className={`w-14 h-14 rounded-xl overflow-hidden bg-black/40 border ${
                nextRarityConfig?.cardBorder || 'border-white/10'
              } shrink-0`}
            >
              <PrizeImage
                src={nextPrize.image || nextPrize.icon_url}
                alt={nextPrize.name || nextPrize.title}
                className="w-full h-full"
                iconSize="w-5 h-5"
              />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <h4 className="text-xs font-black text-white truncate">
                {nextPrize.name || nextPrize.title}
              </h4>
              <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">
                {nextPrize.description ||
                  'Automatically enters the current pool when the active grand prize runs out of stock.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Winners Section */}
      <div className="rounded-2xl bg-[#0F1320] border border-white/10 p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            RECENT WINNERS
          </span>
          <span className="text-[10px] text-zinc-500">Live Server Feed</span>
        </div>

        {recentWinners && recentWinners.length > 0 ? (
          <div className="space-y-2">
            {recentWinners.slice(0, 5).map((winner) => {
              const rConfig = RARITY_CONFIG[winner.rarity] || RARITY_CONFIG.COMMON;
              return (
                <div
                  key={winner.id}
                  className="p-2.5 rounded-xl bg-[#141825] border border-white/5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
                      <PrizeImage
                        src={winner.image || winner.icon_url}
                        alt={winner.prize_name}
                        className="w-full h-full rounded-lg"
                        iconSize="w-3.5 h-3.5"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-white block truncate">
                        {winner.username ? `@${winner.username}` : winner.first_name}
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        Won {winner.prize_name}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${rConfig.badgeStyle}`}
                  >
                    {rConfig.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#141825] border border-white/5 text-center space-y-1">
            <Trophy className="w-6 h-6 text-zinc-600 mx-auto" />
            <p className="text-xs font-bold text-zinc-400">No recent winners yet</p>
            <p className="text-[11px] text-zinc-500">
              Be the first to roll and claim an exclusive reward!
            </p>
          </div>
        )}
      </div>

      {/* Prize Odds & Probability Breakdown */}
      <div className="rounded-2xl bg-[#0F1320] border border-white/10 p-4 space-y-2 shadow-xl">
        <button
          type="button"
          onClick={() => setShowOddsDetails(!showOddsDetails)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            DROP PROBABILITIES & ODDS
          </span>
          {showOddsDetails ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>

        {showOddsDetails && (
          <div className="pt-2 space-y-2 border-t border-white/5 animate-fadeIn">
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL'] as GachaRarity[]).map(
                (rarity) => {
                  const rConfig = RARITY_CONFIG[rarity];
                  return (
                    <div
                      key={rarity}
                      className="p-1.5 rounded-lg bg-[#141825] border border-white/5 space-y-0.5"
                    >
                      <span className={`text-[8px] font-black block ${rConfig.textColor}`}>
                        {rConfig.label}
                      </span>
                      <span className="text-[10px] font-bold text-white block">
                        {rConfig.dropRate}
                      </span>
                    </div>
                  );
                }
              )}
            </div>

            <div className="space-y-1.5 pt-1">
              {poolPrizes.map((prize) => {
                const rConfig = RARITY_CONFIG[prize.rarity] || RARITY_CONFIG.COMMON;
                return (
                  <div
                    key={prize.id}
                    className="p-2 rounded-lg bg-[#141825] border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-black/40 border border-white/10 shrink-0 overflow-hidden">
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
                    <span
                      className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border shrink-0 ${rConfig.badgeStyle}`}
                    >
                      {prize.probability_percent}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* E. WINNER REVEAL MODAL */}
      {/* ========================================================= */}
      {showRevealModal && winningPrize && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowRevealModal(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl bg-[#0F1320] border p-5 text-center relative shadow-2xl text-white space-y-4 ${
              RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-white/20'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-400/30">
                <Sparkles className="w-3 h-3" />
                CONGRATULATIONS!
              </span>
              <h2 className="text-xl font-black tracking-tight text-white">YOU WON!</h2>
            </div>

            {/* Prize Image Container */}
            <div
              className={`w-28 h-28 mx-auto rounded-2xl overflow-hidden bg-black/50 border-2 ${
                RARITY_CONFIG[winningPrize.rarity]?.cardBorder || 'border-white/20'
              } p-2 shadow-2xl relative flex items-center justify-center`}
            >
              <PrizeImage
                src={winningPrize.image || winningPrize.icon_url}
                alt={winningPrize.name || winningPrize.title}
                className="w-full h-full rounded-xl"
                iconSize="w-10 h-10"
              />
            </div>

            {/* Prize Info & Rarity */}
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">
                {winningPrize.name || winningPrize.title}
              </h3>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
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

            {/* Description */}
            {winningPrize.description && (
              <p className="text-xs text-zinc-300 leading-relaxed px-2">
                {winningPrize.description}
              </p>
            )}

            {/* Delivery Data (Voucher code or Points alert) */}
            {revealedClaim?.delivery_data?.code && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-left">
                <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider block">
                  Redemption Voucher Code:
                </span>
                <div className="flex items-center justify-between gap-2 bg-[#141825] p-2 rounded-lg border border-white/10">
                  <code className="text-xs font-mono font-bold text-amber-400 truncate">
                    {revealedClaim.delivery_data.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyVoucherCode(revealedClaim.delivery_data.code)}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-zinc-300 transition-colors shrink-0"
                  >
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {winningPrize.reward_type === 'points' && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>Points credited instantly to your account!</span>
              </div>
            )}

            {winningPrize.delivery_mode === 'manual_review' && (
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>Staff verification claim logged. View in profile.</span>
              </div>
            )}

            {/* Claim Confirmation Button */}
            <button
              type="button"
              onClick={() => setShowRevealModal(false)}
              className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              CLAIM REWARD
            </button>
          </div>
        </div>
      )}
    </div>
  );
};