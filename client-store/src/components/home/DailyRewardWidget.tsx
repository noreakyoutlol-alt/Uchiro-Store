import React, { useState, useEffect } from 'react';
import { Gift, Flame, CheckCircle, Sparkles, Loader2, Crown, Clock } from 'lucide-react';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { DailyRewardStatus } from '../../types';

interface DailyRewardWidgetProps {
  onRewardClaimed?: (newBalance: number) => void;
}

export const DailyRewardWidget: React.FC<DailyRewardWidgetProps> = ({ onRewardClaimed }) => {
  const { t } = useLanguage();
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  const loadStatus = async () => {
    try {
      const data: DailyRewardStatus = await StoreAPI.getDailyRewardStatus();
      setStatus(data);
      if (data.seconds_remaining && data.seconds_remaining > 0) {
        setCountdown(data.seconds_remaining);
      }
    } catch {
      // offline or guest fallback
      setStatus({
        can_claim: true,
        current_streak: 1,
        reward_points: 5,
        last_claimed_at: null,
        next_claim_at: null,
        streak_days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
          day: d,
          points: d === 7 ? 20 : 5,
          isClaimed: false,
          isToday: d === 1,
          isBonus: d === 7,
        })),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setClaimFeedback(null);
    try {
      const tg = (window as any).Telegram?.WebApp;
      const uid = tg?.initDataUnsafe?.user?.id;

      // Optimistically update local points state immediately
      window.dispatchEvent(
        new CustomEvent('uchiro_points_updated', {
          detail: { points: 5 },
        })
      );

      setStatus((prev) =>
        prev
          ? {
              ...prev,
              can_claim: false,
              current_streak: (prev.current_streak || 1) + 1,
            }
          : null
      );
      setCountdown(24 * 3600);

      // Call API
      const res = await StoreAPI.claimDailyReward(uid);

      if (typeof res?.newBalance === 'number') {
        window.dispatchEvent(
          new CustomEvent('uchiro_points_updated', {
            detail: { points: res.newBalance },
          })
        );
        if (onRewardClaimed) {
          onRewardClaimed(res.newBalance);
        }
      }

      setClaimFeedback({
        type: 'success',
        text: '🎉 ទទួលបាន +5 ពិន្ទុជោគជ័យ!',
      });
    } catch {
      setClaimFeedback({
        type: 'success',
        text: '🎉 ទទួលបាន +5 ពិន្ទុជោគជ័យ!',
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) return null;

  const currentStreak = status?.current_streak || 1;
  const streakDays =
    status?.streak_days && status.streak_days.length > 0
      ? status.streak_days
      : [1, 2, 3, 4, 5, 6, 7].map((d) => ({
          day: d,
          points: d === 7 ? 20 : 5,
          isClaimed: d < currentStreak,
          isToday: d === currentStreak,
          isBonus: d === 7,
        }));

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#161C2E] via-[#121626] to-[#1C172D] border border-[#FFD166]/25 p-4 shadow-xl">
      <div className="absolute top-0 right-0 w-36 h-36 bg-[#FFD166]/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Bar: Title, Streak Badge & Claim Action */}
      <div className="relative z-10 flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFD166] to-[#E63946] p-0.5 flex items-center justify-center shadow-lg shadow-[#FFD166]/20 shrink-0">
            <div className="w-full h-full bg-[#121626] rounded-[9px] flex items-center justify-center">
              <Gift className="w-5 h-5 text-[#FFD166]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                {t('daily_reward')}
              </h3>
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-400">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>{currentStreak} Day Streak</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Check in daily to earn points • Day 7 gives +15 bonus!
            </p>
          </div>
        </div>

        {status?.can_claim ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD166] to-[#FFB703] hover:brightness-110 active:scale-95 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-[#FFD166]/30 transition-all shrink-0"
          >
            {isClaiming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>យកពិន្ទុ +{status?.reward_points || 5} Pts</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-amber-500/40 text-slate-300 text-xs font-bold shrink-0 transition-colors active:scale-95"
          >
            <Clock className="w-3.5 h-3.5 text-[#FFD166]" />
            <span className="text-[11px]">ចាំថ្ងៃស្អែក: {formatCountdown(countdown)}</span>
          </button>
        )}
      </div>

      {claimFeedback && (
        <div
          className={`mb-3 p-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-between gap-2 ${
            claimFeedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
          }`}
        >
          <span>{claimFeedback.text}</span>
          <button
            type="button"
            onClick={() => setClaimFeedback(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 7-Day Visual Progression Bar */}
      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {streakDays.map((sd) => {
          const isDone = sd.isClaimed;
          const isSpecial = sd.isBonus || sd.day === 7;
          return (
            <div
              key={sd.day}
              className={`flex flex-col items-center justify-between py-2 px-1 rounded-xl border text-center transition-all ${
                isDone
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : sd.isToday && status?.can_claim
                  ? 'bg-[#FFD166]/20 border-[#FFD166] text-[#FFD166] ring-1 ring-[#FFD166]'
                  : isSpecial
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                D{sd.day}
              </span>

              <div className="my-1 flex items-center justify-center">
                {isDone ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : isSpecial ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                ) : (
                  <Gift className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              <span
                className={`text-[10px] font-black ${
                  isDone
                    ? 'text-emerald-400'
                    : isSpecial
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                +{sd.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
