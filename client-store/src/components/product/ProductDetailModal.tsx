import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Video,
} from 'lucide-react';
import { Product, RobloxProfile } from '../../types';
import { StoreAPI } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { AppIcon } from '../common/AppIcon';

interface ProductDetailModalProps {
  product: Product | null;
  initialQuantity?: number;
  onClose: () => void;
  onProceedToCheckout: (
    product: Product,
    robloxUsername?: string,
    robloxDisplayName?: string,
    robloxUserId?: string,
    quantity?: number,
  ) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  initialQuantity = 1,
  onClose,
  onProceedToCheckout,
}) => {
  const { t } = useLanguage();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [robloxUsername, setRobloxUsername] = useState('');
  const [isVerifyingRoblox, setIsVerifyingRoblox] = useState(false);
  const [robloxProfile, setRobloxProfile] = useState<RobloxProfile | null>(null);
  const [isAccountConfirmed, setIsAccountConfirmed] = useState(false);
  const [robloxError, setRobloxError] = useState<string | null>(null);

  const isOutOfStock = !product || product.stock <= 0;
  const isAccount = product ? (product.delivery_mode === 'auto_account' || product.product_type === 'account') : false;
  const isGift = product ? (product.delivery_mode === 'manual_service' || product.product_type === 'gift') : false;
  const isTrade = product ? (product.delivery_mode === 'trade_item' || product.product_type === 'trade') : false;
  const isMultiQuantityEligible = !isAccount && Boolean(
    product &&
    (product.delivery_mode === 'digital_code' ||
      product.delivery_mode === 'manual_service' ||
      product.delivery_mode === 'trade_item')
  );
  const showQuantityStepper = Boolean(isMultiQuantityEligible && product && product.stock >= 2);

  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (product) {
      setSelectedImageIndex(0);
      setRobloxUsername('');
      setRobloxProfile(null);
      setIsAccountConfirmed(false);
      setRobloxError(null);
      setQuantity(isAccount ? 1 : Math.min(Math.max(1, initialQuantity || 1), Math.max(1, product.stock)));
    }
  }, [product, isAccount, initialQuantity]);

  if (!product) return null;

  const images = product.media && product.media.length > 0
    ? product.media.map((m) => m.url)
    : ['https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'];

  const handleVerifyRoblox = async (usernameToVerify: string) => {
    if (!usernameToVerify.trim()) {
      setRobloxProfile(null);
      setIsAccountConfirmed(false);
      setRobloxError(null);
      return;
    }

    setIsVerifyingRoblox(true);
    setRobloxError(null);
    setIsAccountConfirmed(false);

    try {
      const profile = await StoreAPI.verifyRobloxUsername(usernameToVerify.trim());
      if (profile) {
        setRobloxProfile(profile);
        setIsAccountConfirmed(false);
        setRobloxError(null);
      } else {
        setRobloxProfile(null);
        setIsAccountConfirmed(false);
        setRobloxError('Roblox user not found. Please double-check spelling.');
      }
    } catch {
      setRobloxProfile(null);
      setIsAccountConfirmed(false);
      setRobloxError('Could not verify username at this moment.');
    } finally {
      setIsVerifyingRoblox(false);
    }
  };

  const currentQuantity = isAccount ? 1 : Math.min(Math.max(1, quantity), Math.max(1, product.stock));
  const totalPrice = Number((product.price * currentQuantity).toFixed(2));
  const compareTotalPrice = product.compare_at_price ? Number((product.compare_at_price * currentQuantity).toFixed(2)) : null;

  const canProceed =
    !isOutOfStock &&
    (!product.requires_roblox_username || (Boolean(robloxProfile) && isAccountConfirmed && !robloxError));

  // Render Status Badge strictly per specification:
  // Account: available = "Instant Account Delivery", zero = "SOLD OUT"
  // Gift: available = "Roblox Gift Delivery", zero = "SOLD OUT"
  // Trade: available = "In-Game Trade", zero = "SOLD OUT"
  // Code: available = "Instant Digital Key", zero = "SOLD OUT"
  const renderStatus = () => {
    if (isOutOfStock) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 text-xs font-black tracking-wider uppercase">
          🔒 SOLD OUT
        </span>
      );
    }

    if (isAccount) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
          <span>⚡ Available • Instant Delivery</span>
        </span>
      );
    }

    if (isGift) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs font-bold">
          <span>🎁 Roblox Gift</span>
        </span>
      );
    }

    if (isTrade) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold">
          <span>🤝 In-Game Trade</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-xs font-bold">
        <span>🔑 Digital Code</span>
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] bg-white dark:bg-[#0F1320] border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl relative text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all backdrop-blur-sm"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Scrollable Container */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          {/* ========================================================= */}
          {/* FIRST VIEWPORT: IMAGE -> NAME -> PRICE -> STATUS -> WARRANTY -> BUY NOW */}
          {/* ========================================================= */}

          {/* 1. IMAGE */}
          <div className="space-y-2">
            <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100 dark:bg-[#181E30] border border-slate-200 dark:border-white/10 shadow-sm">
              <img
                src={images[selectedImageIndex] || images[0]}
                alt={product.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>

            {images.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {images.map((imgUrl, idx) => (
                  <button
                    type="button"
                    key={imgUrl}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      selectedImageIndex === idx
                        ? 'border-amber-400 dark:border-[#FFD166] scale-105'
                        : 'border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. PRODUCT NAME */}
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white leading-snug">
              {product.title}
            </h2>
          </div>

          {/* 3. PRICE */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              ${totalPrice.toFixed(2)}
            </span>
            {currentQuantity > 1 && (
              <span className="text-xs text-slate-400 font-medium">
                (${product.price.toFixed(2)} each)
              </span>
            )}
            {compareTotalPrice && compareTotalPrice > totalPrice && (
              <span className="text-xs sm:text-sm text-slate-400 line-through">
                ${compareTotalPrice.toFixed(2)}
              </span>
            )}
          </div>

          {/* 4. STATUS */}
          <div className="flex items-center gap-2">
            {renderStatus()}
          </div>

          {/* 5. WARRANTY */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-amber-500 dark:text-[#FFD166] shrink-0" />
            <span className="font-semibold">
              {product.warranty_days ? `${product.warranty_days}-Day Protection Warranty Included` : '14-Day Warranty Guarantee Included'}
            </span>
          </div>

          {/* Quantity Controls */}
          {showQuantityStepper && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 dark:text-white">Quantity</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {product.stock} available in stock
                </span>
              </div>
              <div className="flex items-center gap-2">
                {currentQuantity === 1 ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-1 transition-all border border-rose-500/20 active:scale-95"
                    title="Remove item"
                  >
                    <span>🗑️ Remove</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition-all active:scale-95"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                )}
                <span className="w-8 text-center font-black text-sm text-slate-900 dark:text-[#FFD166]">
                  {currentQuantity}
                </span>
                <button
                  type="button"
                  disabled={currentQuantity >= product.stock}
                  onClick={() => setQuantity((prev) => Math.min(prev + 1, product.stock))}
                  className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white font-black text-sm flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Roblox Verification (if required for trade or gift) */}
          {product.requires_roblox_username && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-[#181E30] border border-amber-300 dark:border-amber-500/30 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Roblox Username Verification Required</span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={robloxUsername}
                  onChange={(e) => {
                    setRobloxUsername(e.target.value);
                    handleVerifyRoblox(e.target.value);
                  }}
                  placeholder="Enter your exact Roblox username..."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black/50 border border-slate-300 dark:border-white/20 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                />
                {isVerifyingRoblox && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="w-4 h-4 text-amber-500 dark:text-[#FFD166] animate-spin" />
                  </div>
                )}
              </div>

              {robloxProfile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                    {robloxProfile.avatarUrl && (
                      <img
                        src={robloxProfile.avatarUrl}
                        alt={robloxProfile.name}
                        className="w-8 h-8 rounded-full bg-slate-200 object-cover border border-emerald-500/40"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 truncate">
                        <span>{robloxProfile.displayName || robloxProfile.name}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>@{robloxProfile.name}</span>
                        <span>•</span>
                        <span>ID: {robloxProfile.id}</span>
                      </div>
                    </div>
                  </div>

                  {!isAccountConfirmed ? (
                    <button
                      type="button"
                      onClick={() => setIsAccountConfirmed(true)}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4 text-black" />
                      <span>Confirm This Account</span>
                    </button>
                  ) : (
                    <div className="flex items-center justify-between px-1 text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Account Confirmed for Delivery
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAccountConfirmed(false)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Change Account
                      </button>
                    </div>
                  )}
                </div>
              )}

              {robloxError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  {robloxError}
                </p>
              )}
            </div>
          )}

          {/* 6. BUY NOW BUTTON */}
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onProceedToCheckout(
              product,
              robloxUsername || undefined,
              robloxProfile?.displayName || undefined,
              String(robloxProfile?.id || '') || undefined,
              currentQuantity,
            )}
            className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm tracking-wide uppercase transition-all shadow-md active:scale-[0.99] ${
              canProceed
                ? 'bg-amber-400 dark:bg-[#FFD166] text-black hover:bg-amber-300 dark:hover:bg-[#ffe082]'
                : 'bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            {isOutOfStock
              ? 'SOLD OUT'
              : product.requires_roblox_username && !robloxProfile
              ? 'Verify Roblox Username to Proceed'
              : product.requires_roblox_username && !isAccountConfirmed
              ? 'Confirm Roblox Account Above'
              : currentQuantity > 1
              ? `Buy Now (${currentQuantity} Items • $${totalPrice.toFixed(2)})`
              : 'Buy Now'}
          </button>

          {/* ========================================================= */}
          {/* BELOW: PRODUCT OVERVIEW -> SPECS -> DELIVERY INFORMATION */}
          {/* ========================================================= */}

          {/* Product Overview */}
          <div className="pt-2 space-y-1.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Product Overview
            </h3>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {product.description || product.short_description || 'Exclusive verified gaming product.'}
            </div>
          </div>

          {/* Account & Item Specs */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Account & Item Specs
              </h3>
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 divide-y divide-slate-200/60 dark:divide-white/5 text-xs overflow-hidden">
                {Object.entries(product.specifications).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center p-2.5">
                    <span className="text-slate-500 dark:text-slate-400">{key}</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-right">
                      {Array.isArray(val) ? val.join(', ') : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Video Showcase */}
          {product.video_url && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <Video className="w-3.5 h-3.5 text-amber-500 dark:text-[#FFD166]" />
                <span>Showcase Video</span>
              </div>
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black/80 border border-slate-200 dark:border-white/10">
                <iframe
                  src={product.video_url}
                  title="Showcase Video"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Delivery Information */}
          <div className="space-y-1.5 pt-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Delivery Information
            </h3>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
              {isAccount ? (
                <>
                  <p>• <strong>Instant Automated Vault:</strong> Full login credentials delivered directly to your order vault upon payment confirmation.</p>
                  <p>• <strong>Authenticator Support:</strong> 2FA setup keys and backup codes ready for 1-tap copy.</p>
                  <p>• <strong>14-Day Warranty:</strong> Complete account coverage guarantee.</p>
                </>
              ) : isGift ? (
                <>
                  <p>• <strong>Roblox Gift Delivery:</strong> After payment, our admin sends the item directly to your verified Roblox account.</p>
                  <p>• <strong>Manual Fulfillment:</strong> Our team processes each gift order personally. You will see your order status updated once the item is sent.</p>
                  <p>• <strong>Not Instant:</strong> Delivery is handled by staff — you will be notified when fulfilled.</p>
                </>
              ) : isTrade ? (
                <>
                  <p>• <strong>Trade Session:</strong> Coordinated in private trade servers after payment is confirmed.</p>
                  <p>• <strong>100% Item Guarantee:</strong> Delivered by verified trade staff.</p>
                </>
              ) : (
                <>
                  <p>• <strong>Instant Key:</strong> Digital activation code revealed immediately in receipt.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
