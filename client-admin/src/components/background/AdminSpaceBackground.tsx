import React from 'react';

/**
 * Premium dark space doodle background for the Admin Dashboard.
 * Reuses the project's canonical pattern.svg asset.
 * Pointer-events-none ensures zero interference with admin clicks, scrolling, forms, or navigation.
 */
export const AdminSpaceBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#070A14]">
      {/*
        Admin Space-Doodle Pattern Asset: pattern.svg
        Seamless tiling on dark navy / black space base with clearer blue & violet line art.
      */}
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: 'url("./pattern.svg")',
          backgroundRepeat: 'repeat',
          backgroundSize: '460px 460px',
          backgroundPosition: '0 0',
          transform: 'translateZ(0)',
        }}
      />

      {/*
        Atmospheric space glow & vignette:
        Subtle celestial blue and violet nebula glow with restrained edge shading to ensure
        all admin KPI cards, forms, tables, inputs, dialogs, and status messages remain 100% readable.
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(129, 140, 248, 0.12) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%), ' +
            'radial-gradient(circle at 90% 35%, rgba(167, 139, 250, 0.08) 0%, transparent 45%), ' +
            'radial-gradient(circle at 10% 75%, rgba(96, 165, 250, 0.07) 0%, transparent 50%), ' +
            'linear-gradient(180deg, rgba(7, 10, 20, 0.25) 0%, transparent 40%, rgba(7, 10, 20, 0.55) 100%)',
        }}
      />
    </div>
  );
};
