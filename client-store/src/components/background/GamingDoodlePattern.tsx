import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const GamingDoodlePattern: React.FC = () => {
  const { activeTheme, patternUrl } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#070A12]">
      {/*
        Store Mini App Space-Doodle Pattern Asset: pattern.svg
        Seamless tiling on near-black/deep-navy base with restrained muted indigo/lavender strokes.
        Hardware-accelerated, zero-lag rendering on iOS & Android WebViews.
      */}
      <div
        key={patternUrl}
        className={`absolute inset-0 transition-opacity duration-500 ${
          activeTheme === 'dark'
            ? 'opacity-85'
            : 'opacity-40 invert'
        }`}
        style={{
          backgroundImage: `url("${patternUrl}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '420px 420px',
          backgroundPosition: '0 0',
          transform: 'translateZ(0)',
          willChange: 'opacity',
        }}
      />

      {/*
        Subtle gradient overlay to guarantee text, price, and card readability while preserving pattern visibility
      */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          activeTheme === 'dark'
            ? 'bg-gradient-to-b from-[#070A12]/40 via-transparent to-[#070A12]/70'
            : 'bg-gradient-to-b from-[#F8F9FA]/75 via-[#F8F9FA]/60 to-[#F8F9FA]/80'
        }`}
      />
    </div>
  );
};
