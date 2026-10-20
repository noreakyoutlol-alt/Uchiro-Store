import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Coins,
  Layers,
  X,
  Loader2,
  Sliders,
  Gift,
  HelpCircle,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { GachaPool, GachaPrize } from '../types';
import { AdminAPI } from '../services/api';

export const GachaPage: React.FC = () => {
  const [pools, setPools] = useState<GachaPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // File upload input ref for prize image asset
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pool Modal State
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [editingPool, setEditingPool] = useState<Partial<GachaPool> | null>(null);

  // Prize Modal State
  const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Partial<GachaPrize> | null>(null);
  const [prizeRewardValue, setPrizeRewardValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isValidatingWithBackend, setIsValidatingWithBackend] = useState(false);
  const [backendValidationFeedback, setBackendValidationFeedback] = useState<string | null>(null);

  const handleVerifyWithBackend = async () => {
    if (!selectedPool) return;
    setIsValidatingWithBackend(true);
    setBackendValidationFeedback(null);
    try {
      const res = await AdminAPI.validatePoolProbabilities(selectedPool.id);
      if (res && res.data) {
        if (res.data.isValid) {
          setBackendValidationFeedback('Backend Confirmed: Active pool probabilities total exactly 100.0%!');
        } else {
          setBackendValidationFeedback(`Backend Alert: ${res.data.error || 'Pool does not total 100%'}`);
        }
      }
    } catch (err: any) {
      setBackendValidationFeedback(err.response?.data?.error || err.message || 'Validation request failed');
    } finally {
      setIsValidatingWithBackend(false);
    }
  };

  const loadPools = async () => {
    setIsLoading(true);
    try {
      const data = await AdminAPI.getGachaPools();
      setPools(data || []);
      if (data && data.length > 0) {
        // Auto-select initial active pool, or fallback to first pool
        const firstActive = data.find((p: GachaPool) => p.is_active);
        const autoSelected = firstActive ? firstActive.id : data[0].id;
        setSelectedPoolId((prev) => {
          if (prev && data.some((p: GachaPool) => p.id === prev)) {
            return prev;
          }
          return autoSelected;
        });
      }
    } catch (err: any) {
      console.error('Failed to load gacha pools:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, []);

  const selectedPool = pools.find((p) => p.id === selectedPoolId) || pools[0];
  const activePrizes = (selectedPool?.prizes || []).filter((pr) => pr.is_active && pr.slot_status !== 'draft');
  const totalProbability = activePrizes.reduce((sum, pr) => sum + (Number(pr.probability_percent) || 0), 0);
  const isProbabilityValid = Math.abs(totalProbability - 100) < 0.05;

  const [prizeFilterTab, setPrizeFilterTab] = useState<'all' | 'current' | 'draft'>('all');

  const handlePromoteDraftPrize = async (prizeId: string) => {
    try {
      setIsSubmitting(true);
      await AdminAPI.promoteGachaPrize(prizeId);
      await loadPools();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to promote prize');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pool handlers
  const handleOpenCreatePool = () => {
    setEditingPool({
      title: '',
      slug: '',
      description: '',
      spin_price: 1.5,
      is_active: true,
      banner_url: '',
    });
    setFormError(null);
    setIsPoolModalOpen(true);
  };

  const handleOpenEditPool = (pool: GachaPool) => {
    setEditingPool({ ...pool });
    setFormError(null);
    setIsPoolModalOpen(true);
  };

  const handleSavePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPool || !editingPool.title?.trim()) {
      setFormError('Pool title is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const saved = await AdminAPI.saveGachaPool(editingPool);
      setIsPoolModalOpen(false);
      await loadPools();
      if (saved?.id) setSelectedPoolId(saved.id);
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Failed to save pool');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prize handlers
  const handleOpenCreatePrize = () => {
    if (!selectedPool) return;
    setEditingPrize({
      pool_id: selectedPool.id,
      reward_number: (selectedPool.prizes?.length || 0) + 1,
      slot_number: (selectedPool.prizes?.length || 0) + 1,
      slot_status: 'current',
      title: '',
      description: '',
      rarity: 'COMMON',
      probability_percent: Number(Math.max(0, 100 - totalProbability).toFixed(1)),
      delivery_mode: 'auto_account',
      reward_type: 'points',
      reward_data: { points: 50 },
      stock: 100,
      is_active: true,
    });
    setPrizeRewardValue('50');
    setFormError(null);
    setIsPrizeModalOpen(true);
  };

  const handleOpenEditPrize = (prize: GachaPrize) => {
    setEditingPrize({ ...prize });
    const rewardVal =
      prize.reward_type === 'points'
        ? String(prize.reward_data?.points || 0)
        : String(prize.reward_data?.code || prize.reward_data?.item || '');
    setPrizeRewardValue(rewardVal);
    setFormError(null);
    setIsPrizeModalOpen(true);
  };

  const handleDeletePrize = async (prizeId: string) => {
    if (!confirm('Are you sure you want to delete this prize?')) return;
    try {
      await AdminAPI.deleteGachaPrize(prizeId);
      await loadPools();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete prize');
    }
  };

  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrize || !selectedPool) return;

    if (!editingPrize.title?.trim()) {
      setFormError('Prize title is required');
      return;
    }

    const prob = Number(editingPrize.probability_percent);
    if (isNaN(prob) || prob < 0) {
      setFormError('Probability must be a positive number');
      return;
    }

    const isDraft = editingPrize.slot_status === 'draft' || !editingPrize.is_active;

    if (!isDraft) {
      // Client-side validation: Active CURRENT prizes total must equal exactly 100%
      const otherPrizes = (selectedPool.prizes || []).filter(
        (pr) => pr.id !== editingPrize.id && pr.is_active && pr.slot_status !== 'draft'
      );
      const otherSum = otherPrizes.reduce((sum, pr) => sum + (Number(pr.probability_percent) || 0), 0);
      const newTotal = otherSum + prob;

      if (Math.abs(newTotal - 100) > 0.05) {
        setFormError(
          `Active current prize probabilities must sum to exactly 100.0%. Current total with this prize is ${newTotal.toFixed(
            1
          )}% (difference: ${(newTotal - 100).toFixed(1)}%). If this is a standby replacement prize, set Slot Status to "Draft (Standby)" so it doesn't affect active probability.`
        );
        return;
      }
    }

    // Format reward_data according to reward_type
    let rewardData: Record<string, any> = {};
    if (editingPrize.reward_type === 'points') {
      rewardData = { points: Number(prizeRewardValue) || 0 };
    } else if (editingPrize.reward_type === 'code') {
      rewardData = { code: prizeRewardValue };
    } else {
      rewardData = { item: prizeRewardValue };
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await AdminAPI.saveGachaPrize({
        ...editingPrize,
        pool_id: selectedPool.id,
        probability_percent: prob,
        reward_data: rewardData,
      });
      setIsPrizeModalOpen(false);
      await loadPools();
    } catch (err: any) {
      setFormError(err.response?.data?.error || err.message || 'Failed to save prize');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'MYTHICAL':
        return 'bg-gradient-to-r from-amber-500 to-red-500 text-white border-amber-400/40';
      case 'LEGENDARY':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'EPIC':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'RARE':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  if (isLoading && pools.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-2" />
        <span className="text-xs font-bold">Loading Gacha Pools...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-black text-white">GACHA & MYSTERY POOLS</h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure spin rates, prize drop weights, instant code vouchers, and reward points.
          </p>
        </div>

        <button
          onClick={handleOpenCreatePool}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>New Gacha Pool</span>
        </button>
      </div>

      {/* Pool Selector & Overview Card */}
      <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">Active Pool:</span>
            <select
              value={selectedPool?.id || ''}
              onChange={(e) => setSelectedPoolId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
            >
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (${p.spin_price.toFixed(2)}/spin) {!p.is_active ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedPool && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEditPool(selectedPool)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                <span>Edit Pool Settings</span>
              </button>
            </div>
          )}
        </div>

        {selectedPool && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-black/40 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Ticket Economy</span>
              <div className="text-base font-black text-amber-400 mt-1">
                100 Pts / Ticket
              </div>
              <span className="text-[9px] text-slate-400 font-medium">Points-Only (Zero Fiat)</span>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Total Spins</span>
              <div className="text-base font-black text-white mt-1">
                {selectedPool.total_spins.toLocaleString()}
              </div>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Status</span>
              <div className="mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedPool.is_active
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {selectedPool.is_active ? 'Active' : 'Disabled'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-black/40 rounded-xl border border-white/5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Prize Count</span>
              <div className="text-base font-black text-indigo-400 mt-1">
                {(selectedPool.prizes || []).length} Items ({activePrizes.length} Active)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 100% Probability Validation Banner */}
      {selectedPool && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isProbabilityValid
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isProbabilityValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            )}
            <div>
              <div className="text-xs font-bold flex items-center gap-2">
                <span>
                  {isProbabilityValid
                    ? 'Probability Sum Valid (100.0%)'
                    : `Probability Sum Invalid: ${totalProbability.toFixed(1)}% (Must sum to exactly 100%)`}
                </span>
                <button
                  type="button"
                  onClick={handleVerifyWithBackend}
                  disabled={isValidatingWithBackend}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  {isValidatingWithBackend ? 'Verifying...' : 'Validate with Backend'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {backendValidationFeedback
                  ? backendValidationFeedback
                  : isProbabilityValid
                  ? 'Gacha pool RNG roll weights are balanced and strictly compliant with store rules.'
                  : `Adjustment needed: ${(100 - totalProbability).toFixed(1)}% remaining across active prizes.`}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-48 bg-black/40 rounded-full h-3 overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-300 ${
                isProbabilityValid
                  ? 'bg-emerald-500'
                  : totalProbability > 100
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, totalProbability)}%` }}
            />
          </div>
        </div>
      )}

      {/* Prize List Table */}
      {selectedPool && (
        <div className="bg-[#111622] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-white">Prize Pool Distribution & Standby Drafts</h3>
              <span className="text-[11px] text-slate-400">
                Manage live prizes (100% total probability) and standby draft replacements
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Tabs */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setPrizeFilterTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    prizeFilterTab === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({(selectedPool.prizes || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrizeFilterTab('current')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    prizeFilterTab === 'current'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Current Active ({activePrizes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrizeFilterTab('draft')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    prizeFilterTab === 'draft'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Draft Standby ({(selectedPool.prizes || []).filter((p) => p.slot_status === 'draft').length})
                </button>
              </div>

              <button
                onClick={handleOpenCreatePrize}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add Prize</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
                <tr>
                  <th className="p-3.5 w-16 text-center">Slot</th>
                  <th className="p-3.5">Prize Title</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Rarity</th>
                  <th className="p-3.5">Reward Payload</th>
                  <th className="p-3.5">Delivery Mode</th>
                  <th className="p-3.5">Probability</th>
                  <th className="p-3.5">Stock</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(() => {
                  const filtered = (selectedPool.prizes || []).filter((p) => {
                    if (prizeFilterTab === 'current') return p.slot_status !== 'draft' && p.is_active;
                    if (prizeFilterTab === 'draft') return p.slot_status === 'draft';
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-500">
                          No prizes match this filter. Tap "Add Prize" to configure slot prizes or draft standby items.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((prize, pIdx) => {
                    const isDraft = prize.slot_status === 'draft';
                    const slotNum = prize.slot_number || prize.reward_number || pIdx + 1;
                    return (
                      <tr key={prize.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3.5 text-center font-mono font-bold text-slate-300">
                          <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                            Slot #{slotNum}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-white">
                          <div className="flex items-center gap-2.5">
                            {prize.icon_url ? (
                              <img
                                src={prize.icon_url}
                                alt={prize.title}
                                className="w-8 h-8 rounded-lg object-cover bg-black/40 border border-white/10 shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center shrink-0 text-slate-500">
                                <Gift className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div>{prize.title}</div>
                              {prize.description && (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  {prize.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          {isDraft ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Draft Standby
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Current Active
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRarityBadge(
                              prize.rarity
                            )}`}
                          >
                            {prize.rarity}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-indigo-300 capitalize">
                          {prize.reward_type === 'points'
                            ? `+${prize.reward_data?.points || 0} Points`
                            : prize.reward_type === 'code'
                            ? `Code: ${prize.reward_data?.code || prize.reward_data?.coupon_code || 'Digital Voucher'}`
                            : `Item: ${prize.reward_data?.item || prize.reward_data?.item_name || 'Asset'}`}
                        </td>
                        <td className="p-3.5 capitalize">
                          <span className="text-slate-400">
                            {prize.delivery_mode.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-amber-400 font-mono">
                          {prize.probability_percent.toFixed(1)}%
                        </td>
                        <td className="p-3.5 font-mono text-slate-400">{prize.stock}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              prize.is_active
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700/40 text-slate-400'
                            }`}
                          >
                            {prize.is_active ? 'Active' : 'Standby / Off'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isDraft && (
                              <button
                                onClick={() => handlePromoteDraftPrize(prize.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1 transition-all"
                                title="Promote to Current active prize in this slot"
                              >
                                <span>Promote</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEditPrize(prize)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                              title="Edit Prize"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePrize(prize.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                              title="Delete Prize"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pool Edit / Create Modal */}
      {isPoolModalOpen && editingPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-sm text-white">
                {editingPool.id ? 'EDIT GACHA POOL' : 'NEW GACHA POOL'}
              </h3>
              <button
                onClick={() => setIsPoolModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePool} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Pool Title</label>
                <input
                  type="text"
                  required
                  value={editingPool.title || ''}
                  onChange={(e) => setEditingPool({ ...editingPool, title: e.target.value })}
                  placeholder="e.g. Mythical Pirate Chest"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">URL Slug</label>
                <input
                  type="text"
                  value={editingPool.slug || ''}
                  onChange={(e) => setEditingPool({ ...editingPool, slug: e.target.value })}
                  placeholder="e.g. mythical-pirate-chest"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingPool.description || ''}
                  onChange={(e) => setEditingPool({ ...editingPool, description: e.target.value })}
                  placeholder="Pool description for customers..."
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Spin Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingPool.spin_price ?? 1.5}
                    onChange={(e) =>
                      setEditingPool({ ...editingPool, spin_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Active Status</label>
                  <select
                    value={editingPool.is_active ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditingPool({ ...editingPool, is_active: e.target.value === 'true' })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Banner Image URL</label>
                <input
                  type="url"
                  value={editingPool.banner_url || ''}
                  onChange={(e) => setEditingPool({ ...editingPool, banner_url: e.target.value })}
                  placeholder="https://... or /banner.jpg"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Save Pool</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prize Edit / Create Modal */}
      {isPrizeModalOpen && editingPrize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-sm text-white">
                {editingPrize.id ? 'EDIT GACHA PRIZE' : 'ADD NEW GACHA PRIZE'}
              </h3>
              <button
                onClick={() => setIsPrizeModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSavePrize} className="space-y-3 text-xs">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Slot #</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingPrize.slot_number ?? editingPrize.reward_number ?? 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 1;
                      setEditingPrize({ ...editingPrize, slot_number: val, reward_number: val });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Slot Role</label>
                  <select
                    value={editingPrize.slot_status || 'current'}
                    onChange={(e) => {
                      const st = e.target.value as 'current' | 'draft';
                      setEditingPrize({
                        ...editingPrize,
                        slot_status: st,
                        is_active: st === 'current',
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="current">Current (Active in Pool)</option>
                    <option value="draft">Draft (Standby Reserve)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 font-bold block mb-1">Prize Title (Name)</label>
                  <input
                    type="text"
                    required
                    value={editingPrize.title || ''}
                    onChange={(e) => setEditingPrize({ ...editingPrize, title: e.target.value })}
                    placeholder="e.g. 50 Uchiro Points or V2 Voucher"
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Description</label>
                <input
                  type="text"
                  value={editingPrize.description || ''}
                  onChange={(e) => setEditingPrize({ ...editingPrize, description: e.target.value })}
                  placeholder="Short description displayed on card"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>

              {/* Dynamic Image Asset Handler: URL or Direct File Upload + Instant Render Preview Box */}
              <div className="space-y-2">
                <label className="text-slate-400 font-bold block mb-1">
                  Prize Image Asset (URL or Direct Upload)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={editingPrize.icon_url || ''}
                    onChange={(e) => setEditingPrize({ ...editingPrize, icon_url: e.target.value })}
                    placeholder="https://... (Image URL or upload file)"
                    className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith('image/')) {
                          alert('Please select an image file (PNG, JPG, WEBP, GIF)');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const dataUrl = ev.target?.result as string;
                          if (dataUrl) {
                            setEditingPrize((prev) => (prev ? { ...prev, icon_url: dataUrl } : null));
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors"
                    title="Upload image from device"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Upload</span>
                  </button>
                </div>

                {/* Instant Render Preview Box */}
                {editingPrize.icon_url ? (
                  <div className="relative p-2.5 rounded-2xl bg-black/50 border border-white/10 flex items-center gap-3">
                    <img
                      src={editingPrize.icon_url}
                      alt="Prize Preview"
                      className="w-14 h-14 rounded-xl object-cover bg-black/60 border border-white/10 shadow-md shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-bold text-white truncate">
                        {editingPrize.title || 'Prize Asset Preview'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {editingPrize.icon_url.startsWith('data:')
                          ? 'Direct Upload (Data URI Ready)'
                          : editingPrize.icon_url}
                      </p>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Instant Preview Active
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPrize({ ...editingPrize, icon_url: '' })}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-2 text-slate-500 text-xs">
                    <ImageIcon className="w-4 h-4" />
                    <span>No image set. Enter a URL or click Upload for instant preview.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Rarity Tier</label>
                  <select
                    value={editingPrize.rarity || 'COMMON'}
                    onChange={(e) => setEditingPrize({ ...editingPrize, rarity: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="COMMON">COMMON</option>
                    <option value="RARE">RARE</option>
                    <option value="EPIC">EPIC</option>
                    <option value="LEGENDARY">LEGENDARY</option>
                    <option value="MYTHICAL">MYTHICAL</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    Probability Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    required
                    value={editingPrize.probability_percent ?? 10}
                    onChange={(e) =>
                      setEditingPrize({
                        ...editingPrize,
                        probability_percent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-amber-400 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Reward Type</label>
                  <select
                    value={editingPrize.reward_type || 'points'}
                    onChange={(e) =>
                      setEditingPrize({ ...editingPrize, reward_type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="points">Uchiro Points</option>
                    <option value="code">Digital Code / Voucher</option>
                    <option value="item">Physical / In-game Item</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">
                    {editingPrize.reward_type === 'points'
                      ? 'Points Amount'
                      : editingPrize.reward_type === 'code'
                      ? 'Code / Voucher Prefix'
                      : 'Item Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={prizeRewardValue}
                    onChange={(e) => setPrizeRewardValue(e.target.value)}
                    placeholder={editingPrize.reward_type === 'points' ? 'e.g. 50' : 'e.g. UCH-CODE-10OFF'}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Delivery Mode</label>
                  <select
                    value={editingPrize.delivery_mode || 'auto_account'}
                    onChange={(e) =>
                      setEditingPrize({ ...editingPrize, delivery_mode: e.target.value as any })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="auto_account">Auto Account (Instant Vault)</option>
                    <option value="manual_service">Manual Service (Roblox Verification)</option>
                    <option value="trade_item">Trade Item (In-game Dispatch)</option>
                    <option value="digital_code">Digital Code (Instant Redemption)</option>
                    <option value="points">UCHIRO Points (Instant Ledger)</option>
                    <option value="discount_coupon">Discount Coupon (Instant Voucher)</option>
                    <option value="instant_code">Instant Code (Legacy)</option>
                    <option value="manual_review">Manual Review (Legacy)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editingPrize.stock ?? 100}
                    onChange={(e) =>
                      setEditingPrize({ ...editingPrize, stock: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-bold block mb-1">Active</label>
                  <select
                    value={editingPrize.is_active ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditingPrize({ ...editingPrize, is_active: e.target.value === 'true' })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="true">Active</option>
                    <option value="false">Off</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-black/50 rounded-xl border border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-300">
                  Client Probability Validator
                </span>
                <p className="text-[10px] text-slate-400">
                  Sum of other active prizes: {(
                    (selectedPool.prizes || [])
                      .filter((p) => p.id !== editingPrize.id && p.is_active)
                      .reduce((s, p) => s + (p.probability_percent || 0), 0)
                  ).toFixed(1)}
                  % + This prize:{' '}
                  {(editingPrize.is_active ? Number(editingPrize.probability_percent) || 0 : 0).toFixed(
                    1
                  )}
                  % ={' '}
                  <b
                    className={
                      Math.abs(
                        (selectedPool.prizes || [])
                          .filter((p) => p.id !== editingPrize.id && p.is_active)
                          .reduce((s, p) => s + (p.probability_percent || 0), 0) +
                          (editingPrize.is_active
                            ? Number(editingPrize.probability_percent) || 0
                            : 0) -
                          100
                      ) < 0.05
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }
                  >
                    {(
                      (selectedPool.prizes || [])
                        .filter((p) => p.id !== editingPrize.id && p.is_active)
                        .reduce((s, p) => s + (p.probability_percent || 0), 0) +
                      (editingPrize.is_active
                        ? Number(editingPrize.probability_percent) || 0
                        : 0)
                    ).toFixed(1)}
                    %
                  </b>{' '}
                  (Must be exactly 100.0%)
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPrizeModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Save Prize</span>
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
