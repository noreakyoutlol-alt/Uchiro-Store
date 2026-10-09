import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  KeyRound,
  Home,
  CheckCircle2,
  Calendar,
  CreditCard,
  ShieldCheck,
  PackageCheck,
  Loader2,
  FileText,
} from 'lucide-react';
import { Order, OrderReceipt } from '../../types';
import { StoreAPI } from '../../services/api';
import { downloadReceiptFile } from '../../services/receipt-pdf';

interface OrderReceiptModalProps {
  order: Order | null;
  onClose: () => void;
  onOpenDelivery: (order: Order) => void;
  onBackToHome: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  onClose,
  onOpenDelivery,
  onBackToHome,
}) => {
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!order) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const fetchReceipt = async () => {
      try {
        const data = await StoreAPI.getOrderReceipt(order.id);
        if (isMounted) setReceipt(data);
      } catch (err: any) {
        if (!isMounted) return;
        // Fallback to synthesizing receipt from order if network error
        const item = order.items?.[0];
        let pType = 'Instant Account Delivery';
        if (order.delivery_mode === 'digital_code') pType = 'Instant Digital Key';
        else if (order.delivery_mode === 'manual_service') pType = 'Roblox Gift Delivery';
        else if (order.delivery_mode === 'trade_item') pType = 'In-Game Trade';

        setReceipt({
          order_id: order.id,
          order_number: order.order_number,
          store_name: 'UCHIRO STORE',
          product_name: item?.product_title || 'Gaming Product',
          product_type: pType,
          amount: order.total_amount,
          currency: 'USD',
          payment_method: order.payment?.provider ? (order.payment.provider.toUpperCase() === 'KHPAY' ? 'KHPay Gateway' : order.payment.provider) : 'KHPay Gateway',
          payment_status: order.payment?.status || (order.status === 'delivered' || order.status === 'paid' ? 'PAID' : order.status),
          transaction_reference: order.payment?.transaction_reference || null,
          order_date: order.created_at,
          paid_at: order.payment?.paid_at || order.updated_at,
          delivery_status: order.status,
          warranty_duration: `${order.warranty_days || 14} Days`,
          warranty_starts_at: order.warranty_starts_at || null,
          warranty_expires_at: order.warranty_expires_at || null,
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchReceipt();

    return () => {
      isMounted = false;
    };
  }, [order?.id]);

  if (!order) return null;

  const handleDownload = async () => {
    if (!receipt) return;
    setIsDownloading(true);
    try {
      // Attempt server download first, fallback to client-side generator
      try {
        await StoreAPI.downloadReceiptPdf(receipt.order_id, receipt.order_number);
      } catch {
        downloadReceiptFile(receipt);
      }
    } catch {
      // Non-fatal
    } finally {
      setIsDownloading(false);
    }
  };

  const formattedDate = receipt?.order_date
    ? new Date(receipt.order_date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

  const warrantyStartDate = receipt?.warranty_starts_at
    ? new Date(receipt.warranty_starts_at).toLocaleDateString('en-US', {
        dateStyle: 'medium',
      })
    : formattedDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-[#121620] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="p-4 bg-gradient-to-r from-[#141923] via-[#1A2230] to-[#141923] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFD166] to-[#E63946] flex items-center justify-center text-black font-black text-xs shadow-md">
              <FileText className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-1.5">
                <span>Official Receipt</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                #{order.order_number}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
            title="Close Receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#FFD166]" />
              <span className="text-xs font-semibold">Generating Official Receipt...</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {!isLoading && receipt && (
            <>
              {/* Receipt Top Card */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-xs font-black text-[#FFD166] tracking-wider uppercase">
                      {receipt.store_name}
                    </span>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Verified Purchase Confirmation
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-[10px] tracking-wider uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{receipt.payment_status.toUpperCase()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Order ID
                    </span>
                    <span className="font-mono font-bold text-white select-all">
                      #{receipt.order_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Date & Time
                    </span>
                    <span className="text-slate-300 font-medium">
                      {formattedDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Payment Method
                    </span>
                    <span className="text-slate-300 font-medium">
                      {receipt.payment_method}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      Delivery Status
                    </span>
                    <span className="text-emerald-400 font-bold uppercase">
                      {receipt.delivery_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product Purchased Item Card */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Purchased Item
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold">
                    {receipt.product_type}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white leading-tight">
                      {receipt.product_name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Standard Digital Gaming Product
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-[#FFD166]">
                      ${receipt.amount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {receipt.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warranty Protection Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Warranty Protection</span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration:</span>
                    <span className="font-bold text-white">{receipt.warranty_duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Since:</span>
                    <span className="text-slate-200">{warrantyStartDate}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-1 leading-normal">
                  Full 14-day replacement guarantee provided recovery credentials remain intact.
                </p>
              </div>

              {/* Security Compliance Note */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[10px] text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 uppercase tracking-wider block">
                  Security Compliance
                </span>
                <p>
                  Account passwords, authenticator setup keys, and live TOTP codes are NEVER printed on receipts for your security. Open your secure delivery vault below to access credentials.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 bg-black/60 border-t border-white/10 space-y-2">
          {/* Primary Action Row: Download Receipt & Open Delivery */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloading || !receipt}
              className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFD166]" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#FFD166]" />
              )}
              <span>Download PDF</span>
            </button>

            <button
              onClick={() => onOpenDelivery(order)}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 active:scale-98"
            >
              <KeyRound className="w-3.5 h-3.5 text-white" />
              <span>Open Delivery</span>
            </button>
          </div>

          {/* Back to Home Button */}
          <button
            onClick={onBackToHome}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E63946] to-[#D90429] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#E63946]/20 hover:brightness-110 active:scale-98 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
