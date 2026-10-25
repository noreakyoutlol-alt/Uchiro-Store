import React, { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';

export const ChristmasAtmosphere: React.FC = () => {
  const { prefersReducedMotion } = useTheme();

  // Deterministic lightweight snow particle configuration (low density: 22 particles)
  const snowflakes = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      left: `${(i * 4.6 + (i % 3) * 2) % 98}%`,
      size: `${2 + (i % 4) * 1.5}px`,
      duration: `${6 + (i % 5) * 2}s`,
      delay: `${(i * 0.4) % 5}s`,
      opacity: 0.35 + ((i % 5) * 0.12),
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Winter Frost Ambience (Cool Cyan & Emerald Glow) */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(ellipse at 50% -5%, rgba(56, 189, 248, 0.12) 0%, transparent 55%), ' +
            'radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 40%), ' +
            'radial-gradient(circle at 90% 20%, rgba(239, 68, 68, 0.07) 0%, transparent 40%)',
        }}
      />

      {/* 2. Tasteful Festive Lights Garland along Top Bar */}
      <div className="absolute top-0 inset-x-0 h-6 flex justify-between px-2 sm:px-6 items-start overflow-hidden opacity-90">
        {Array.from({ length: 14 }).map((_, i) => {
          const colors = [
            'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
            'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]',
            'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
            'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]',
          ];
          const colorClass = colors[i % colors.length];
          return (
            <div key={i} className="flex flex-col items-center">
              {/* Wire attachment */}
              <div className="w-[1px] h-2 bg-slate-600/60" />
              {/* Glowing Bulb */}
              <div
                className={`w-2 h-2.5 rounded-full ${colorClass} ${
                  prefersReducedMotion ? '' : 'animate-pulse'
                }`}
                style={{
                  animationDuration: `${1.8 + (i % 3) * 0.6}s`,
                  animationDelay: `${(i % 4) * 0.3}s`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* 3. Lightweight Falling Snow Particles */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0">
          {snowflakes.map((flake) => (
            <div
              key={flake.id}
              className="absolute rounded-full bg-white animate-christmas-snow"
              style={{
                left: flake.left,
                top: '-10px',
                width: flake.size,
                height: flake.size,
                opacity: flake.opacity,
                animationDuration: flake.duration,
                animationDelay: flake.delay,
                boxShadow: '0 0 4px rgba(255, 255, 255, 0.8)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
