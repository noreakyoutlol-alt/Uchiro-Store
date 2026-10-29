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
import { RedeemCodeModal } from './RedeemCodeModal';

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
  profile: initialProfile,
  orders,
  onSelectOrder,
  onNavigateToTab,
  onRefreshProfile,
}) => {
  const { t, language, setLanguage } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    const handleSync = (e: any) => {
      const syncPts = Number(e.detail?.points);
      if (!isNaN(syncPts)) {
        setProfile((prev: any) => prev ? {
          ...prev,
          points: syncPts,
          loyalty_points: syncPts,
          reward_points: syncPts
        } : prev);
        setProfileStats((prev: any) => prev ? {
          ...prev,
          points: syncPts,
        } : prev);
      }
    };
    window.addEventListener('uchiro_points_sync', handleSync);
    window.addEventListener('uchiro_points_updated', handleSync);
    return () => {
      window.removeEventListener('uchiro_points_sync', handleSync);
      window.removeEventListener('uchiro_points_updated', handleSync);
    };
  }, []);

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

  const orderHistoryRef = React.useRef<HTMLDivElement>(null);
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
  }, [profile?.points, profile?.gacha_tickets, orders.length, user?.telegram_id]);

  const scrollToOrders = () => {
    orderHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProfileStats = async () => {
    try {
      const res = await StoreAPI.getMeStats();
      const data = res?.data || res;
      if (data) {
        const pts = Number(data.points ?? data.reward_points ?? data.loyalty_points ?? 0);
        const tix = Number(data.gacha_tickets ?? 0);
        const ordersCount = Number(data.total_orders ?? 0);
        const spent = Number(data.total_spent ?? 0);
        setProfileStats({
          points: pts,
          gacha_tickets: tix,
          total_orders: ordersCount,
          total_spent: spent,
        });
        setProfile((prev) => prev ? {
          ...prev,
          points: pts,
          reward_points: pts,
          loyalty_points: pts,
          gacha_tickets: tix,
        } : prev);
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
    if (!confirmingTier || userPoints < confirmingTier.points || isRedeemingCoupon) return;
    setIsRedeemingCoupon(true);
    try {
      const res = await StoreAPI.redeemPointsForCoupon(confirmingTier.points);
      if (res && res.code) {
        setRedeemedCouponCode(res.code);
        setConfirmingTier(null);
        const newBalance = typeof res.newBalance === 'number' ? res.newBalance : Math.max(0, userPoints - confirmingTier.points);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('uchiro_points_sync', { detail: { points: newBalance } }));
          window.dispatchEvent(new CustomEvent('uchiro_points_updated', { detail: { points: newBalance } }));
        }
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
  const fallbackTotalOrders = orders.length;
  const fallbackTotalSpent = verifiedOrders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );

  const userPoints = profileStats !== null ? Number(profileStats.points) : Number(profile?.points ?? profile?.loyalty_points ?? user?.points ?? 0);
  const gachaTickets = profileStats !== null ? Number(profileStats.gacha_tickets) : Number(profile?.gacha_tickets ?? 0);
  const totalOrdersCount = orders.length > 0 ? orders.length : Number(profileStats?.total_orders ?? 0);
  const totalSpentAmount = profileStats !== null && Number(profileStats.total_spent) > 0 ? Number(profileStats.total_spent) : fallbackTotalSpent;

  return (
    <div className="max-w-md w-full mx-auto p-2.5 sm:p-3 space-y-3 pb-28 animate-fadeIn">
      {/* 1. Compact User Card (Mobile Friendly) */}
      <div className="p-3.5 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 shadow-xl space-y-3">
        {/* User Identity Row */}
        <div className="flex items-center gap-2.5">
          {/* Compact Avatar (w-10 h-10) */}
          <div className="relative shrink-0">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName}
                className="w-10 h-10 rounded-xl object-cover bg-black/50 border border-amber-500/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-base">
                {userInitial}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0F1424]" />
          </div>

          {/* Name & ID & Points */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-xs text-white truncate max-w-[170px]">
                {displayName}
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                VIP
              </span>
            </div>

            <button
              type="button"
              onClick={() => copyTelegramId(String(user?.telegram_id || user?.id || '—'))}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-amber-400 transition-colors"
              title="Copy Telegram ID"
            >
              <span>ID: {String(user?.telegram_id || user?.id || '—')}</span>
              {copiedTelegramId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500" />
              )}
            </button>

            <div className="pt-0.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-black text-xs">
                <span>💎</span>
                <span>{userPoints.toLocaleString()} Pts</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Button: Order History (Full Width) */}
        <button
          type="button"
          onClick={() => {
            if (onNavigateToTab) {
              onNavigateToTab('orders');
            } else {
              scrollToOrders();
            }
          }}
          className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Package className="w-3.5 h-3.5" />
          <span>Order History ({orders.length})</span>
        </button>

        {/* 3 Concise Metrics Strip */}
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-white/5 border border-white/5 text-center text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Orders
            </span>
            <span className="font-mono font-bold text-white text-xs">
              {totalOrdersCount}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Total Spent
            </span>
            <span className="font-mono font-bold text-emerald-400 text-xs">
              ${Number(totalSpentAmount).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              Gacha Tickets
            </span>
            <span className="font-mono font-bold text-purple-400 text-xs flex items-center justify-center gap-1">
              <Ticket className="w-3 h-3" />
              {gachaTickets}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Daily Check-in Reward (Section 30: Dedicated in Profile / Rewards) */}
      <DailyRewardWidget
        user={user}
        onRewardClaimed={() => {
          if (onRefreshProfile) onRefreshProfile();
          loadProfileStats();
          loadLedger();
        }}
      />

      {/* 3. Uchiro Points & Loyalty Redemption (Requirement 66, Item 25) */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-[#FFD166]/25 shadow-xl space-y-3.5">
        {/* Points Hero — large, unmissable reward points display */}
        <div className="flex flex-col items-center justify-center py-3 gap-1 border-b border-[#FFD166]/15 pb-3.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-400 uppercase tracking-widest">
            <Coins className="w-3.5 h-3.5 text-[#FFD166]" />
            <span>UCHIRO REWARD POINTS</span>
          </div>
          <div className="text-4xl sm:text-5xl font-black text-[#FFD166] tracking-tight leading-none mt-1 drop-shadow-[0_2px_12px_rgba(255,209,102,0.35)]">
            {userPoints.toLocaleString()}
          </div>
          <span className="text-xs text-slate-400 mt-1">Reward Points Total</span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Earn points on purchases and daily check-ins. Redeem your points for instant discount coupons:
        </p>

        {/* 3 Loyalty Coupon Redemption Options — compact horizontal rows (~44px height) */}
        <div className="space-y-2">
          {COUPON_TIERS.map((tier) => {
            const hasEnough = userPoints >= tier.points;
            return (
              <div key={tier.points} className="flex items-center justify-between p-2.5 rounded-lg bg-[#141824] border border-white/10 mb-2">
                <div>
                  <div className="text-sm font-bold text-amber-400">${tier.discount.toFixed(2)} OFF</div>
                  <div className="text-[10px] text-gray-400">Min order ${tier.minOrder.toFixed(2)} • {tier.points} Pts</div>
                </div>
                <button
                  type="button"
                  disabled={!hasEnough || isRedeemingCoupon}
                  onClick={() => setConfirmingTier(tier)}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:bg-gray-700 text-black transition-colors"
                >
                  {hasEnough ? 'Redeem' : 'Need Pts'}
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
            <button
              type="button"
              onClick={() => setIsRedeemModalOpen(true)}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 transition-colors cursor-pointer"
            >
              + Redeem Code
            </button>
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
          <div className="w-full max-w-sm bg-[#121624] border border-[#FFD166]/30 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
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
                  {Math.max(0, userPoints - confirmingTier.points)} PTS
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
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 shadow-xl space-y-3">
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
            <span>Theme</span>
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

      {/* 5. My Orders Section */}
      <div ref={orderHistoryRef} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider">
            <Package className="w-4 h-4 text-[#FFD166]" />
            <span>RECENT DELIVERIES ({orders.length})</span>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 text-center text-xs text-slate-400 shadow-sm">
            You haven't placed any orders yet.
          </div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-3 sm:p-3.5 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 hover:border-[#FFD166]/30 transition-all flex items-center justify-between cursor-pointer active:scale-99 shadow-sm"
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
      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 shadow-xl space-y-3">
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

        <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
          <p className="text-[11px] text-slate-400 text-center">
            Prefer direct messaging?
          </p>
          <a
            href="https://t.me/uchirosupport"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Headphones className="w-3.5 h-3.5 text-[#FFD166]" />
            <span>Chat with Admin / Support (24/7)</span>
          </a>
        </div>
      </div>

      {/* 7. Action Cards: My Vault & Accounts and Redeem Code (Near bottom of Profile page, above footer) */}
      <div className="space-y-2 pt-1">
        {/* Card 1: My Vault & Accounts */}
        <button
          type="button"
          onClick={() => onNavigateToTab('vault')}
          className="w-full p-3 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-[#FFD166]/30 flex items-center justify-between text-xs font-bold text-white hover:brightness-110 transition-all shadow-md active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎒</span>
            <div className="text-left">
              <span className="block text-white leading-tight font-black">
                {language === 'km' ? 'កាបូប & គណនីរបស់ខ្ញុំ' : 'My Vault & Accounts'}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {language === 'km' ? 'មើលឈ្មោះគណនី លេខសម្ងាត់ និង 2FA' : 'View Usernames, Passwords & 2FA'}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-[#FFD166] font-bold flex items-center gap-1">
            Open →
          </span>
        </button>

        {/* Card 2: Redeem Code */}
        <button
          type="button"
          onClick={() => setIsRedeemModalOpen(true)}
          className="w-full p-3 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-amber-500/30 flex items-center justify-between text-xs font-bold text-white hover:brightness-110 transition-all cursor-pointer shadow-md active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🎟️</span>
            <div className="text-left">
              <span className="block text-white leading-tight font-black">
                {language === 'km' ? 'ប្តូរកូដរង្វាន់ (Redeem Code)' : 'Redeem Promo Code'}
              </span>
              <span className="text-[10px] text-slate-300 font-normal">
                {language === 'km'
                  ? 'បញ្ចូលកូដប្រូម៉ូសិន ឬកូដកាដូរបស់អ្នក ដើម្បីទទួលបានពិន្ទុ សំបុត្រកាឆា ឬប័ណ្ណបញ្ចុះតម្លៃ។'
                  : 'Enter your promo or gift code to claim Points, Gacha Tickets, or Discount Coupons.'}
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 flex items-center gap-1">
            Redeem →
          </span>
        </button>
      </div>

      <RedeemCodeModal
        isOpen={isRedeemModalOpen}
        onClose={() => setIsRedeemModalOpen(false)}
        onSuccess={() => {
          if (onRefreshProfile) onRefreshProfile();
          loadProfileStats();
          loadLedger();
          loadCoupons();
        }}
      />
    </div>
  );
});
