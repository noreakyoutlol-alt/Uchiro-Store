import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  QrCode,
  ExternalLink,
  Lock,
  User,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Sparkles,
  Home,
  FileText,
  Loader2,
  Gift,
} from 'lucide-react';
import { Order, CustomerDeliveryResult, CustomerTotpResult } from '../../types';
import { StoreAPI } from '../../services/api';
import { formatShortOrderId } from '../../utils/order.util';

interface DeliveredOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onBackToHome?: () => void;
  onViewReceipt?: (order: Order) => void;
}

export const DeliveredOrderModal: React.FC<DeliveredOrderModalProps> = ({
  order,
  onClose,
  onBackToHome,
  onViewReceipt,
}) => {
  // In-memory state only (Strict Requirement: never persisted to localStorage/sessionStorage)
  const [delivery, setDelivery] = useState<CustomerDeliveryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorState, setErrorState] = useState<string | null>(null);

  // Live TOTP state
  const [totpCode, setTotpCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [period, setPeriod] = useState<number>(30);
  const [isRefreshingTotp, setIsRefreshingTotp] = useState<boolean>(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // UI state
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Cleanup in-memory credentials immediately when leaving or closing
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setDelivery(null);
      setTotpCode('');
    };
  }, []);

  // Fetch initial delivery payload on mount / order change
  useEffect(() => {
    if (!order) return;

    let isMounted = true;
    setIsLoading(true);
    setErrorState(null);
    setTotpError(null);

    const loadDelivery = async () => {
      try {
        const data = await StoreAPI.getOrderDelivery(order.id);
        if (!isMounted) return;

        setDelivery(data);

        if (data.authenticator && data.authenticator.available) {
          if (data.authenticator.code) {
            setTotpCode(data.authenticator.code);
          }
          if (data.authenticator.period) {
            setPeriod(data.authenticator.period);
          }

          if (data.authenticator.expiresAt) {
            const expMs = new Date(data.authenticator.expiresAt).getTime();
            setExpiresAt(expMs);
            const remaining = Math.max(0, Math.ceil((expMs - Date.now()) / 1000));
            setSecondsRemaining(remaining);
          } else if (data.authenticator.secondsRemaining !== undefined) {
            setSecondsRemaining(data.authenticator.secondsRemaining);
            setExpiresAt(Date.now() + data.authenticator.secondsRemaining * 1000);
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          setErrorState('Delivery access expired');
        } else if (status === 400) {
          setErrorState(err.response?.data?.error || 'Order delivery is no longer available.');
        } else {
          setErrorState('Unable to load order delivery. Please try again.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDelivery();

    return () => {
      isMounted = false;
    };
  }, [order?.id]);

  // Server-authoritative TOTP countdown & automatic background refresh loop
  useEffect(() => {
    if (!delivery?.authenticator?.available) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = Date.now();
      if (expiresAt > 0) {
        const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
        setSecondsRemaining(remaining);

        // When timer hits 0, immediately clear expired code and trigger instant server-authoritative TOTP refresh
        if (remaining <= 0 && !isFetchingRef.current) {
          setTotpCode(''); // Never let expired code remain displayed!
          refreshTotp(true);
        }
      } else {
        setSecondsRemaining((prev) => {
          if (prev <= 1 && !isFetchingRef.current) {
            setTotpCode(''); // Never let expired code remain displayed!
            refreshTotp(true);
            return period;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt, period, delivery?.authenticator?.available, order?.id]);

  // Fetch updated TOTP code from authoritative backend
  const refreshTotp = async (isAuto = false) => {
    if (!order || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isAuto) setIsRefreshingTotp(true);
    setTotpError(null);

    try {
      const totpData: CustomerTotpResult = await StoreAPI.getOrderDeliveryTotp(order.id);
      if (totpData && totpData.code) {
        setTotpCode(totpData.code);
        if (totpData.period) setPeriod(totpData.period);

        if (totpData.expiresAt) {
          const expMs = new Date(totpData.expiresAt).getTime();
          setExpiresAt(expMs);
          const remaining = Math.max(0, Math.ceil((expMs - Date.now()) / 1000));
          setSecondsRemaining(remaining);
        } else if (totpData.secondsRemaining !== undefined) {
          setSecondsRemaining(totpData.secondsRemaining);
          setExpiresAt(Date.now() + totpData.secondsRemaining * 1000);
        }
      }
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        setTotpError('Delivery access expired');
      } else if (status === 404) {
        setTotpError('Authenticator is unavailable for this account.');
      } else {
        setTotpError('Unable to refresh code');
      }
    } finally {
      isFetchingRef.current = false;
      if (!isAuto) setIsRefreshingTotp(false);
    }
  };

  if (!order) return null;

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAddToAuthenticator = () => {
    if (delivery?.authenticator?.otpauth_url) {
      window.location.href = delivery.authenticator.otpauth_url;
    }
  };

  // Section F: Never display expired code
  const formattedCode =
    isRefreshingTotp || !totpCode || secondsRemaining <= 0
      ? isRefreshingTotp
        ? '••• •••'
        : '------'
      : `${totpCode.slice(0, 3)} ${totpCode.slice(3)}`;

  const progressPercent = Math.min(100, Math.max(0, (secondsRemaining / (period || 30)) * 100));

  const manualSetupKey =
    delivery?.authenticator?.manual_setup_key ||
    (delivery?.authenticator?.otpauth_url
      ? (() => {
          try {
            return new URL(delivery.authenticator.otpauth_url).searchParams.get('secret') || '';
          } catch {
            return '';
          }
        })()
      : '') ||
    '';

  const hasAuthenticator = Boolean(delivery?.authenticator?.available);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0C101D]/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 bg-gradient-to-r from-[#141923] via-[#1A2230] to-[#141923] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md ${
              order.delivery_mode === 'manual_service'
                ? 'bg-gradient-to-br from-indigo-600 to-purple-600'
                : order.delivery_mode === 'trade_item'
                ? 'bg-gradient-to-br from-amber-600 to-orange-600'
                : order.delivery_mode === 'digital_code'
                ? 'bg-gradient-to-br from-cyan-600 to-blue-600'
                : 'bg-gradient-to-br from-[#E63946] to-[#FFD166]'
            }`}>
              {order.delivery_mode === 'manual_service' ? (
                <Gift className="w-4 h-4 text-white" />
              ) : order.delivery_mode === 'trade_item' ? (
                <User className="w-4 h-4 text-white" />
              ) : order.delivery_mode === 'digital_code' ? (
                <KeyRound className="w-4 h-4 text-white" />
              ) : (
                <Lock className="w-4 h-4 text-black" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                {order.delivery_mode === 'manual_service'
                  ? 'Roblox Gift Delivery'
                  : order.delivery_mode === 'trade_item'
                  ? 'In-Game Trade'
                  : order.delivery_mode === 'digital_code'
                  ? 'Instant Digital Key'
                  : 'Secure Delivery Vault'}
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                {formatShortOrderId(order.order_number || order.id)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#FFD166]" />
              <span className="text-xs font-semibold">Opening Secure Delivery Vault...</span>
            </div>
          )}

          {errorState && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">Delivery Unavailable</h3>
              <p className="text-xs text-rose-300">{errorState}</p>
            </div>
          )}

          {/* DIGITAL CODE DELIVERY MODE (Instant Digital Key) */}
          {!isLoading && !errorState && delivery?.delivery_mode === 'digital_code' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#0F1420] border border-cyan-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
                    <KeyRound className="w-4 h-4" />
                    <span>Instant Digital Key</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                    Active & Ready to Redeem
                  </span>
                </div>

                {/* Unused Key Display Box */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Activation Key / Voucher
                    </span>
                    <span className="text-sm sm:text-base font-mono font-black text-[#FFD166] select-all truncate block">
                      {delivery.digital_code || 'CODE-PENDING'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(delivery.digital_code || '', 'code')}
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-[#FFD166] hover:brightness-110 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 active:scale-95"
                    title="Copy Key"
                  >
                    {copiedField === 'code' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-black" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-black" />
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Step-by-Step Redemption Instructions */}
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                  <span className="text-[11px] font-bold text-white block">
                    How to Redeem Your Digital Key:
                  </span>
                  <ol className="text-[11px] text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                    <li>
                      Visit the official redemption portal:{' '}
                      <span className="text-cyan-300 font-mono">roblox.com/redeem</span>
                    </li>
                    <li>Sign in to your Roblox account if prompted.</li>
                    <li>Paste your copied key into the code input field.</li>
                    <li>Click <strong>Redeem</strong> to credit the virtual item or Robux to your account.</li>
                  </ol>
                </div>

                {/* Direct External Link */}
                <a
                  href="https://www.roblox.com/redeem"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-98"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Open roblox.com/redeem</span>
                </a>
              </div>
            </div>
          )}

          {/* IN-GAME TRADE MANUAL FULFILLMENT MODE */}
          {!isLoading && !errorState && delivery?.delivery_mode === 'trade_item' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <User className="w-4 h-4" />
                    <span>In-Game Trade</span>
                  </div>
                  {order.status === 'delivered' || order.status === 'completed' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                      Trade Completed / Fulfilled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      Awaiting Admin Fulfillment
                    </span>
                  )}
                </div>

                {/* 1-Click Copy Order ID */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Your Order ID</span>
                    <p className="font-mono text-sm font-black text-white">{formatShortOrderId(order.order_number || order.id)}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(formatShortOrderId(order.order_number || order.id), 'order_id')}
                    className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    {copiedField === 'order_id' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copy Order ID</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                  <p className="text-xs font-bold text-white">Arrange In-Game Meeting:</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your payment is confirmed! Contact our trade admin on Telegram with your Order ID to coordinate meeting on our private server and receive your items.
                  </p>
                </div>

                <a
                  href={`https://t.me/uchirosupport?text=Hello%20Admin,%20Order%20${encodeURIComponent(formatShortOrderId(order.order_number || order.id))}%20(In-Game%20Trade)`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E63946] to-[#D90429] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#E63946]/20 hover:brightness-110 active:scale-98 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Contact Support (Order {formatShortOrderId(order.order_number || order.id)})</span>
                </a>
              </div>
            </div>
          )}

          {/* ROBLOX GIFT MANUAL FULFILLMENT MODE */}
          {!isLoading && !errorState && delivery?.delivery_mode === 'manual_service' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                    <Gift className="w-4 h-4" />
                    <span>Roblox Gift Delivery</span>
                  </div>
                  {order.status === 'delivered' || order.status === 'completed' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                      Gift Delivered / Fulfilled
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      Awaiting Admin Gift Delivery
                    </span>
                  )}
                </div>

                {/* Recipient Account Badge */}
                {order.roblox_username && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between text-xs text-cyan-300">
                    <span>Delivering to Verified Account:</span>
                    <span className="font-bold">@{order.roblox_username}</span>
                  </div>
                )}

                {/* 1-Click Copy Order ID */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Your Order ID</span>
                    <p className="font-mono text-sm font-black text-white">{formatShortOrderId(order.order_number || order.id)}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(formatShortOrderId(order.order_number || order.id), 'order_id')}
                    className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    {copiedField === 'order_id' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                        <span>Copy Order ID</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                  <p className="text-xs font-bold text-white">Gift Fulfillment in Progress:</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Payment verified! Our admin is sending this gift item directly to your verified Roblox account in-game. Once sent, this order status will update to "Gift Delivered / Fulfilled".
                  </p>
                </div>

                <a
                  href={`https://t.me/uchirosupport?text=Hello%20Admin,%20Order%20${encodeURIComponent(formatShortOrderId(order.order_number || order.id))}%20(Roblox%20Gift)`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 hover:brightness-110 active:scale-98 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Contact Support (Order {formatShortOrderId(order.order_number || order.id)})</span>
                </a>
              </div>
            </div>
          )}

          {/* STRICT ACCOUNT DELIVERY (SECTIONS D & E) */}
          {!isLoading && !errorState && delivery?.delivery_mode !== 'digital_code' && delivery?.delivery_mode !== 'trade_item' && delivery?.delivery_mode !== 'manual_service' && (
            <div className="space-y-4">
              {/* ================= SECTION 1: ACCOUNT (ALWAYS SHOWN) ================= */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 uppercase tracking-wider">
                  <User className="w-4 h-4 text-indigo-400" />
                  <span>Account Credentials</span>
                </div>

                {/* Username */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Username
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold text-white select-all">
                      {delivery?.username || 'PlayerAccount'}
                    </span>
                    <button
                      onClick={() => handleCopy(delivery?.username || '', 'username')}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all"
                      title="Copy Username"
                    >
                      {copiedField === 'username' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Password
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono font-bold text-white select-all">
                      {showPassword ? delivery?.password || '••••••••' : '••••••••••••'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all"
                        title={showPassword ? 'Hide Password' : 'Show Password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(delivery?.password || '', 'password')}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all"
                        title="Copy Password"
                      >
                        {copiedField === 'password' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================= SECTION 2: AUTHENTICATOR (ONLY WHEN ACCOUNT HAS 2FA) ================= */}
              {hasAuthenticator && delivery?.authenticator && (
                <div className="space-y-3.5 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 uppercase tracking-wider">
                    <KeyRound className="w-4 h-4 text-[#FFD166]" />
                    <span>Authenticator Setup & Live Code</span>
                  </div>

                  {/* 1. Authenticator App Setup Key (Full Manual Setup Key) */}
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Authenticator App Setup Key
                      </span>
                      <span className="text-[10px] text-[#FFD166] font-medium">
                        Manual Key
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-white tracking-wider select-all break-all">
                        {manualSetupKey || 'SETUP-KEY-UNAVAILABLE'}
                      </span>
                      <button
                        onClick={() => handleCopy(manualSetupKey, 'setup_key')}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-all flex-shrink-0"
                        title="Copy Setup Key"
                      >
                        {copiedField === 'setup_key' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Enter this key manually into Google Authenticator or Microsoft Authenticator if you cannot scan the QR code.
                    </p>
                  </div>

                  {/* 2. QR Code Container */}
                  {delivery.authenticator.qr && (
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                      <div className="p-2.5 rounded-xl bg-white shadow-lg shadow-black/40 inline-block">
                        <img
                          src={delivery.authenticator.qr}
                          alt="Authenticator QR Code"
                          className="w-36 h-36 rounded-lg object-contain"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Scan with Google Authenticator, Microsoft Authenticator, or 1Password
                      </span>
                    </div>
                  )}

                  {/* 3. [ Add to Authenticator ] Button */}
                  {delivery.authenticator.otpauth_url && (
                    <button
                      onClick={handleAddToAuthenticator}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 active:scale-98"
                    >
                      <QrCode className="w-4 h-4 text-white" />
                      <span>Add to Authenticator</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  )}

                  {/* 4. Live Authenticator Code Display Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121828] via-[#161F33] to-[#111624] border border-[#FFD166]/30 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                        Live Authenticator Code
                      </span>
                      <span className="text-[10px] text-[#FFD166] font-medium">
                        RFC 6238 Source of Truth
                      </span>
                    </div>

                    {/* 6-Digit Display */}
                    <div className="flex items-center justify-center bg-black/70 p-3.5 rounded-xl border border-white/10">
                      <span className="font-mono text-3xl sm:text-4xl font-black text-[#FFD166] tracking-widest select-all text-center">
                        {formattedCode}
                      </span>
                    </div>

                    {/* Expiry Countdown & Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span>
                          Refreshes in <b className="text-white">{secondsRemaining}s</b>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Automatic sync
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-1000 rounded-full ${
                            secondsRemaining < 6
                              ? 'bg-rose-500'
                              : 'bg-gradient-to-r from-[#FFD166] to-emerald-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* TOTP Error / Retry */}
                    {totpError && (
                      <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                        <span className="text-[11px] font-medium">{totpError}</span>
                        <button
                          onClick={() => refreshTotp(false)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[10px] font-bold"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* [ Copy Code ] & [ Refresh Code ] Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleCopy(totpCode, 'code')}
                        disabled={!totpCode || secondsRemaining <= 0}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-40"
                      >
                        {copiedField === 'code' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                        )}
                        <span>Copy Code</span>
                      </button>

                      <button
                        onClick={() => refreshTotp(false)}
                        disabled={isRefreshingTotp}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 text-[#FFD166] ${
                            isRefreshingTotp ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Warranty Badge Card */}
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-[11px] font-bold text-white block">
                      14-Day Replacement Warranty
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Active protection status
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                  Active
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Sections D, E, H) */}
        <div className="p-4 bg-black/60 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2">
            {onViewReceipt && (
              <button
                onClick={() => onViewReceipt(order)}
                className="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
              >
                <FileText className="w-3.5 h-3.5 text-[#FFD166]" />
                <span>View Receipt</span>
              </button>
            )}

            {/* Back to Home Button (Section H) */}
            <button
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  onClose();
                }
              }}
              className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-[#E63946] to-[#D90429] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#E63946]/20 hover:brightness-110 active:scale-98 transition-all"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
