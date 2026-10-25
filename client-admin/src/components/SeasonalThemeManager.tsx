import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Gamepad2,
  Flame,
  Snowflake,
  Landmark,
  CheckCircle2,
  AlertCircle,
  Eye,
  Check,
  X,
  Loader2,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { AdminAPI } from '../services/api';
import { SeasonalThemeId, SeasonalThemeConfig } from '../types';

interface ThemeCardDef {
  id: SeasonalThemeId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  accentColor: string;
  borderColor: string;
  bgGradient: string;
  previewDecorations: string;
}

const THEMES: ThemeCardDef[] = [
  {
    id: 'gaming',
    name: 'Default Gaming',
    badge: 'Default & Fallback',
    tagline: 'Classic Uchiro Aesthetic',
    description:
      'Seamless space-doodle background pattern with celestial nebula glows. Clean, fast, and unchanged as the safe fallback.',
    icon: Gamepad2,
    accentColor: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    bgGradient: 'from-indigo-950/40 to-slate-900/60',
    previewDecorations: 'Space doodle pattern with cyan/violet ambient nebula.',
  },
  {
    id: 'halloween',
    name: 'Halloween',
    badge: 'Spooky Season',
    tagline: 'Webs, Spiders & Ambience',
    description:
      'Restrained corner spiderweb vector decorations, gentle floating animated spiders, deep violet/pumpkin glow, and optional spooky sound.',
    icon: Flame,
    accentColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    bgGradient: 'from-purple-950/40 via-slate-900/60 to-orange-950/30',
    previewDecorations: 'Corner spiderwebs, descending silk threads, subtle orange/purple radial glow.',
  },
  {
    id: 'christmas',
    name: 'Christmas',
    badge: 'Winter Holiday',
    tagline: 'Falling Snow & Lights',
    description:
      'Lightweight falling snow particles, glowing festive holiday lights garland along the top, frosty cyan ambiance, and optional winter chimes.',
    icon: Snowflake,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgGradient: 'from-slate-900/60 via-emerald-950/30 to-sky-950/30',
    previewDecorations: 'Festive garland bulbs, gentle snow drift, cool winter ambient highlights.',
  },
  {
    id: 'angkor-khmer',
    name: 'Angkor / Khmer',
    badge: 'Cultural Heritage',
    tagline: 'Temple Silhouette & Gold',
    description:
      'Refined Angkor Wat sanctuary silhouette, traditional Khmer decorative lotus motifs, and regal gold accents fitting the Uchiro palette.',
    icon: Landmark,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgGradient: 'from-amber-950/30 via-slate-900/60 to-yellow-950/20',
    previewDecorations: 'Five Angkor Wat towers, Khmer Kbach ornament, warm gold highlights.',
  },
];

