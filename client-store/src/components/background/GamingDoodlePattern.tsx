import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export const GamingDoodlePattern: React.FC = () => {
  const { activeTheme, patternUrl } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/*
        Original Project Pattern Asset (pattern black.jpg in Dark Mode / pattern white.jpg in Light Mode).
        Ensuring image is visibly recognizable as the wallpaper across mobile and desktop.
      */}
      <div
        key={patternUrl}
        className={`absolute inset-0 bg-cover bg-top bg-no-repeat transition-opacity duration-700 ${
          activeTheme === 'dark' ? 'opacity-40 sm:opacity-50' : 'opacity-45 sm:opacity-55'
        }`}
        style={{
          backgroundImage: `url("${patternUrl}")`,
          backgroundAttachment: 'fixed',
        }}
      />

      {/*
        Subtle gradient overlay to guarantee text and card readability while preserving pattern visibility
      */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          activeTheme === 'dark'
            ? 'bg-gradient-to-b from-[#0B0E14]/75 via-[#0B0E14]/60 to-[#0B0E14]/85'
            : 'bg-gradient-to-b from-[#F8F9FA]/75 via-[#F8F9FA]/60 to-[#F8F9FA]/85'
        }`}
      />
    </div>
  );
};
