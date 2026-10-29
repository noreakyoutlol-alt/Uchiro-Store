import React from 'react';
import { Eye, X } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useLanguage } from '../../../context/LanguageContext';

export const SeasonalSoundControl: React.FC = () => {
  const {
    previewTheme,
    clearPreviewTheme,
  } = useTheme();
  const { language } = useLanguage();

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
    </>
  );
};
