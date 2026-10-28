import React, { useState } from 'react';
import {
  Package,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Send,
  Loader2,
  X,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import { Order } from '../types';
import { AdminAPI } from '../services/api';

interface OrdersPageProps {
  orders: Order[];
  onRefreshOrders: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  onRefreshOrders,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Manual Fulfillment form
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Warranty Actions
  const [showWarrantyReplaceModal, setShowWarrantyReplaceModal] = useState(false);
  const [replacementUsername, setReplacementUsername] = useState('');
  const [replacementPassword, setReplacementPassword] = useState('');
  const [replacementNotes, setReplacementNotes] = useState('Replacement issued under 14-day official warranty');
  const [isProcessingWarranty, setIsProcessingWarranty] = useState(false);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.roblox_username && o.roblox_username.toLowerCase().includes(q)) ||
        o.telegram_id.toString().includes(q)
      );
    }
    return true;
  });

  const handleFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsSubmitting(true);

    try {
      let credentials: any[] | undefined = undefined;
      if (selectedOrder.delivery_mode === 'auto_account' && usernameInput && passwordInput) {
        credentials = [{ username: usernameInput, password: passwordInput }];
      } else if (selectedOrder.delivery_mode === 'digital_code' && codeInput) {
        credentials = [{ code: codeInput }];
      }

      await AdminAPI.fulfillOrder(selectedOrder.id, fulfillNotes || undefined, credentials);
      setSelectedOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to fulfill order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWarrantyReplacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setIsProcessingWarranty(true);

    try {
      const credentials = replacementUsername && replacementPassword
        ? [{ username: replacementUsername, password: replacementPassword }]
        : undefined;

      await AdminAPI.replaceWarrantyOrder(selectedOrder.id, {
        replacement_notes: replacementNotes,
        credentials,
      });

      alert('Warranty replacement issued successfully and notified to customer!');
      setShowWarrantyReplaceModal(false);
      setSelectedOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to issue warranty replacement');
    } finally {
      setIsProcessingWarranty(false);
    }
  };

  const handleInvalidateWarranty = async () => {
    if (!selectedOrder) return;
    const reason = prompt('Reason for invalidating 14-day warranty (e.g. Authenticator/recovery email removed):');
    if (!reason) return;

    try {
      await AdminAPI.invalidateWarranty(selectedOrder.id, reason);
      alert('Warranty invalidated.');
      setSelectedOrder(null);
      onRefreshOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to invalidate warranty');
    }
  };

  const handleReDeliver = async () => {
    if (!selectedOrder) return;
    if (!confirm(`Re-send order credentials to customer via Telegram bot?`)) return;

    try {
      await AdminAPI.reDeliverOrder(selectedOrder.id);
      alert('Order credentials re-sent successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to re-deliver');
    }
  };

  return (
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, Telegram ID, Roblox username..."
            className="w-full pl-9 pr-3 h-8 sm:h-9 rounded-lg bg-[#111622] border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 sm:h-9 px-2.5 rounded-lg bg-[#111622] border border-white/10 text-white text-xs focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="paid">Paid (Awaiting Delivery)</option>
          <option value="delivered">Delivered</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-[#111622] border border-white/10 rounded-xl overflow-hidden shadow-md">
        <div className="overflow-x-auto w-full -mx-2.5 px-2.5">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
              <tr>
                <th className="py-2 px-2.5">Order</th>
                <th className="py-2 px-2.5">Customer</th>
                <th className="py-2 px-2.5">Mode</th>
                <th className="py-2 px-2.5">Total</th>
                <th className="py-2 px-2.5">Status</th>
                <th className="py-2 px-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No matching orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-1.5 px-2 text-xs font-mono font-bold text-white">#{o.order_number}</td>
                    <td className="py-1.5 px-2 text-xs">
                      <div className="font-bold text-white">{o.roblox_username || 'Customer'}</div>
                      <span className="text-[10px] text-slate-500 font-mono">TG: {o.telegram_id}</span>
                    </td>
                    <td className="py-1.5 px-2 text-xs">
                      {o.delivery_mode === 'auto_account'
                        ? 'Instant Account Delivery'
                        : o.delivery_mode === 'manual_service'
                        ? 'Roblox Gift Delivery'
                        : o.delivery_mode === 'trade_item'
                        ? 'In-Game Trade'
                        : o.delivery_mode === 'digital_code'
                        ? 'Instant Digital Key'
                        : String(o.delivery_mode).replace(/_/g, ' ')}
                    </td>
                    <td className="py-1.5 px-2 text-xs font-bold text-emerald-400">${o.total_amount.toFixed(2)}</td>
                    <td className="py-1.5 px-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          o.status === 'delivered'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : o.status === 'paid'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-xs text-right">
                      <button
                        onClick={() => setSelectedOrder(o)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 text-[11px] font-bold transition-all"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Fulfillment & Warranty Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-[95vw] mx-auto p-3 sm:p-5 rounded-2xl max-h-[90vh] overflow-y-auto bg-[#111622] border border-white/10 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-sm text-white">
                MANAGE ORDER #{selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs bg-black/40 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between text-slate-400">
                <span>Product:</span>
                <span className="font-bold text-white">
                  {selectedOrder.items?.[0]?.product_title || 'Gaming Product'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Delivery Mode:</span>
                <span className="font-bold text-indigo-400">
                  {selectedOrder.delivery_mode === 'auto_account'
                    ? 'Instant Account Delivery'
                    : selectedOrder.delivery_mode === 'manual_service'
                    ? 'Roblox Gift Delivery'
                    : selectedOrder.delivery_mode === 'trade_item'
                    ? 'In-Game Trade'
                    : selectedOrder.delivery_mode === 'digital_code'
                    ? 'Instant Digital Key'
                    : String(selectedOrder.delivery_mode).replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Roblox Recipient:</span>
                <span className="font-bold text-cyan-400">
                  {selectedOrder.roblox_username ? `@${selectedOrder.roblox_username}` : 'N/A'}
                  {selectedOrder.roblox_display_name ? ` (${selectedOrder.roblox_display_name})` : ''}
                </span>
              </div>
              {selectedOrder.roblox_user_id && (
                <div className="flex justify-between text-slate-400">
                  <span>Roblox User ID:</span>
                  <span className="font-mono text-slate-300">
                    {selectedOrder.roblox_user_id}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>Current Status:</span>
                <span className="font-bold text-amber-400 uppercase">
                  {selectedOrder.status}
                </span>
              </div>
              {selectedOrder.delivery_mode === 'auto_account' && (
                <div className="flex justify-between text-slate-400">
                  <span>14-Day Warranty Protection:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>14 Days Active</span>
                  </span>
                </div>
              )}
            </div>

            {/* If Already Delivered: Warranty & Re-delivery Actions */}
            {(selectedOrder.status === 'delivered' || selectedOrder.status === 'completed') ? (
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                  {selectedOrder.delivery_mode === 'auto_account'
                    ? 'This Roblox account order was delivered. You can issue a 14-day warranty replacement, re-deliver credentials to customer, or invalidate warranty.'
                    : 'This order was delivered. You can re-deliver order details to customer.'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedOrder.delivery_mode === 'auto_account' && (
                    <button
                      onClick={() => setShowWarrantyReplaceModal(true)}
                      className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Warranty Replacement</span>
                    </button>
                  )}

                  <button
                    onClick={handleReDeliver}
                    className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Re-Deliver via Bot</span>
                  </button>
                </div>

                {selectedOrder.delivery_mode === 'auto_account' && (
                  <button
                    onClick={handleInvalidateWarranty}
                    className="w-full py-2 px-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Invalidate Warranty Coverage</span>
                  </button>
                )}
              </div>
            ) : (
              /* Fulfillment Form */
              <form onSubmit={handleFulfill} className="space-y-3 pt-2">
                {selectedOrder.delivery_mode === 'auto_account' && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase">
                      Account Credentials to Deliver
                    </span>
                    <input
                      type="text"
                      placeholder="Username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
                    />
                  </div>
                )}

                {selectedOrder.delivery_mode === 'digital_code' && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase">
                      Redemption Voucher / Code
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. ROBLOX-VOUCH-99482"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400">Fulfillment Note (Optional)</span>
                  <textarea
                    placeholder="Notes for customer..."
                    value={fulfillNotes}
                    onChange={(e) => setFulfillNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Fulfill & Notify Customer</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Warranty Replacement Modal */}
      {showWarrantyReplaceModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#121626] border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-400" />
                <h3 className="font-black text-sm text-white">
                  ISSUE WARRANTY REPLACEMENT
                </h3>
              </div>
              <button
                onClick={() => setShowWarrantyReplaceModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Provide replacement account credentials for order <b>#{selectedOrder.order_number}</b>.
              Customer will instantly receive a notification and new authenticator credentials in their vault.
            </p>

            <form onSubmit={handleWarrantyReplacement} className="space-y-3">
              <input
                type="text"
                placeholder="Replacement Username"
                value={replacementUsername}
                onChange={(e) => setReplacementUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                placeholder="Replacement Password"
                value={replacementPassword}
                onChange={(e) => setReplacementPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
              />
              <textarea
                placeholder="Replacement Notes..."
                value={replacementNotes}
                onChange={(e) => setReplacementNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWarrantyReplaceModal(false)}
                  className="flex-1 py-2 rounded-xl bg-white/10 text-white text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingWarranty}
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isProcessingWarranty ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm Replacement</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
