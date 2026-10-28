import React, { useState } from 'react';
import {
  Package,
  Clock,
  CheckCircle2,
  ChevronRight,
  Zap,
  KeyRound,
  UserCheck,
  ShieldCheck,
  FileText,
  Search,
  X,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  ShoppingBag,
} from 'lucide-react';
import { Order } from '../../types';
import { formatShortOrderId } from '../../utils/order.util';

interface OrdersPageProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onPayOrder: (order: Order) => void;
  onViewReceipt?: (order: Order) => void;
  onNavigateToShop: () => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  onSelectOrder,
  onPayOrder,
  onViewReceipt,
  onNavigateToShop,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyOrderNumber = (e: React.MouseEvent, text: string, orderId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter((order) => {
    // 1. Status Filter
    if (filter === 'pending' && order.status !== 'pending_payment') return false;
    if (filter === 'delivered' && order.status !== 'delivered' && order.status !== 'completed') return false;

    // 2. Search / Tracking Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchOrderNum = order.order_number?.toLowerCase().includes(q);
      const matchTitle = order.items?.some((item) =>
        item.product_title?.toLowerCase().includes(q)
      );
      const matchDelivery = order.delivery_mode?.toLowerCase().includes(q);
      const matchId = order.id?.toLowerCase().includes(q);
      return matchOrderNum || matchTitle || matchDelivery || matchId;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'paid':
      case 'fulfillment':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'pending_payment':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'cancelled':
      case 'expired':
      case 'refunded':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700/40 text-slate-400 border-slate-600/40';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'Delivered';
      case 'paid':
      case 'fulfillment':
        return 'Paid • Processing';
      case 'pending_payment':
        return 'Pending Payment';
      case 'cancelled':
        return 'Cancelled';
      case 'expired':
        return 'Expired';
      case 'refunded':
        return 'Refunded';
      default:
        return status;
    }
  };

  return (
    <div className="max-w-md w-full mx-auto p-2.5 sm:p-3 space-y-3 pb-28 animate-fadeIn">
      {/* Header & Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#FFD166]" />
          <h2 className="text-base font-black text-white uppercase tracking-wider">
            My Orders
          </h2>
        </div>
        <span className="text-xs font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full font-mono">
          {orders.length} Total
        </span>
      </div>

      {/* Search & Track Order Number Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order #, Game, or Product..."
          className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
            aria-label="Clear Search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 p-1 rounded-xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 text-xs font-bold">
        {(['all', 'pending', 'delivered'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
              filter === f
                ? 'bg-[#FFD166] text-black shadow-md shadow-[#FFD166]/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All Orders' : f === 'pending' ? 'Waiting Payment' : 'Delivered'}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="p-10 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 text-center space-y-3 shadow-xl">
          <Loader2 className="w-8 h-8 text-[#FFD166] animate-spin mx-auto" />
          <p className="text-sm font-bold text-white">Loading your orders...</p>
          <p className="text-xs text-slate-400">Please wait while we retrieve your order history.</p>
        </div>
      ) : error ? (
        /* Explicit API / Network Error State (never confused with empty state) */
        <div className="p-8 sm:p-10 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-rose-500/30 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-white">Unable to Load Orders</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {error || 'Network error occurred while fetching your order history.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E63946] to-[#FFD166] text-black font-extrabold text-xs shadow-md shadow-[#E63946]/20 hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : filteredOrders.length === 0 ? (
        /* Empty State */
        <div className="p-10 sm:p-12 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-[#FFD166]">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {searchQuery
                ? `No orders matching "${searchQuery}"`
                : 'No Orders Yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Try searching with a different order number or product title.'
                : "You haven't placed any orders yet. Discover our verified game accounts, Robux, and items in the store!"}
            </p>
          </div>
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              Clear Search
            </button>
          ) : (
            <button
              type="button"
              onClick={onNavigateToShop}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E63946] to-[#FFD166] text-black text-xs font-extrabold shadow-md shadow-[#E63946]/20 hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Products</span>
            </button>
          )}
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'pending_payment';
            const isDelivered = order.status === 'delivered' || order.status === 'completed';
            const shortId = formatShortOrderId(order.order_number || order.id);
            const formattedDate = order.created_at
              ? new Date(order.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Recent Order';

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#0C101D]/90 backdrop-blur-md border border-white/10 hover:border-[#FFD166]/40 transition-all cursor-pointer space-y-3 shadow-lg active:scale-[0.99]"
              >
                {/* Order Header: ID, Date & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-white">
                      #{shortId}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleCopyOrderNumber(e, shortId, order.id)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Copy Order ID"
                      aria-label="Copy Order ID"
                    >
                      {copiedId === order.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <span className="text-[10px] text-slate-500">• {formattedDate}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    {isDelivered && <CheckCircle2 className="w-2.5 h-2.5" />}
                    {isPending && <Clock className="w-2.5 h-2.5" />}
                    <span>{getStatusLabel(order.status)}</span>
                  </span>
                </div>

                {/* Product Info & Total */}
                <div className="flex items-start justify-between gap-3 pt-1 border-t border-white/5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">
                      {order.items?.[0]?.product_title || 'Gaming Product'}
                    </h3>

                    {/* Delivery Mode Badge */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      {order.delivery_mode === 'auto_account' ? (
                        <KeyRound className="w-3 h-3 text-cyan-400 shrink-0" />
                      ) : order.delivery_mode === 'manual_service' ? (
                        <UserCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                      ) : order.delivery_mode === 'digital_code' ? (
                        <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Package className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">
                        {order.delivery_mode === 'auto_account'
                          ? 'Instant Account Delivery'
                          : order.delivery_mode === 'manual_service'
                          ? 'Roblox Gift Delivery'
                          : order.delivery_mode === 'digital_code'
                          ? 'Instant Digital Key'
                          : order.delivery_mode === 'trade_item'
                          ? 'In-Game Trade'
                          : 'Standard Delivery'}
                      </span>
                    </div>

                    {/* 14-Day Warranty Badge (Roblox Accounts only) */}
                    {isDelivered && (order.delivery_mode === 'auto_account' || (order as any).product_type === 'account') && order.warranty_status && order.warranty_status !== 'none' && (
                      <div className="pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            order.warranty_status === 'active'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : order.warranty_status === 'replaced'
                              ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                              : order.warranty_status === 'invalidated'
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                              : 'bg-slate-700 border-slate-600 text-slate-400'
                          }`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5" />
                          <span>
                            {order.warranty_status === 'active'
                              ? `14-Day Warranty Active (${Math.max(
                                  0,
                                  Math.ceil(
                                    ((order.warranty_expires_at
                                      ? new Date(order.warranty_expires_at).getTime()
                                      : Date.now() + 14 * 86400000) -
                                      Date.now()) /
                                      (1000 * 60 * 60 * 24)
                                  )
                                )}d left)`
                              : `Warranty: ${order.warranty_status}`}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-black text-[#FFD166] shrink-0">
                    ${order.total_amount.toFixed(2)}
                  </span>
                </div>

                {/* Quick Action Buttons */}
                <div className="pt-1 flex items-center justify-end gap-2 border-t border-white/5">
                  {(isDelivered || order.status === 'paid' || order.status === 'fulfillment') && onViewReceipt && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReceipt(order);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#FFD166]" />
                      <span>View Receipt</span>
                    </button>
                  )}
                  {isPending ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPayOrder(order);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E63946] to-[#FFD166] text-black font-black text-xs shadow-md shadow-[#E63946]/20 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      <span>Pay KHQR</span>
                    </button>
                  ) : isDelivered ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1 hover:bg-emerald-500/30 active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>View Credentials</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
