import React, { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  Plus,
  Search,
  Sparkles,
  Gift,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Power,
  Calendar,
  Users,
  AlertCircle,
  Loader2,
  X,
  History,
  CheckCircle2,
  Clock,
  Coins,
  Percent,
  DollarSign,
  Shuffle,
  ShieldAlert,
} from 'lucide-react';
import {
  RedeemCode,
  RedeemRewardType,
  RedeemCodeUseMode,
  RedeemCodeUsage,
  CreateRedeemCodeDTO,
} from '../types';
import { AdminAPI } from '../services/api';

export const RedeemCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<RedeemCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [rewardFilter, setRewardFilter] = useState<'all' | RedeemRewardType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'DISABLED' | 'EXPIRED' | 'EXHAUSTED'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [historyCode, setHistoryCode] = useState<RedeemCode | null>(null);
  const [historyUsages, setHistoryUsages] = useState<RedeemCodeUsage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formRewardType, setFormRewardType] = useState<RedeemRewardType>('points');
  const [formRewardAmount, setFormRewardAmount] = useState<number>(100);
  const [formCouponType, setFormCouponType] = useState<'percentage' | 'fixed'>('fixed');
  const [formCouponValue, setFormCouponValue] = useState<number>(1.0);
  const [formCouponMinOrder, setFormCouponMinOrder] = useState<number>(3.0);
  const [formCouponMaxDiscount, setFormCouponMaxDiscount] = useState<number | ''>('');
  const [formCouponValidityDays, setFormCouponValidityDays] = useState<number>(14);

  const [formUseMode, setFormUseMode] = useState<RedeemCodeUseMode>('one_per_member');
  const [formIsUnlimited, setFormIsUnlimited] = useState<boolean>(true);
  const [formMaxUses, setFormMaxUses] = useState<number | ''>(100);
  const [formPerUserLimit, setFormPerUserLimit] = useState<number>(1);
  const [formHasExpiry, setFormHasExpiry] = useState<boolean>(false);
  const [formExpiresAt, setFormExpiresAt] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const loadCodes = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await AdminAPI.getRedeemCodes();
      setCodes(data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to load redeem codes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  // Filtered Codes
  const filteredCodes = useMemo(() => {
    return codes.filter((c) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = c.code.toLowerCase().includes(q);
        const matchesNotes = (c.notes || '').toLowerCase().includes(q);
        if (!matchesCode && !matchesNotes) return false;
      }

      // Reward Filter
      if (rewardFilter !== 'all' && c.reward_type !== rewardFilter) {
        return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const s = c.status || (c.is_active ? 'ACTIVE' : 'DISABLED');
        if (s !== statusFilter) return false;
      }

      return true;
    });
  }, [codes, searchQuery, rewardFilter, statusFilter]);

  // Metric Aggregates
  const totalCodesCount = codes.length;
  const activeCodesCount = codes.filter((c) => c.status === 'ACTIVE' || (c.is_active && c.status !== 'EXPIRED' && c.status !== 'EXHAUSTED')).length;
  const totalRedemptionsCount = codes.reduce((sum, c) => sum + (c.times_used || 0), 0);
  const pointsCodesCount = codes.filter((c) => c.reward_type === 'points').length;
  const ticketsCodesCount = codes.filter((c) => c.reward_type === 'gacha_tickets').length;
  const couponsCodesCount = codes.filter((c) => c.reward_type === 'discount_coupon').length;

  const handleCopyCode = (c: RedeemCode) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(c.code).catch(() => {});
    }
    setCopiedCodeId(c.id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const generated = await AdminAPI.generateRedeemCode();
      setFormCode(generated);
    } catch (err) {
      // Fallback client generator
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let rand = '';
      for (let i = 0; i < 4; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
      setFormCode(`UCH-${rand}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const openCreateModal = () => {
    setFormCode('');
    setFormRewardType('points');
    setFormRewardAmount(100);
    setFormCouponType('fixed');
    setFormCouponValue(1.0);
    setFormCouponMinOrder(3.0);
    setFormCouponMaxDiscount('');
    setFormCouponValidityDays(14);
    setFormUseMode('one_per_member');
    setFormIsUnlimited(true);
    setFormMaxUses(100);
    setFormPerUserLimit(1);
    setFormHasExpiry(false);
    setFormExpiresAt('');
    setFormNotes('');
    setFormIsActive(true);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: CreateRedeemCodeDTO = {
        code: formCode.trim() ? formCode.trim().toUpperCase() : undefined,
        reward_type: formRewardType,
        reward_amount: formRewardType === 'points' || formRewardType === 'gacha_tickets' ? Number(formRewardAmount) : 0,
        reward_data:
          formRewardType === 'discount_coupon'
            ? {
                discount_type: formCouponType,
                discount_value: Number(formCouponValue),
                min_order_amount: Number(formCouponMinOrder),
                max_discount_amount: formCouponMaxDiscount !== '' ? Number(formCouponMaxDiscount) : null,
                validity_days: Number(formCouponValidityDays) || 14,
              }
            : undefined,
        use_mode: formUseMode,
        max_uses: formUseMode === 'single_use' ? 1 : formIsUnlimited ? null : Number(formMaxUses),
        per_user_limit: formUseMode === 'single_use' ? 1 : Number(formPerUserLimit) || 1,
        expires_at: formHasExpiry && formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        is_active: formIsActive,
        notes: formNotes.trim() || undefined,
      };

      await AdminAPI.createRedeemCode(payload);
      setIsCreateModalOpen(false);
      await loadCodes();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || 'Failed to create redeem code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (c: RedeemCode) => {
    setActionInProgressId(c.id);
    try {
      const updated = await AdminAPI.toggleRedeemCodeActive(c.id);
      setCodes((prev) => prev.map((item) => (item.id === c.id ? updated : item)));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to toggle status');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDeleteCode = async (c: RedeemCode) => {
    if (!confirm(`Are you sure you want to delete redeem code "${c.code}"? This action cannot be undone.`)) {
      return;
    }
    setActionInProgressId(c.id);
    try {
      await AdminAPI.deleteRedeemCode(c.id);
      setCodes((prev) => prev.filter((item) => item.id !== c.id));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete code');
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleOpenHistory = async (c: RedeemCode) => {
    setHistoryCode(c);
    setIsLoadingHistory(true);
    setHistoryUsages([]);
    try {
      const usages = await AdminAPI.getRedeemCodeUsages(c.id);
      setHistoryUsages(usages);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-wide">
            <Ticket className="w-6 h-6 text-amber-400" />
            <span>Redeem Codes Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create, issue, and manage promotional gift codes for Points, Gacha Tickets, and Discount Coupons.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCodes}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Redeem Code</span>
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Codes</span>
            <Ticket className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white mt-2">{totalCodesCount}</p>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
            <span>Points: {pointsCodesCount}</span>
            <span>•</span>
            <span>Tickets: {ticketsCodesCount}</span>
            <span>•</span>
            <span>Coupons: {couponsCodesCount}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Active Codes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-2">{activeCodesCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Ready for members to claim</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Redemptions</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400 mt-2">{totalRedemptionsCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">Successful member claims</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Fraud & Bot Guard</span>
            <ShieldAlert className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-sm font-bold text-cyan-400 mt-2">Active Enforcement</p>
          <p className="text-[11px] text-slate-400 mt-1">Per-member & rate limits enforced</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code or notes..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={rewardFilter}
            onChange={(e) => setRewardFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
          >
            <option value="all">All Reward Types</option>
            <option value="points">Points Only</option>
            <option value="gacha_tickets">Gacha Tickets Only</option>
            <option value="discount_coupon">Discount Coupons Only</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-amber-400"
          >
            <option value="all">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Disabled</option>
            <option value="EXPIRED">Expired</option>
            <option value="EXHAUSTED">Exhausted</option>
          </select>
        </div>
      </div>

      {/* Codes Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Reward</th>
                <th className="py-3 px-4">Mode & Limits</th>
                <th className="py-3 px-4">Redemptions</th>
                <th className="py-3 px-4">Expiry</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                    <span>Loading redeem codes...</span>
                  </td>
                </tr>
              ) : filteredCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Ticket className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                    <p className="font-semibold text-sm text-slate-300">No redeem codes found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {codes.length === 0
                        ? 'Click "Create Redeem Code" above to issue your first reward code.'
                        : 'No codes match your search or filter criteria.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCodes.map((c) => {
                  const status = c.status || (c.is_active ? 'ACTIVE' : 'DISABLED');
                  const percentUsed = c.max_uses ? Math.min(100, Math.round((c.times_used / c.max_uses) * 100)) : null;

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Code with Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm tracking-wider select-all">
                            {c.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Copy Code"
                          >
                            {copiedCodeId === c.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {c.notes && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5" title={c.notes}>
                            {c.notes}
                          </p>
                        )}
                      </td>

                      {/* Reward */}
                      <td className="py-3.5 px-4">
                        {c.reward_type === 'points' && (
                          <div className="flex items-center gap-1.5 font-bold text-amber-400">
                            <Coins className="w-3.5 h-3.5" />
                            <span>+{c.reward_amount.toLocaleString()} Pts</span>
                          </div>
                        )}
                        {c.reward_type === 'gacha_tickets' && (
                          <div className="flex items-center gap-1.5 font-bold text-indigo-400">
                            <Ticket className="w-3.5 h-3.5" />
                            <span>+{c.reward_amount} Tickets</span>
                          </div>
                        )}
                        {c.reward_type === 'discount_coupon' && (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                              <Tag className="w-3.5 h-3.5" />
                              <span>
                                {c.reward_data?.discount_type === 'percentage'
                                  ? `${c.reward_data.discount_value}% OFF`
                                  : `$${Number(c.reward_data?.discount_value || 0).toFixed(2)} OFF`}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Min Order: ${Number(c.reward_data?.min_order_amount || 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Mode & Limits */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                          {c.use_mode === 'single_use' && '1-Time Single'}
                          {c.use_mode === 'one_per_member' && '1 Per Member'}
                          {c.use_mode === 'reusable' && `Reusable (${c.per_user_limit}/member)`}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Limit: {c.max_uses ? `${c.max_uses} max` : 'Unlimited pool'}
                        </div>
                      </td>

                      {/* Redemptions count & progress bar */}
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-white">{c.times_used}</span>
                          <span className="text-slate-400">/ {c.max_uses ?? '∞'}</span>
                        </div>
                        {percentUsed !== null ? (
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                percentUsed >= 100
                                  ? 'bg-rose-500'
                                  : percentUsed > 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percentUsed}%` }}
                            />
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">No cap</span>
                        )}
                      </td>

                      {/* Expiry */}
                      <td className="py-3.5 px-4">
                        {c.expires_at ? (
                          <div className="space-y-0.5">
                            <span className="text-slate-300 block">
                              {new Date(c.expires_at).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {new Date(c.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">No Expiration</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                            status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : status === 'DISABLED'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : status === 'EXPIRED'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === 'ACTIVE'
                                ? 'bg-emerald-400'
                                : status === 'DISABLED'
                                ? 'bg-rose-400'
                                : status === 'EXPIRED'
                                ? 'bg-amber-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* History */}
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(c)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="View Redemption History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(c)}
                            disabled={actionInProgressId === c.id}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              c.is_active
                                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            }`}
                            title={c.is_active ? 'Disable Code' : 'Enable Code'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCode(c)}
                            disabled={actionInProgressId === c.id}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                            title="Delete Code"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* CREATE REDEEM CODE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-lg my-8 bg-gradient-to-b from-[#131B2E] to-[#0A0E1A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            {/* Header Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-500" />

            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">Create Redeem Code</h3>
                  <p className="text-xs text-slate-400">Configure reward, usage constraints, and expiration</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Code Input & Random Generator */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Redeem Code
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={isGenerating}
                    className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Shuffle className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Generate Unpredictable Code</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. UCH-VIP-2025 (Leave empty to auto-generate)"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold tracking-wider placeholder:text-slate-500 focus:outline-none focus:border-amber-400 text-sm uppercase"
                />
              </div>

              {/* Reward Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Reward Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRewardType('points')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      formRewardType === 'points'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Coins className="w-5 h-5" />
                    <span className="text-xs font-bold">Reward Points</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRewardType('gacha_tickets')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      formRewardType === 'gacha_tickets'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-md shadow-indigo-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Ticket className="w-5 h-5" />
                    <span className="text-xs font-bold">Gacha Tickets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRewardType('discount_coupon')}
                    className={`py-3 px-3 rounded-xl border flex flex-col items-center gap-1 text-center transition-all cursor-pointer ${
                      formRewardType === 'discount_coupon'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <Tag className="w-5 h-5" />
                    <span className="text-xs font-bold">Discount Coupon</span>
                  </button>
                </div>
              </div>

              {/* Reward Amount Controls */}
              {formRewardType === 'points' && (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Points to Credit</label>
                  <input
                    type="number"
                    min="1"
                    value={formRewardAmount}
                    onChange={(e) => setFormRewardAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Directly credits member's loyalty points balance upon code redemption.
                  </p>
                </div>
              )}

              {formRewardType === 'gacha_tickets' && (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">Gacha Tickets to Credit</label>
                  <input
                    type="number"
                    min="1"
                    value={formRewardAmount}
                    onChange={(e) => setFormRewardAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <p className="text-[11px] text-slate-400">
                    Directly adds gacha tickets to member's reward chest inventory.
                  </p>
                </div>
              )}

              {formRewardType === 'discount_coupon' && (
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Discount Type</label>
                      <select
                        value={formCouponType}
                        onChange={(e) => setFormCouponType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      >
                        <option value="fixed">Fixed Dollar ($)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Discount Value</label>
                      <input
                        type="number"
                        step={formCouponType === 'fixed' ? '0.1' : '1'}
                        min="0.1"
                        value={formCouponValue}
                        onChange={(e) => setFormCouponValue(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Min Order Amount ($)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={formCouponMinOrder}
                        onChange={(e) => setFormCouponMinOrder(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Coupon Validity (Days)</label>
                      <input
                        type="number"
                        min="1"
                        value={formCouponValidityDays}
                        onChange={(e) => setFormCouponValidityDays(parseInt(e.target.value) || 14)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Generates an instant unique store coupon stored in member's wallet for checkout.
                  </p>
                </div>
              )}

              {/* Use Mode & Constraints */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Usage Mode & Limits
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormUseMode('single_use')}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                      formUseMode === 'single_use'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    1-Time Single
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormUseMode('one_per_member')}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                      formUseMode === 'one_per_member'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    1 Per Member
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormUseMode('reusable')}
                    className={`py-2 px-2.5 rounded-xl border text-center text-xs font-semibold transition-all cursor-pointer ${
                      formUseMode === 'reusable'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    Custom Reusable
                  </button>
                </div>

                {/* Total Uses Cap */}
                {formUseMode !== 'single_use' && (
                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-medium">Total Redemptions Cap</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formIsUnlimited}
                          onChange={(e) => setFormIsUnlimited(e.target.checked)}
                          className="rounded bg-slate-950 border-slate-700"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    {!formIsUnlimited && (
                      <input
                        type="number"
                        min="1"
                        value={formMaxUses}
                        onChange={(e) => setFormMaxUses(parseInt(e.target.value) || 1)}
                        placeholder="e.g. 50 total redemptions"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                      />
                    )}
                  </div>
                )}

                {/* Per Member Limit (for Custom Reusable) */}
                {formUseMode === 'reusable' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Max Redemptions Per Member
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formPerUserLimit}
                      onChange={(e) => setFormPerUserLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Expiration Settings */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Expiration Date
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasExpiry}
                      onChange={(e) => setFormHasExpiry(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700"
                    />
                    <span>Set Expiry Date</span>
                  </label>
                </div>
                {formHasExpiry && (
                  <input
                    type="datetime-local"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    required={formHasExpiry}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs"
                  />
                )}
              </div>

              {/* Internal Admin Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Discord giveaway promo, batch 1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs placeholder:text-slate-500"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-white block">Active Status</span>
                  <span className="text-[11px] text-slate-400">
                    Immediately enable code upon creation
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-700"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold text-xs tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REDEMPTION HISTORY MODAL */}
      {historyCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#131B2E] to-[#0A0E1A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">Redemption History</h3>
                  <p className="text-xs text-slate-400">
                    Code: <span className="font-mono font-bold text-amber-400">{historyCode.code}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryCode(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Total Recorded Usages:</span>
                <span className="font-bold text-white text-sm">{historyUsages.length}</span>
              </div>

              {isLoadingHistory ? (
                <div className="py-8 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  <span className="text-xs">Loading redemption logs...</span>
                </div>
              ) : historyUsages.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                  <p className="font-semibold text-xs text-slate-300">No redemptions yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">This code has not been redeemed by any member.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyUsages.map((usage) => (
                    <div
                      key={usage.id}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Member: {usage.masked_telegram_id || `ID: ${usage.telegram_id}`}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(usage.created_at).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-right">
                        {usage.reward_type === 'points' && (
                          <span className="font-bold text-amber-400">+{usage.reward_amount} Pts</span>
                        )}
                        {usage.reward_type === 'gacha_tickets' && (
                          <span className="font-bold text-indigo-400">+{usage.reward_amount} Tickets</span>
                        )}
                        {usage.reward_type === 'discount_coupon' && (
                          <span className="font-bold text-emerald-400">Coupon Generated</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setHistoryCode(null)}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs tracking-wider transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
