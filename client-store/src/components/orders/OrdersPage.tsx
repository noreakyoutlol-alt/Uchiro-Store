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
} from 'lucide-react';
import { Order } from '../../types';
import { formatShortOrderId } from '../../utils/order.util';

interface OrdersPageProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onPayOrder: (order: Order) => void;
  onViewReceipt?: (order: Order) => void;
  onNavigateToShop: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  onSelectOrder,
  onPayOrder,
  onViewReceipt,
  onNavigateToShop,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'delivered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getStatusLabel = (order: Order) => {
    if (order.status === 'delivered' || order.status === 'completed') {
      if (order.delivery_mode === 'manual_service') return 'Gift Delivered / Fulfilled';
      if (order.delivery_mode === 'trade_item') return 'Trade Completed / Fulfilled';
      return 'Delivered';
    }
    if (order.status === 'paid' || order.status === 'fulfillment') {
      if (order.delivery_mode === 'manual_service') return 'Awaiting Admin Gift Delivery';
      if (order.delivery_mode === 'trade_item') return 'Awaiting Admin Fulfillment';
      return 'Processing Delivery';
    }
    if (order.status === 'pending_payment') {
      return 'Waiting Payment';
    }
    return order.status.replace('_', ' ');
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white">MY ORDERS</h2>
        <span className="text-xs text-slate-400">{orders.length} Total</span>
      </div>

      {/* Search & Track Orders Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Order # (e.g. UCH-...) or Product..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#121624] border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166]/50 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'delivered'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
              filter === f
                ? 'bg-[#FFD166] text-black shadow-md shadow-[#FFD166]/20'
                : 'bg-[#121624] text-slate-400 border border-white/10 hover:text-white'
            }`}
          >
            {f === 'all' ? 'All Orders' : f === 'pending' ? 'Waiting Payment' : 'Delivered'}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#121624] border border-white/10 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-white">
            {searchQuery
              ? `No orders matching "${searchQuery}"`
              : 'No orders in this category'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={onNavigateToShop}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#E63946] to-[#C1121F] text-white text-xs font-bold shadow-md"
            >
              Browse Products
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'pending_payment';
            const isDelivered = order.status === 'delivered' || order.status === 'completed';

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className="p-4 rounded-2xl bg-[#121624] border border-white/10 hover:border-[#FFD166]/40 transition-all cursor-pointer space-y-3 shadow-lg active:scale-99"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div>
                    <span className="text-xs font-mono font-bold text-white block">
                      {formatShortOrderId(order.order_number || order.id)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(order.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(
                      order.status
                    )}`}
                  >
                    {getStatusLabel(order)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white line-clamp-1">
                      {order.items?.[0]?.product_title || 'Gaming Product'}
                    </h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      {order.delivery_mode === 'auto_account' && <UserCheck className="w-3 h-3 text-emerald-400" />}
                      {order.delivery_mode === 'manual_service' && <Zap className="w-3 h-3 text-pink-400" />}
                      {order.delivery_mode === 'trade_item' && <Zap className="w-3 h-3 text-amber-400" />}
                      {order.delivery_mode === 'digital_code' && <KeyRound className="w-3 h-3 text-cyan-400" />}
                      <span>
                        {order.delivery_mode === 'auto_account'
                          ? 'Available • Instant Delivery'
                          : order.delivery_mode === 'manual_service'
                          ? 'Roblox Gift Delivery'
                          : order.delivery_mode === 'digital_code'
                          ? 'Instant Digital Key'
                          : order.delivery_mode === 'trade_item'
                          ? 'In-Game Trade'
                          : 'Available • Instant Delivery'}
                      </span>
                    </span>

                    {/* 14-Day Warranty Badge */}
                    {isDelivered && order.warranty_status && (
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
                              : order.warranty_status === 'replaced'
                              ? 'Warranty Replaced'
                              : order.warranty_status === 'invalidated'
                              ? 'Warranty Voided'
                              : 'Warranty Expired'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  <span className="text-sm font-black text-[#FFD166]">
                    ${order.total_amount.toFixed(2)}
                  </span>
                </div>

                {/* Quick Action Button */}
                <div className="pt-1 flex items-center justify-end gap-2">
                  {(isDelivered || order.status === 'paid' || order.status === 'fulfillment') && onViewReceipt && (
                    <button
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
                      onClick={(e) => {
                        e.stopPropagation();
                        onPayOrder(order);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#E63946] to-[#FFD166] text-black font-black text-xs shadow-md shadow-[#E63946]/20 flex items-center gap-1"
                    >
                      <Zap className="w-3.5 h-3.5 fill-black" />
                      <span>Pay KHQR</span>
                    </button>
                  ) : isDelivered ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1"
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
