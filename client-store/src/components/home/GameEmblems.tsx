import React from 'react';

export interface GameEmblemProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 1. Blox Fruits: Flaming golden katana (#F59E0B)
 */
export const BloxFruitsEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #F59E0B)', ...style }}
  >
    <defs>
      <linearGradient id="bfBlade" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="30%" stopColor="#FDE68A" />
        <stop offset="70%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" />
      </linearGradient>
      <linearGradient id="bfFlame" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="50%" stopColor="#FBBF24" />
        <stop offset="100%" stopColor="#FEF3C7" />
      </linearGradient>
    </defs>
    {/* Swirling Back Flame Tongue */}
    <path
      d="M20 5C19 9 22 11 20 16C18 19 14 19 13 22C17 21 19 18 21 15C23 12 24 8 20 5Z"
      fill="url(#bfFlame)"
      opacity="0.85"
    />
    {/* Katana Curved Blade Spine & Edge */}
    <path
      d="M27 4C23 6 15 13 9 20L11 22C17 16 24 8 27 4Z"
      fill="url(#bfBlade)"
    />
    <path
      d="M27 4C21 8 13 16 8 22L9 23L11 22C16 16 23 9 27 4Z"
      fill="#FFFBEB"
      opacity="0.9"
    />
    {/* Flaming Aura Wisps */}
    <path
      d="M24 7C22 10 25 12 23 15C22 16.5 20 17 19 18C21 16.5 22.5 15 23 13C24 10 22.5 8.5 24 7Z"
      fill="#FEF08A"
    />
    <path
      d="M17 14C15 17 18 19 16 22C15.5 23 14 23.5 13 24C15 23 16 21.5 16.5 20C17.5 17 16 15.5 17 14Z"
      fill="#F59E0B"
    />
    {/* Tsuba (Guard) */}
    <ellipse
      cx="8.5"
      cy="21.5"
      rx="3.5"
      ry="1.8"
      transform="rotate(-45 8.5 21.5)"
      fill="#B45309"
      stroke="#FDE68A"
      strokeWidth="0.8"
    />
    {/* Tsuka (Wrapped Hilt) */}
    <path
      d="M8 22L4 26C3.5 26.5 3.5 27.5 4 28L4.5 28.5C5 29 6 29 6.5 28.5L10.5 24.5L8 22Z"
      fill="#78350F"
      stroke="#F59E0B"
      strokeWidth="0.75"
    />
    {/* Hilt Diamond Wraps */}
    <line x1="5.5" y1="24.5" x2="7.5" y2="26.5" stroke="#FDE68A" strokeWidth="0.8" />
    <line x1="7" y1="23" x2="9" y2="25" stroke="#FDE68A" strokeWidth="0.8" />
    {/* Pommel Accent */}
    <circle cx="3.8" cy="28.2" r="1" fill="#FDE68A" />
  </svg>
);

/**
 * 2. MM2: Dual murder blades + skull motif (#EF4444)
 */
export const MM2Emblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #EF4444)', ...style }}
  >
    <defs>
      <linearGradient id="mmBlade1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FEE2E2" />
        <stop offset="50%" stopColor="#EF4444" />
        <stop offset="100%" stopColor="#991B1B" />
      </linearGradient>
      <linearGradient id="mmSkull" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="70%" stopColor="#E2E8F0" />
        <stop offset="100%" stopColor="#94A3B8" />
      </linearGradient>
    </defs>
    {/* Crossed Murder Blade 1 (Top-Left to Bottom-Right) */}
    <path
      d="M4 6L11 13L9.5 14.5L6.5 13.5L5 15L4 12L2 10L4 6Z"
      fill="url(#mmBlade1)"
    />
    <path
      d="M10 12L25 27L28 27L28 24L13 9L10 12Z"
      fill="url(#mmBlade1)"
      stroke="#FECACA"
      strokeWidth="0.5"
    />
    {/* Crossed Murder Blade 2 (Top-Right to Bottom-Left) */}
    <path
      d="M28 6L21 13L22.5 14.5L25.5 13.5L27 15L28 12L30 10L28 6Z"
      fill="url(#mmBlade1)"
    />
    <path
      d="M22 12L7 27L4 27L4 24L19 9L22 12Z"
      fill="url(#mmBlade1)"
      stroke="#FECACA"
      strokeWidth="0.5"
    />
    {/* Central Stylized Skull Motif */}
    <path
      d="M16 8C11.5 8 9 11 9 15C9 18 11 19.5 12 21L13 24H19L20 21C21 19.5 23 18 23 15C23 11 20.5 8 16 8Z"
      fill="url(#mmSkull)"
      stroke="#7F1D1D"
      strokeWidth="0.75"
    />
    {/* Glowing Menacing Crimson Eye Sockets */}
    <ellipse cx="13" cy="15" rx="1.8" ry="2.2" fill="#7F1D1D" />
    <circle cx="13" cy="15" r="1" fill="#EF4444" />
    <ellipse cx="19" cy="15" rx="1.8" ry="2.2" fill="#7F1D1D" />
    <circle cx="19" cy="15" r="1" fill="#EF4444" />
    {/* Skull Nose Cavity */}
    <path d="M16 17.5L15 19H17L16 17.5Z" fill="#7F1D1D" />
    {/* Skull Teeth Ridges */}
    <line x1="14.5" y1="21.5" x2="14.5" y2="23.5" stroke="#7F1D1D" strokeWidth="0.7" />
    <line x1="16" y1="21.5" x2="16" y2="23.5" stroke="#7F1D1D" strokeWidth="0.7" />
    <line x1="17.5" y1="21.5" x2="17.5" y2="23.5" stroke="#7F1D1D" strokeWidth="0.7" />
  </svg>
);

