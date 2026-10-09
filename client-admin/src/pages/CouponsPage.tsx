import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  CheckCircle2,
  X,
  Trash2,
  Edit2,
  AlertCircle,
  Search,
  Percent,
  DollarSign,
  UserCheck,
  Ban,
  Check,
  Loader2,
} from 'lucide-react';
import { Coupon } from '../types';
import { AdminAPI } from '../services/api';

interface CouponsPageProps {
  coupons: Coupon[];
  onRefreshCoupons: () => void;
}

export const CouponsPage: React.FC<CouponsPageProps> = ({
  coupons,
  onRefreshCoupons,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrder, setMinOrder] = useState(5);
  const [usageLimit, setUsageLimit] = useState<number | ''>('');
  const [perUserLimit, setPerUserLimit] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'revoked'>('all');

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('percentage');
    setDiscountValue(10);
    setMinOrder(5);
    setUsageLimit('');
    setPerUserLimit(1);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (c: Coupon) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDiscountType(c.discount_type);
    setDiscountValue(c.discount_value);
    setMinOrder(c.min_order_amount);
    setUsageLimit(c.usage_limit || '');
    setPerUserLimit(c.per_user_limit || 1);
    setIsActive(c.is_active);
    setIsModalOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsSubmitting(true);

    try {
      const payload: Partial<Coupon> = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_order_amount: Number(minOrder),
        usage_limit: usageLimit ? Number(usageLimit) : null,
        per_user_limit: Number(perUserLimit),
        is_active: isActive,
      };

      if (editingCoupon) {
        await AdminAPI.updateCoupon(editingCoupon.id, payload);
      } else {
        await AdminAPI.createCoupon(payload);
      }

      setIsModalOpen(false);
      onRefreshCoupons();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error saving coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    setDeletingId(id);
    try {
      await AdminAPI.deleteCoupon(id);
      onRefreshCoupons();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete coupon');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (c: Coupon) => {
    try {
      await AdminAPI.updateCoupon(c.id, { is_active: !c.is_active });
      onRefreshCoupons();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle status');
    }
  };

  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      if (statusFilter === 'active' && (!c.is_active || c.status === 'USED' || c.status === 'REVOKED')) return false;
      if (statusFilter === 'used' && c.status !== 'USED') return false;
      if (statusFilter === 'revoked' && (c.is_active && c.status !== 'REVOKED')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = c.code.toLowerCase().includes(q);
        const orderMatch = (c.used_in_order_number || '').toLowerCase().includes(q);
        const userMatch = (c.customer_telegram_id ? String(c.customer_telegram_id) : '').includes(q);
        return codeMatch || orderMatch || userMatch;
      }
      return true;
    });
  }, [coupons, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <span>PROMO CODES & DISCOUNT REWARDS</span>
          </h2>
          <p className="text-xs text-slate-400">
            Campaign vouchers, points-redeemed store vouchers, and order minimum rules.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Promo Code</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-[#111622] border border-white/5 flex flex-col sm:flex-row gap-3 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search coupon code, order number, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Coupons ({coupons.length})</option>
          <option value="active">Active Available</option>
          <option value="used">Used / Redeemed</option>
          <option value="revoked">Disabled / Revoked</option>
        </select>
      </div>

      {/* Coupons Table */}
      <div className="bg-[#111622] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
              <tr>
                <th className="p-3.5">Coupon Code</th>
                <th className="p-3.5">Type & Value</th>
                <th className="p-3.5">Min Order</th>
                <th className="p-3.5">Usage / Limits</th>
                <th className="p-3.5">Linked Customer / Order</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCoupons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Tag className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                    <p className="font-bold text-slate-400">No coupons match your filter.</p>
                  </td>
                </tr>
              ) : (
                filteredCoupons.map((c) => {
                  const isDeleting = deletingId === c.id;
                  const isUsed = c.status === 'USED' || (c.usage_limit !== null && c.times_used >= c.usage_limit);

                  return (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-amber-400">
                        {c.code}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-emerald-400">
                          {c.discount_type === 'percentage'
                            ? `${c.discount_value}% OFF`
                            : `$${c.discount_value.toFixed(2)} OFF`}
                        </span>
                        <span className="text-[10px] text-slate-500 block capitalize">
                          {c.discount_type} discount
                        </span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-300">
                        ${c.min_order_amount.toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-white">
                          {c.times_used}
                          {c.usage_limit ? ` / ${c.usage_limit}` : ' (unlimited)'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {c.customer_telegram_id ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded inline-block">
                              User: {c.customer_telegram_id}
                            </span>
                            {c.used_in_order_number && (
                              <span className="text-[10px] font-mono text-slate-400 block">
                                Order: {c.used_in_order_number}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">General Public</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {isUsed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400">
                            USED
                          </span>
                        ) : c.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400">
                            REVOKED
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(c)}
                            title={c.is_active ? 'Revoke / Disable' : 'Activate'}
                            className={`p-1.5 rounded-lg transition-all ${
                              c.is_active
                                ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            }`}
                          >
                            {c.is_active ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => openEditModal(c)}
                            title="Edit Coupon"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteCoupon(c.id)}
                            disabled={isDeleting}
                            title="Delete Coupon"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all disabled:opacity-50"
                          >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">
                {editingCoupon ? 'Edit Coupon Promo' : 'Create New Promo Code'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Coupon Code:</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. UCHIRO10"
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Discount Type:</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    Discount Value ({discountType === 'percentage' ? '%' : '$'}):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Min Order Amount ($):</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={minOrder}
                    onChange={(e) => setMinOrder(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Usage Limit (Total):</label>
                  <input
                    type="number"
                    min="1"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Empty for unlimited"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                <span className="text-xs font-bold text-white">Active Status</span>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/30"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
