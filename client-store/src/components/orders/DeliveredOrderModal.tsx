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
  Package,
  HelpCircle,
} from 'lucide-react';
import { Order, CustomerDeliveryResult, CustomerTotpResult } from '../../types';
import { StoreAPI } from '../../services/api';
import { formatShortOrderId } from '../../utils/order.util';
import { useLanguage } from '../../context/LanguageContext';

interface DeliveredOrderModalProps {
  order: Order | null;
  onClose: () => void;
  onBackToHome?: () => void;
  onBackToOrders?: () => void;
  onViewReceipt?: (order: Order) => void;
}

export const DeliveredOrderModal: React.FC<DeliveredOrderModalProps> = ({
  order,
  onClose,
  onBackToHome,
  onBackToOrders,
  onViewReceipt,
}) => {
  const { language } = useLanguage();
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
  const [showHowToLogin, setShowHowToLogin] = useState<boolean>(false);

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
                {language === 'km'
                  ? (order.delivery_mode === 'manual_service'
                      ? 'ការដឹកជញ្ជូនកាដូ Roblox'
                      : order.delivery_mode === 'trade_item'
                      ? 'ការដោះដូរក្នុងហ្គេម'
                      : order.delivery_mode === 'digital_code'
                      ? 'កូដឌីជីថលភ្លាមៗ'
                      : 'ឃ្លាំងដឹកជញ្ជូនសុវត្ថិភាព')
                  : (order.delivery_mode === 'manual_service'
                      ? 'Roblox Gift Delivery'
                      : order.delivery_mode === 'trade_item'
                      ? 'In-Game Trade'
                      : order.delivery_mode === 'digital_code'
                      ? 'Instant Digital Key'
                      : 'Secure Delivery Vault')}
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
              <span className="text-xs font-semibold">
                {language === 'km' ? 'កំពុងបើកឃ្លាំងដឹកជញ្ជូនសុវត្ថិភាព...' : 'Opening Secure Delivery Vault...'}
              </span>
            </div>
          )}

          {errorState && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="font-bold text-white text-sm">
                {language === 'km' ? 'មិនអាចទាញយកការដឹកជញ្ជូនបានទេ' : 'Delivery Unavailable'}
              </h3>
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
                    <span>{language === 'km' ? 'កូដឌីជីថលភ្លាមៗ' : 'Instant Digital Key'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                    {language === 'km' ? 'សកម្ម & រួចរាល់សម្រាប់បញ្ចូល' : 'Active & Ready to Redeem'}
                  </span>
                </div>

                {/* Unused Key Display Box */}
                <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      {language === 'km' ? 'កូដសកម្មភាព / ប័ណ្ណ' : 'Activation Key / Voucher'}
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
                    {language === 'km' ? 'របៀបបញ្ចូលកូដឌីជីថលរបស់អ្នក៖' : 'How to Redeem Your Digital Key:'}
                  </span>
                  <ol className="text-[11px] text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
                    <li>
                      {language === 'km' ? 'ចូលទៅកាន់ទំព័រផ្លូវការ៖ ' : 'Visit the official redemption portal: '}
                      <span className="text-cyan-300 font-mono">roblox.com/redeem</span>
                    </li>
                    <li>{language === 'km' ? 'ចូលគណនី Roblox របស់អ្នកប្រសិនបើទាមទារ។' : 'Sign in to your Roblox account if prompted.'}</li>
                    <li>{language === 'km' ? 'បិទភ្ជាប់កូដដែលបានចម្លងទៅក្នុងប្រអប់បញ្ចូលកូដ។' : 'Paste your copied key into the code input field.'}</li>
                    <li>{language === 'km' ? 'ចុច Redeem ដើម្បីបញ្ចូលទំនិញ ឬ Robux ទៅក្នុងគណនីរបស់អ្នក។' : 'Click Redeem to credit the virtual item or Robux to your account.'}</li>
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
                    <span>{language === 'km' ? 'ការដោះដូរក្នុងហ្គេម' : 'In-Game Trade'}</span>
                  </div>
                  {order.status === 'delivered' || order.status === 'completed' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                      {language === 'km' ? 'ការដោះដូរបានសម្រេច' : 'Trade Completed / Fulfilled'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      {language === 'km' ? 'រង់ចាំការដោះដូរក្នុងហ្គេម' : 'Awaiting Admin Fulfillment'}
                    </span>
                  )}
                </div>

                {/* 1-Click Copy Order ID */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      {language === 'km' ? 'លេខសម្គាល់ការបញ្ជាទិញរបស់អ្នក' : 'Your Order ID'}
                    </span>
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
                  <p className="text-xs font-bold text-white">
                    {language === 'km' ? 'រៀបចំការជួបគ្នាក្នុងហ្គេម៖' : 'Arrange In-Game Meeting:'}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {language === 'km'
                      ? 'ការទូទាត់របស់អ្នកត្រូវបានបញ្ជាក់! សូមទាក់ទងផ្នែករដ្ឋបាលពាណិជ្ជកម្មរបស់យើងតាម Telegram ជាមួយលេខសម្គាល់ការបញ្ជាទិញរបស់អ្នក ដើម្បីណាត់ជួបគ្នាក្នុង server ឯកជន និងទទួលទំនិញរបស់អ្នក។'
                      : 'Your payment is confirmed! Contact our trade admin on Telegram with your Order ID to coordinate meeting on our private server and receive your items.'}
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
                    <span>{language === 'km' ? 'ការដឹកជញ្ជូនកាដូ Roblox' : 'Roblox Gift Delivery'}</span>
                  </div>
                  {order.status === 'delivered' || order.status === 'completed' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                      {language === 'km' ? 'កាដូត្រូវបានដឹកជញ្ជូនរួចរាល់' : 'Gift Delivered / Fulfilled'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                      {language === 'km' ? 'កំពុងដំណើរការដឹកជញ្ជូនកាដូ' : 'Awaiting Admin Gift Delivery'}
                    </span>
                  )}
                </div>

                {/* Recipient Account Badge */}
                {order.roblox_username && (
                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-between text-xs text-cyan-300">
                    <span>{language === 'km' ? 'គណនី Roblox ទទួលទំនិញ៖' : 'Delivering to Verified Account:'}</span>
                    <span className="font-bold">@{order.roblox_username}</span>
                  </div>
                )}

                {/* 1-Click Copy Order ID */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      {language === 'km' ? 'លេខសម្គាល់ការបញ្ជាទិញរបស់អ្នក' : 'Your Order ID'}
                    </span>
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
                  <p className="text-xs font-bold text-white">
                    {language === 'km' ? 'ការដឹកជញ្ជូនកាដូក្នុងហ្គេម Roblox៖' : 'Gift Fulfillment in Progress:'}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {language === 'km'
                      ? 'ការទូទាត់ត្រូវបានផ្ទៀងផ្ទាត់! រដ្ឋបាលរបស់យើងកំពុងផ្ញើកាដូនេះទៅកាន់គណនី Roblox ដែលបានផ្ទៀងផ្ទាត់របស់អ្នកក្នុងហ្គេម។ នៅពេលផ្ញើរួច ស្ថានភាពនឹងប្តូរទៅជា "កាដូត្រូវបានដឹកជញ្ជូនរួចរាល់"។'
                      : 'Payment verified! Our admin is sending this gift item directly to your verified Roblox account in-game. Once sent, this order status will update to "Gift Delivered / Fulfilled".'}
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
                  <span>{language === 'km' ? 'ព័ត៌មានគណនី' : 'Account Credentials'}</span>
                </div>

                {/* Username */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    {language === 'km' ? 'ឈ្មោះគណនី' : 'Username'}
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
                    {language === 'km' ? 'ពាក្យសម្ងាត់' : 'Password'}
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-300 uppercase tracking-wider">
                      <KeyRound className="w-4 h-4 text-[#FFD166]" />
                      <span>{language === 'km' ? 'ការផ្ទៀងផ្ទាត់ 2FA & កូដផ្ទាល់' : 'Authenticator Setup & Live Code'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHowToLogin(!showHowToLogin)}
                      className="py-1 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition-all"
                    >
                      <HelpCircle className="w-3 h-3 text-amber-400" />
                      <span>How to Login with 2FA</span>
                    </button>
                  </div>

                  {showHowToLogin && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 animate-fadeIn">
                      <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{language === 'km' ? 'របៀបចូលប្រើគណនីមាន 2FA' : 'How to Login with 2FA'}</span>
                      </h4>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-200 text-[11px] leading-relaxed">
                        <li>
                          {language === 'km'
                            ? 'បើកកម្មវិធី ឬគេហទំព័រ Roblox រួចបញ្ចូល Username និង Password ខាងលើ។'
                            : 'Open Roblox and enter the Username and Password shown above.'}
                        </li>
                        <li>
                          {language === 'km'
                            ? 'នៅពេល Roblox សួររកកូដ 2-Step Verification សូមចម្លងកូដ ៦ ខ្ទង់ផ្ទាល់ (Live 2FA Code) ពីប្រអប់ខាងលើ។'
                            : 'When Roblox prompts for 2-step verification, copy the Live 6-digit Authenticator Code above.'}
                        </li>
                        <li>
                          {language === 'km'
                            ? 'បិទភ្ជាប់កូដ ៦ ខ្ទង់ រួចចុច Verify ដើម្បីចូលគណនីភ្លាមៗ។'
                            : 'Paste the 6-digit code and click Verify to complete login.'}
                        </li>
                        <li>
                          {language === 'km'
                            ? 'អ្នកក៏អាចស្កេន QR ឬចម្លង Setup Key ចូល Google Authenticator ដើម្បីទទួលបានកូដរាល់ពេលចូល។'
                            : 'You can also scan the QR or copy the Setup Key into Google Authenticator for future logins.'}
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* 1. Authenticator App Setup Key (Full Manual Setup Key) */}
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        {language === 'km' ? 'កូដដំឡើង Authenticator App' : 'Authenticator App Setup Key'}
                      </span>
                      <span className="text-[10px] text-[#FFD166] font-medium">
                        {language === 'km' ? 'កូដដោយដៃ' : 'Manual Key'}
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
                      {language === 'km'
                        ? 'បញ្ចូលកូដនេះដោយផ្ទាល់ក្នុងកម្មវិធី Google Authenticator ឬ 2FAS ប្រសិនបើអ្នកមិនអាចស្កេន QR កូដបានទេ។'
                        : 'Enter this key manually into Google Authenticator or Microsoft Authenticator if you cannot scan the QR code.'}
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
                        {language === 'km'
                          ? 'ស្កេនជាមួយ Google Authenticator, 2FAS ឬ Microsoft Authenticator'
                          : 'Scan with Google Authenticator, Microsoft Authenticator, or 1Password'}
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
                        {language === 'km' ? 'កូដផ្ទៀងផ្ទាត់ផ្ទាល់ (Live 2FA)' : 'Live Authenticator Code'}
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
                          {language === 'km' ? 'ប្តូរកូដថ្មីក្នុងរយៈពេល' : 'Refreshes in'} <b className="text-white">{secondsRemaining}s</b>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {language === 'km' ? 'សមកាលកម្មស្វ័យប្រវត្តិ' : 'Automatic sync'}
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
                      {language === 'km' ? 'ការធានាប្តូរជូនវិញក្នុងរយៈពេល ១៤ ថ្ងៃ' : '14-Day Replacement Warranty'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {language === 'km' ? 'ស្ថានភាពការពារកំពុងដំណើរការ' : 'Active protection status'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                  {language === 'km' ? 'សកម្ម' : 'Active'}
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
                type="button"
                onClick={() => onViewReceipt(order)}
                className="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#FFD166]" />
                <span>View Receipt</span>
              </button>
            )}

            {onBackToOrders && (
              <button
                type="button"
                onClick={onBackToOrders}
                className="flex-1 py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-emerald-400" />
                <span>Back to Order</span>
              </button>
            )}

            {/* Back to Home Button (Section H) */}
            <button
              type="button"
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  onClose();
                }
              }}
              className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-[#E63946] to-[#D90429] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#E63946]/20 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
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
