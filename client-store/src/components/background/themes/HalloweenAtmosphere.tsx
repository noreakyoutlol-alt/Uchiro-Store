import React from 'react';
import { useTheme } from '../../../context/ThemeContext';

export const HalloweenAtmosphere: React.FC = () => {
  const { prefersReducedMotion } = useTheme();

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Atmospheric Spooky Glow (Deep Violet & Warm Pumpkin Ambience) */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(circle at 15% 10%, rgba(139, 92, 246, 0.14) 0%, transparent 45%), ' +
            'radial-gradient(circle at 85% 15%, rgba(249, 115, 22, 0.12) 0%, transparent 40%), ' +
            'radial-gradient(circle at 50% 90%, rgba(109, 40, 217, 0.10) 0%, transparent 50%)',
        }}
      />

      {/* 2. Top-Left Spiderweb Decoration */}
      <div className="absolute top-0 left-0 w-36 sm:w-56 h-36 sm:h-56 opacity-35 text-amber-500/40">
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full stroke-current stroke-[1.2]">
          <path d="M0,0 L200,0 M0,0 L180,60 M0,0 L140,140 M0,0 L60,180 M0,0 L0,200" />
          <path d="M40,0 Q35,15 0,40" />
          <path d="M80,0 Q65,30 0,80" />
          <path d="M120,0 Q95,50 0,120" />
          <path d="M160,0 Q125,70 0,160" />
          <path d="M200,0 Q155,90 0,200" />
          <path d="M40,0 Q30,12 28,12 Q12,30 0,40" />
          <path d="M80,0 Q60,24 56,24 Q24,60 0,80" />
          <path d="M120,0 Q90,36 84,36 Q36,90 0,120" />
        </svg>
      </div>

      {/* 3. Top-Right Spiderweb Decoration */}
      <div className="absolute top-0 right-0 w-36 sm:w-56 h-36 sm:h-56 opacity-35 text-purple-400/40 transform scale-x-[-1]">
        <svg viewBox="0 0 200 200" fill="none" className="w-full h-full stroke-current stroke-[1.2]">
          <path d="M0,0 L200,0 M0,0 L180,60 M0,0 L140,140 M0,0 L60,180 M0,0 L0,200" />
          <path d="M50,0 Q40,20 0,50" />
          <path d="M100,0 Q80,40 0,100" />
          <path d="M150,0 Q120,60 0,150" />
          <path d="M200,0 Q160,80 0,200" />
        </svg>
      </div>

      {/* 4. Hanging Animated Spiders (Gentle, lightweight, non-blocking) */}
      <div className="absolute inset-x-0 top-0 h-96">
        {/* Spider 1: Left-center gentle hanging spider */}
        <div
          className={`absolute left-[12%] top-0 flex flex-col items-center ${
            prefersReducedMotion ? '' : 'animate-halloween-spider-sway'
          }`}
          style={{ transformOrigin: 'top center' }}
        >
          {/* Silky web line */}
          <div className="w-[1px] h-28 sm:h-36 bg-gradient-to-b from-white/30 via-white/20 to-white/40" />
          {/* Spider SVG */}
          <div className="w-5 h-5 text-purple-300 drop-shadow-[0_2px_8px_rgba(168,85,247,0.5)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              {/* Spider Body */}
              <circle cx="12" cy="14" r="4.5" />
              <circle cx="12" cy="8" r="2.8" />
              {/* Glowing Eyes */}
              <circle cx="11" cy="7.5" r="0.7" fill="#F97316" />
              <circle cx="13" cy="7.5" r="0.7" fill="#F97316" />
              {/* Left Legs */}
              <path d="M9 12 C5 10 3 6 1 8" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M8 14 C4 13 3 13 2 16" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M9 16 C6 17 4 19 3 22" stroke="currentColor" strokeWidth="1.2" fill="none" />
              {/* Right Legs */}
              <path d="M15 12 C19 10 21 6 23 8" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M16 14 C20 13 21 13 22 16" stroke="currentColor" strokeWidth="1.2" fill="none" />
              <path d="M15 16 C18 17 20 19 21 22" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          </div>
        </div>

        {/* Spider 2: Right-side smaller spider */}
        <div
          className={`absolute right-[16%] top-0 flex flex-col items-center ${
            prefersReducedMotion ? '' : 'animate-halloween-spider-bounce'
          }`}
          style={{ transformOrigin: 'top center' }}
        >
          <div className="w-[1px] h-20 sm:h-28 bg-gradient-to-b from-white/30 via-white/20 to-white/40" />
          <div className="w-4 h-4 text-orange-400 drop-shadow-[0_2px_6px_rgba(249,115,22,0.5)]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
              <circle cx="12" cy="14" r="4" />
              <circle cx="12" cy="8.5" r="2.5" />
              <circle cx="11" cy="8" r="0.6" fill="#A855F7" />
              <circle cx="13" cy="8" r="0.6" fill="#A855F7" />
              <path d="M9 12 C6 10 4 7 2 9" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M8 14 C5 13 4 14 3 17" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M15 12 C18 10 20 7 22 9" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M16 14 C19 13 20 14 21 17" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