export const SeasonalThemeManager: React.FC = () => {
  const [activeTheme, setActiveTheme] = useState<SeasonalThemeId>('gaming');
  const [themeConfig, setThemeConfig] = useState<SeasonalThemeConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation modal state
  const [confirmTheme, setConfirmTheme] = useState<ThemeCardDef | null>(null);

  // Local admin preview modal state (Never persists globally or affects customers)
  const [previewTheme, setPreviewTheme] = useState<ThemeCardDef | null>(null);

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    setIsLoading(true);
    try {
      const config = await AdminAPI.getSeasonalTheme();
      if (config?.active_theme) {
        setActiveTheme(config.active_theme);
        setThemeConfig(config);
      }
    } catch (err: any) {
      console.warn('Failed to fetch seasonal theme:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (theme: ThemeCardDef) => {
    setIsActivating(true);
    setFeedback(null);
    try {
      const updated = await AdminAPI.updateSeasonalTheme(theme.id);
      if (updated?.active_theme) {
        setActiveTheme(updated.active_theme);
        setThemeConfig(updated);
        setFeedback({
          type: 'success',
          message: `Theme "${theme.name}" successfully activated globally for all customers!`,
        });
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to activate theme.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsActivating(false);
      setConfirmTheme(null);
    }
  };

  return (
    <div className="bg-[#111622] border border-white/10 rounded-2xl p-5 space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span>Seasonal Store Themes</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PROMPT 6
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Manage the visual theme and atmospheric decorations for customer Store Mini App & site.
            </p>
          </div>
        </div>

        {/* Current Active Indicator */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active:</span>
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {THEMES.find((t) => t.id === activeTheme)?.name || 'Default Gaming'}
            </span>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2.5 text-xs font-bold rounded-xl p-3.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Theme Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {THEMES.map((theme) => {
          const isActive = activeTheme === theme.id;
          const Icon = theme.icon;

          return (
            <div
              key={theme.id}
              className={`rounded-2xl border p-4.5 transition-all relative overflow-hidden flex flex-col justify-between bg-gradient-to-br ${
                theme.bgGradient
              } ${
                isActive
                  ? 'border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-lg'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute top-3 right-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Active Theme</span>
                </div>
              )}

              {/* Theme Header & Info */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl bg-black/40 border ${theme.borderColor} ${theme.accentColor}`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">{theme.name}</h4>
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {theme.badge} • {theme.tagline}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">{theme.description}</p>
              </div>

              {/* Action Buttons: Preview & Activate */}
              <div className="flex items-center gap-2 pt-4 mt-3 border-t border-white/5">
                {/* Preview Action (Safe, purely local to admin) */}
                <button
                  type="button"
                  onClick={() => setPreviewTheme(theme)}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  <span>Preview</span>
                </button>

                {/* Activate Globally Action */}
                <button
                  type="button"
                  disabled={isActive || isActivating}
                  onClick={() => setConfirmTheme(theme)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 cursor-default'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                  }`}
                >
                  {isActive ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scheduling & Safety Documentation Box */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <Calendar className="w-3.5 h-3.5 text-indigo-400" />
          <span>Seasonal Theme Scheduling Architecture:</span>
        </div>
        <p>
          Manual activation is currently authoritative and persists centrally in PostgreSQL and memory.
          Automatic date-based scheduling (Asia/Phnom_Penh timezone) is documented as not yet implemented
          and planned for a future release to prevent accidental mid-event overrides.
        </p>
      </div>

      {/* Confirmation Modal */}
      {confirmTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#161B2A] border border-white/20 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <Sparkles className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black text-white">Confirm Global Theme Activation</h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              You are about to activate <strong className="text-white font-bold">{confirmTheme.name}</strong> globally for all customers.
              Store visitors will immediately see the new seasonal atmosphere across all devices.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isActivating}
                onClick={() => setConfirmTheme(null)}
                className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isActivating}
                onClick={() => handleActivate(confirmTheme)}
                className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg flex items-center gap-1.5 transition-colors"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Activate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Live Preview Modal (Safe: Never mutates global theme or customer sessions) */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#0F1422] border border-white/20 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Admin Preview: {previewTheme.name}
                </h4>
              </div>
              <button
                onClick={() => setPreviewTheme(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Card Simulation */}
            <div
              className={`rounded-xl border p-4 bg-gradient-to-br ${previewTheme.bgGradient} ${previewTheme.borderColor} space-y-3 relative overflow-hidden`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg bg-black/50 ${previewTheme.accentColor}`}>
                  <previewTheme.icon className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">{previewTheme.name}</h5>
                  <span className="text-[10px] text-slate-400">{previewTheme.tagline}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/60 border border-white/5 space-y-1.5 text-[11px]">
                <span className="font-bold text-amber-300 block">Atmospheric Accents:</span>
                <p className="text-slate-300">{previewTheme.previewDecorations}</p>
              </div>

              <div className="text-[10px] text-slate-400 italic">
                ℹ️ Preview does not change the global theme for customers.
              </div>
            </div>

            {/* Open in Store Mini App with query param */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <a
                href={`/?theme=${previewTheme.id}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span>Open Store Preview Link</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <button
                type="button"
                onClick={() => {
                  const themeToActivate = previewTheme;
                  setPreviewTheme(null);
                  setConfirmTheme(themeToActivate);
                }}
                className="py-2 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-colors"
              >
                Activate Globally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
