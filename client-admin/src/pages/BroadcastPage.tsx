import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Clock,
  Sparkles,
  Check,
  X,
  Edit2,
  Users,
  History,
  Image,
  Video,
  LinkIcon,
  ShoppingBag,
  Globe,
  RefreshCw,
  Ban,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AdminAPI } from '../services/api';
import {
  BroadcastType,
  BroadcastAudience,
  BroadcastCampaign,
  BroadcastPreview,
  BroadcastButtonConfig,
  BroadcastMediaType,
} from '../types';

// ── Validation helpers (client-side) ─────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const p = new URL(url.trim());
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch {
    return false;
  }
}
function isValidLabel(label: string): boolean {
  return label.trim().length > 0 && label.trim().length <= 64;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BroadcastCampaign['status'] }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft:      { cls: 'bg-slate-700 text-slate-300',       label: 'Draft' },
    pending:    { cls: 'bg-amber-900/60 text-amber-400',    label: 'Pending' },
    running:    { cls: 'bg-blue-900/60 text-blue-400',      label: 'Sending…' },
    completed:  { cls: 'bg-green-900/60 text-green-400',    label: 'Completed' },
    failed:     { cls: 'bg-red-900/60 text-red-400',        label: 'Failed' },
    cancelled:  { cls: 'bg-slate-800 text-slate-500',       label: 'Cancelled' },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-slate-700 text-slate-300', label: status };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${cls}`}>
      {label}
    </span>
  );
}

// ── Type options ──────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: BroadcastType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'text_only',          icon: <Edit2 className="w-3.5 h-3.5" />,       label: 'Text Only',           desc: 'Plain announcement' },
  { value: 'text_shop_now',      icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Text + Shop Now',     desc: 'Includes a Shop Now button linking to the store' },
  { value: 'text_custom_button', icon: <LinkIcon className="w-3.5 h-3.5" />,    label: 'Text + Custom Button', desc: 'Include your own button label and URL' },
  { value: 'media_caption',      icon: <Image className="w-3.5 h-3.5" />,       label: 'Media + Caption',     desc: 'Send a photo or video with optional caption and button' },
];

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: 'all', label: 'All Registered Users' },
  { value: 'en',  label: 'English-preference Users' },
  { value: 'km',  label: 'Khmer-preference Users' },
];

// ── Composer (Step 1) ─────────────────────────────────────────────────────────

interface ComposerState {
  type: BroadcastType;
  audience: BroadcastAudience;
  text: string;
  textKm: string;
  textEn: string;
  bilingual: boolean;
  mediaType: BroadcastMediaType;
  mediaUrl: string;
  buttonLabel: string;
  buttonUrl: string;
  idempotencyKey: string;
}

const defaultState: ComposerState = {
  type: 'text_only',
  audience: 'all',
  text: '',
  textKm: '',
  textEn: '',
  bilingual: false,
  mediaType: 'photo',
  mediaUrl: '',
  buttonLabel: '',
  buttonUrl: '',
  idempotencyKey: '',
};