/**
 * 3. Rivals: Tactical sniper reticle (#06B6D4)
 */
export const RivalsEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #06B6D4)', ...style }}
  >
    <defs>
      <linearGradient id="rvCyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#A5F3FC" />
        <stop offset="50%" stopColor="#06B6D4" />
        <stop offset="100%" stopColor="#0891B2" />
      </linearGradient>
    </defs>
    {/* Outer Digital Tactical Corner Brackets */}
    <path d="M5 10V5H10" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M22 5H27V10" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M27 22V27H22" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M10 27H5V22" stroke="#06B6D4" strokeWidth="1.5" strokeLinecap="round" />
    {/* Outer Reticle Ring */}
    <circle cx="16" cy="16" r="10" stroke="url(#rvCyan)" strokeWidth="1.2" opacity="0.9" />
    {/* Inner Precision Target Ring */}
    <circle cx="16" cy="16" r="5" stroke="#A5F3FC" strokeWidth="1" strokeDasharray="2 1.5" />
    {/* Cardinal Crosshair Lines */}
    <line x1="16" y1="2" x2="16" y2="11" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="21" x2="16" y2="30" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="16" x2="11" y2="16" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="21" y1="16" x2="30" y2="16" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
    {/* Sub-Zero Elevation Mil-Dots */}
    <circle cx="16" cy="8" r="0.8" fill="#EC4899" />
    <circle cx="16" cy="24" r="0.8" fill="#EC4899" />
    <circle cx="8" cy="16" r="0.8" fill="#EC4899" />
    <circle cx="24" cy="16" r="0.8" fill="#EC4899" />
    {/* Central Target Center Pip */}
    <circle cx="16" cy="16" r="1.5" fill="#EF4444" stroke="#FFF" strokeWidth="0.5" />
  </svg>
);

/**
 * 4. Blade Ball: Electric lightning sphere (#A855F7)
 */
export const BladeBallEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #A855F7)', ...style }}
  >
    <defs>
      <radialGradient id="bbOrb" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#F3E8FF" />
        <stop offset="40%" stopColor="#C084FC" />
        <stop offset="80%" stopColor="#9333EA" />
        <stop offset="100%" stopColor="#581C87" />
      </radialGradient>
      <linearGradient id="bbBolt" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="50%" stopColor="#E9D5FF" />
        <stop offset="100%" stopColor="#C084FC" />
      </linearGradient>
    </defs>
    {/* Outer Tilted Orbit Ring */}
    <ellipse
      cx="16"
      cy="16"
      rx="13"
      ry="5.5"
      transform="rotate(-28 16 16)"
      stroke="#D8B4FE"
      strokeWidth="1.2"
      strokeDasharray="4 2"
      opacity="0.8"
    />
    {/* Central Psychic Energy Sphere */}
    <circle cx="16" cy="16" r="8.5" fill="url(#bbOrb)" stroke="#E9D5FF" strokeWidth="0.8" />
    {/* Core Electric Flash */}
    <circle cx="14" cy="13.5" r="3" fill="#FFFFFF" opacity="0.75" />
    {/* Crackling High-Voltage Lightning Bolts */}
    <path
      d="M16 3L14 10L17 11L13 19L19 14L16 13L18 3Z"
      fill="url(#bbBolt)"
    />
    <path
      d="M28 12L22 15L23.5 17L17 18L21 21L20 23L29 17L26 16L28 12Z"
      fill="#F3E8FF"
      opacity="0.9"
    />
    <path
      d="M5 19L10 17L9 15L15 15L11 12L12 10L4 15L6 16L5 19Z"
      fill="#E9D5FF"
      opacity="0.9"
    />
  </svg>
);

