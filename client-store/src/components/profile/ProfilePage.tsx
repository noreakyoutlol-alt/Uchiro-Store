import React, { useState, useEffect } from 'react';
import {
  User,
  Package,
  Headphones,
  Coins,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Send,
  Loader2,
  CheckCircle2,
  Gift,
  Copy,
  Check,
  Moon,
  Sun,
  Globe,
  Tag,
  Clock,
  Sparkles,
  Ticket,
  AlertCircle,
  X,
} from 'lucide-react';
import { TelegramUser, Profile, Order, Coupon } from '../../types';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { DailyRewardWidget } from '../home/DailyRewardWidget';

interface ProfilePageProps {
  user: TelegramUser | null;
  profile: Profile | null;
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onNavigateToTab: (tab: any) => void;
  onRefreshProfile?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = React.memo(({
  user,
  profile,
  orders,
  onSelectOrder,
  onNavigateToTab,
  onRefreshProfile,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();

  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Coupon redemption tiers (Requirement 66, Item 25)
  const COUPON_TIERS = [
    { points: 50, discount: 0.5, minOrder: 1.5, label: '$0.50 Coupon', badge: 'Tier 1' },
    { points: 100, discount: 1.0, minOrder: 3.0, label: '$1.00 Coupon', badge: 'Tier 2' },
    { points: 200, discount: 2.0, minOrder: 5.0, label: '$2.00 Coupon', badge: 'Tier 3' },
  ];

  // Points redemption and ledger state
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false);
  const [confirmingTier, setConfirmingTier] = useState<typeof COUPON_TIERS[0] | null>(null);
  const [redeemedCouponCode, setRedeemedCouponCode] = useState<string | null>(null);
  const [myCoupons, setMyCoupons] = useState<Coupon[]>([]);
  const [pointsLedger, setPointsLedger] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedTelegramId, setCopiedTelegramId] = useState(false);

  const copyTelegramId = (idVal: string) => {
    if (!idVal || idVal === '—') return;
    try {
      navigator.clipboard.writeText(idVal);
      setCopiedTelegramId(true);
      setTimeout(() => setCopiedTelegramId(false), 2000);
    } catch (err) {
      console.warn('Clipboard write error:', err);
    }
  };

  const [profileStats, setProfileStats] = useState<{
    points: number;
    gacha_tickets: number;
    total_orders: number;
    total_spent: number;
  } | null>(null);

  useEffect(() => {
    loadLedger();
    loadCoupons();
    loadProfileStats();
  }, [profile?.points, profile?.gacha_tickets, orders.length]);

  const loadProfileStats = async () => {
    try {
      const data = await StoreAPI.getMeStats();
      if (data) {
        setProfileStats(data);
      }
    } catch {
      // Ignore if not logged in or endpoint error
    }
  };

  const loadCoupons = async () => {
    try {
      const data = await StoreAPI.getMyCoupons();
      if (Array.isArray(data)) {
        setMyCoupons(data);
      }
    } catch {
      // Ignore if not logged in or endpoint error
    }
  };

  const loadLedger = async () => {
    try {
      const data = await StoreAPI.getPointsLedger();
      if (Array.isArray(data)) {
        setPointsLedger(data);
      }
    } catch {
      // fallback - remove fake data
      setPointsLedger([]);
    }
  };

  const handleConfirmRedeem = async () => {
    if (!confirmingTier || !profile || profile.points < confirmingTier.points || isRedeemingCoupon) return;
    setIsRedeemingCoupon(true);
    try {
      const res = await StoreAPI.redeemPointsForCoupon(confirmingTier.points);
      if (res && res.code) {
        setRedeemedCouponCode(res.code);
        setConfirmingTier(null);
        if (onRefreshProfile) onRefreshProfile();
        loadLedger();
        loadCoupons();
        loadProfileStats();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Failed to redeem coupon');
    } finally {
      setIsRedeemingCoupon(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;

    setIsSubmittingTicket(true);
    try {
      await StoreAPI.submitSupportTicket({
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
      });
      setTicketSuccess(true);
      setSupportSubject('');
      setSupportMessage('');
      setTimeout(() => setTicketSuccess(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Telegram User';
  const hasUsername = Boolean(user?.username && user.username.trim().length > 0);
  const userInitial = (user?.first_name || displayName || 'T').charAt(0).toUpperCase();

  const verifiedOrders = orders.filter(
    (o) => o.status === 'paid' || o.status === 'delivered' || o.status === 'completed'
  );
  const fallbackTotalOrders = verifiedOrders.length;
  const fallbackTotalSpent = verifiedOrders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );

  const userPoints = profileStats !== null ? profileStats.points : (profile?.points ?? 0);
  const gachaTickets = profileStats !== null ? profileStats.gacha_tickets : (profile?.gacha_tickets ?? 0);
  const totalOrdersCount = profileStats !== null ? profileStats.total_orders : fallbackTotalOrders;
  const totalSpentAmount = profileStats !== null ? profileStats.total_spent : fallbackTotalSpent;

  return (
    <div className="space-y-5 pb-20 animate-fadeIn">
      {/* 1. Ultra-Sleek Luxury Gaming Passport Card */}
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#0F1424]/95 via-[#0C0F1A]/95 to-[#080A12] border border-cyan-500/20 shadow-[0_0_35px_rgba(6,182,212,0.12)] backdrop-blur-2xl space-y-4 flex flex-col items-center text-center">
        {/* Subtle Ambient Decorative Glowing Background Elements */}
        <div className="w-40 h-40 bg-amber-500/10 blur-3xl absolute -top-12 -right-12 pointer-events-none rounded-full" />
        <div className="w-40 h-40 bg-cyan-500/10 blur-3xl absolute -bottom-12 -left-12 pointer-events-none rounded-full" />

        {/* Passport Cyber Header */}
        <div className="w-full flex items-center justify-between text-[10px] font-mono tracking-widest text-slate-500 uppercase border-b border-white/5 pb-2">
          <span className="flex items-center gap-1.5 text-cyan-400/90 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06B6D4] animate-pulse" />
            UCHIRO PASSPORT
          </span>
          <span className="text-slate-400 font-medium">VERIFIED CITIZEN</span>
        </div>

        {/* Top Identity: Sleek circular avatar with animated glowing cyan/gold border */}
        <div className="relative group my-1">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#06B6D4] via-[#F59E0B] to-[#06B6D4] opacity-80 blur-md group-hover:opacity-100 transition-opacity animate-pulse" />
          <div className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-[#06B6D4] via-[#F59E0B] to-[#06B6D4] shadow-[0_0_20px_rgba(6,182,212,0.35)]">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName}
                className="w-20 h-20 rounded-full object-cover bg-[#0B0E17]"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#151D2E] to-[#0A0D15] flex items-center justify-center text-white font-black text-2xl shadow-inner">
                {userInitial}
              </div>
            )}
          </div>
        </div>

        {/* Verified checkmark pill badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black tracking-widest uppercase shadow-[0_0_12px_rgba(16,185,129,0.25)] backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Verified Customer</span>
        </div>

        {/* Display Name in bold geometric font + monospaced @username tag */}
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white tracking-wide uppercase font-sans drop-shadow-sm">
            {displayName.toUpperCase()}
          </h2>
          {hasUsername && (
            <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-xs font-mono font-medium text-cyan-300">
              @{user!.username}
            </div>
          )}
        </div>

        {/* Redesigned Metrics Presentation (Sleek 2-column glassmorphism grid) */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/10 text-left">
          {/* Card 1: Identity & Activity */}
          <div className="p-4 rounded-2xl bg-[#0B0F1C]/80 border border-white/10 backdrop-blur-xl space-y-3 relative overflow-hidden group hover:border-cyan-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Identity & Activity
              </span>
              <User className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            {/* Telegram ID */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Telegram ID
                </span>
                <span className="text-sm font-mono font-bold text-white tracking-wide">
                  {String(user?.telegram_id || user?.id || '—')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyTelegramId(String(user?.telegram_id || user?.id || ''))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-all active:scale-90"
                title="Copy Telegram ID"
              >
                {copiedTelegramId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {/* Total Orders */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Total Orders
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {totalOrdersCount}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.25)]">
                <Package className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Card 2: Value & Progression */}
          <div className="p-4 rounded-2xl bg-[#0B0F1C]/80 border border-white/10 backdrop-blur-xl space-y-3 relative overflow-hidden group hover:border-amber-500/30 transition-all shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                Value & Progression
              </span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* Total Spent */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Total Spent
                </span>
                <span className="text-sm font-black text-white font-mono">
                  ${Number(totalSpentAmount).toFixed(2)}{' '}
                  <span className="text-xs font-semibold text-emerald-400">USD</span>
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* UCHIRO Points & Gacha Tickets */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  UCHIRO Points
                </span>
                <span className="text-sm font-black font-mono bg-gradient-to-r from-[#F59E0B] to-[#D97706] bg-clip-text text-transparent">
                  {userPoints} PTS
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Gacha Tickets
                </span>
                <div className="flex items-center gap-1.5">
                  <Ticket className="w-3.5 h-3.5 text-purple-400 shrink-0 drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                  <span className="text-sm font-black text-purple-400 font-mono">
                    {gachaTickets}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Daily Check-in Reward (Section 30: Dedicated in Profile / Rewards) */}
      <DailyRewardWidget
        onRewardClaimed={() => {
          if (onRefreshProfile) onRefreshProfile();
          loadProfileStats();
          loadLedger();
        }}
      />

      {/* 3. Uchiro Points & Loyalty Redemption (Requirement 66, Item 25) */}
      <div className="p-4 rounded-3xl bg-[#121624] border border-[#FFD166]/20 space-y-4">
        {/* Points Hero — large, unmissable reward points display */}
        <div className="flex flex-col items-center justify-center py-3 gap-1 border-b border-[#FFD166]/10 pb-4">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <Coins className="w-3.5 h-3.5 text-[#FFD166]" />
            <span>UCHIRO REWARD POINTS</span>
          </div>
          <div className="text-5xl font-black text-[#FFD166] tracking-tight leading-none mt-1">
            {userPoints}
          </div>
          <span className="text-xs text-slate-400 mt-1">Reward Points Total</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Earn points on purchases and daily check-ins. Redeem your points for instant discount coupons:
        </p>

        {/* 3 Loyalty Coupon Redemption Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {COUPON_TIERS.map((tier) => {
            const hasEnough = (profile?.points || 0) >= tier.points;
            return (
              <div
                key={tier.points}
                className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                  hasEnough
                    ? 'bg-white/5 border-white/10 hover:border-[#FFD166]/40'
                    : 'bg-black/20 border-white/5 opacity-70'
                }`}
              >
                <div className="space-y-1 mb-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {tier.badge}
                    </span>
                    <span className="text-xs font-mono font-black text-[#FFD166]">
                      {tier.points} PTS
                    </span>
                  </div>

                  <div className="text-sm font-black text-white">
                    ${tier.discount.toFixed(2)} OFF
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-500" />
                    <span>Min order ${tier.minOrder.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmingTier(tier)}
                  disabled={!hasEnough || isRedeemingCoupon}
                  className={`w-full py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                    hasEnough
                      ? 'bg-gradient-to-r from-[#FFD166] to-[#FFB703] text-black shadow-md shadow-[#FFD166]/10 hover:brightness-110 active:scale-98'
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>{hasEnough ? 'Redeem' : 'Need Points'}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Recently Generated Coupon Alert */}
        {redeemedCouponCode && (
          <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] text-emerald-400 font-bold block flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Coupon Added to Wallet!
              </span>
              <span className="font-mono text-sm font-black text-white select-all">
                {redeemedCouponCode}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(redeemedCouponCode, 'redeemed_coupon')}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              {copiedCode === 'redeemed_coupon' ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        {/* Customer Coupon Wallet (Item 25) */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-[#FFD166]" />
              My Coupon Wallet ({myCoupons.length})
            </span>
          </div>

          {myCoupons.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-1">
              No saved coupons. Redeem your points above to generate discount codes.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {myCoupons.map((c) => {
                const status = c.status || 'AVAILABLE';
                const isAvailable = status === 'AVAILABLE';
                return (
                  <div
                    key={c.id}
                    className="p-2.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-white select-all">
                          {c.code}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            isAvailable
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : status === 'USED'
                              ? 'bg-slate-500/20 text-slate-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {c.discount_type === 'percentage'
                          ? `${c.discount_value}% OFF`
                          : `$${Number(c.discount_value).toFixed(2)} OFF`}{' '}
                        • Min order ${Number(c.min_order_amount || 0).toFixed(2)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(c.code, c.id)}
                      className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white shrink-0"
                      title="Copy code"
                    >
                      {copiedCode === c.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Points Transaction Ledger */}
        {pointsLedger.length > 0 && (
          <div className="pt-2 border-t border-white/5 space-y-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Points History
            </span>
            <div className="divide-y divide-white/5 max-h-36 overflow-y-auto pr-1">
              {pointsLedger.map((item, idx) => {
                const amount = item.amount !== undefined ? item.amount : item.change || 0;
                const reason = item.description || item.reason || item.type || 'Points Update';
                return (
                  <div key={item.id || idx} className="py-2 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="text-slate-200 block truncate font-medium">
                        {reason}
                      </span>
                      {item.created_at && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {amount >= 0 ? `+${amount}` : amount} PTS
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Points Redemption */}
      {confirmingTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#121624] border border-[#FFD166]/30 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#FFD166]" />
                <h3 className="font-black text-sm text-white">
                  CONFIRM REDEMPTION
                </h3>
              </div>
              <button
                onClick={() => setConfirmingTier(null)}
                className="w-7 h-7 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Coupon Reward:</span>
                <span className="font-bold text-white">${confirmingTier.discount.toFixed(2)} Store Discount</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Minimum Order:</span>
                <span className="font-bold text-white">${confirmingTier.minOrder.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Points Cost:</span>
                <span className="font-mono font-bold text-[#FFD166]">{confirmingTier.points} PTS</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between text-slate-300">
                <span>Points After:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Math.max(0, (profile?.points || 0) - confirmingTier.points)} PTS
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed text-center">
              The coupon will be added directly to your profile and remains available until used on checkout.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingTier(null)}
                disabled={isRedeemingCoupon}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRedeem}
                disabled={isRedeemingCoupon}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#FFD166] to-[#FFB703] text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#FFD166]/20 hover:brightness-110 active:scale-98"
              >
                {isRedeemingCoupon ? (
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                ) : (
                  <>
                    <Tag className="w-3.5 h-3.5" />
                    <span>Confirm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Settings: Language & Theme Appearance (Section 16 & 48) */}
      <div className="p-4 rounded-3xl bg-[#121624] border border-white/10 space-y-3">
        <h3 className="text-xs font-black text-white uppercase tracking-wider">
          APP PREFERENCES
        </h3>

        {/* Language selector */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            <Globe className="w-4 h-4 text-[#FFD166]" />
            <span>Language / ភាសា</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'en'
                  ? 'bg-[#FFD166] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN 🇺🇸
            </button>
            <button
              onClick={() => setLanguage('km')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                language === 'km'
                  ? 'bg-[#FFD166] text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              KH 🇰🇭
            </button>
          </div>
        </div>

        {/* Theme mode selector */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5">
          <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
            {themeMode === 'light' ? (
              <Sun className="w-4 h-4 text-[#FFD166]" />
            ) : (
              <Moon className="w-4 h-4 text-purple-400" />
            )}
            <span>Theme / ស្បែក</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setThemeMode('dark')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                themeMode === 'dark'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setThemeMode('light')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                themeMode === 'light'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Light
            </button>
          </div>
        </div>
      </div>

      {/* 4. My Orders Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <Package className="w-4 h-4 text-[#FFD166]" />
            <span>RECENT DELIVERIES ({orders.length})</span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#121624] border border-white/10 text-center text-xs text-slate-400">
            You haven't placed any orders yet.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-3.5 rounded-2xl bg-[#121624] border border-white/10 hover:border-white/20 transition-all flex items-center justify-between cursor-pointer active:scale-99"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white">
                      #{order.order_number}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        order.status === 'delivered'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : order.status === 'paid'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                    {order.items?.[0]?.product_title || 'Gaming Order'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-white">
                    ${order.total_amount.toFixed(2)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Support & Ticket Helpdesk */}
      <div className="p-4 rounded-3xl bg-[#121624] border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
          <Headphones className="w-4 h-4 text-[#FFD166]" />
          <span>CUSTOMER SUPPORT & 14-DAY WARRANTY</span>
        </div>

        <p className="text-xs text-slate-400">
          Need assistance or account replacement under warranty? Send a ticket directly to our admin team:
        </p>

        <form onSubmit={handleSubmitTicket} className="space-y-2.5">
          <input
            type="text"
            value={supportSubject}
            onChange={(e) => setSupportSubject(e.target.value)}
            placeholder="Subject / Issue..."
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166]"
          />

          <textarea
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            rows={3}
            placeholder="Describe your issue or order number..."
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166]"
          />

          <button
            type="submit"
            disabled={isSubmittingTicket || !supportSubject || !supportMessage}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E63946] to-[#C1121F] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
          >
            {isSubmittingTicket ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </>
            )}
          </button>

          {ticketSuccess && (
            <p className="text-xs text-emerald-400 flex items-center justify-center gap-1 pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ticket submitted! Support will respond via Store Bot.</span>
            </p>
          )}
        </form>
      </div>
    </div>
  );
});
