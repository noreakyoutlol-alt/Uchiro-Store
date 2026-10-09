import React, { useState } from 'react';
import { Gift, CheckCircle2, XCircle, Loader2, Sparkles, Send, X, AlertCircle } from 'lucide-react';
import { GachaClaim } from '../types';
import { AdminAPI } from '../services/api';

interface ClaimsPageProps {
  claims: GachaClaim[];
  onRefreshClaims: () => void;
}

export const ClaimsPage: React.FC<ClaimsPageProps> = ({
  claims,
  onRefreshClaims,
}) => {
  const [resolvingClaim, setResolvingClaim] = useState<GachaClaim | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'fulfilled' | 'rejected'>('fulfilled');
  const [notes, setNotes] = useState('');
  const [deliveryCode, setDeliveryCode] = useState('');
  const [deliveryAccount, setDeliveryAccount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openResolveModal = (claim: GachaClaim, status: 'fulfilled' | 'rejected') => {
    setResolvingClaim(claim);
    setResolveStatus(status);
    setNotes(status === 'fulfilled' ? 'Claim verified and reward delivered.' : 'Claim rejected after verification.');
    setDeliveryCode('');
    setDeliveryAccount('');
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingClaim) return;
    setIsSubmitting(true);

    try {
      const deliveryData: Record<string, any> = {};
      if (deliveryCode.trim()) deliveryData.code = deliveryCode.trim();
      if (deliveryAccount.trim()) deliveryData.account = deliveryAccount.trim();

      await AdminAPI.resolveClaim(
        resolvingClaim.id,
        resolveStatus,
        notes,
        Object.keys(deliveryData).length > 0 ? deliveryData : undefined
      );

      setResolvingClaim(null);
      onRefreshClaims();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error resolving claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-400" />
            <span>GACHA CLAIMS REVIEW</span>
          </h2>
          <p className="text-xs text-slate-400">
            Fulfill won prizes needing manual delivery (voucher codes, accounts, or items) or reject fraudulent claims.
          </p>
        </div>
      </div>

      <div className="bg-[#111622] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
              <tr>
                <th className="p-3.5">Claim ID</th>
                <th className="p-3.5">Prize Title</th>
                <th className="p-3.5">Rarity</th>
                <th className="p-3.5">Customer ID</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                    <p className="font-bold text-slate-400">No pending gacha claims to review.</p>
                    <p className="text-[11px]">All won mystery prizes are currently fulfilled.</p>
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400">
                      {claim.id.substring(0, 10)}...
                    </td>
                    <td className="p-3.5 font-bold text-white">
                      {claim.prize?.title || 'Mystery Reward'}
                    </td>
                    <td className="p-3.5 font-bold text-amber-400">
                      {claim.prize?.rarity || 'MYTHICAL'}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{claim.customer_id}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        claim.status === 'fulfilled'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : claim.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/20 text-amber-300 animate-pulse'
                      }`}>
                        {claim.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {claim.status === 'pending' || claim.status === 'pending_review' || claim.status === 'claimed' ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openResolveModal(claim, 'fulfilled')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 text-[11px] font-bold transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Fulfill</span>
                          </button>
                          <button
                            onClick={() => openResolveModal(claim, 'rejected')}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-200 text-[11px] font-bold transition-all flex items-center gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fulfillment Modal */}
      {resolvingClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  {resolveStatus === 'fulfilled' ? 'Fulfill Gacha Prize Claim' : 'Reject Gacha Claim'}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Prize: {resolvingClaim.prize?.title}
                </span>
              </div>
              <button
                onClick={() => setResolvingClaim(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-3.5">
              {resolveStatus === 'fulfilled' && (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Digital Voucher / Code (Optional):
                    </label>
                    <input
                      type="text"
                      value={deliveryCode}
                      onChange={(e) => setDeliveryCode(e.target.value)}
                      placeholder="e.g. ROBLOX-VOUCHER-XXXX"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Account Credentials (Optional):
                    </label>
                    <input
                      type="text"
                      value={deliveryAccount}
                      onChange={(e) => setDeliveryAccount(e.target.value)}
                      placeholder="Username:Password"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Customer Notification Notes:
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Message sent to the customer via Telegram bot..."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingClaim(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-1 shadow-lg transition-all ${
                    resolveStatus === 'fulfilled'
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Confirm {resolveStatus === 'fulfilled' ? 'Delivery' : 'Rejection'}</span>
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
