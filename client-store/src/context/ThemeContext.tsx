import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SeasonalThemeId } from '../types';
import { StoreAPI } from '../services/api';
import { seasonalAudio } from '../services/seasonal-audio';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ActiveTheme = 'dark' | 'light';

export const VALID_SEASONAL_THEMES: readonly SeasonalThemeId[] = [
  'gaming',
  'halloween',
  'christmas',
  'angkor-khmer',
] as const;

interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: ActiveTheme;
  setThemeMode: (mode: ThemeMode) => void;
  patternUrl: string;

  // Seasonal Themes (Prompt 6)
  seasonalTheme: SeasonalThemeId;
  activeSeasonalTheme: SeasonalThemeId;
  previewTheme: SeasonalThemeId | null;
  setPreviewTheme: (theme: SeasonalThemeId | null) => void;
  clearPreviewTheme: () => void;
  isSeasonalSoundEnabled: boolean;
  toggleSeasonalSound: () => void;
  prefersReducedMotion: boolean;
  refreshSeasonalTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  activeTheme: 'dark',
  setThemeMode: () => {},
  patternUrl: '/pattern.svg',

  seasonalTheme: 'gaming',
  activeSeasonalTheme: 'gaming',
  previewTheme: null,
  setPreviewTheme: () => {},
  clearPreviewTheme: () => {},
  isSeasonalSoundEnabled: false,
  toggleSeasonalSound: () => {},
  prefersReducedMotion: false,
  refreshSeasonalTheme: async () => {},
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

  // Seasonal Theme State
  const [seasonalTheme, setSeasonalTheme] = useState<SeasonalThemeId>('gaming');
  const [previewTheme, setPreviewThemeState] = useState<SeasonalThemeId | null>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('theme')?.toLowerCase();
      if (param && (VALID_SEASONAL_THEMES as readonly string[]).includes(param)) {
        return param as SeasonalThemeId;
      }
    }
    return null;
  });

  const [isSeasonalSoundEnabled, setIsSeasonalSoundEnabled] = useState<boolean>(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Active theme is previewTheme if currently in preview, otherwise the persisted global seasonalTheme
  const activeSeasonalTheme: SeasonalThemeId = previewTheme || seasonalTheme;

  // Dark/light mode effect
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

  // Reduced motion media query listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Fetch authoritative seasonal theme from server on mount
  const refreshSeasonalTheme = useCallback(async () => {
    try {
      const data = await StoreAPI.getSeasonalTheme();
      if (data?.active_theme && (VALID_SEASONAL_THEMES as readonly string[]).includes(data.active_theme)) {
        setSeasonalTheme(data.active_theme);
      } else {
        setSeasonalTheme('gaming');
      }
    } catch {
      setSeasonalTheme('gaming');
    }
  }, []);

  useEffect(() => {
    refreshSeasonalTheme();
  }, [refreshSeasonalTheme]);

  // Handle seasonal audio state transitions
  useEffect(() => {
    // Stop seasonal audio immediately if sound is disabled or theme switches to one without sound
    if (!isSeasonalSoundEnabled || activeSeasonalTheme === 'gaming' || activeSeasonalTheme === 'angkor-khmer') {
      seasonalAudio.stop();
      return;
    }

    // Play active seasonal sound (only starts because isSeasonalSoundEnabled was explicitly toggled)
    seasonalAudio.play(activeSeasonalTheme);

    return () => {
      seasonalAudio.stop();
    };
  }, [activeSeasonalTheme, isSeasonalSoundEnabled]);

  // Sound toggle (strictly user initiated)
  const toggleSeasonalSound = useCallback(() => {
    setIsSeasonalSoundEnabled((prev) => {
      const next = !prev;
      if (!next) {
        seasonalAudio.stop();
      }
      return next;
    });
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('uchiro_store_theme', mode);
    } catch {
      // storage unavailable
    }
  };

  const setPreviewTheme = (theme: SeasonalThemeId | null) => {
    setPreviewThemeState(theme);
    // Turn off sound when switching preview
    if (!theme || theme === 'gaming') {
      setIsSeasonalSoundEnabled(false);
      seasonalAudio.stop();
    }
  };

  const clearPreviewTheme = () => {
    setPreviewThemeState(null);
    setIsSeasonalSoundEnabled(false);
    seasonalAudio.stop();
  };

  // Project Pattern Asset: pattern.svg
  const patternUrl = '/pattern.svg';

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        activeTheme,
        setThemeMode,
        patternUrl,
        seasonalTheme,
        activeSeasonalTheme,
        previewTheme,
        setPreviewTheme,
        clearPreviewTheme,
        isSeasonalSoundEnabled,
        toggleSeasonalSound,
        prefersReducedMotion,
        refreshSeasonalTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
