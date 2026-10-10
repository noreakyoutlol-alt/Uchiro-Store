import React from 'react';
import { Send, Shield, Zap } from 'lucide-react';

export const TelegramBrowserBlocked: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#0B0E14] text-white flex flex-col items-center justify-center p-4 z-50 select-none">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl bg-[#121624] border border-amber-500/30 shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-[#E63946]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Uchiro Brand Emblem */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-[#E63946] p-0.5 mb-5 shadow-lg relative">
          <div className="w-full h-full bg-[#0B0E14] rounded-[14px] flex items-center justify-center">
            <Zap className="w-8 h-8 text-amber-400 fill-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
          ⚡ Uchiro Store — Telegram Mini App Only
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed">
          This store is exclusively designed to run inside Telegram. Please open the official Telegram bot to browse verified gaming accounts, instant digital items, and KHQR payments.
        </p>

        {/* Action Button */}
        <a
          href="https://t.me/UchiroStore_BOT"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-400 flex items-center justify-center gap-2 shadow-md hover:shadow-amber-500/25 transition-all active:scale-95 mb-4"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>Open in Telegram (@UchiroStore_BOT)</span>
        </a>

        {/* Footer verification chip */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Official Uchiro Gaming Store • 100% Safe</span>
        </div>
      </div>
    </div>
  );
};
