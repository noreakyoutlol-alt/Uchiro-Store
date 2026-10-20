import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Package,
  Clock,
  Loader2,
  Ticket,
  ChevronRight,
  ShieldCheck,
  Tag,
  Headphones,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { TelegramUser, Profile, Order, Coupon } from '../../types';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { RedeemCodeModal } from './RedeemCodeModal';

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: TelegramUser | null;
  profile: Profile | null;
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onRefreshProfile?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  orders,
  onSelectOrder,
  onRefreshProfile,
}) => {
  const { language, setLanguage } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();

  const [copiedId, setCopiedId] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);
  const [dailyClaimFeedback, setDailyClaimFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showOrdersList, setShowOrdersList] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [userPoints, setUserPoints] = useState<number>(profile?.points ?? 0);
  const [canClaimDaily, setCanClaimDaily] = useState(true);

  useEffect(() => {
    if (typeof profile?.points === 'number') {
      setUserPoints(profile.points);
    }
  }, [profile?.points]);

  useEffect(() => {
    if (isOpen) {
      checkDailyStatus();
    }
  }, [isOpen, user?.telegram_id]);

  const checkDailyStatus = async () => {
    try {
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      const tgId = user?.telegram_id || tg?.initDataUnsafe?.user?.id;
      const status = await StoreAPI.getDailyRewardStatus(tgId);
      if (status) {
        setCanClaimDaily(Boolean(status.can_claim));
      }
    } catch {
      // Keep default
    }
  };

  const handleCopyTelegramId = () => {
    const idVal = String(user?.telegram_id || '');
    if (!idVal) return;
    try {
      navigator.clipboard.writeText(idVal);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleClaimPoints = async () => {
    if (isClaimingDaily) return;
    setIsClaimingDaily(true);
    setDailyClaimFeedback(null);
    try {
      const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
      const tgId = user?.telegram_id || tg?.initDataUnsafe?.user?.id;
      const res = await StoreAPI.claimDailyReward(tgId);
      if (res?.success) {
        setCanClaimDaily(false);
        const newBal = typeof res.newBalance === 'number' ? res.newBalance : userPoints + (res.pointsAwarded || 5);
        setUserPoints(newBal);
        window.dispatchEvent(
          new CustomEvent('uchiro_points_sync', {
            detail: { points: newBal },
          })
        );
        window.dispatchEvent(
          new CustomEvent('uchiro_points_updated', {
            detail: { points: newBal },
          })
        );
        onRefreshProfile?.();
        setDailyClaimFeedback({
          type: 'success',
          text: `🎉 ទទួលបាន +${res.pointsAwarded || 5} ពិន្ទុជោគជ័យ!`,
        });
      } else {
        setCanClaimDaily(false);
        setDailyClaimFeedback({
          type: 'error',
          text: 'អ្នកបានយកពិន្ទុថ្ងៃនេះរួចហើយ (ចាំថ្ងៃស្អែក)',
        });
      }
    } catch (err: any) {
      setCanClaimDaily(false);
      const backendMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        'អ្នកបានយកពិន្ទុថ្ងៃនេះរួចហើយ (ចាំថ្ងៃស្អែក)';
      setDailyClaimFeedback({
        type: 'error',
        text: backendMsg,
      });
    } finally {
      setIsClaimingDaily(false);
    }
  };

  if (!isOpen) return null;

  const displayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Telegram User';
  const userInitial = (user?.first_name || displayName || 'U').charAt(0).toUpperCase();
  const telegramIdStr = user?.telegram_id ? String(user.telegram_id) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-[#0F1424] border border-white/10 shadow-2xl p-3 space-y-3 max-h-[92vh] overflow-y-auto">
        {/* Header with Title & Close */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-white">
              {language === 'km' ? 'គណនីហ្គេម (Account)' : 'Account Profile'}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              VIP
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact User Card */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center gap-3">
          {/* Compact Avatar */}
          <div className="relative shrink-0">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName}
                className="w-12 h-12 rounded-xl object-cover bg-black/50 border border-amber-500/40"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-lg">
                {userInitial}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0F1424]" />
          </div>

          {/* Info: Name, Telegram ID, Balance */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <h4 className="font-bold text-xs text-white truncate">{displayName}</h4>
            <button
              type="button"
              onClick={handleCopyTelegramId}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-amber-400 transition-colors"
              title="Copy Telegram ID"
            >
              <span>ID: {telegramIdStr}</span>
              {copiedId ? (
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

        {/* Feedback alert (if clicked) */}
        {dailyClaimFeedback && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold border flex items-center justify-between gap-2 transition-all ${
              dailyClaimFeedback.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <span>{dailyClaimFeedback.text}</span>
            <button
              onClick={() => setDailyClaimFeedback(null)}
              className="text-slate-400 hover:text-white px-1 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Primary Action Button: Order History (Full Width) */}
        <button
          type="button"
          onClick={() => setShowOrdersList(!showOrdersList)}
          className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Package className="w-3.5 h-3.5" />
          <span>
            {language === 'km' ? 'ប្រវត្តិបញ្ជាទិញ' : 'Order History'} ({orders.length})
          </span>
        </button>

        {/* Redeem Code Button */}
        <button
          type="button"
          onClick={() => setIsRedeemOpen(true)}
          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-indigo-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 border border-amber-500/30 text-amber-300 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
        >
          <Gift className="w-3.5 h-3.5 text-amber-400" />
          <span>Redeem Code</span>
        </button>

        {/* Collapsible Order History */}
        {showOrdersList && (
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
              <span>{language === 'km' ? 'បញ្ជីបញ្ជាទិញកន្លងមក' : 'Recent Orders'}</span>
              <span>{orders.length} orders</span>
            </div>
            {orders.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2 text-center">
                {language === 'km' ? 'មិនទាន់មានការបញ្ជាទិញនៅឡើយទេ' : 'No orders found.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {orders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => {
                      onSelectOrder(o);
                      onClose();
                    }}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-white truncate font-bold">
                        #{o.id.substring(0, 8)} • ${(Number(o.total_amount) || 0).toFixed(2)}
                      </p>
                      <span className="text-[9px] text-slate-400 uppercase">
                        {o.status} • {new Date(o.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Preferences: Language & Theme */}
        <div className="pt-1 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
          <span className="text-[11px] font-semibold text-slate-400">
            {language === 'km' ? 'ភាសា / Language' : 'Language'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLanguage('km')}
              className={`px-2 py-1 rounded text-[10px] font-bold ${
                language === 'km'
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              ខ្មែរ
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 rounded text-[10px] font-bold ${
                language === 'en'
                  ? 'bg-amber-400 text-black'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>

      <RedeemCodeModal
        isOpen={isRedeemOpen}
        onClose={() => setIsRedeemOpen(false)}
        onSuccess={(res) => {
          if (res.points_balance !== undefined) {
            setUserPoints(res.points_balance);
          }
          if (onRefreshProfile) onRefreshProfile();
        }}
      />
    </div>
  );
};
