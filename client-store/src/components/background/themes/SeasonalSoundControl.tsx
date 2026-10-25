import React from 'react';
import { Volume2, VolumeX, Eye, X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';

export const SeasonalSoundControl: React.FC = () => {
  const {
    activeSeasonalTheme,
    previewTheme,
    clearPreviewTheme,
    isSeasonalSoundEnabled,
    toggleSeasonalSound,
  } = useTheme();
  const { language } = useLanguage();

  const hasAudio = activeSeasonalTheme === 'halloween' || activeSeasonalTheme === 'christmas';

  return (
    <>
      {/* 1. Preview Mode Notification Banner (Visible only in preview mode) */}
      {previewTheme && (
        <div className="fixed top-0 inset-x-0 z-50 bg-gradient-to-r from-amber-600 via-indigo-600 to-purple-600 text-white text-[11px] font-bold py-1.5 px-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-1.5 truncate">
            <Eye className="w-3.5 h-3.5 shrink-0 animate-pulse text-amber-300" />
            <span className="truncate">
              {language === 'km'
                ? `កំពុងមើលសាកល្បង Theme: ${previewTheme.toUpperCase()} (Admin Preview)`
                : `Previewing Theme: ${previewTheme.toUpperCase()} (Admin Preview)`}
            </span>
          </div>
          <button
            onClick={clearPreviewTheme}
            className="flex items-center gap-1 bg-black/40 hover:bg-black/60 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0 transition-colors"
            title="Exit preview mode"
          >
            <span>Exit</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 2. Accessible Sound Toggle Control (Only rendered when the active theme supports audio) */}
      {hasAudio && (
        <div className="fixed bottom-20 right-3 z-30 pointer-events-auto">
          <button
            type="button"
            onClick={toggleSeasonalSound}
            aria-label={
              isSeasonalSoundEnabled
                ? language === 'km'
                  ? 'បិទសំឡេង Theme'
                  : 'Mute seasonal theme audio'
                : language === 'km'
                  ? 'បើកសំឡេង Theme'
                  : 'Play seasonal theme audio'
            }
            title={
              isSeasonalSoundEnabled
                ? 'Mute seasonal sound'
                : `Play ${activeSeasonalTheme === 'halloween' ? 'Spooky Halloween' : 'Holiday Christmas'} sound`
            }
            className={`p-2.5 rounded-full backdrop-blur-md border shadow-xl flex items-center gap-1.5 text-xs font-bold transition-all duration-300 ${
              isSeasonalSoundEnabled
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-400 ring-2 ring-amber-400/30'
                : 'bg-black/60 border-white/10 text-slate-400 hover:text-white hover:bg-black/80'
            }`}
          >
            {isSeasonalSoundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 animate-bounce text-amber-400" />
                <span className="text-[10px] pr-1 hidden sm:inline">Sound ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                <span className="text-[10px] pr-1 hidden sm:inline">Sound OFF</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
};
