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
        Subtle celestial blue, violet and cyan nebula glow with restrained edge shading to ensure
        white text, price labels, gold accents and buttons remain easy to read.
      */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
          activeTheme === 'dark' ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(129, 140, 248, 0.15) 0%, rgba(99, 102, 241, 0.05) 45%, transparent 70%), ' +
            'radial-gradient(circle at 92% 30%, rgba(167, 139, 250, 0.10) 0%, transparent 45%), ' +
            'radial-gradient(circle at 8% 70%, rgba(6, 182, 212, 0.08) 0%, transparent 50%), ' +
            'radial-gradient(circle at 50% 100%, rgba(245, 158, 11, 0.04) 0%, transparent 40%), ' +
            'linear-gradient(180deg, rgba(7, 10, 20, 0.20) 0%, transparent 35%, rgba(7, 10, 20, 0.55) 100%)',
        }}
      />

      {/* Layered Celestial Dust & Micro-stars (Restrained 3D depth, pointer-events-none) */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
          activeTheme === 'dark' ? 'opacity-80' : 'opacity-0'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 75px 120px, #B8A5FF 100%, transparent), ' +
            'radial-gradient(1.5px 1.5px at 280px 80px, #FDE68A 100%, transparent), ' +
            'radial-gradient(1px 1px at 340px 320px, #67E8F9 100%, transparent), ' +
            'radial-gradient(1.5px 1.5px at 150px 480px, #A78BFA 100%, transparent), ' +
            'radial-gradient(1px 1px at 310px 600px, #FDE68A 100%, transparent)',
          backgroundSize: '400px 700px',
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
