import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const GamingDoodlePattern: React.FC = () => {
  const { activeTheme, patternUrl } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#070A14]">
      {/*
        Store Mini App Space-Doodle Pattern Asset: pattern.svg
        Seamless tiling on dark navy / black space base with clearer blue & violet line art.
        Hardware-accelerated, zero-lag rendering on iOS & Android WebViews.
      */}
      <div
        key={patternUrl}
        className={`absolute inset-0 transition-opacity duration-500 ${
          activeTheme === 'dark'
            ? 'opacity-90'
            : 'opacity-35 invert'
        }`}
        style={{
          backgroundImage: `url("${patternUrl}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '460px 460px',
          backgroundPosition: '0 0',
          transform: 'translateZ(0)',
          willChange: 'opacity',
        }}
      />

      {/*
        Atmospheric space glow & vignette:
        Subtle celestial blue and violet nebula glow with restrained edge shading to ensure
        white text, price labels, gold accents and buttons remain easy to read.
      */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
          activeTheme === 'dark' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(129, 140, 248, 0.12) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%), ' +
            'radial-gradient(circle at 90% 35%, rgba(167, 139, 250, 0.08) 0%, transparent 45%), ' +
            'radial-gradient(circle at 10% 75%, rgba(96, 165, 250, 0.07) 0%, transparent 50%), ' +
            'linear-gradient(180deg, rgba(7, 10, 20, 0.20) 0%, transparent 40%, rgba(7, 10, 20, 0.50) 100%)',
        }}
      />

      {/*
        Light-mode overlay protection
      */}
      <div
        className={`absolute inset-0 transition-colors duration-500 pointer-events-none ${
          activeTheme === 'dark'
            ? 'hidden'
            : 'bg-gradient-to-b from-[#F8F9FA]/80 via-[#F8F9FA]/65 to-[#F8F9FA]/85'
        }`}
      />
    </div>
  );
};