/**
 * 5. Evade: Neon sprint flame / energy wave (#10B981)
 */
export const EvadeEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #10B981)', ...style }}
  >
    <defs>
      <linearGradient id="evWave" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#047857" />
        <stop offset="45%" stopColor="#10B981" />
        <stop offset="85%" stopColor="#34D399" />
        <stop offset="100%" stopColor="#ECFDF5" />
      </linearGradient>
    </defs>
    {/* Aerodynamic Speed Lines */}
    <line x1="3" y1="9" x2="11" y2="9" stroke="#6EE7B7" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    <line x1="2" y1="16" x2="9" y2="16" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    <line x1="4" y1="23" x2="12" y2="23" stroke="#6EE7B7" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    {/* Main Dynamic Sprint Wave & Propulsion Flame */}
    <path
      d="M10 27C14 27 16 23 18 20C21 16 23 15 28 14C23 12 21 9 18 6C16 4 14 3 11 3C14 6 15 9 15 12C15 15 12 17 9 17C12 18 14 20 14 22C14 25 12 26 10 27Z"
      fill="url(#evWave)"
    />
    {/* Inner High-Speed Core Streak */}
    <path
      d="M14 22C16 20 18 17 22 15C18 14 16 12 14 9C16 11 17 13 17 15C17 17 16 19 14 22Z"
      fill="#FFFFFF"
      opacity="0.85"
    />
    {/* Forward Energy Burst Point */}
    <polygon points="28,14 23,12 24,14 23,16" fill="#A7F3D0" />
  </svg>
);

/**
 * 6. Steal Egg: Radiant cracked mythical egg with golden sunbeams (#EAB308)
 */
export const StealEggEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #EAB308)', ...style }}
  >
    <defs>
      <radialGradient id="eggBody" cx="45%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="40%" stopColor="#FACC15" />
        <stop offset="80%" stopColor="#CA8A04" />
        <stop offset="100%" stopColor="#854D0E" />
      </radialGradient>
      <linearGradient id="eggBeams" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="100%" stopColor="#FDE047" />
      </linearGradient>
    </defs>
    {/* Radiating Golden Sunbeams Bursting from Core */}
    <line x1="16" y1="2" x2="16" y2="7" stroke="url(#eggBeams)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="25" x2="16" y2="30" stroke="url(#eggBeams)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="16" x2="7" y2="16" stroke="url(#eggBeams)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="25" y1="16" x2="30" y2="16" stroke="url(#eggBeams)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="5" y1="5" x2="9" y2="9" stroke="url(#eggBeams)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="27" y1="5" x2="23" y2="9" stroke="url(#eggBeams)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="5" y1="27" x2="9" y2="23" stroke="url(#eggBeams)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="27" y1="27" x2="23" y2="23" stroke="url(#eggBeams)" strokeWidth="1.2" strokeLinecap="round" />
    {/* Mythical Egg Base Contour */}
    <path
      d="M16 6C10.5 6 7 12 7 18C7 23.5 11 27 16 27C21 27 25 23.5 25 18C25 12 21.5 6 16 6Z"
      fill="url(#eggBody)"
      stroke="#FEF08A"
      strokeWidth="0.8"
    />
    {/* Radiant Zig-Zag Crack with Emitted Intense Light */}
    <path
      d="M8.5 17L13 14L15 18L19 15L21 19L24 16"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13 14L15 18L19 15"
      stroke="#FEF9C3"
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.8"
    />
    {/* Golden Shimmer Accents */}
    <circle cx="12" cy="10" r="1.2" fill="#FFFFFF" opacity="0.8" />
    <circle cx="20" cy="22" r="1" fill="#FEF08A" opacity="0.8" />
  </svg>
);

/**
 * 7. Gamepasses: Holographic VIP voucher ticket (#EC4899)
 */
