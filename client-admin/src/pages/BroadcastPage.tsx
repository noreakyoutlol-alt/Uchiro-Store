import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { AdminAPI } from '../services/api';

interface BroadcastDraft {
  id: string;
  batch_number: number;
  order_count: number;
  title: string;
  message: string;
  status: 'draft' | 'broadcasted' | 'dismissed';
  created_at: string;
}

interface SentBroadcastLog {
  id: string;
  message: string;
  audience: string;
  sent_count: number;
  total_users: number;
  sent_at: string;
}

export const BroadcastPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'buyers' | 'inactive'>('all');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  // Drafts
  const [drafts, setDrafts] = useState<BroadcastDraft[]>([]);
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(false);
  const [editingDraft, setEditingDraft] = useState<BroadcastDraft | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Sent logs history
  const [sentLogs, setSentLogs] = useState<SentBroadcastLog[]>([]);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setIsLoadingDrafts(true);
    try {
      const data = await AdminAPI.getOrderDrafts();
      setDrafts(data || []);
    } catch (err) {
      console.error('Failed to load drafts:', err);
    } finally {
      setIsLoadingDrafts(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (!window.confirm(`Broadcast this message to ${audience.toUpperCase()} customers via Store Bot?`)) return;

    setIsSending(true);
    setResult(null);

    try {
      const res = await AdminAPI.broadcast(message.trim());
      setResult(res);
      setSentLogs((prev) => [
        {
          id: String(Date.now()),
          message: message.trim(),
          audience,
          sent_count: res.sent,
          total_users: res.total,
          sent_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setMessage('');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Broadcast error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendDraft = async (draftId: string) => {
    if (!window.confirm('Send this 3-order milestone announcement to all customers?')) return;
    setActionLoadingId(draftId);
    try {
      const res = await AdminAPI.broadcastOrderDraft(draftId);
      alert(`Broadcast sent to ${res.sent} customers!`);
      await loadDrafts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to broadcast draft');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDismissDraft = async (draftId: string) => {
    setActionLoadingId(draftId);
    try {
      await AdminAPI.dismissOrderDraft(draftId);
      await loadDrafts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to dismiss draft');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-400" />
          <span>TELEGRAM BROADCAST & 3-ORDER AUTO DRAFTS</span>
        </h2>
        <p className="text-xs text-slate-400">
          Push global announcements, flash restock alerts, and review auto-generated 3-order batch marketing drafts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Broadcast Form */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              <span>Compose Telegram Dispatch</span>
            </span>

            {/* Target Audience */}
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className="px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-white text-[11px] font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Audience: All Users</option>
              <option value="buyers">Audience: Active Buyers</option>
              <option value="inactive">Audience: Inactive Users</option>
            </select>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3">
            <textarea
              rows={6}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement or promotion details here... Use HTML e.g. <b>bold</b>, <i>italic</i>, <code>code</code>."
              className="w-full p-3.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />

            <button
              type="submit"
              disabled={isSending || !message.trim()}
              className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching to Telegram Bot...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Broadcast ({audience.toUpperCase()})</span>
                </>
              )}
            </button>
          </form>

          {result && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Broadcast sent successfully to {result.sent} of {result.total} customers.
              </span>
            </div>
          )}
        </div>

        {/* Rich Message Telegram Preview */}
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-4 shadow-xl flex flex-col">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-indigo-400" />
            <span>Telegram Client Preview</span>
          </div>

          <div className="flex-1 p-4 rounded-xl bg-[#182533] border border-white/5 space-y-2 text-white text-xs relative flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black">
                  U
                </div>
                <div>
                  <span className="font-bold text-xs text-white block">Uchiro Store Bot</span>
                  <span className="text-[10px] text-indigo-300">bot</span>
                </div>
              </div>

              {message.trim() ? (
                <div
                  className="bg-[#2b5278] p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed text-white whitespace-pre-wrap max-w-sm"
                  dangerouslySetInnerHTML={{
                    __html: message
                      .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
                      .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
                      .replace(/<code>(.*?)<\/code>/g, '<code class="bg-black/30 px-1 rounded">$1</code>'),
                  }}
                />
              ) : (
                <div className="bg-[#2b5278]/40 p-4 rounded-2xl rounded-tl-sm text-xs text-slate-400 italic">
                  Live Telegram formatting preview will render here as you type...
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 text-right pt-2 border-t border-white/5">
              Audience: <strong className="text-indigo-400 capitalize">{audience}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Order Rule Auto Drafts */}
      <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              3-Order Auto Notification Drafts (Rule 45/48)
            </h3>
          </div>
          <button
            onClick={loadDrafts}
            className="text-[11px] font-bold text-slate-400 hover:text-white"
          >
            Refresh Drafts
          </button>
        </div>

        {isLoadingDrafts ? (
          <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Loading milestone drafts...</span>
          </div>
        ) : drafts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <p className="font-bold text-slate-400">No active notification drafts pending.</p>
            <p className="text-[11px]">
              Every 3 completed orders will trigger a restock / customer marketing announcement draft here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{d.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      d.status === 'draft' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{d.message}</p>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    Created: {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>

                {d.status === 'draft' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleSendDraft(d.id)}
                      disabled={actionLoadingId === d.id}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                    >
                      {actionLoadingId === d.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Broadcast</span>
                    </button>

                    <button
                      onClick={() => handleDismissDraft(d.id)}
                      disabled={actionLoadingId === d.id}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Dismiss</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sent Broadcasts Log */}
      {sentLogs.length > 0 && (
        <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-3 shadow-xl">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Sent Broadcasts This Session
            </h3>
          </div>
          <div className="space-y-2">
            {sentLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="truncate max-w-md">
                  <span className="font-bold text-white block truncate">{log.message}</span>
                  <span className="text-[10px] text-slate-400">
                    Target: {log.audience} • Sent to {log.sent_count}/{log.total_users} users
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(log.sent_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
