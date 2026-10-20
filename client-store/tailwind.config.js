/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        uchiro: {
          dark: '#0B0E14',
          card: '#121624',
          surface: '#181E30',
          border: 'rgba(255, 255, 255, 0.08)',
          primary: '#E63946',
          crimson: '#C1121F',
          gold: '#FFD166',
          goldDark: '#D4A017',
          pink: '#FF6B8B',
          cloud: '#F8F9FA',
          doodle: '#3A4468',
          accent: '#7209B7',
          cyber: '#4361EE',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Kantumruy Pro"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      },
      animation: {
        'cloud-pulse': 'cloudPulse 4s ease-in-out infinite',
        'float-slow': 'floatSlow 6s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
        'gear5-glow': 'gear5Glow 2.5s ease-in-out infinite',
        'scanline': 'scanline 2s linear infinite',
      },
      keyframes: {
        cloudPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.06)', opacity: '0.85' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        gear5Glow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 12px rgba(255, 255, 255, 0.4))' },
          '50%': { filter: 'drop-shadow(0 0 24px rgba(255, 209, 102, 0.7))' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
