import React from 'react';
import { useTheme } from '../../../context/ThemeContext';

export const AngkorAtmosphere: React.FC = () => {
  const { prefersReducedMotion } = useTheme();

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Royal Gold & Warm Amber Ambient Glow */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          background:
            'radial-gradient(ellipse at 50% -10%, rgba(217, 119, 6, 0.15) 0%, transparent 60%), ' +
            'radial-gradient(circle at 10% 85%, rgba(245, 158, 11, 0.08) 0%, transparent 45%), ' +
            'radial-gradient(circle at 90% 85%, rgba(251, 191, 36, 0.08) 0%, transparent 45%)',
        }}
      />

      {/* 2. Top-Center Khmer Decorative Ornamental Border (Kbach Motif) */}
      <div className="absolute top-0 inset-x-0 flex justify-center opacity-30">
        <svg
          viewBox="0 0 600 40"
          fill="none"
          className="w-full max-w-xl h-7 stroke-amber-400 stroke-[1.2]"
        >
          <path d="M0,0 L600,0" strokeWidth="1" strokeOpacity="0.4" />
          {/* Symmetrical Khmer Kbach Lotus Crown Motif */}
          <path d="M300,28 L308,16 L318,22 L312,10 L324,12 L314,4 L300,0 L286,4 L276,12 L288,10 L282,22 L292,16 Z" fill="rgba(245, 158, 11, 0.25)" />
          {/* Repeating flourishes */}
          <path d="M220,10 Q240,2 260,12 Q280,22 300,12 Q320,22 340,12 Q360,2 380,10" />
          <circle cx="300" cy="8" r="2.5" fill="#F59E0B" />
          <circle cx="250" cy="10" r="1.5" fill="#F59E0B" />
          <circle cx="350" cy="10" r="1.5" fill="#F59E0B" />
        </svg>
      </div>

      {/* 3. Noble Angkor Wat Temple Towers Silhouette at Bottom */}
      <div className="absolute bottom-0 inset-x-0 h-44 sm:h-60 opacity-20 flex justify-center items-end overflow-hidden">
        <svg
          viewBox="0 0 1000 300"
          preserveAspectRatio="xMidYMax slice"
          className="w-full h-full text-amber-500/50 fill-current"
        >
          {/* Five Iconic Towers of Angkor Wat */}
          {/* Center Main Sanctuary Tower */}
          <path d="M470,300 L470,140 Q470,120 480,90 Q490,60 500,20 Q510,60 520,90 Q530,120 530,140 L530,300 Z" />
          {/* Center Finial */}
          <polygon points="500,5 496,25 504,25" />

          {/* Inner Left Tower */}
          <path d="M410,300 L410,170 Q410,150 420,125 Q430,100 440,70 Q450,100 460,125 Q470,150 470,170 L470,300 Z" />
          <polygon points="440,55 437,72 443,72" />

          {/* Inner Right Tower */}
          <path d="M530,300 L530,170 Q530,150 540,125 Q550,100 560,70 Q570,100 580,125 Q590,150 590,170 L590,300 Z" />
          <polygon points="560,55 557,72 563,72" />

          {/* Outer Left Tower */}
          <path d="M350,300 L350,200 Q350,180 360,160 Q370,140 380,110 Q390,140 400,160 Q410,180 410,200 L410,300 Z" />
          <polygon points="380,95 377,112 383,112" />

          {/* Outer Right Tower */}
          <path d="M590,300 L590,200 Q590,180 600,160 Q610,140 620,110 Q630,140 640,160 Q650,180 650,200 L650,300 Z" />
          <polygon points="620,95 617,112 623,112" />

          {/* Gallery Bas-relief & Temple Base Foundation */}
          <rect x="250" y="240" width="500" height="60" />
          <rect x="180" y="270" width="640" height="30" />
        </svg>
      </div>

      {/* 4. Subtle Shimmering Golden Floating Dust Accent */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0">
          {[
            { left: '20%', top: '35%', delay: '0s', dur: '4s' },
            { left: '80%', top: '45%', delay: '1.5s', dur: '5s' },
            { left: '45%', top: '25%', delay: '2.5s', dur: '4.5s' },
            { left: '65%', top: '60%', delay: '0.8s', dur: '6s' },
            { left: '30%', top: '70%', delay: '2s', dur: '5.5s' },
          ].map((dust, idx) => (
            <div
              key={idx}
              className="absolute w-1 h-1 rounded-full bg-amber-400/50 animate-pulse"
              style={{
                left: dust.left,
                top: dust.top,
                animationDelay: dust.delay,
                animationDuration: dust.dur,
                boxShadow: '0 0 6px rgba(245, 158, 11, 0.6)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
