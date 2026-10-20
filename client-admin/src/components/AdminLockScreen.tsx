import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Lock, Delete, RotateCcw, Loader2 } from 'lucide-react';
import { verifyPin } from '../services/admin-auth';
import { AdminSpaceBackground } from './background/AdminSpaceBackground';

interface Props {
  onSuccess: () => void;
}

export const AdminLockScreen: React.FC<Props> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptUnlock = useCallback(async (candidatePin: string): Promise<void> => {
    if (!candidatePin || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await verifyPin(candidatePin.trim());
      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || 'Access Denied. Incorrect Security PIN.');
        setPin('');
      }
    } catch {
      setError('Network communication failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, onSuccess]);

  // Dynamic automatic submission when PIN reaches 4 digits without exposing the PIN value in source
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      attemptUnlock(pin);
    }
  }, [pin, submitting, attemptUnlock]);

  const handleDigit = (digit: string) => {
    if (submitting || pin.length >= 4) return;
    setPin(prev => prev + digit);
    setError(null);
  };

  const handleDelete = () => {
    if (submitting) return;
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (submitting) return;
    setPin('');
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent): void => {
    if (e) e.preventDefault();
    if (pin.length >= 4 && !submitting) {
      attemptUnlock(pin);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A14] text-slate-100 flex items-center justify-center p-4 relative select-none">
      <AdminSpaceBackground />

      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#121727] via-[#0E1322] to-[#0A0D16] border border-white/10 p-6 sm:p-7 relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] card-3d">
        {/* Top Specular Rim */}
        <div className="absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent pointer-events-none" />

        {/* Security Shield Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 p-0.5 shadow-[0_0_24px_rgba(99,102,241,0.4)] mb-3 relative group">
            <div className="w-full h-full bg-[#0E1322] rounded-[14px] flex items-center justify-center">
              {submitting ? (
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
              ) : error ? (
                <ShieldAlert className="w-7 h-7 text-rose-400 animate-pulse" />
              ) : (
                <ShieldCheck className="w-7 h-7 text-indigo-400 group-hover:scale-110 transition-transform" />
              )}
            </div>
          </div>
          <h1 className="text-lg font-black tracking-wide text-white uppercase">Admin Security Portal</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Enter 4-digit Master PIN to unlock console</p>
        </div>

        {/* PIN Dots Indicator */}
        <div className="flex justify-center items-center gap-3.5 mb-6">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-indigo-400 scale-125 shadow-[0_0_12px_rgba(99,102,241,0.9)] border border-indigo-200'
                    : 'bg-white/10 border border-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Physical Keyboard Accessible Input */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(val);
                setError(null);
              }}
              placeholder="••••"
              disabled={submitting}
              className="w-full py-2 px-3 text-center text-lg tracking-[0.5em] font-mono bg-black/50 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <Lock className="w-4 h-4" />
            </div>
          </div>

          {error && (
            <div className="mt-2.5 p-2 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center flex items-center justify-center gap-1.5 animate-fadeIn">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Tactile 3D Cyber Keypad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((item) => {
            const isClear = item === 'C';
            const isBackspace = item === '⌫';

            return (
              <button
                key={item}
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (isClear) handleClear();
                  else if (isBackspace) handleDelete();
                  else handleDigit(item);
                }}
                className={`h-12 rounded-xl font-black text-sm transition-all duration-150 flex items-center justify-center active:scale-95 cursor-pointer shadow-sm ${
                  isClear || isBackspace
                    ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white'
                    : 'bg-[#151B2E] hover:bg-[#1A223B] border border-white/10 hover:border-indigo-500/50 text-white hover:text-indigo-300 shadow-[0_2px_4px_rgba(0,0,0,0.4)]'
                }`}
              >
                {isClear ? (
                  <RotateCcw className="w-4 h-4" />
                ) : isBackspace ? (
                  <Delete className="w-4 h-4" />
                ) : (
                  <span>{item}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Submit Button */}
        <button
          type="button"
          disabled={pin.length < 4 || submitting}
          onClick={() => handleSubmit()}
          className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
            pin.length < 4 || submitting
              ? 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
              : 'btn-3d-primary shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:brightness-110 active:scale-[0.98]'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying Session...</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock Admin Panel</span>
            </>
          )}
        </button>

        {/* Security watermark footer */}
        <div className="mt-4 pt-3 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-500 font-mono tracking-wider">
            UCHIRO V3 ENTERPRISE CORE • ZERO-TRUST PIN GATE
          </p>
        </div>
      </div>
    </div>
  );
};
