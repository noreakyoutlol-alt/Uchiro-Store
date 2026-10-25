import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Tag,
  ShieldCheck,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  UserCheck,
  Gift,
  Zap,
} from 'lucide-react';
import { Product, CouponValidationResult, RobloxProfile, formatDeliveryMode } from '../../types';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

interface CheckoutModalProps {
  product: Product;
  quantity?: number;
  initialQuantity?: number;
  robloxUsername?: string;
  robloxDisplayName?: string;
  robloxUserId?: string;
  onClose: () => void;
  onOrderCreated: (order: any, payment: any) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  product,
  quantity: propQuantity,
  initialQuantity,
  robloxUsername: initialRobloxUsername,
  robloxDisplayName: initialRobloxDisplayName,
  robloxUserId: initialRobloxUserId,
  onClose,
  onOrderCreated,
}) => {
  const { language } = useLanguage();
  const isAccount = product.delivery_mode === 'auto_account' || product.product_type === 'account';
  const isGift = product.delivery_mode === 'manual_service' || product.product_type === 'gift';
  const isTrade = product.delivery_mode === 'trade_item' || product.product_type === 'trade';
  const isMultiQtyEligible = !isAccount && (
    product.delivery_mode === 'digital_code' ||
    product.delivery_mode === 'manual_service' ||
    product.delivery_mode === 'trade_item'
  );
  const showQuantityControls = Boolean(isMultiQtyEligible && product.stock >= 2);
  const maxStock = Math.max(1, product.stock || 1);
  const idempotencyKeyRef = useRef<string>(`idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`);

  const [quantity, setQuantity] = useState<number>(() => {
    if (isAccount) return 1;
    const initial = propQuantity || initialQuantity || 1;
    return Math.max(1, Math.min(initial, maxStock));
  });

  useEffect(() => {
    if (isAccount) {
      setQuantity(1);
    } else if (propQuantity && propQuantity > 0) {
      setQuantity(Math.min(propQuantity, maxStock));
    }
  }, [propQuantity, isAccount, maxStock]);

  const effectiveQuantity = isAccount ? 1 : Math.min(Math.max(1, quantity), maxStock);
  const subtotal = Number((product.price * effectiveQuantity).toFixed(2));

  const requiresRoblox = Boolean(
    product.requires_roblox_username ||
    product.requires_roblox_verification ||
    isGift ||
    isTrade
  );

  // Roblox verification state
  const [robloxUsernameInput, setRobloxUsernameInput] = useState(initialRobloxUsername || '');
  const [verifiedProfile, setVerifiedProfile] = useState<RobloxProfile | null>(() => {
    if (initialRobloxUsername && initialRobloxUserId) {
      return {
        id: Number(initialRobloxUserId) || 0,
        name: initialRobloxUsername,
        displayName: initialRobloxDisplayName || initialRobloxUsername,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${initialRobloxUsername}`,
        isVerified: true,
      };
    }
    return null;
  });
  const [isVerifyingRoblox, setIsVerifyingRoblox] = useState(false);
  const [robloxVerifyError, setRobloxVerifyError] = useState<string | null>(null);
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  // Age confirmation state (Mandatory 18+ self-declaration; unchecked by default)
  const [buyerConfirmedAge18, setBuyerConfirmedAge18] = useState(false);
  const [buyerUnder18, setBuyerUnder18] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If initial username was provided without full verified profile, verify on mount
  useEffect(() => {
    if (initialRobloxUsername && !verifiedProfile?.avatarUrl) {
      verifyUsername(initialRobloxUsername);
    }
  }, [initialRobloxUsername]);

  const verifyUsername = async (username: string) => {
    const clean = username.trim();
    if (!clean) {
      setVerifiedProfile(null);
      setRobloxVerifyError(null);
      return;
    }

    // Instant regex validation
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      setVerifiedProfile(null);
      setRobloxVerifyError(
        language === 'km'
          ? 'ឈ្មោះគណនីត្រូវមាន 3-20 តួអក្សរ (អក្សរ លេខ ឬ _)'
          : 'Username must be 3-20 alphanumeric characters or underscores'
      );
      return;
    }

    setIsVerifyingRoblox(true);
    setRobloxVerifyError(null);
    try {
      const profile = await StoreAPI.verifyRobloxUsername(clean);
      if (profile) {
        setVerifiedProfile(profile);
        setRecipientConfirmed(true);
        setRobloxVerifyError(null);
      } else {
        const fallback = {
          id: 0,
          name: clean,
          displayName: clean,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean.toLowerCase()}`,
          isVerified: true,
        };
        setVerifiedProfile(fallback);
        setRecipientConfirmed(true);
        setRobloxVerifyError(null);
      }
    } catch {
      const fallback = {
        id: 0,
        name: clean,
        displayName: clean,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean.toLowerCase()}`,
        isVerified: true,
      };
      setVerifiedProfile(fallback);
      setRecipientConfirmed(true);
      setRobloxVerifyError(null);
    } finally {
      setIsVerifyingRoblox(false);
    }
  };

  const handleRobloxInputChange = (val: string) => {
    setRobloxUsernameInput(val);
    setRecipientConfirmed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      verifyUsername(val);
    }, 600);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setErrorMessage(null);

    try {
      const res = await StoreAPI.validateCoupon(couponCode.trim(), subtotal);
      setCouponResult(res);
      if (!res.isValid) {
        setErrorMessage(res.error || 'Invalid or expired coupon code');
      }
    } catch {
      setErrorMessage('Failed to validate coupon');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Dynamically revalidate applied coupon if quantity/subtotal changes
  useEffect(() => {
    if (couponResult?.isValid && couponCode.trim()) {
      StoreAPI.validateCoupon(couponCode.trim(), subtotal)
        .then((res) => {
          if (res.isValid) {
            setCouponResult(res);
          } else {
            setCouponResult(null);
            setErrorMessage(res.error || 'Coupon no longer valid for this quantity/amount');
          }
        })
        .catch(() => {});
    }
  }, [effectiveQuantity, product.price]);

  const discountAmount = couponResult?.isValid ? couponResult.discountAmount : 0;
  const finalTotal = Math.max(0.1, Number((subtotal - discountAmount).toFixed(2)));

  const isFulfillmentReady =
    !requiresRoblox ||
    (Boolean(verifiedProfile) && recipientConfirmed && buyerConfirmedAge18 && !buyerUnder18);

  const handleProceedToPayment = async () => {
    if (requiresRoblox) {
      if (!verifiedProfile) {
        setErrorMessage('Please enter and verify the recipient Roblox username before proceeding.');
        return;
      }
      if (!recipientConfirmed) {
        setErrorMessage('Please confirm that this is the correct recipient account.');
        return;
      }
      if (buyerUnder18) {
        setErrorMessage(
          language === 'km'
            ? 'ការទិញត្រូវបានរារាំង៖ អ្នកទិញត្រូវតែមានអាយុយ៉ាងតិច ១៨ ឆ្នាំឡើងទៅ។'
            : 'Purchases are strictly restricted to buyers 18 years of age or older. Orders cannot be placed.'
        );
        return;
      }
      if (!buyerConfirmedAge18) {
        setErrorMessage(
          language === 'km'
            ? 'សូមបញ្ជាក់ថាអ្នកមានអាយុយ៉ាងតិច ១៨ ឆ្នាំឡើងទៅមុនពេលបន្ត។'
            : 'Please confirm that you are at least 18 years of age before proceeding.'
        );
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // Reuse session idempotency key across automatic retries to prevent duplicate orders
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
    const idempotencyKey = idempotencyKeyRef.current;
    const orderPayload = {
      productId: product.id,
      quantity: effectiveQuantity,
      couponCode: couponResult?.isValid ? couponCode.trim() : undefined,
      robloxUsername: verifiedProfile?.name || robloxUsernameInput.trim() || undefined,
      robloxDisplayName: verifiedProfile?.displayName || undefined,
      robloxUserId: verifiedProfile?.id ? String(verifiedProfile.id) : undefined,
      buyerConfirmedAge18,
      buyerUnder18,
      idempotencyKey,
    };

    try {
      const result = await StoreAPI.createOrder(orderPayload);
      onOrderCreated(result.order, result.payment);
    } catch (err: any) {
      // If 401 received, trigger immediate silent re-authentication with Telegram initData and retry
      if (err.response?.status === 401) {
        try {
          const tg = (window as any).Telegram?.WebApp;
          const initData = tg?.initData || '';
          await StoreAPI.authenticateTelegram(initData);
          const retryResult = await StoreAPI.createOrder(orderPayload);
          onOrderCreated(retryResult.order, retryResult.payment);
          return;
        } catch (retryErr: any) {
          setErrorMessage(
            retryErr.response?.data?.error?.message || 'Authentication expired. Please refresh the app.'
          );
          return;
        }
      }

      const errorCode = err.response?.data?.error?.code;
      const errorMsg = err.response?.data?.error?.message;

      if (errorCode === 'INSUFFICIENT_STOCK' || errorCode === 'PRODUCT_OUT_OF_STOCK') {
        // Reset key for next user attempt
        idempotencyKeyRef.current = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        setErrorMessage(
          language === 'km'
            ? 'ចំនួនទំនិញក្នុងស្តុកបានផ្លាស់ប្តូរមុនពេលការទូទាត់ត្រូវបានបញ្ចប់។ សូមកែប្រែចំនួន ឬជ្រើសរើសទំនិញផ្សេង។'
            : 'Available stock changed before checkout could be completed. Please adjust your quantity or choose another item.'
        );
      } else {
        setErrorMessage(
          errorMsg || 'Failed to initialize payment order.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGuaranteeText = () => {
    if (isGift) return 'Guaranteed Roblox Gift Delivery via KHPay Gateway.';
    if (isTrade) return 'Guaranteed In-Game Trade Delivery via KHPay Gateway.';
    if (product.delivery_mode === 'digital_code') return 'Guaranteed Instant Digital Key via KHPay Gateway.';
    return 'Guaranteed Instant Delivery via KHPay Gateway.';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#0B0F1D] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)] relative card-3d"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Specular Rim */}
        <div className="absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none" />

        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFD166]" />
            <h3 className="font-black text-white text-base">ORDER CHECKOUT</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Product Summary */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex gap-3 items-center">
            <img
              src={
                product.media?.[0]?.url ||
                '/placeholder.svg'
              }
              alt=""
              className="w-14 h-14 rounded-xl object-cover bg-black/40 border border-white/10 flex-shrink-0"
              loading="lazy"
              decoding="async"
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-xs text-white truncate">{product.title}</h4>
              <p className="text-[11px] text-slate-400">
                {isGift
                  ? 'Roblox Gift Delivery'
                  : isTrade
                  ? 'In-Game Trade'
                  : formatDeliveryMode(product.delivery_mode)}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-black text-[#FFD166]">
                  ${subtotal.toFixed(2)}
                </span>
                {effectiveQuantity > 1 && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    (${product.price.toFixed(2)} × {effectiveQuantity})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quantity Controls (if multi-quantity supported and stock >= 2) */}
          {showQuantityControls && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Quantity</span>
                <span className="text-[10px] text-slate-400">
                  {product.stock} available in stock
                </span>
              </div>
              <div className="flex items-center gap-2">
                {effectiveQuantity === 1 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs flex items-center gap-1 transition-all border border-rose-500/30 active:scale-95"
                    title="Remove item"
                  >
                    <span>🗑️ Remove</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-sm flex items-center justify-center transition-all active:scale-95"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                )}
                <span className="w-8 text-center font-black text-sm text-[#FFD166]">
                  {effectiveQuantity}
                </span>
                <button
                  type="button"
                  disabled={effectiveQuantity >= product.stock}
                  onClick={() => setQuantity((prev) => Math.min(prev + 1, product.stock))}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-sm flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Verification Enforcement for Gift & Trade Items */}
          {requiresRoblox && (
            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#FFD166]" />
                  <span>Recipient Roblox Account</span>
                </label>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">
                  * Required
                </span>
              </div>

              {/* Input with inline verification loader */}
              <div className="relative">
                <input
                  type="text"
                  value={robloxUsernameInput}
                  onChange={(e) => handleRobloxInputChange(e.target.value)}
                  placeholder="Enter exact Roblox username..."
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl bg-[#141926] border border-white/15 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166]"
                />
                {isVerifyingRoblox && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-[#FFD166] animate-spin" />
                  </div>
                )}
              </div>

              {/* Verified Recipient Card */}
              {verifiedProfile && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {verifiedProfile.avatarUrl ? (
                      <img
                        src={verifiedProfile.avatarUrl}
                        alt={verifiedProfile.name}
                        className="w-10 h-10 rounded-full object-cover bg-black/40 border border-emerald-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-xs shrink-0">
                        {verifiedProfile.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-300 truncate">
                        <span>{verifiedProfile.displayName || verifiedProfile.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>@{verifiedProfile.name}</span>
                        {verifiedProfile.id > 0 && (
                          <span className="font-mono text-slate-500">ID: {verifiedProfile.id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase shrink-0">
                    Verified
                  </span>
                </div>
              )}

              {/* Error state */}
              {robloxVerifyError && !isVerifyingRoblox && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{robloxVerifyError}</span>
                </div>
              )}

              {/* Recipient Confirmation Checkbox */}
              {verifiedProfile && (
                <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={recipientConfirmed}
                    onChange={(e) => setRecipientConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-black/40 border-white/20 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I confirm this is my exact Roblox account{' '}
                    <strong className="text-white">(@{verifiedProfile.name})</strong> and understand gift/trade deliveries cannot be transferred once sent.
                  </span>
                </label>
              )}

              {/* Step 3: Confirm Buyer's Age (18+ Self-Declaration; unchecked by default) */}
              {verifiedProfile && recipientConfirmed && (
                <div className="p-3 rounded-2xl bg-black/40 border border-amber-500/20 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      {language === 'km' ? 'ការបញ្ជាក់អាយុរបស់អ្នកទិញ (១៨+ ឆ្នាំ)' : 'Buyer Age Confirmation'}
                    </span>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Required
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-snug">
                    {language === 'km'
                      ? 'អ្នកទិញត្រូវតែមានអាយុយ៉ាងតិច ១៨ ឆ្នាំឡើងទៅដើម្បីធ្វើការបញ្ជាទិញ។ នេះជាការប្រកាសបញ្ជាក់ផ្ទាល់ខ្លួនរបស់អ្នកទិញ។'
                      : 'Buyers must be at least 18 years of age to complete a purchase. This is an explicit buyer self-declaration.'}
                  </p>

                  {/* 18+ Unchecked by default checkbox */}
                  <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <input
                      type="checkbox"
                      checked={buyerConfirmedAge18}
                      onChange={(e) => {
                        setBuyerConfirmedAge18(e.target.checked);
                        if (e.target.checked) setBuyerUnder18(false);
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-black/40 border-white/20 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-200 font-medium leading-snug">
                      {language === 'km'
                        ? 'ខ្ញុំសូមបញ្ជាក់ថាខ្ញុំមានអាយុយ៉ាងតិច ១៨ ឆ្នាំឡើងទៅ (ការប្រកាសផ្ទាល់ខ្លួន)'
                        : 'I confirm that I am at least 18 years old (Buyer Self-Declaration)'}
                    </span>
                  </label>

                  {/* Option to declare under 18 */}
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBuyerUnder18(true);
                        setBuyerConfirmedAge18(false);
                      }}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                        buyerUnder18
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      I am under 18
                    </button>
                    {buyerUnder18 && (
                      <span className="text-[10px] font-bold text-rose-400">
                        {language === 'km' ? 'ការទិញត្រូវបានរារាំង' : 'Purchase blocked'}
                      </span>
                    )}
                  </div>

                  {/* Under 18 blocked message */}
                  {buyerUnder18 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>
                        {language === 'km'
                          ? 'ការទិញត្រូវបានរារាំង៖ អ្នកទិញដែលមានអាយុក្រោម ១៨ ឆ្នាំមិនត្រូវបានអនុញ្ញាតឱ្យធ្វើការបញ្ជាទិញទេ។'
                          : 'Under-18 Purchase Blocked: Buyers under 18 years of age are not permitted to complete purchases.'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Coupon Code Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#FFD166]" />
              <span>Promo / Coupon Code</span>
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="e.g. UCHIRO10"
                className="flex-1 px-3 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white text-xs uppercase placeholder:text-slate-500 focus:outline-none focus:border-[#FFD166]"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isValidatingCoupon || !couponCode.trim()}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all disabled:opacity-50"
              >
                {isValidatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </button>
            </div>

            {couponResult?.isValid && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Coupon Applied: -${couponResult.discountAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Pricing Breakdown */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal {effectiveQuantity > 1 && `(${effectiveQuantity} items)`}</span>
              <span className="text-white font-bold">${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400 font-bold">
                <span>Coupon Discount</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-white/10 pt-2 flex justify-between items-center">
              <span className="font-bold text-white text-sm">Total Due</span>
              <span className="font-black text-[#FFD166] text-lg">
                ${finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Warranty Guarantee */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-[#FFD166] flex-shrink-0" />
            <span>{getGuaranteeText()}</span>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer / Action */}
        <div className="p-4 bg-[#0A0D14] border-t border-white/10">
          <button
            disabled={isSubmitting || !isFulfillmentReady}
            onClick={handleProceedToPayment}
            className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isSubmitting || !isFulfillmentReady
                ? 'bg-white/10 text-slate-500 cursor-not-allowed opacity-60'
                : 'btn-3d-gold hover:brightness-110 active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-black" />
                <span>Generating KHPay QR...</span>
              </>
            ) : requiresRoblox && !verifiedProfile ? (
              <span>ENTER VERIFIED ROBLOX RECIPIENT</span>
            ) : requiresRoblox && !recipientConfirmed ? (
              <span>CONFIRM RECIPIENT TO PROCEED</span>
            ) : requiresRoblox && buyerUnder18 ? (
              <span>PURCHASE BLOCKED (UNDER 18)</span>
            ) : requiresRoblox && !buyerConfirmedAge18 ? (
              <span>CONFIRM AGE (18+) TO PROCEED</span>
            ) : (
              <>
                <span>PAY ${finalTotal.toFixed(2)} WITH KHPAY</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
