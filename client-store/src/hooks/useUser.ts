import { useState, useEffect, useCallback } from 'react';
import { StoreAPI } from '../services/api';
import { TelegramUser, Profile } from '../types';

export interface UserState {
  id?: string;
  telegram_id: string;
  username?: string | null;
  first_name?: string | null;
  points: number;
  streak_count: number;
  role: string;
  last_daily_claim_at?: string | null;
  gacha_tickets?: number;
}

/**
 * Global helper to dispatch points sync event across all mounted views & tabs.
 */
export function dispatchPointsSync(points: number, streak_count?: number) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('uchiro_points_sync', {
        detail: { points, streak_count },
      })
    );
  }
}

export function useUser(initialTelegramId?: string | number) {
  const [user, setUser] = useState<UserState | null>(null);
  const [points, setPoints] = useState<number>(0);
  const [streakCount, setStreakCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch live profile from Supabase-backed API
  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Determine telegram_id from Telegram WebApp SDK if available
      let tid = initialTelegramId ? String(initialTelegramId) : undefined;
      if (!tid && typeof window !== 'undefined') {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user?.id) {
          tid = String(tg.initDataUnsafe.user.id);
        }
      }

      const res = await StoreAPI.getUserProfile(tid);
      const data: UserState = res?.data || res;

      if (data && typeof data.points === 'number') {
        setUser(data);
        setPoints(data.points);
        setStreakCount(data.streak_count ?? 0);
      }
    } catch (err: any) {
      console.warn('[useUser] Failed to fetch live profile:', err?.message);
      setError(err?.message || 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  }, [initialTelegramId]);

  // Initial load
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Listen for points sync events across views
  useEffect(() => {
    const handlePointsSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ points?: number; streak_count?: number }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.points === 'number') {
          setPoints(customEvent.detail.points);
          setUser((prev) => (prev ? { ...prev, points: customEvent.detail.points! } : null));
        }
        if (typeof customEvent.detail.streak_count === 'number') {
          setStreakCount(customEvent.detail.streak_count);
          setUser((prev) => (prev ? { ...prev, streak_count: customEvent.detail.streak_count! } : null));
        }
      }
    };

    window.addEventListener('uchiro_points_sync', handlePointsSync);
    window.addEventListener('focus', fetchProfile);

    return () => {
      window.removeEventListener('uchiro_points_sync', handlePointsSync);
      window.removeEventListener('focus', fetchProfile);
    };
  }, [fetchProfile]);

  const updatePoints = useCallback((newPoints: number, newStreak?: number) => {
    setPoints(newPoints);
    if (typeof newStreak === 'number') {
      setStreakCount(newStreak);
    }
    dispatchPointsSync(newPoints, newStreak);
  }, []);

  return {
    user,
    points,
    streakCount,
    isLoading,
    error,
    refreshUser: fetchProfile,
    updatePoints,
  };
}
