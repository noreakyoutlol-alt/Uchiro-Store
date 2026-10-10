import React from 'react';
import { Send, Shield } from 'lucide-react';

export const TelegramBrowserBlocked: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[#0B0E14] text-white flex flex-col items-center justify-center p-4 z-50 select-none">
      <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl bg-[#121624] border border-red-500/30 shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Ambient Top Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Lock Icon Emblem */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 via-amber-500 to-[#E63946] p-0.5 mb-5 shadow-lg relative flex items-center justify-center">
          <div className="w-full h-full bg-[#0B0E14] rounded-[14px] flex items-center justify-center">
            <span className="text-3xl select-none" role="img" aria-label="Locked">🔒</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mb-2">
          Telegram Mini App Only
        </h1>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-300 mb-6 leading-relaxed font-medium">
          ហាងនេះត្រូវបានការពារសុវត្ថិភាព និងអាចចូលប្រើប្រាស់បានតែតាមរយៈ Telegram Bot ផ្លូវការប៉ុណ្ណោះ។
        </p>

        {/* Action Button */}
        <a
          href="https://t.me/UchiroStore_BOT"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-[#2AABEE] to-[#229ED9] text-white hover:brightness-110 flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95 mb-4"
        >
          <Send className="w-4 h-4 fill-current" />
          <span>ចូលទៅកាន់ Telegram (@UchiroStore_BOT)</span>
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
