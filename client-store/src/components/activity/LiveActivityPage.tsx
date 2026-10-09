import React, { useState, useEffect } from 'react';
import { StoreAPI } from '../../services/api';
import { formatDeliveryMode } from '../../types';
import {
  TrendingUp,
  Users,
  Eye,
  ShieldCheck,
  Award,
  Loader2,
  RefreshCw,
  Zap,
  Package,
  Clock,
} from 'lucide-react';

interface SaleEntry {
  id: string;
  buyer_anonymized: string;
  product_title: string;
  time_ago: string;
  delivery_mode: string;
  amount: number;
}

interface BuyerEntry {
  rank: number;
  buyer_anonymized: string;
  total_orders: number;
  badge: string;
}

interface ActivityData {
  live_now: number;
  total_buyers: number;
  total_orders?: number;
  total_views?: number;
  recent_sales: SaleEntry[];
  top_buyers: BuyerEntry[];
}

interface LiveActivityPageProps {
  onNavigateToShop?: () => void;
}

export const LiveActivityPage: React.FC<LiveActivityPageProps> = ({ onNavigateToShop }) => {
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'leaderboard'>('sales');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let sessId = sessionStorage.getItem('uchiro_session_id');
    if (!sessId) {
      sessId = `uch_sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      sessionStorage.setItem('uchiro_session_id', sessId);
    }
    StoreAPI.sendHeartbeat(sessId);
    loadActivity(true);

    const sendHeartbeatIfVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (sessId) {
        StoreAPI.sendHeartbeat(sessId);
      }
    };

    const hbInterval = setInterval(sendHeartbeatIfVisible, 25000);

    // Refresh activity every 30 seconds if visible
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadActivity(false);
    }, 30000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        sendHeartbeatIfVisible();
        loadActivity(false);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      clearInterval(hbInterval);
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  const loadActivity = async (initial = false) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await StoreAPI.getStoreActivity();
      if (data) {
        setActivity(data);
        setLastUpdated(new Date());
      }
    } catch {
      // Only set minimal real structure if the API fails — no fake metrics
      if (!activity) {
        setActivity({
          live_now: 0,
          total_buyers: 0,
          total_views: 0,
          recent_sales: [],
          top_buyers: [],
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFD166]" />
        <span className="text-xs text-slate-400">Loading live activity...</span>
      </div>
    );
  }

  const recentSales = activity?.recent_sales || [];
  const topBuyers = activity?.top_buyers || [];

  const timeSinceUpdate = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    : null;

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <h1 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
              LIVE ACTIVITY HUB
            </h1>
          </div>
          <p className="text-[11px] text-slate-400">
            Real-time store engagement and verified purchases
          </p>
        </div>
        <button
          onClick={() => loadActivity(false)}
          disabled={isRefreshing}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#FFD166]' : ''}`} />
        </button>
      </div>

      {timeSinceUpdate !== null && (
        <p className="text-[10px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Updated {timeSinceUpdate < 5 ? 'just now' : `${timeSinceUpdate}s ago`}
        </p>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-white dark:bg-[#121624] rounded-2xl border border-emerald-500/30 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">Live Now</span>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {activity?.live_now != null ? activity.live_now : 0}
            </span>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-[#121624] rounded-2xl border border-indigo-500/30 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
            <Users className="w-3 h-3 inline mr-0.5" />
            Buyers
          </span>
          <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
            {activity?.total_buyers != null ? `${activity.total_buyers}` : '0'}
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-[#121624] rounded-2xl border border-amber-500/30 text-center shadow-sm">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
            <Package className="w-3 h-3 inline mr-0.5" />
            Orders
          </span>
          <div className="text-lg font-black text-amber-600 dark:text-[#FFD166] font-mono mt-1">
            {activity?.total_orders != null ? `${activity.total_orders}` : (activity?.recent_sales ? `${activity.recent_sales.length}` : '0')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-[#121624] p-1 rounded-xl border border-slate-200 dark:border-white/5">
        <button
          onClick={() => setActiveTab('sales')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'sales'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Recent Sales
          {recentSales.length > 0 && (
            <span className="ml-1 text-[10px] opacity-80">({recentSales.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Top Buyers
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'sales' ? (
        <div className="space-y-2">
          {recentSales.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/5 text-center shadow-sm">
              <Package className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No recent purchases yet.</p>
              {onNavigateToShop && (
                <button
                  onClick={onNavigateToShop}
                  className="mt-3 px-4 py-1.5 rounded-xl bg-[#FFD166] text-black text-xs font-bold hover:bg-amber-400 transition-colors"
                >
                  Browse the Shop
                </button>
              )}
            </div>
          ) : (
            recentSales.map((sale) => (
              <div
                key={sale.id}
                className="p-3 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/5 hover:border-indigo-500/30 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-snug truncate">
                      <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {sale.buyer_anonymized}
                      </span>{' '}
                      purchased{' '}
                      <span className="font-semibold text-slate-900 dark:text-white">{sale.product_title}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                        <Zap className="w-3 h-3" />
                        {formatDeliveryMode(sale.delivery_mode)}
                      </span>
                      <span>•</span>
                      <span>{sale.time_ago}</span>
                    </div>
                  </div>
                  {sale.amount > 0 && (
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs shrink-0">
                      ${sale.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {topBuyers.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/5 text-center shadow-sm">
              <Award className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-500 mb-2" />
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">No buyer rankings yet.</p>
            </div>
          ) : (
            topBuyers.map((buyer) => (
              <div
                key={buyer.rank}
                className="p-3 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200 dark:border-white/5 flex items-center gap-3 shadow-sm"
              >
                <span
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                    buyer.rank === 1
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                      : buyer.rank === 2
                      ? 'bg-slate-400/20 text-slate-600 dark:text-slate-300 border border-slate-400/40'
                      : buyer.rank === 3
                      ? 'bg-orange-700/20 text-orange-600 dark:text-orange-400 border border-orange-500/40'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                  }`}
                >
                  #{buyer.rank}
                </span>

                <div className="flex-1 min-w-0">
                  <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                    {buyer.buyer_anonymized}
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {buyer.total_orders} completed order{buyer.total_orders !== 1 ? 's' : ''}
                  </p>
                </div>

                {buyer.badge && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {buyer.badge}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Privacy Note */}
      <div className="p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex items-start gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-300 font-semibold">Privacy-First:</strong> All buyer
          identities are anonymized (e.g. Rip•••, Uch•••). Full usernames and credentials are never
          shown in public feeds.
        </p>
      </div>
    </div>
  );
};