function generateIdempotencyKey(): string {
  return `bc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ── Draft Broadcast Notifications card (existing feature, preserved) ──────────

interface BroadcastDraft {
  id: string;
  batch_number: number;
  order_count: number;
  title: string;
  message: string;
  status: 'draft' | 'broadcasted' | 'dismissed';
  created_at: string;
}

// ── Main component ────────────────────────────────────────────────────────────

type Step = 'compose' | 'preview' | 'sent';

export const BroadcastPage: React.FC = () => {
  // Composer
  const [step, setStep] = useState<Step>('compose');
  const [form, setForm] = useState<ComposerState>({ ...defaultState, idempotencyKey: generateIdempotencyKey() });
  const [errors, setErrors] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<BroadcastCampaign | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // History
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Legacy 3-order drafts
  const [drafts, setDrafts] = useState<BroadcastDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const data = await AdminAPI.listBroadcastCampaigns();
      setCampaigns(data || []);
    } catch {
      // not fatal
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setIsLoadingDrafts(true);
    try {
      const data = await AdminAPI.getOrderDrafts();
      setDrafts(data || []);
    } catch {
      // not fatal
    } finally {
      setIsLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    loadDrafts();
  }, [loadHistory, loadDrafts]);

  // Poll running campaigns
  useEffect(() => {
    const ids = campaigns.filter((c) => c.status === 'pending' || c.status === 'running').map((c) => c.id);
    if (ids.length === 0) return;
    const interval = setInterval(() => loadHistory(), 4000);
    return () => clearInterval(interval);
  }, [campaigns, loadHistory]);

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): string[] {
    const errs: string[] = [];
    const { type, bilingual, text, textKm, textEn, mediaType, mediaUrl, buttonLabel, buttonUrl } = form;

    if (type === 'text_only' || type === 'text_shop_now') {
      if (bilingual) {
        if (!textKm.trim() && !textEn.trim()) errs.push('At least one language variant (Khmer or English) is required');
      } else {
        if (!text.trim()) errs.push('Message text is required');
      }
    }

    if (type === 'text_custom_button') {
      if (bilingual) {
        if (!textKm.trim() && !textEn.trim()) errs.push('At least one language variant is required');
      } else {
        if (!text.trim()) errs.push('Message text is required');
      }
      if (!buttonLabel.trim()) errs.push('Button label is required');
      if (buttonLabel.trim().length > 64) errs.push('Button label must be 64 characters or fewer');
      if (!buttonUrl.trim()) errs.push('Button URL is required');
      if (buttonUrl.trim() && !isValidUrl(buttonUrl)) errs.push('Button URL must be a valid http:// or https:// URL');
    }

    if (type === 'media_caption') {
      if (!mediaUrl.trim()) errs.push('Media URL is required');
      if (mediaUrl.trim() && !mediaUrl.trim().startsWith('https://')) errs.push('Media URL must start with https://');
      if (buttonLabel.trim() && !buttonUrl.trim()) errs.push('Button URL is required when a button label is provided');
      if (buttonUrl.trim() && !isValidUrl(buttonUrl)) errs.push('Button URL must be a valid http:// or https:// URL');
    }

    return errs;
  }

  // ── Build API params ─────────────────────────────────────────────────────────

  function buildParams() {
    const button: BroadcastButtonConfig | undefined =
      form.type === 'text_custom_button' || (form.type === 'media_caption' && form.buttonLabel.trim())
        ? { label: form.buttonLabel.trim(), url: form.buttonUrl.trim() }
        : undefined;

    return {
      type: form.type,
      audience: form.audience,
      text: (!form.bilingual && form.text.trim()) ? form.text.trim() : undefined,
      text_km: form.bilingual ? form.textKm.trim() || undefined : undefined,
      text_en: form.bilingual ? form.textEn.trim() || undefined : undefined,
      media_type: form.type === 'media_caption' ? form.mediaType : undefined,
      media_url: form.type === 'media_caption' ? form.mediaUrl.trim() : undefined,
      button,
      idempotency_key: form.idempotencyKey,
    };
  }

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handlePreview = async () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setIsPreviewing(true);
    try {
      const params = buildParams();
      const result = await AdminAPI.previewBroadcast(params);
      setPreview(result);
      setStep('preview');
    } catch (e: any) {
      setErrors([e?.response?.data?.error || e.message || 'Preview failed']);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!window.confirm(
      `Are you absolutely sure you want to send this broadcast?\n\nTarget: ${preview?.target_count ?? '?'} users\n\nThis cannot be undone.`
    )) return;

    setIsDispatching(true);
    setDispatchError(null);
    try {
      const params = buildParams();
      // Create draft
      const { campaign } = draftCampaignId
        ? { campaign: { id: draftCampaignId } }
        : await AdminAPI.createBroadcastCampaign(params, form.idempotencyKey);

      const actualId = draftCampaignId || campaign.id;
      setDraftCampaignId(actualId);

      // Confirm dispatch
      const dispatched = await AdminAPI.confirmBroadcast(actualId);
      setDispatchResult(dispatched);
      setStep('sent');
      // Refresh history
      await loadHistory();
    } catch (e: any) {
      setDispatchError(e?.response?.data?.error || e.message || 'Dispatch failed');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancel = async () => {
    if (draftCampaignId) {
      try {
        await AdminAPI.cancelBroadcast(draftCampaignId);
      } catch {
        // not fatal
      }
    }
    setStep('compose');
    setPreview(null);
    setDraftCampaignId(null);
    setErrors([]);
    setDispatchError(null);
  };

  const handleNewBroadcast = () => {
    setForm({ ...defaultState, idempotencyKey: generateIdempotencyKey() });
    setPreview(null);
    setDraftCampaignId(null);
    setDispatchResult(null);
    setDispatchError(null);
    setErrors([]);
    setStep('compose');
  };

  const setField = (key: keyof ComposerState, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ── Legacy draft handlers ──────────────────────────────────────────────────

  const handleBroadcastDraft = async (id: string) => {
    if (!window.confirm('Send this auto-generated notification to all customers?')) return;
    setActionLoadingId(id);
    try {
      await AdminAPI.broadcastOrderDraft(id);
      await loadDrafts();
    } catch {
      // not fatal
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismissDraft = async (id: string) => {
    setActionLoadingId(id);
    try {
      await AdminAPI.dismissOrderDraft(id);
      await loadDrafts();
    } catch {
      // not fatal
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Preview panel ──────────────────────────────────────────────────────────

  const renderPreviewMessage = (p: BroadcastPreview['preview_en'], lang: string) => (
    <div className="p-3 rounded-xl bg-[#1a1f2e] border border-white/10 space-y-2">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{lang}</div>
      {p.media_type && p.media_url && (
        <div className="flex items-center gap-2 text-xs text-slate-300">
          {p.media_type === 'video' ? <Video className="w-4 h-4 text-purple-400" /> : <Image className="w-4 h-4 text-blue-400" />}
          <a href={p.media_url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-400 underline">{p.media_url}</a>
        </div>
      )}
      {(p.text || p.caption) && (
        <div className="text-xs text-white whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
          {p.text || p.caption}
        </div>
      )}
      {p.button && (
        <div className="mt-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600/80 text-white text-xs font-semibold">
            {p.button.label}
          </span>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{p.button.url}</div>
        </div>
      )}
    </div>
  );

  // ── Campaign history row ───────────────────────────────────────────────────

  const renderCampaignRow = (c: BroadcastCampaign) => (
    <div key={c.id} className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={c.status} />
        <span className="text-[10px] text-slate-400">by admin {c.created_by_admin}</span>
        <span className="text-[10px] text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
      </div>
      <div className="text-xs text-white font-semibold">
        {TYPE_OPTIONS.find(o => o.value === c.type)?.label ?? c.type}
        {' — '}
        <span className="text-slate-400 font-normal">
          {AUDIENCE_OPTIONS.find(a => a.value === c.audience)?.label ?? c.audience}
        </span>
      </div>
      {c.text && <div className="text-[11px] text-slate-400 truncate">{c.text.slice(0, 100)}</div>}
      {(c.status === 'completed' || c.status === 'running') && (
        <div className="flex gap-3 text-[10px] pt-0.5">
          <span className="text-green-400">✓ {c.sent_count} sent</span>
          <span className="text-slate-400">/ {c.target_count} total</span>
          {c.failed_count > 0 && <span className="text-red-400">✗ {c.failed_count} failed</span>}
          {c.blocked_count > 0 && <span className="text-slate-500">🚫 {c.blocked_count} blocked</span>}
        </div>
      )}
      {c.status === 'running' && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-400 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" /> Delivering…
        </div>
      )}
      {c.error_message && (
        <div className="text-[10px] text-red-400">Error: {c.error_message.slice(0, 100)}</div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-400" />
          <span>BROADCAST CENTER</span>
        </h2>
        <p className="text-xs text-slate-400">
          Compose and dispatch Telegram announcements to your customer base. Preview before sending. No message is sent unless you confirm.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Composer / Preview / Sent ── */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-4">

          {/* ── Step: Compose ── */}
          {step === 'compose' && (
            <>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-indigo-400" /> Compose Broadcast
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/40 space-y-1">
                  {errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-400 flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {e}
                    </div>
                  ))}
                </div>
              )}

              {/* Type selection */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1.5">Broadcast Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setField('type', opt.value)}
                      className={`flex flex-col p-2.5 rounded-xl border text-left text-xs gap-1 transition-all ${
                        form.type === opt.value
                          ? 'border-indigo-500 bg-indigo-900/30 text-white'
                          : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-semibold">
                        {opt.icon} {opt.label}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Audience</label>
                <select
                  value={form.audience}
                  onChange={(e) => setField('audience', e.target.value as BroadcastAudience)}
                  className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                >
                  {AUDIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Media URL + type (media_caption) */}
              {form.type === 'media_caption' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">Media Type</label>
                    <div className="flex gap-3">
                      {(['photo', 'video'] as const).map((mt) => (
                        <button
                          key={mt}
                          onClick={() => setField('mediaType', mt)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            form.mediaType === mt
                              ? 'border-indigo-500 bg-indigo-900/30 text-white'
                              : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/20'
                          }`}
                        >
                          {mt === 'video' ? <Video className="w-3.5 h-3.5" /> : <Image className="w-3.5 h-3.5" />}
                          {mt.charAt(0).toUpperCase() + mt.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                      Media URL (https://)
                    </label>
                    <input
                      type="url"
                      value={form.mediaUrl}
                      onChange={(e) => setField('mediaUrl', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Must be a public https:// URL. Photos max 5 MB, videos max 50 MB (Telegram limits).
                    </p>
                  </div>
                </div>
              )}

              {/* Message text / bilingual */}
              {(form.type !== 'media_caption' || true) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                      {form.type === 'media_caption' ? 'Caption (optional)' : 'Message'}
                    </label>
                    <button
                      onClick={() => setField('bilingual', !form.bilingual)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                        form.bilingual
                          ? 'border-amber-500 bg-amber-900/30 text-amber-400'
                          : 'border-white/10 bg-black/30 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      🌐 {form.bilingual ? 'Bilingual ON' : 'Use Bilingual Variants'}
                    </button>
                  </div>

                  {!form.bilingual ? (
                    <textarea
                      rows={5}
                      value={form.text}
                      onChange={(e) => setField('text', e.target.value)}
                      placeholder={form.type === 'media_caption' ? 'Optional caption…' : 'Your announcement…'}
                      maxLength={4096}
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 resize-y placeholder-slate-600"
                    />
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-amber-400 font-semibold block mb-0.5">🇰🇭 Khmer (km)</label>
                        <textarea
                          rows={3}
                          value={form.textKm}
                          onChange={(e) => setField('textKm', e.target.value)}
                          placeholder="ខ្មែរ…"
                          maxLength={4096}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500 resize-y placeholder-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-blue-400 font-semibold block mb-0.5">🇬🇧 English (en)</label>
                        <textarea
                          rows={3}
                          value={form.textEn}
                          onChange={(e) => setField('textEn', e.target.value)}
                          placeholder="English…"
                          maxLength={4096}
                          className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500 resize-y placeholder-slate-600"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 flex items-start gap-1">
                        <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Recipients with Khmer preference see the Khmer text; all others see the English text. These are provided by you — no automatic translation.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Custom button (text_custom_button or media_caption optional) */}
              {(form.type === 'text_custom_button' || form.type === 'media_caption') && (
                <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/5">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <LinkIcon className="w-3 h-3" />
                    {form.type === 'media_caption' ? 'Optional Button' : 'Custom Button'}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Button Label (English, max 64 chars)</label>
                    <input
                      type="text"
                      value={form.buttonLabel}
                      onChange={(e) => setField('buttonLabel', e.target.value)}
                      maxLength={64}
                      placeholder="Learn More"
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-0.5">Button URL (http:// or https://)</label>
                    <input
                      type="url"
                      value={form.buttonUrl}
                      onChange={(e) => setField('buttonUrl', e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600"
                    />
                  </div>
                </div>
              )}

              {/* Shop Now info */}
              {form.type === 'text_shop_now' && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-900/20 border border-indigo-700/30 text-xs text-indigo-300">
                  <Globe className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-400" />
                  <span>A "🛍️ Shop Now" button will be added linking to the official Uchiro Store URL.</span>
                </div>
              )}

              <button
                onClick={handlePreview}
                disabled={isPreviewing}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isPreviewing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating preview…</>
                ) : (
                  <><Eye className="w-4 h-4" /> Preview Broadcast</>
                )}
              </button>
            </>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && preview && (
            <>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-400" /> Preview — Confirm Before Sending
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1 text-xs">
                <div className="flex gap-4 text-slate-400">
                  <span><b className="text-white">Type:</b> {TYPE_OPTIONS.find(o => o.value === preview.type)?.label}</span>
                  <span><b className="text-white">Audience:</b> {AUDIENCE_OPTIONS.find(a => a.value === preview.audience)?.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <b>{preview.target_count}</b> eligible recipients
                </div>
                {preview.is_bilingual && (
                  <div className="text-amber-400 text-[10px] flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Bilingual — recipients see their preferred language
                  </div>
                )}
              </div>

              {preview.is_bilingual ? (
                <div className="space-y-2">
                  {renderPreviewMessage(preview.preview_km, '🇰🇭 Khmer recipients')}
                  {renderPreviewMessage(preview.preview_en, '🇬🇧 English recipients')}
                </div>
              ) : (
                renderPreviewMessage(preview.preview_en, 'All recipients')
              )}

              {dispatchError && (
                <div className="p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-xs text-red-400 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {dispatchError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={() => setStep('compose')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={handleConfirmSend}
                  disabled={isDispatching}
                  className="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isDispatching ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Confirm Send</>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Step: Sent ── */}
          {step === 'sent' && dispatchResult && (
            <>
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Broadcast Dispatched
              </div>

              <div className="p-4 rounded-xl bg-green-900/20 border border-green-700/30 space-y-2">
                <div className="text-sm text-green-400 font-bold">
                  {dispatchResult.status === 'pending' || dispatchResult.status === 'running'
                    ? '⏳ Delivery in progress…'
                    : '✅ Delivery complete'
                  }
                </div>
                <div className="text-xs text-slate-300 space-y-0.5">
                  <div>Status: <b className="text-white">{dispatchResult.status}</b></div>
                  <div>Target: <b className="text-white">{dispatchResult.target_count}</b> users</div>
                  {dispatchResult.sent_count > 0 && (
                    <div className="text-green-400">✓ {dispatchResult.sent_count} delivered</div>
                  )}
                  {dispatchResult.failed_count > 0 && (
                    <div className="text-red-400">✗ {dispatchResult.failed_count} failed</div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Delivery runs in the background — check Campaign History for live updates.
                </p>
              </div>

              <button
                onClick={handleNewBroadcast}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Megaphone className="w-4 h-4" /> New Broadcast
              </button>
            </>
          )}
        </div>

        {/* ── Right: History ── */}
        <div className="space-y-4">

          {/* Campaign history */}
          <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-indigo-400" /> Campaign History
              </div>
              <button
                onClick={loadHistory}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                title="Refresh history"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Loading…
              </div>
            ) : campaigns.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No broadcast campaigns yet.
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map(renderCampaignRow)}
              </div>
            )}
          </div>

          {/* Legacy 3-order auto-drafts */}
          <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  3-Order Auto Notification Drafts
                </h3>
              </div>
              <button onClick={loadDrafts} className="text-[11px] font-bold text-slate-400 hover:text-white">
                Refresh
              </button>
            </div>

            {isLoadingDrafts ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading milestone drafts…</span>
              </div>
            ) : drafts.filter((d) => d.status === 'draft').length === 0 ? (
              <div className="py-4 text-center text-slate-500 text-xs">
                <p className="font-bold text-slate-400">No active notification drafts pending.</p>
                <p className="text-[11px]">
                  Every 3 completed orders will trigger a restock / customer marketing announcement draft here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts
                  .filter((d) => d.status === 'draft')
                  .map((d) => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{d.title}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-400 text-[10px] font-semibold">
                            Auto Draft
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2">{d.message}</p>
                        <p className="text-[10px] text-slate-600">
                          Batch #{d.batch_number} · {d.order_count} orders ·{' '}
                          {new Date(d.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          disabled={actionLoadingId === d.id}
                          onClick={() => handleBroadcastDraft(d.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                          {actionLoadingId === d.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Send
                        </button>
                        <button
                          disabled={actionLoadingId === d.id}
                          onClick={() => handleDismissDraft(d.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" /> Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
