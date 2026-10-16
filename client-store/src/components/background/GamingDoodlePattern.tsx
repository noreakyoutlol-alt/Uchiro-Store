import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const GamingDoodlePattern: React.FC = () => {
  const { activeTheme, patternUrl } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/*
        Store Mini App Background Pattern Asset: pattern.svg
        Scales proportionally without geometric distortion.
        Filter invert(1) in dark mode provides crisp light lines; subtle opacity guarantees readability.
      */}
      <div
        key={patternUrl}
        className={`absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-500 ${
          activeTheme === 'dark'
            ? 'opacity-20 sm:opacity-25 invert'
            : 'opacity-10 sm:opacity-15'
        }`}
        style={{
          backgroundImage: `url("${patternUrl}")`,
          backgroundAttachment: 'fixed',
        }}
      />

      {/*
        Subtle gradient overlay to guarantee text, price, and card readability while preserving pattern visibility
      */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          activeTheme === 'dark'
            ? 'bg-gradient-to-b from-[#0B0E14]/85 via-[#0B0E14]/70 to-[#0B0E14]/90'
            : 'bg-gradient-to-b from-[#F8F9FA]/85 via-[#F8F9FA]/70 to-[#F8F9FA]/90'
        }`}
      />
    </div>
  );
};
