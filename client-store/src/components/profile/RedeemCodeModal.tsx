import React, { useState } from 'react';
import {
  X,
  Ticket,
  Gift,
  Tag,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  ArrowRight,
} from 'lucide-react';
import { StoreAPI } from '../../services/api';
import { RedeemCodeResult } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface RedeemCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: RedeemCodeResult) => void;
}

export const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemCodeResult | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setCode('');
    setErrorMsg(null);
    setResult(null);
    setCopiedCoupon(false);
    onClose();
  };

  const mapErrorCodeToMessage = (code?: string): string => {
    switch (code) {
      case 'CODE_EXPIRED':
        return t('redeem_code_err_expired');
      case 'CODE_DISABLED':
        return t('redeem_code_err_disabled');
      case 'CODE_EXHAUSTED':
        return t('redeem_code_err_exhausted');
      case 'MEMBER_LIMIT_REACHED':
        return t('redeem_code_err_limit');
      case 'UNAUTHORIZED':
        return t('redeem_code_err_unauthorized');
      case 'INVALID_CODE':
      case 'CODE_NOT_FOUND':
        return t('redeem_code_err_invalid');
      default:
        return t('redeem_code_err_system');
    }
  };

  const handleRedeem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      setErrorMsg(t('redeem_code_err_required'));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await StoreAPI.redeemCode(cleanCode);
      setResult(res);

      // Dispatch global sync events for instant balance updates across the Mini App
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('uchiro_points_sync', { detail: { points: res.points_balance } }));
        window.dispatchEvent(new CustomEvent('uchiro_profile_refresh'));
      }

      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err: any) {
      const errResponse = err.response?.data?.error;
      const errCode = errResponse?.code;
      const customMsg = mapErrorCodeToMessage(errCode);
      setErrorMsg(customMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCoupon = (couponCode: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(couponCode).catch(() => {});
    }
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#131B2E] to-[#0A0E1A] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-500" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {t('redeem_code_modal_title')}
              </h3>
              <p className="text-xs text-slate-400">
                {t('redeem_code_entry_title')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!result ? (
            /* Input & Form State */
            <form onSubmit={handleRedeem} className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('redeem_code_modal_subtitle')}
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  {t('redeem_code_input_label')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder={t('redeem_code_placeholder')}
                    disabled={isLoading}
                    autoFocus
                    className="w-full px-4 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white font-mono font-bold tracking-wider placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-sm disabled:opacity-60 transition-all uppercase"
                  />
                  {code && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setCode('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-rose-300 text-xs animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Actions - English Button Labels */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold text-xs tracking-wider transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !code.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Redeeming...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Redeem Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Clear Result State */
            <div className="space-y-5 animate-in zoom-in-95 duration-200 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-lg font-black text-white">
                  {t('redeem_code_success_heading')}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Code: <span className="font-mono font-bold text-amber-300">{result.code}</span>
                </p>
              </div>

              {/* Reward Details Card */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/80 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    {result.reward_type === 'points' && <Gift className="w-5 h-5 text-amber-400" />}
                    {result.reward_type === 'gacha_tickets' && <Ticket className="w-5 h-5 text-indigo-400" />}
                    {result.reward_type === 'discount_coupon' && <Tag className="w-5 h-5 text-emerald-400" />}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">{result.reward_title}</h5>
                    <p className="text-xs text-slate-400">{result.reward_description}</p>
                  </div>
                </div>

                {/* Balance breakdown */}
                {result.reward_type === 'points' && result.points_balance !== undefined && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t('redeem_code_new_balance_pts')}:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {result.points_balance.toLocaleString()} Pts
                    </span>
                  </div>
                )}

                {result.reward_type === 'gacha_tickets' && result.tickets_balance !== undefined && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t('redeem_code_new_balance_tickets')}:</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {result.tickets_balance} Tickets
                    </span>
                  </div>
                )}

                {result.reward_type === 'discount_coupon' && result.coupon && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <p className="text-xs text-emerald-400 font-medium">
                      {t('redeem_code_coupon_ready')}
                    </p>
                    <div className="flex items-center justify-between p-2.5 bg-slate-950/80 rounded-lg border border-slate-800">
                      <span className="font-mono font-bold text-white text-xs tracking-wider">
                        {result.coupon.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCoupon(result.coupon!.code)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {copiedCoupon ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button - English Label */}
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
