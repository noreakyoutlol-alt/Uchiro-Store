import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { Payment, Order } from '../../types';
import { StoreAPI } from '../../services/api';
import { AppIcon } from '../common/AppIcon';

interface KHQRPaymentScreenProps {
  order: Order;
  payment: Payment;
  onPaymentSuccess: (deliveredOrder: Order) => void;
  onClose: () => void;
}

export const KHQRPaymentScreen: React.FC<KHQRPaymentScreenProps> = ({
  order,
  payment,
  onPaymentSuccess,
  onClose,
}) => {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(() => {
    if (payment?.expires_at) {
      const expiryTime = new Date(payment.expires_at).getTime();
      if (!isNaN(expiryTime)) {
        return Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      }
    }
    return typeof payment?.expires_in === 'number' && payment.expires_in > 0 ? payment.expires_in : 600;
  });
  const [isPaid, setIsPaid] = useState(false);
  const [isCompositingQR, setIsCompositingQR] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  // 1. Real Countdown Timer based on KHPay's actual expires_at
  useEffect(() => {
    const expiryTime = new Date(payment.expires_at).getTime();
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeftSeconds(diff);
      if (diff === 0 && !isPaid) {
        setErrorMsg('Payment session expired. Please return and place a new order.');
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [payment.expires_at, isPaid]);

  // 2. Real-time Status Polling (server authoritative)
  useEffect(() => {
    if (isPaid || timeLeftSeconds === 0) return;

    let isMounted = true;
    const pollStatus = async () => {
      try {
        const res = await StoreAPI.getPaymentStatus(payment.id);
        if (res.isPaid && isMounted) {
          handleSuccess();
        }
      } catch {
        // Retry silently on network hiccups
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [payment.id, isPaid, timeLeftSeconds]);

  const handleSuccess = async () => {
    setIsPaid(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    try {
      // Fetch latest fulfilled order state from server
      const updatedOrder = await StoreAPI.getOrderById(order.id);
      setTimeout(() => {
        onPaymentSuccess(updatedOrder);
      }, 1500);
    } catch {
      setTimeout(() => {
        onPaymentSuccess({ ...order, status: 'paid' });
      }, 1500);
    }
  };

  // 3. Download Real KHPay QR Code on Branded Card Template or High-Res PNG
  const handleDownloadQR = async () => {
    // Fast client-side canvas download
    const qrCanvas = document.querySelector('canvas#khqr-canvas') as HTMLCanvasElement;
    if (qrCanvas) {
      const a = document.createElement('a');
      a.href = qrCanvas.toDataURL('image/png');
      a.download = `KHQR-Order-${order.order_number || order.id || 'payment'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setIsCompositingQR(true);
    try {
      let qrImageSource = '';
      if (qrRef.current) {
        const canvas = qrRef.current.querySelector('canvas');
        if (canvas) {
          qrImageSource = canvas.toDataURL('image/png');
        } else {
          const svg = qrRef.current.querySelector('svg');
          if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            qrImageSource = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
          } else {
            const img = qrRef.current.querySelector('img');
            if (img && img.src) {
              qrImageSource = img.src;
            }
          }
        }
      }
      if (!qrImageSource && payment.qr_image_url) {
        qrImageSource = payment.qr_image_url;
      }

      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = src;
        });
      };

      // Check for template cards
      let templateImg: HTMLImageElement | null = null;
      const templatePaths = ['/qr temple.jpg', '/qr-template.jpg', '/assets/payment/qr-template.jpg'];
      for (const path of templatePaths) {
        try {
          templateImg = await loadImage(path);
          if (templateImg) break;
        } catch {
          // continue search
        }
      }

      if (templateImg && qrImageSource) {
        const qrImg = await loadImage(qrImageSource);
        const canvas = document.createElement('canvas');
        canvas.width = 1792;
        canvas.height = 2352;
        // Hardware accelerated canvas 2D context
        const ctx = canvas.getContext('2d', { willReadFrequently: false });
        if (ctx) {
          // 1. Draw base template (1792 x 2352)
          ctx.drawImage(templateImg, 0, 0, 1792, 2352);

          // 2. Patch pre-existing template text in header area with clean background
          // Cleans x: 440 to 1352, y: 510 to 685
          ctx.fillStyle = '#0C101B';
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(440, 510, 912, 175, 18);
            ctx.fill();
          } else {
            ctx.fillRect(440, 510, 912, 175);
          }

          // 3. Dynamic Monetary & Order Info calculation
          const usdAmount = Number(payment.amount || order.total_amount || 0);
          const khrAmount = Math.round(usdAmount * 4100).toLocaleString('en-US');
          const orderNum = order.order_number || (order.id ? order.id.slice(0, 8) : 'UCH-123456');

          // Render Monospace "$XX.XX USD" centered horizontally
          ctx.font = 'bold 74px monospace, "Courier New", Courier';
          ctx.textBaseline = 'middle';
          const amountStr = `$${usdAmount.toFixed(2)}`;
          const fullPriceStr = `${amountStr} USD`;
          const fullWidth = ctx.measureText(fullPriceStr).width;
          const amountWidth = ctx.measureText(amountStr + ' ').width;
          const startX = 896 - fullWidth / 2;

          ctx.textAlign = 'left';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(amountStr + ' ', startX, 575);
          ctx.fillStyle = '#FF9900';
          ctx.fillText('USD', startX + amountWidth, 575);

          // Render Monospace Subline: "UCHIRO STORE • ៛... KHR • #ORDER_NUM"
          ctx.textAlign = 'center';
          ctx.fillStyle = '#FFD166';
          ctx.font = 'bold 32px monospace, "Courier New", Courier';
          ctx.fillText(`UCHIRO STORE • ៛${khrAmount} KHR • #${orderNum}`, 896, 645);

          // 4. Render Dynamic QR Code strictly inside the red scroll banner
          // Target frame coordinates matching the inner scroll:
          const qrTargetX = 945;
          const qrTargetY = 1385;
          const qrTargetSize = 540;

          // Clean white backing card inside the red frame
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(890, 1330, 650, 650);

          // Draw dynamic high-res QR code
          ctx.drawImage(qrImg, qrTargetX, qrTargetY, qrTargetSize, qrTargetSize);

          const compositeUrl = canvas.toDataURL('image/jpeg', 0.95);
          const link = document.createElement('a');
          link.href = compositeUrl;
          link.download = `KHPay-Order-${order.order_number}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }
      }

      // Standalone high-res QR fallback
      if (qrImageSource) {
        const qrImg = await loadImage(qrImageSource);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 512, 512);
          ctx.drawImage(qrImg, 24, 24, 464, 464);
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `KHPay-Order-${order.order_number}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error('Failed to download KHPay QR:', err);
    } finally {
      setIsCompositingQR(false);
    }
  };

  // 4. Open ABA Mobile Deeplink with Telegram WebApp support
  const handleOpenABA = () => {
    const deeplink = payment.aba_deep_link || (payment as any).abapay_deeplink;
    const fallbackUrl = (payment as any).payment_url || payment.bakong_deep_link || deeplink || '#';
    const targetLink = deeplink && deeplink !== '#' ? deeplink : fallbackUrl;
    if (!targetLink || targetLink === '#') return;

    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    if (tg?.openLink) {
      tg.openLink(targetLink, { try_instant_view: false });
    } else {
      window.location.href = targetLink;
    }
  };

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const exactAmount = Number(payment.amount || order.total_amount || 0).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-sm bg-[#0E121E] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative my-auto">
        {/* Floating Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header: KHPay Checkout Gateway */}
        <div className="p-4 pt-5 bg-gradient-to-b from-[#E63946]/20 via-[#FFD166]/10 to-transparent border-b border-white/10 text-center relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1 px-1">
            <span className="font-mono font-bold text-slate-300">#{order.order_number}</span>
            <div className="flex items-center gap-1 text-[#FFD166] font-mono font-bold">
              <Clock className="w-3.5 h-3.5" />
              <span>{timeFormatted}</span>
            </div>
          </div>

          <span className="text-[11px] text-[#FFD166] font-black uppercase tracking-wider">
            KHPAY CHECKOUT GATEWAY
          </span>
          <div className="text-3xl font-black text-white tracking-tight mt-0.5">
            ${exactAmount} <span className="text-sm font-bold text-[#FFD166]">USD</span>
          </div>
        </div>

        {/* QR Code Container styled with dark gaming accents */}
        <div className="p-5 flex flex-col items-center justify-center">
          <div
            ref={qrRef}
            className="relative w-[230px] h-[230px] rounded-3xl overflow-hidden shadow-[0_0_30px_rgba(230,57,70,0.18)] bg-white p-3.5 flex items-center justify-center border-2 border-[#FFD166]/40 ring-4 ring-black/40"
          >
            {isPaid ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-emerald-600 gap-2 p-2 text-center">
                <CheckCircle2 className="w-16 h-16 animate-bounce" />
                <span className="font-black text-sm text-black tracking-tight">
                  PAYMENT CONFIRMED!
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Continuing to fulfillment...
                </span>
              </div>
            ) : payment.qr_payload ? (
              <QRCodeCanvas
                id="khqr-canvas"
                value={payment.qr_payload}
                size={195}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
                includeMargin={false}
                className="w-full h-full object-contain"
              />
            ) : payment.qr_image_url ? (
              <img
                src={payment.qr_image_url}
                alt="KHPay QR Code"
                className="w-full h-full object-contain"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFD166]" />
                <span>Generating KHPay QR...</span>
              </div>
            )}
          </div>

          {/* Status Indicator */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold">
            {isPaid ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <AppIcon name="SUCCESS" size={15} className="text-emerald-400" />
                <span>Payment Verified & Confirmed!</span>
              </span>
            ) : (
              <span className="text-[#FFD166] flex items-center gap-2 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Waiting for payment verification...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-400">
            <AppIcon name="SECURITY" size={13} className="text-emerald-400" />
            <span>KHPay Checkout • Secured Gateway</span>
          </div>

          {errorMsg && (
            <div className="mt-2.5 p-2 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs text-center flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Action / Return to Store */}
        <div className="px-5 pb-5 space-y-2.5">
          <p className="text-[11px] text-center text-slate-400 leading-tight">
            Scan this QR code with Bakong, ABA Mobile, or any Cambodian banking app to complete your payment.
          </p>

          {/* Close / Return Button */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
