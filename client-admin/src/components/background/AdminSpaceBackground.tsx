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
        Subtle celestial blue, violet and cyan nebula glow with restrained edge shading to ensure
        all admin KPI cards, forms, tables, inputs, dialogs, and status messages remain 100% readable.
      */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(129, 140, 248, 0.15) 0%, rgba(99, 102, 241, 0.05) 45%, transparent 70%), ' +
            'radial-gradient(circle at 92% 30%, rgba(167, 139, 250, 0.10) 0%, transparent 45%), ' +
            'radial-gradient(circle at 8% 70%, rgba(6, 182, 212, 0.08) 0%, transparent 50%), ' +
            'radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.05) 0%, transparent 40%), ' +
            'linear-gradient(180deg, rgba(7, 10, 20, 0.25) 0%, transparent 35%, rgba(7, 10, 20, 0.60) 100%)',
        }}
      />

      {/* Layered Celestial Dust & Micro-stars (Restrained 3D depth, pointer-events-none) */}
      <div
        className="absolute inset-0 opacity-75 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(1px 1px at 75px 120px, #B8A5FF 100%, transparent), ' +
            'radial-gradient(1.5px 1.5px at 280px 80px, #C7D2FE 100%, transparent), ' +
            'radial-gradient(1px 1px at 340px 320px, #67E8F9 100%, transparent), ' +
            'radial-gradient(1.5px 1.5px at 150px 480px, #A78BFA 100%, transparent), ' +
            'radial-gradient(1px 1px at 310px 600px, #C7D2FE 100%, transparent)',
          backgroundSize: '400px 700px',
        }}
      />
    </div>
  );
};
