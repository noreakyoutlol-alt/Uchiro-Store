import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X,
  Download,
  ExternalLink,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { Order, Payment } from '../../types';

export interface PaymentModalProps {
  isOpen?: boolean;
  orderId?: string;
  totalAmount?: number;
  khqrString?: string;
  order?: Order | null;
  payment?: Payment | null;
  onClose: () => void;
  onSuccess?: (order: Order) => void;
  onPaymentSuccess?: (order: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen = true,
  orderId,
  totalAmount,
  khqrString,
  order,
  payment,
  onClose,
  onSuccess,
  onPaymentSuccess,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  const effectiveOrderId = orderId || order?.id || payment?.order_id || '';
  const effectiveAmount = totalAmount ?? order?.total_amount ?? payment?.amount ?? 0;
  const effectiveKHQR =
    khqrString ||
    payment?.qr_payload ||
    (order as any)?.khqr_data ||
    (order as any)?.khqr_string ||
    (order as any)?.qr_code ||
    '';

  const abaDeepLink =
    payment?.aba_deep_link ||
    (payment as any)?.abapay_deeplink ||
    (order as any)?.aba_deep_link ||
    `https://link.payway.com.kh/aba?id=${effectiveOrderId}`;

  // Countdown timer (15 minutes)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Instant client-side QR download
  const downloadQR = () => {
    const canvas = document.querySelector('canvas#khqr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `KHQR-Order-${effectiveOrderId || 'payment'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ABA Mobile deep link inside Telegram WebView
  const handleOpenABAMobile = (deepLink: string) => {
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    if (tg?.openLink) {
      tg.openLink(deepLink, { try_instant_view: false });
    } else {
      window.location.href = deepLink;
    }
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(effectiveAmount.toFixed(2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#121626] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#161C2E]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-md">
              KH
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">KHQR Payment</h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Order #{effectiveOrderId.slice(0, 8)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col items-center gap-4">
          {/* Price & Timer */}
          <div className="flex items-center justify-between w-full px-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Amount</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-black text-[#FFD166]">
                  ${Number(effectiveAmount).toFixed(2)} USD
                </span>
                <button
                  type="button"
                  onClick={handleCopyAmount}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-bold">
              <Clock className="w-3 h-3" />
              <span>{formattedTime}</span>
            </div>
          </div>

          {/* QR Container */}
          <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200">
            {effectiveKHQR ? (
              <QRCodeCanvas
                id="khqr-canvas"
                value={effectiveKHQR}
                size={220}
                level="M"
                bgColor="#FFFFFF"
                fgColor="#000000"
                includeMargin={false}
              />
            ) : (
              <div className="w-[220px] h-[220px] flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Zap className="w-8 h-8 text-amber-500 animate-pulse" />
                <span>Preparing KHQR...</span>
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 text-center font-medium">
            Scan with ABA Mobile, Bakong, or any Cambodian Banking Mini App
          </p>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 w-full pt-1">
            <button
              type="button"
              onClick={downloadQR}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-[#FFD166]" />
              <span>Save QR</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenABAMobile(abaDeepLink)}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#005F73] hover:bg-[#0A9396] text-white text-xs font-bold shadow-md shadow-[#005F73]/20 transition-all active:scale-95"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-300" />
              <span>ABA Mobile</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0C101B] border-t border-white/5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Secure Automated KHQR Verification</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
export * from './CheckoutModal';
