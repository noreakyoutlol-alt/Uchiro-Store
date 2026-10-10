import React, { useState, useEffect, useRef } from 'react';
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
  const targetEndRef = useRef<number>(0);

  const [claimFeedback, setClaimFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  // Bulletproof timestamp-based countdown timer:
  // Never drifts when the tab is backgrounded or phone screen locked.
  useEffect(() => {
    if (countdown <= 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetEndRef.current - now) / 1000));
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        loadStatus();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown > 0]);

  const loadStatus = async () => {
    try {
      const data: DailyRewardStatus = await StoreAPI.getDailyRewardStatus();
      setStatus(data);
      if (data.seconds_remaining && data.seconds_remaining > 0) {
        targetEndRef.current = Date.now() + data.seconds_remaining * 1000;
        setCountdown(data.seconds_remaining);
      } else {
        setCountdown(0);
      }
    } catch {
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
        total_check_ins: 0,
        seconds_remaining: 0,
      });
      setCountdown(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    if (isClaiming || !status?.can_claim) return;
    setIsClaiming(true);
    setClaimFeedback(null);

    try {
      const res = await StoreAPI.claimDailyReward();

      if (res && res.success) {
        const remaining = res.seconds_remaining ?? res.status?.seconds_remaining ?? 0;
        if (remaining > 0) {
          targetEndRef.current = Date.now() + remaining * 1000;
          setCountdown(remaining);
        } else {
          loadStatus();
        }

        setStatus((prev) =>
          prev
            ? {
                ...prev,
                can_claim: false,
                current_streak: res.streak,
                seconds_remaining: remaining,
                streak_days: prev.streak_days?.map((d) =>
                  d.day === res.streak ? { ...d, isClaimed: true } : d
                ),
              }
            : null
        );

        const newPoints = res.points ?? res.newBalance;
        if (typeof newPoints === 'number') {
          window.dispatchEvent(new CustomEvent('uchiro_points_sync', { detail: { points: newPoints } }));
          window.dispatchEvent(
            new CustomEvent('uchiro_points_updated', {
              detail: { points: newPoints },
            })
          );

          if (onRewardClaimed) {
            onRewardClaimed(newPoints);
          }
        }

        setClaimFeedback({
          type: 'success',
          text: res.message || '🎉 ទទួលបាន +5 ពិន្ទុជោគជ័យ!',
        });
      } else {
        const remaining = res?.seconds_remaining ?? res?.status?.seconds_remaining ?? 0;
        if (remaining > 0) {
          targetEndRef.current = Date.now() + remaining * 1000;
          setCountdown(remaining);
        }
        setStatus((prev) => (prev ? { ...prev, can_claim: false } : null));
        setClaimFeedback({
          type: 'error',
          text: res?.message || 'អ្នកបានទទួលពិន្ទុសម្រាប់ថ្ងៃនេះរួចរាល់ហើយ',
        });
      }
    } catch {
      loadStatus();
      setClaimFeedback({
        type: 'error',
        text: 'សូមព្យាយាមម្តងទៀត',
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
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#161C2E] via-[#121626] to-[#1C172D] border border-[#FFD166]/25 p-2.5 sm:p-3 shadow-md">
      <div className="absolute top-0 right-0 w-28 h-28 bg-[#FFD166]/10 rounded-full blur-xl pointer-events-none" />

      {/* Top Bar: Title, Streak Badge & Claim Action (Compact Header) */}
      <div className="relative z-10 flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Header icon w-7 h-7 */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FFD166] to-[#E63946] p-0.5 flex items-center justify-center shadow-md shadow-[#FFD166]/20 shrink-0">
            <div className="w-full h-full bg-[#121626] rounded-[6px] flex items-center justify-center">
              <Gift className="w-3.5 h-3.5 text-[#FFD166]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {t('daily_reward')}
              </h3>
              {/* Countdown pill text-[10px] px-2 py-0.5 */}
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-400">
                <Flame className="w-2.5 h-2.5 text-orange-400" />
                <span>Streak {currentStreak}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium">
              ចូលយករាល់ថ្ងៃ • ថ្ងៃទី៧ +15 Pts ពិសេស!
            </p>
          </div>
        </div>

        {status?.can_claim ? (
          <button
            onClick={handleClaim}
            disabled={isClaiming}
            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#FFD166] to-[#FFB703] hover:brightness-110 active:scale-95 text-black font-black text-xs flex items-center gap-1 shadow-md shadow-[#FFD166]/30 transition-all shrink-0 cursor-pointer"
          >
            {isClaiming ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            <span>+{status?.reward_points || 5} Pts</span>
          </button>
        ) : (
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-300 text-[11px] font-bold shrink-0 select-none cursor-default"
          >
            <Clock className="w-3.5 h-3.5 text-[#FFD166]" />
            <span className="tabular-nums tracking-wide">{formatCountdown(countdown)}</span>
          </div>
        )}
      </div>

      {/* Toast feedback: compact py-1.5 px-2 text-[11px] */}
      {claimFeedback && (
        <div
          className={`mb-2 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-between gap-1.5 ${
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

      {/* 7-Day Streak Road: Pocket Friendly Grid */}
      <div className="relative z-10 grid grid-cols-7 gap-1 sm:gap-1.5 pt-1">
        {streakDays.map((d) => {
          const isClaimed = d.isClaimed;
          const isToday = d.isToday && status?.can_claim;
          const isBonus = d.isBonus;

          return (
            <div
              key={d.day}
              className={`relative flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg border transition-all text-center ${
                isClaimed
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 shadow-sm'
                  : isToday
                  ? 'bg-[#FFD166]/15 border-[#FFD166] text-[#FFD166] shadow-sm shadow-[#FFD166]/20 animate-pulse'
                  : isBonus
                  ? 'bg-purple-950/30 border-purple-500/40 text-purple-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">
                D{d.day}
              </span>

              <div className="my-0.5">
                {isClaimed ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : isBonus ? (
                  <Crown className="w-3.5 h-3.5 text-[#FFD166]" />
                ) : (
                  <Sparkles className="w-3 h-3 text-slate-300" />
                )}
              </div>

              <span className="text-[9px] font-black">
                +{d.points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
