import React from 'react';
import {
  DollarSign,
  ShoppingBag,
  Users,
  AlertTriangle,
  Gift,
  Boxes,
  ArrowUpRight,
  Clock,
  Package,
} from 'lucide-react';
import { DashboardStats, Order } from '../types';

interface DashboardPageProps {
  stats: DashboardStats | null;
  orders?: Order[];
  onNavigateTab: (tab: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  stats,
  orders = [],
  onNavigateTab,
}) => {
  if (!stats) return null;

  // Use orders prop or stats.recent_orders from database
  const recentOrders: Order[] =
    orders.length > 0
      ? orders.slice(0, 10)
      : (stats.recent_orders || []).slice(0, 10);

  const totalRevenue = Number(stats.revenue ?? stats.totalRevenue ?? 0);
  const totalOrders = Number(stats.total_orders ?? stats.totalOrders ?? 0);
  const paidOrders = Number(stats.paid_orders ?? 0);
  const pendingFulfillment = Number(stats.pending_fulfillment ?? stats.pendingFulfillment ?? 0);
  const availableInventory = Number(
    stats.available_inventory ?? stats.inventory_status?.available ?? 0
  );
  const activeProducts = Number(stats.active_products ?? stats.activeProducts ?? 0);
  const totalCustomers = Number(stats.total_customers ?? 0);

  const accountsInStock = Number(
    stats.inventory_status?.accounts_available ?? 0
  );
  const keysInStock = Number(
    stats.inventory_status?.codes_available ?? 0
  );

  const getDeliveryModeBadge = (mode: string) => {
    switch (mode) {
      case 'auto_account':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            Account
          </span>
        );
      case 'manual_service':
        return (
          <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">
            Roblox Gift
          </span>
        );
      case 'trade_item':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
            In-Game Trade
          </span>
        );
      case 'digital_code':
        return (
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold">
            Digital Key
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-bold">
            {mode}
          </span>
        );
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold capitalize">
            Delivered
          </span>
        );
      case 'paid':
        return (
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold capitalize">
            Paid
          </span>
        );
      case 'fulfillment':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold capitalize">
            Fulfillment
          </span>
        );
      case 'pending_payment':
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-bold capitalize">
            Pending Payment
          </span>
        );
      case 'cancelled':
      case 'failed':
      case 'expired':
        return (
          <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold capitalize">
            {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 text-[10px] font-bold capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-xl font-black text-white">SYSTEM DASHBOARD</h2>
        <p className="text-xs text-slate-400">
          Real-time metrics, live sales volume, and system alerts.
        </p>
      </div>

      {/* Primary KPI Cards Grid (Direct live backend metrics with honest zero states) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total Gross Revenue */}
        <div className="p-4 rounded-2xl bg-[#111622] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white">
            ${totalRevenue.toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-400 font-semibold">
            Verified Net Sales
          </span>
        </div>

        {/* Total Orders */}
        <div className="p-4 rounded-2xl bg-[#111622] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalOrders}</div>
          <span className="text-[10px] text-indigo-400 font-semibold">
            {paidOrders} Paid & Delivered
          </span>
        </div>

        {/* Pending Manual Gifts & Trades */}
        <div className="p-4 rounded-2xl bg-[#111622] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Pending Fulfillment</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">{pendingFulfillment}</div>
          <span className="text-[10px] text-amber-400 font-semibold">
            Awaiting Staff Delivery
          </span>
        </div>

        {/* In-Stock Inventory Items */}
        <div className="p-4 rounded-2xl bg-[#111622] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>In-Stock Inventory</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white">{availableInventory}</div>
          <span className="text-[10px] text-cyan-400 font-semibold">
            {accountsInStock > 0 || keysInStock > 0
              ? `${accountsInStock} Accounts • ${keysInStock} Keys`
              : 'Available Items'}
          </span>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-[#111622]/60 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Catalog</span>
            <p className="text-lg font-black text-white">{activeProducts}</p>
          </div>
          <Package className="w-4 h-4 text-slate-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#111622]/60 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Registered Users</span>
            <p className="text-lg font-black text-white">{totalCustomers}</p>
          </div>
          <Users className="w-4 h-4 text-slate-500" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#111622]/60 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Low Stock Warnings</span>
            <p className="text-lg font-black text-amber-400">{stats.low_stock_count ?? 0}</p>
          </div>
          <AlertTriangle className="w-4 h-4 text-amber-500/60" />
        </div>

        <div className="p-3.5 rounded-xl bg-[#111622]/60 border border-white/5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Pending Claims</span>
            <p className="text-lg font-black text-purple-400">{stats.pending_claims_count ?? 0}</p>
          </div>
          <Gift className="w-4 h-4 text-purple-500/60" />
        </div>
      </div>

      {/* Action Alerts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Low Stock Warning */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Alerts ({stats.low_stock_count ?? 0})</span>
            </div>
            <button
              onClick={() => onNavigateTab('inventory')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>Add Stock</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!stats.low_stock_items || stats.low_stock_items.length === 0 ? (
            <p className="text-xs text-slate-400">All inventory levels are healthy!</p>
          ) : (
            <div className="space-y-2">
              {stats.low_stock_items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs"
                >
                  <span className="font-semibold text-white truncate max-w-[200px]">
                    {item.title}
                  </span>
                  <span className="font-bold text-amber-400">{item.stock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Gacha Claims */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-purple-400">
              <Gift className="w-4 h-4" />
              <span>Pending Gacha Claims ({stats.pending_claims_count ?? 0})</span>
            </div>
            <button
              onClick={() => onNavigateTab('claims')}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              <span>Review Claims</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {(stats.pending_claims_count ?? 0) > 0
              ? `${stats.pending_claims_count} high-tier mythical rewards awaiting manual distribution.`
              : 'All mythical rewards have been claimed and resolved.'}
          </p>
        </div>
      </div>

      {/* Recent Orders Widget (Real Database Orders & Honest Empty State) */}
      <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Recent Orders</h3>
            <p className="text-[11px] text-slate-400">
              Real-time transaction log from database records
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('orders')}
            className="text-xs text-indigo-400 hover:underline flex items-center gap-0.5"
          >
            <span>View All Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 px-4 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-600 mb-1" />
            <p className="text-sm font-semibold text-slate-300">
              No orders recorded yet
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              Real-time customer transactions will appear here once placed in the store.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Order Number</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => onNavigateTab('orders')}
                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      #{order.order_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {order.roblox_username ? (
                        <span className="font-medium text-emerald-400">
                          @{order.roblox_username}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">
                          TG #{order.telegram_id}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {getDeliveryModeBadge(order.delivery_mode)}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      ${Number(order.total_amount).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      {getOrderStatusBadge(order.status)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
