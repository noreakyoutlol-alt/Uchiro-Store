import React from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Music,
  Moon,
  Sun,
  Globe,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { useAudio } from '../../context/AudioPlayerContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { isPlaying, isMuted, volume, togglePlay, toggleMute, setVolume } = useAudio();
  const { language, setLanguage } = useLanguage();
  const { themeMode, setThemeMode } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#121624] border-t sm:border border-slate-200 dark:border-white/10 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              {language === 'km' ? 'ការកំណត់' : 'Settings'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-5">
          {/* 1. BACKGROUND MUSIC (BGM) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {language === 'km' ? 'តន្ត្រីផ្ទៃខាងក្រោយ (BGM)' : 'Background Music (BGM)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isPlaying ? 'Playing • Uchiro Theme' : 'Off'}
                  </p>
                </div>
              </div>

              {/* Music On/Off Toggle Button */}
              <button
                type="button"
                onClick={togglePlay}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isPlaying ? 'bg-amber-400' : 'bg-slate-300 dark:bg-white/20'
                }`}
                title="Toggle Music"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPlaying ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Audio Controls (Play/Pause, Mute, Volume Slider) */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isPlaying
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>{language === 'km' ? 'ផ្អាក' : 'Pause'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{language === 'km' ? 'ចាក់' : 'Play'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  Vol
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/20 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 w-8 text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* 2. LANGUAGE PREFERENCE */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{language === 'km' ? 'ភាសា' : 'Language'}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  language === 'en'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-500 dark:text-amber-400'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇺🇸</span>
                  <span>English</span>
                </div>
                {language === 'en' && <Check className="w-4 h-4 text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setLanguage('km')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  language === 'km'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-500 dark:text-amber-400'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇰🇭</span>
                  <span>ភាសាខ្មែរ</span>
                </div>
                {language === 'km' && <Check className="w-4 h-4 text-amber-400" />}
              </button>
            </div>
          </div>

          {/* 3. THEME MODE */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'km' ? 'ទម្រង់ផ្ទៃ' : 'Theme Mode'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  themeMode === 'dark'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-500 dark:text-amber-400'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  <span>Dark</span>
                </div>
                {themeMode === 'dark' && <Check className="w-4 h-4 text-amber-400" />}
              </button>

              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  themeMode === 'light'
                    ? 'border-amber-400 bg-amber-500/10 text-amber-500 dark:text-amber-400'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  <span>Light</span>
                </div>
                {themeMode === 'light' && <Check className="w-4 h-4 text-amber-400" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>Uchiro Store V3.0</span>
          <span>Telegram Mini App</span>
        </div>
      </div>
    </div>
  );
};