export const GamepassesEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #EC4899)', ...style }}
  >
    <defs>
      <linearGradient id="vipPass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FDF2F8" />
        <stop offset="35%" stopColor="#F472B6" />
        <stop offset="75%" stopColor="#EC4899" />
        <stop offset="100%" stopColor="#9D174D" />
      </linearGradient>
    </defs>
    {/* Holographic VIP Ticket with Notched Sides */}
    <path
      d="M5 8C5 6.89543 5.89543 6 7 6H25C26.1046 6 27 6.89543 27 8V13C25.5 13 24 14.3431 24 16C24 17.6569 25.5 19 27 19V24C27 25.1046 26.1046 26 25 26H7C5.89543 26 5 25.1046 5 24V19C6.5 19 8 17.6569 8 16C8 14.3431 6.5 13 5 13V8Z"
      fill="url(#vipPass)"
      stroke="#FBCFE8"
      strokeWidth="0.8"
    />
    {/* Dotted Tear Stub Line */}
    <line x1="11" y1="8" x2="11" y2="24" stroke="#FCE7F3" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.9" />
    {/* VIP Inscription Text */}
    <text
      x="18.5"
      y="18.5"
      fill="#FFFFFF"
      fontSize="7.5"
      fontWeight="900"
      fontFamily="sans-serif"
      letterSpacing="0.8"
      textAnchor="middle"
    >
      VIP
    </text>
    {/* Holographic Star Emblems */}
    <path
      d="M8 9.5L8.6 11L10 11.2L9 12.2L9.3 13.5L8 12.8L6.7 13.5L7 12.2L6 11.2L7.4 11L8 9.5Z"
      fill="#FDF2F8"
    />
    <path
      d="M8 18.5L8.6 20L10 20.2L9 21.2L9.3 22.5L8 21.8L6.7 22.5L7 21.2L6 20.2L7.4 20L8 18.5Z"
      fill="#FDF2F8"
    />
    {/* Holographic Sparkle Stars */}
    <circle cx="23.5" cy="10.5" r="0.8" fill="#FFF" />
    <circle cx="24.5" cy="21.5" r="0.8" fill="#FFF" />
  </svg>
);

/**
 * 8. Other: Futuristic console controller (#818CF8)
 */
export const OtherGamingEmblem: React.FC<GameEmblemProps> = ({
  className = 'w-6 h-6',
  style,
}) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ filter: 'drop-shadow(0 0 8px #818CF8)', ...style }}
  >
    <defs>
      <linearGradient id="padBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#C7D2FE" />
        <stop offset="40%" stopColor="#818CF8" />
        <stop offset="80%" stopColor="#4F46E5" />
        <stop offset="100%" stopColor="#312E81" />
      </linearGradient>
    </defs>
    {/* Futuristic Cyber Gamepad Body */}
    <path
      d="M10 8C7 8 4 10 4 15C4 20 6 25 8 26C10 27 12 25 13 22L14.5 18H17.5L19 22C20 25 22 27 24 26C26 25 28 20 28 15C28 10 25 8 22 8H10Z"
      fill="url(#padBody)"
      stroke="#E0E7FF"
      strokeWidth="0.8"
    />
    {/* Glowing Directional D-Pad (Left) */}
    <path
      d="M9 12H11V14H13V16H11V18H9V16H7V14H9V12Z"
      fill="#1E1B4B"
      stroke="#A5B4FC"
      strokeWidth="0.6"
    />
    {/* Glowing Action Buttons Diamond (Right) */}
    <circle cx="22" cy="13" r="1.1" fill="#38BDF8" />
    <circle cx="20" cy="15" r="1.1" fill="#F43F5E" />
    <circle cx="24" cy="15" r="1.1" fill="#34D399" />
    <circle cx="22" cy="17" r="1.1" fill="#FBBF24" />
    {/* Dual Thumbsticks */}
    <circle cx="12.5" cy="19.5" r="2" fill="#1E1B4B" stroke="#818CF8" strokeWidth="0.6" />
    <circle cx="12.5" cy="19.5" r="1" fill="#A5B4FC" />
    <circle cx="19.5" cy="19.5" r="2" fill="#1E1B4B" stroke="#818CF8" strokeWidth="0.6" />
    <circle cx="19.5" cy="19.5" r="1" fill="#A5B4FC" />
    {/* Center Cyber Accent Bar */}
    <rect x="14" y="11" width="4" height="1.5" rx="0.75" fill="#EEF2FF" />
  </svg>
);
