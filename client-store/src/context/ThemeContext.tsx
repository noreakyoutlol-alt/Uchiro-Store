import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ActiveTheme = 'dark' | 'light';

interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  setThemeMode: (mode: ThemeMode) => void;
  patternUrl: string;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  activeTheme: 'dark',
  setThemeMode: () => {},
  patternUrl: '/pattern-black.jpg',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('uchiro_store_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'dark'; // default to dark gaming aesthetic
  });

  const [activeTheme, setActiveTheme] = useState<ActiveTheme>('dark');

  useEffect(() => {
    let resolved: ActiveTheme = 'dark';
    if (themeMode === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      resolved = prefersDark ? 'dark' : 'light';
    } else {
      resolved = themeMode;
    }

    setActiveTheme(resolved);
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [themeMode]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('uchiro_store_theme', mode);
    } catch {
      // storage unavailable
    }
  };

  // Original Project Pattern Assets
  const patternUrl = activeTheme === 'dark'
    ? '/pattern-black.jpg'
    : '/pattern-white.jpg';

  return (
    <ThemeContext.Provider value={{ themeMode, activeTheme, setThemeMode, patternUrl }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
