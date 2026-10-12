import React, { useState, useEffect, useRef } from 'react';
import { StoreAPI } from '../../services/api';
import { TelegramUser } from '../../types';

export interface DailyRewardProps {
  points?: number;
  streak?: number;
  canClaim?: boolean;
  cooldownRemaining?: string; // e.g., "23:59:50"
  onClaim?: () => Promise<void>;
  user?: TelegramUser | null;
  onRewardClaimed?: (newBalance: number) => void;
}

export const DailyRewardWidget: React.FC<DailyRewardProps> = ({
  points: propPoints,
  streak: propStreak,
  canClaim: propCanClaim,
  cooldownRemaining: propCooldownRemaining,
  onClaim,
  user,
  onRewardClaimed,
}) => {
  const [internalStreak, setInternalStreak] = useState(propStreak ?? user?.streak_count ?? 0);
  const [internalCanClaim, setInternalCanClaim] = useState<boolean>(propCanClaim ?? true);
  const [countdown, setCountdown] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const targetEndRef = useRef<number>(0);

  // If props are provided directly, sync them
  useEffect(() => {
    if (propStreak !== undefined) setInternalStreak(propStreak);
    if (propCanClaim !== undefined) setInternalCanClaim(propCanClaim);
  }, [propStreak, propCanClaim]);

  // Load status from API if no manual onClaim was passed
  const loadStatus = async () => {
    try {
      const res = await StoreAPI.getDailyRewardStatus();
      const statusData = res?.data || res;
      if (statusData) {
        const streakVal = Number(statusData.current_streak ?? statusData.streak_count ?? statusData.streak ?? 0);
        const canClaimVal = Boolean(statusData.can_claim);
        const secs = Number(statusData.seconds_remaining ?? statusData.remainingSeconds ?? 0);
        setInternalStreak(streakVal);
        setInternalCanClaim(canClaimVal);
        if (secs > 0) {
          setCountdown(secs);
          targetEndRef.current = Date.now() + secs * 1000;
        } else {
          setCountdown(0);
        }
        const pts = Number(statusData.points ?? statusData.reward_points ?? statusData.newBalance ?? 0);
        if (!isNaN(pts)) {
          window.dispatchEvent(new CustomEvent('uchiro_points_sync', { detail: { points: pts } }));
          window.dispatchEvent(new CustomEvent('uchiro_points_updated', { detail: { points: pts } }));
        }
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    if (!onClaim) {
      loadStatus();
    }
  }, [user?.telegram_id]);

  // Precise ticking timer for cooldown
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((targetEndRef.current - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        setInternalCanClaim(true);
        if (!onClaim) loadStatus();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  const formatTimer = (totalSeconds: number): string => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClaim = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (onClaim) {
        await onClaim();
      } else {
        const res = await StoreAPI.claimDailyReward();
        const data = res?.data || res;
        if (data && (res.success || data.success)) {
          setInternalCanClaim(false);
          const newStreakVal = Number(data.streak ?? internalStreak + 1);
          setInternalStreak(newStreakVal);
          const secs = Number(data.seconds_remaining || data.remainingSeconds || 86400);
          setCountdown(secs);
          targetEndRef.current = Date.now() + secs * 1000;
          const awardedPoints = Number(data.points ?? data.newBalance ?? data.reward_points ?? 0);
          if (!isNaN(awardedPoints)) {
            window.dispatchEvent(new CustomEvent('uchiro_points_sync', { detail: { points: awardedPoints } }));
            window.dispatchEvent(new CustomEvent('uchiro_points_updated', { detail: { points: awardedPoints } }));
            if (onRewardClaimed) onRewardClaimed(awardedPoints);
          }
        }
      }
    } catch (err) {
      console.error('Daily claim failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeStreak = propStreak ?? internalStreak;
  const isClaimable = propCanClaim !== undefined ? propCanClaim : internalCanClaim && countdown <= 0;
  const cooldownStr = propCooldownRemaining || (countdown > 0 ? formatTimer(countdown) : 'Ready');

  return (
    <div className="w-full bg-[#121624] dark:bg-[#121620] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm my-2 max-h-12 h-11">
      {/* Left side: Streak info with 7 progress dots */}
      <div className="flex items-center gap-2">
        <span className="text-base select-none">🔥</span>
        <span className="text-xs font-semibold text-amber-400">
          Streak {activeStreak} Days
        </span>
        <div className="flex items-center gap-1 ml-1">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const currentMod = activeStreak % 7 || (activeStreak > 0 && activeStreak % 7 === 0 ? 7 : 0);
            return (
              <div
                key={day}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  day <= currentMod ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]' : 'bg-white/20'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Right side: Claim button or Cooldown badge */}
      <div>
        {isClaimable ? (
          <button
            type="button"
            onClick={handleClaim}
            disabled={loading}
            className="h-7 px-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-xs rounded-lg active:scale-95 transition-all flex items-center gap-1 shadow-sm hover:brightness-105"
          >
            {loading ? '...' : '🎁 +5 Pts'}
          </button>
        ) : (
          <div className="h-7 px-2.5 bg-white/5 border border-white/10 text-emerald-400 font-mono text-[11px] rounded-lg flex items-center gap-1 select-none">
            <span className="text-xs">✓</span>
            <span>{cooldownStr}</span>
          </div>
        )}
      </div>
    </div>
  );
};
