import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Coins,
  ShieldCheck,
  Package,
  Calendar,
  Gift,
  Loader2,
  BellRing,
} from 'lucide-react';
import { AdminAPI } from '../services/api';
import { StoreSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<StoreSettings>({
    points_per_dollar: 10,
    gacha_spin_cost: 100,
    coupon_points_cost: 100,
    coupon_redemption_enabled: true,
    daily_reward_points: 5,
    streak_bonus_points: 10,
    streak_interval_days: 7,
    gacha_ticket_points_cost: 100,
    gacha_cooldown_seconds: 3600,
    coupon_tier_50_value: 0.5,
    coupon_tier_50_min_order: 1.5,
    coupon_tier_100_value: 1.0,
    coupon_tier_100_min_order: 3.0,
    coupon_tier_200_value: 2.0,
    coupon_tier_200_min_order: 5.0,
    low_stock_threshold: 2,
    default_warranty_days: 14,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await AdminAPI.getSettings();
      if (data) {
        setSettings((prev) => ({ ...prev, ...data }));
      }
    } catch (err: any) {
      console.error('Failed to load store settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await AdminAPI.updateSettings(settings);
      if (updated) {
        setSettings(updated);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update system settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-bold">Loading System Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>SYSTEM & STORE SETTINGS</span>
        </h2>
        <p className="text-xs text-slate-400">
          Configure loyalty points economy, check-in streaks, default warranty periods, and low-inventory alert thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Points & Loyalty Economy */}
        <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Coins className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Loyalty Points & Check-in Economy
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Points Earned Per $1 Spent
              </label>
              <input
                type="number"
                min="0"
                value={settings.points_per_dollar}
                onChange={(e) =>
                  setSettings({ ...settings, points_per_dollar: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 10 points per dollar spent.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Base Daily Check-in Reward (Points)
              </label>
              <input
                type="number"
                min="0"
                value={settings.daily_reward_points}
                onChange={(e) =>
                  setSettings({ ...settings, daily_reward_points: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: +5 points on manual claim.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Streak Bonus Points
              </label>
              <input
                type="number"
                min="0"
                value={settings.streak_bonus_points}
                onChange={(e) =>
                  setSettings({ ...settings, streak_bonus_points: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: +10 bonus points on streak milestone.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Streak Bonus Interval (Days)
              </label>
              <input
                type="number"
                min="1"
                value={settings.streak_interval_days}
                onChange={(e) =>
                  setSettings({ ...settings, streak_interval_days: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 7 consecutive days (Day 7, 14, 21...).
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Gacha Ticket Cost (Points)
              </label>
              <input
                type="number"
                min="1"
                value={settings.gacha_ticket_points_cost}
                onChange={(e) =>
                  setSettings({ ...settings, gacha_ticket_points_cost: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 100 points per 1 Gacha Ticket.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Gacha Roll Cooldown (Seconds)
              </label>
              <input
                type="number"
                min="0"
                value={settings.gacha_cooldown_seconds}
                onChange={(e) =>
                  setSettings({ ...settings, gacha_cooldown_seconds: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Default: 3600 seconds (1 hour cooldown).
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 sm:col-span-2">
              <div>
                <span className="text-xs font-bold text-white block">
                  Customer Points Redemption
                </span>
                <span className="text-[10px] text-slate-400">
                  Allow customers to exchange points for discount vouchers
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.coupon_redemption_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, coupon_redemption_enabled: e.target.checked })
                }
                className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Coupon Tiers & Wallet Economy */}
        <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Gift className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Coupon Redemption Tiers
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
              <span className="text-xs font-black text-amber-400 block">Tier 1: 50 Points</span>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Coupon Value ($)</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.coupon_tier_50_value}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_50_value: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Min Order Amount ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.coupon_tier_50_min_order}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_50_min_order: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
              <span className="text-xs font-black text-amber-400 block">Tier 2: 100 Points</span>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Coupon Value ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.coupon_tier_100_value}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_100_value: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Min Order Amount ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.coupon_tier_100_min_order}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_100_min_order: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
              <span className="text-xs font-black text-amber-400 block">Tier 3: 200 Points</span>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Coupon Value ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.coupon_tier_200_value}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_200_value: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Min Order Amount ($)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.coupon_tier_200_min_order}
                  onChange={(e) => setSettings({ ...settings, coupon_tier_200_min_order: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Warranty & Inventory Alerts */}
        <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Warranty & Inventory Management
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Default Account Warranty (Days)
              </label>
              <input
                type="number"
                min="1"
                value={settings.default_warranty_days}
                onChange={(e) =>
                  setSettings({ ...settings, default_warranty_days: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Guaranteed coverage duration (Sections 26 & 31: 14 Days).
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Low Stock Warning Threshold
              </label>
              <input
                type="number"
                min="0"
                value={settings.low_stock_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, low_stock_threshold: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Triggers admin notification bot when product stock falls below or equal to this.
              </span>
            </div>
          </div>
        </div>

        {/* Submit Button & Confirmation */}
        <div className="flex items-center justify-between pt-2">
          {saveSuccess ? (
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4" />
              <span>Settings successfully saved and live!</span>
            </div>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save System Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
