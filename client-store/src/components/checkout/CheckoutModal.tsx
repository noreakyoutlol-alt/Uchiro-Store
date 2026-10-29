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
  Package,
  HelpCircle,
  Check,
} from 'lucide-react';

export const ROBUX_PACKAGES = [
  { amount: 100, price: 0.35 },
  { amount: 200, price: 0.70 },
  { amount: 400, price: 1.40 },
  { amount: 500, price: 1.75 },
  { amount: 800, price: 2.80 },
  { amount: 1000, price: 3.50, isPopular: true },
  { amount: 1700, price: 5.95 },
  { amount: 2000, price: 7.00 },
  { amount: 4500, price: 15.75 },
  { amount: 10000, price: 35.00 },
];
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
  const isRobux = product.delivery_mode === 'robux' || (product as any).product_type === 'robux' || product.category_id === 'robux';
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

  const [selectedRobuxAmount, setSelectedRobuxAmount] = useState<number>(1000);
  const [buyerConfirmedAge18, setBuyerConfirmedAge18] = useState<boolean>(false);
  const [buyerUnder18, setBuyerUnder18] = useState<boolean>(false);
  const [showHowToLogin2FA, setShowHowToLogin2FA] = useState<boolean>(false);

  const effectiveQuantity = isAccount ? 1 : Math.min(Math.max(1, quantity), maxStock);
  const selectedRobuxPackage = isRobux
    ? ROBUX_PACKAGES.find((p) => p.amount === selectedRobuxAmount) || ROBUX_PACKAGES[0]
    : null;
  const currentItemPrice = isRobux && selectedRobuxPackage ? selectedRobuxPackage.price : product.price;
  const subtotal = Number((currentItemPrice * effectiveQuantity).toFixed(2));

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
  // Robux checkout step: 'confirm_account' -> 'packages_and_age' -> 'final_payment'
  const [robuxReviewStep, setRobuxReviewStep] = useState<'confirm_account' | 'packages_and_age' | 'final_payment'>('confirm_account');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to verify Roblox account eligibility for Robux:
  // Roblox Kids, Roblox Select, and Unchecked / not age-verified accounts must not purchase Robux.
  const checkRobuxEligibility = (profile: RobloxProfile | null): { eligible: boolean; reason?: string } => {
    if (!profile) return { eligible: false, reason: 'Profile not found' };
    const lower = profile.name.toLowerCase();
    if (profile.accountType === 'kids' || lower.includes('kids')) {
      return { eligible: false, reason: 'Roblox Kids accounts are not eligible to purchase Robux.' };
    }
    if (profile.accountType === 'select' || lower.includes('select')) {
      return { eligible: false, reason: 'Roblox Select accounts are not eligible to purchase Robux.' };
    }
    if (profile.accountType === 'unverified' || profile.isAgeVerified === false || lower.includes('unverified') || lower.includes('not_age_verified')) {
      return { eligible: false, reason: 'Unchecked / not age-verified accounts are not eligible to purchase Robux.' };
    }
    return { eligible: true };
  };

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
        setRecipientConfirmed(false); // The required checkbox starts unchecked
        setRobloxVerifyError(null);
      } else {
        const fallback: RobloxProfile = {
          id: 0,
          name: clean,
          displayName: clean,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean.toLowerCase()}`,
          isVerified: true,
          accountType: isRobux ? 'unverified' : 'standard',
          isAgeVerified: !isRobux,
          isEligible: !isRobux,
          ineligibilityReason: isRobux
            ? 'Unchecked / not age-verified accounts are not eligible to purchase Robux.'
            : undefined,
        };
        setVerifiedProfile(fallback);
        setRecipientConfirmed(false); // The required checkbox starts unchecked
        setRobloxVerifyError(null);
      }
    } catch {
      const fallback: RobloxProfile = {
        id: 0,
        name: clean,
        displayName: clean,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean.toLowerCase()}`,
        isVerified: true,
        accountType: isRobux ? 'unverified' : 'standard',
        isAgeVerified: !isRobux,
        isEligible: !isRobux,
        ineligibilityReason: isRobux
          ? 'Unchecked / not age-verified accounts are not eligible to purchase Robux.'
          : undefined,
      };
      setVerifiedProfile(fallback);
      setRecipientConfirmed(false); // The required checkbox starts unchecked
      setRobloxVerifyError(null);
    } finally {
      setIsVerifyingRoblox(false);
    }
  };

  const handleRobloxInputChange = (val: string) => {
    setRobloxUsernameInput(val);
    setRecipientConfirmed(false); // Starts unchecked
    setRobuxReviewStep('confirm_account');
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
    (Boolean(verifiedProfile) &&
      recipientConfirmed &&
      (!isRobux || (checkRobuxEligibility(verifiedProfile).eligible && buyerConfirmedAge18 && !buyerUnder18)));

  const handleConfirmRobuxAccount = () => {
    setErrorMessage(null);
    if (!verifiedProfile) {
      setErrorMessage(
        language === 'km'
          ? 'សូមបញ្ចូល និងផ្ទៀងផ្ទាត់ឈ្មោះគណនី Roblox ជាមុនសិន។'
          : 'Please enter and verify a Roblox recipient username.'
      );
      return;
    }
    const check = checkRobuxEligibility(verifiedProfile);
    if (!check.eligible) {
      setErrorMessage(
        check.reason ||
          (language === 'km'
            ? 'គណនីមិនមានសិទ្ធិ៖ គណនី Roblox Kids, Roblox Select និងគណនីមិនទាន់ផ្ទៀងផ្ទាត់អាយុ មិនអាចទិញ Robux បានទេ។'
            : 'Roblox account eligibility: Roblox Kids, Roblox Select, and unverified accounts cannot purchase Robux.')
      );
      return;
    }
    if (!recipientConfirmed) {
      setErrorMessage(
        language === 'km'
          ? 'សូមធីកប្រអប់បញ្ជាក់គណនីអ្នកទទួលជាមុនសិន។'
          : 'Please check the confirmation box to confirm this recipient account.'
      );
      return;
    }
    setRobuxReviewStep('packages_and_age');
  };

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
      if (isRobux) {
        const check = checkRobuxEligibility(verifiedProfile);
        if (!check.eligible) {
          setErrorMessage(
            check.reason ||
              'Roblox account eligibility: Roblox Kids, Roblox Select, and unverified accounts cannot purchase Robux.'
          );
          return;
        }
        if (buyerUnder18) {
          setErrorMessage(
            language === 'km'
              ? 'ការបញ្ជាទិញមិនត្រូវបានអនុញ្ញាតទេ៖ អ្នកទិញក្រោមអាយុ ១៨ ឆ្នាំមិនត្រូវបានអនុញ្ញាតឱ្យទិញ Robux ឡើយ។'
              : 'Buyers under 18 years of age are not permitted to complete Robux purchases.'
          );
          return;
        }
        if (!buyerConfirmedAge18) {
          setErrorMessage(
            language === 'km'
              ? 'សូមបញ្ជាក់ថាអ្នកមានអាយុចាប់ពី ១៨ ឆ្នាំឡើងទៅ ដើម្បីបន្តការទូទាត់។'
              : 'Please confirm that you are at least 18 years old to complete this purchase.'
          );
          return;
        }
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
      recipientConfirmed,
      confirmationChecked: recipientConfirmed,
      buyerConfirmedAge18: isRobux ? buyerConfirmedAge18 : undefined,
      buyerUnder18: isRobux ? buyerUnder18 : undefined,
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
            <h3 className="font-black text-white text-base">
              {isRobux && robuxReviewStep === 'final_payment'
                ? 'FINAL ORDER REVIEW'
                : isRobux
                ? 'ACCOUNT CONFIRMATION'
                : 'ORDER CHECKOUT'}
            </h3>
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
                {isRobux
                  ? (language === 'km' ? 'បញ្ចូល Robux ផ្ទាល់ទៅក្នុងគណនី' : 'Robux Top-Up Delivery')
                  : isGift
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
                    (${currentItemPrice.toFixed(2)} × {effectiveQuantity})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 2FA Login Assistance for Game Accounts */}
          {isAccount && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowHowToLogin2FA(!showHowToLogin2FA)}
                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>How to Login with 2FA</span>
              </button>

              {showHowToLogin2FA && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 animate-fadeIn">
                  <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{language === 'km' ? 'របៀបចូលប្រើគណនីមាន 2FA' : 'How to Login with 2FA'}</span>
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-200 text-[11px] leading-relaxed">
                    <li>
                      {language === 'km'
                        ? 'បើកកម្មវិធី ឬគេហទំព័រ Roblox រួចបញ្ចូល Username និង Password ដែលទទួលបានក្នុងឃ្លាំងដឹកជញ្ជូន។'
                        : 'Open Roblox and enter the Username and Password from your delivered vault.'}
                    </li>
                    <li>
                      {language === 'km'
                        ? 'នៅពេល Roblox សួររកកូដ 2-Step Verification សូមយកកូដ ៦ ខ្ទង់បន្តផ្ទាល់ (Live 2FA Code) ពីប្រអប់ដឹកជញ្ជូន។'
                        : 'When prompted for 2-step verification, copy the Live 6-digit Authenticator Code from your vault.'}
                    </li>
                    <li>
                      {language === 'km'
                        ? 'បិទភ្ជាប់កូដ ៦ ខ្ទង់ រួចចុច Verify ដើម្បីចូលគណនីដោយសុវត្ថិភាព។'
                        : 'Paste the 6-digit code and click Verify to complete login safely.'}
                    </li>
                    <li>
                      {language === 'km'
                        ? 'អ្នកក៏អាចស្កេន QR ឬចម្លង Setup Key ចូល Google Authenticator សម្រាប់ប្រើលើកក្រោយ។'
                        : 'You can also scan the QR or copy the Setup Key into Google Authenticator for future logins.'}
                    </li>
                  </ol>
                </div>
              )}
            </div>
          )}

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
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase shrink-0 ${
                    isRobux && !checkRobuxEligibility(verifiedProfile).eligible
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {isRobux
                      ? checkRobuxEligibility(verifiedProfile).eligible
                        ? 'Eligible (Age-Verified)'
                        : 'Ineligible'
                      : 'Verified'}
                  </span>
                </div>
              )}

              {/* Ineligible Notice for Robux */}
              {isRobux && verifiedProfile && !checkRobuxEligibility(verifiedProfile).eligible && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{checkRobuxEligibility(verifiedProfile).reason}</span>
                </div>
              )}

              {/* Error state */}
              {robloxVerifyError && !isVerifyingRoblox && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{robloxVerifyError}</span>
                </div>
              )}

              {/* Recipient Confirmation Checkbox — starts unchecked */}
              {verifiedProfile && (
                <label className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={recipientConfirmed}
                    onChange={(e) => setRecipientConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-black/40 border-white/20 cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    {isRobux ? (
                      <>
                        I confirm this is my exact recipient profile{' '}
                        <strong className="text-white">(@{verifiedProfile.name})</strong> for this Robux top-up. I understand that Robux top-ups are strictly non-refundable for incorrect usernames or unclaimable orders once processed, subject to applicable law.
                      </>
                    ) : (
                      <>
                        I confirm this is my exact recipient profile{' '}
                        <strong className="text-white">(@{verifiedProfile.name})</strong> and understand gift/trade deliveries cannot be transferred once sent.
                      </>
                    )}
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Robux Packages & Age Confirmation (Displayed when isRobux) */}
          {isRobux && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-black/40 border border-[#FFD166]/20 animate-fadeIn">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-white flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-[#FFD166]" />
                  <span>
                    {language === 'km' ? 'កញ្ចប់ Robux និងតម្លៃ' : 'Robux Packages & Prices'}
                  </span>
                </label>
                <span className="text-[10px] text-amber-400 font-bold">
                  $3.50 / 1,000 R$
                </span>
              </div>

              {/* Packages Grid */}
              <div className="grid grid-cols-2 gap-2">
                {ROBUX_PACKAGES.map((pkg) => {
                  const isSelected = selectedRobuxAmount === pkg.amount;
                  return (
                    <button
                      type="button"
                      key={pkg.amount}
                      onClick={() => setSelectedRobuxAmount(pkg.amount)}
                      className={`p-2.5 rounded-xl border text-left transition-all active:scale-[0.98] relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/20 border-[#FFD166] text-white shadow-[0_0_12px_rgba(255,209,102,0.25)]'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white">
                          {pkg.amount.toLocaleString()} R$
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-[#FFD166] shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] font-bold text-[#FFD166]">
                          ${pkg.price.toFixed(2)} USD
                        </span>
                        {pkg.isPopular && (
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-300 border border-amber-500/40">
                            HOT
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Robux Age Confirmation & Policy Block */}
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                <div className="space-y-1">
                  <span className="text-[11px] font-black text-white flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>{language === 'km' ? 'ការបញ្ជាក់អាយុ & គោលការណ៍' : 'Age Confirmation & Policy'}</span>
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {language === 'km'
                      ? 'ការបញ្ចូល Robux តម្រូវឱ្យមានការបញ្ជាក់អាយុ (១៨ ឆ្នាំឡើង)។ ការទិញមិនអាចបង្វិលប្រាក់វិញបានទេ ប្រសិនបើលោកអ្នកមិនអាចទទួលបាន ឬបញ្ចូលឈ្មោះខុស។'
                      : 'Robux top-up requires age confirmation (18+). Virtual currency is delivered directly to the username provided. Strictly NO REFUNDS if you cannot claim.'}
                  </p>
                </div>

                {/* Age Choice Checkboxes */}
                <div className="space-y-1.5">
                  <label className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    buyerConfirmedAge18 && !buyerUnder18
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}>
                    <input
                      type="checkbox"
                      checked={buyerConfirmedAge18 && !buyerUnder18}
                      onChange={(e) => {
                        setBuyerConfirmedAge18(e.target.checked);
                        if (e.target.checked) setBuyerUnder18(false);
                      }}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-500 focus:ring-0 bg-black/40 border-white/20 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-200 leading-snug">
                      <strong className="text-white">
                        {language === 'km' ? 'ខ្ញុំមានអាយុ ១៨ ឆ្នាំឡើងទៅ' : 'I am 18 years or older'}
                      </strong>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {language === 'km'
                          ? 'ខ្ញុំយល់ព្រមថានេះជាការទិញរូបិយប័ណ្ណនិម្មិត Roblox ហើយមិនអាចបង្វិលប្រាក់វិញបានឡើយ (No Refund)។'
                          : 'I acknowledge this is a virtual currency purchase and agree there are strictly NO REFUNDS once ordered.'}
                      </span>
                    </span>
                  </label>

                  <label className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                    buyerUnder18
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}>
                    <input
                      type="checkbox"
                      checked={buyerUnder18}
                      onChange={(e) => {
                        setBuyerUnder18(e.target.checked);
                        if (e.target.checked) setBuyerConfirmedAge18(false);
                      }}
                      className="w-4 h-4 rounded text-rose-500 focus:ring-0 bg-black/40 border-white/20 cursor-pointer"
                    />
                    <span className="text-[11px] text-rose-300">
                      {language === 'km' ? 'ខ្ញុំមានអាយុក្រោម ១៨ ឆ្នាំ (មិនអាចទិញបាន)' : 'I am under 18 years old (ineligible)'}
                    </span>
                  </label>
                </div>
              </div>
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
        <div className="p-4 bg-[#0A0D14] border-t border-white/10 space-y-2">
          {/* For Robux on the confirm_account step, show "Confirm Account" button, not the payment button */}
          {isRobux && robuxReviewStep === 'confirm_account' ? (
            <>
              <button
                type="button"
                disabled={!verifiedProfile || !recipientConfirmed || !checkRobuxEligibility(verifiedProfile).eligible}
                onClick={handleConfirmRobuxAccount}
                className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm text-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !verifiedProfile || !recipientConfirmed || !checkRobuxEligibility(verifiedProfile).eligible
                    ? 'bg-white/10 text-slate-500 cursor-not-allowed opacity-60'
                    : 'btn-3d-gold hover:brightness-110 active:scale-[0.98]'
                }`}
              >
                {!verifiedProfile ? (
                  <span>ENTER VERIFIED ROBLOX RECIPIENT</span>
                ) : !checkRobuxEligibility(verifiedProfile).eligible ? (
                  <span>ACCOUNT INELIGIBLE FOR ROBUX</span>
                ) : !recipientConfirmed ? (
                  <span>CHECK CONFIRMATION BOX TO CONFIRM</span>
                ) : (
                  <>
                    <span>CONFIRM ACCOUNT & SELECT AMOUNT</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                Back Home
              </button>
            </>
          ) : (
            <>
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
                ) : isRobux && verifiedProfile && !checkRobuxEligibility(verifiedProfile).eligible ? (
                  <span>ACCOUNT INELIGIBLE FOR ROBUX</span>
                ) : isRobux && buyerUnder18 ? (
                  <span>UNDER 18 CANNOT PURCHASE ROBUX</span>
                ) : isRobux && !buyerConfirmedAge18 ? (
                  <span>CONFIRM AGE 18+ TO PAY</span>
                ) : (
                  <>
                    <span>PAY ${finalTotal.toFixed(2)} WITH KHPAY</span>
                    <ArrowRight className="w-4 h-4 text-black" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl font-bold text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                Back Home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
