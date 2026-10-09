import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  X,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface AuthenticatorVaultProps {
  orderId: string;
  orderNumber: string;
  credentials: Record<string, any>;
  warrantyDays?: number;
}

export const AuthenticatorVault: React.FC<AuthenticatorVaultProps> = ({
  orderId,
  orderNumber,
  credentials,
  warrantyDays = 14,
}) => {
  const { t } = useLanguage();
  const [authData, setAuthData] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFetchingRef = useRef<boolean>(false);

  useEffect(() => {
    fetchTotp();
  }, [orderId]);

  // Server-authoritative TOTP countdown & sync
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1 && !isFetchingRef.current) {
          fetchTotp(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderId]);

  const fetchTotp = async (isAuto = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isAuto) setIsRefreshing(true);
    setErrorMessage(null);

    try {
      const data = await StoreAPI.getOrderDeliveryTotp(orderId);
      if (data) {
        setAuthData(data);
        if (data.secondsRemaining !== undefined) {
          setTimeLeft(data.secondsRemaining);
        } else if (data.seconds_remaining !== undefined) {
          setTimeLeft(data.seconds_remaining);
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        setErrorMessage('Delivery access expired');
      } else if (status === 404) {
        setErrorMessage('Authenticator is unavailable for this account.');
      } else {
        setErrorMessage('Unable to refresh code');
      }
    } finally {
      isFetchingRef.current = false;
      if (!isAuto) setIsRefreshing(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const codeDisplay = authData?.code
    ? `${authData.code.slice(0, 3)} ${authData.code.slice(3)}`
    : '------';

  const progressPercent = Math.min(100, Math.max(0, ((30 - timeLeft) / 30) * 100));

  return (
    <div className="space-y-4">
      {/* Live Authenticator Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121828] via-[#161F33] to-[#111624] border border-[#FFD166]/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FFD166]/20 border border-[#FFD166]/40 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-[#FFD166]" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white tracking-wide uppercase">
                {t('live_totp_code')}
              </h4>
              <span className="text-[10px] text-slate-400">
                Roblox 2-Step Verification
              </span>
            </div>
          </div>

          <button
            onClick={() => fetchTotp(false)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all disabled:opacity-50"
            title="Refresh code"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FFD166]' : ''}`} />
          </button>
        </div>

        {/* Big 6-Digit Display */}
        <div className="flex items-center justify-center bg-black/60 p-3.5 rounded-xl border border-white/10">
          <span className="font-mono text-3xl sm:text-4xl font-black text-[#FFD166] tracking-widest select-all text-center">
            {codeDisplay}
          </span>
        </div>

        {/* Countdown */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>
              {t('expires_in')} <b className="text-white">{timeLeft}s</b>
            </span>
            <span>Refreshes automatically</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                timeLeft < 6 ? 'bg-rose-500' : 'bg-gradient-to-r from-[#FFD166] to-emerald-400'
              }`}
              style={{ width: `${100 - progressPercent}%` }}
            />
          </div>
        </div>

        {/* Error / Retry message */}
        {errorMessage && (
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
            <span className="text-[11px]">{errorMessage}</span>
            <button
              onClick={() => fetchTotp(false)}
              className="px-2 py-0.5 rounded bg-rose-500/20 text-[10px] font-bold text-white"
            >
              Retry
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => copyToClipboard(authData?.code || '', 'totp')}
            className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            {copiedKey === 'totp' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={() => fetchTotp(false)}
            disabled={isRefreshing}
            className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FFD166] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
