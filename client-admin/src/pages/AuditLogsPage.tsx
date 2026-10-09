import React, { useState, useMemo } from 'react';
import {
  History,
  Shield,
  Search,
  Filter,
  CheckCircle2,
  Package,
  Layers,
  Settings,
  Tag,
  ShieldAlert,
  FileJson,
  X,
} from 'lucide-react';
import { AuditLog } from '../types';

interface AuditLogsPageProps {
  logs: AuditLog[];
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [inspectLog, setInspectLog] = useState<AuditLog | null>(null);

  const getActionCategory = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('PRODUCT')) return 'product';
    if (act.includes('ORDER') || act.includes('FULFILL')) return 'order';
    if (act.includes('INVENTORY') || act.includes('STOCK')) return 'inventory';
    if (act.includes('SETTINGS') || act.includes('CONFIG')) return 'settings';
    if (act.includes('COUPON')) return 'coupon';
    if (act.includes('WARRANTY')) return 'warranty';
    return 'other';
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (categoryFilter !== 'all') {
        const cat = getActionCategory(log.action);
        if (cat !== categoryFilter) return false;
      }

      // Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actionMatch = log.action.toLowerCase().includes(q);
        const entityMatch = (log.entity_type || '').toLowerCase().includes(q);
        const actorMatch = String(log.actor_telegram_id).includes(q);
        const metaMatch = JSON.stringify(log.metadata || {}).toLowerCase().includes(q);

        return actionMatch || entityMatch || actorMatch || metaMatch;
      }

      return true;
    });
  }, [logs, categoryFilter, searchQuery]);

  const getActionBadgeColor = (action: string) => {
    const cat = getActionCategory(action);
    switch (cat) {
      case 'product':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
      case 'order':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
      case 'inventory':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';
      case 'warranty':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/20';
      case 'coupon':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      case 'settings':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>SYSTEM AUDIT & SECURITY TRAIL</span>
          </h2>
          <p className="text-xs text-slate-400">
            Cryptographically logged administrator operations, stock modifications, warranty claims, and store configs.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-[#111622] border border-white/5 flex flex-col sm:flex-row gap-3 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail by action, metadata, admin ID, entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Action Types ({logs.length})</option>
          <option value="product">Product Changes</option>
          <option value="order">Order Actions</option>
          <option value="inventory">Inventory Vault</option>
          <option value="warranty">Warranty Actions</option>
          <option value="coupon">Coupon Actions</option>
          <option value="settings">Settings Changes</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#111622] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-black/40 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Admin Actor</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">Target Entity</th>
                <th className="p-3.5">Details Summary</th>
                <th className="p-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Shield className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                    <p className="font-bold text-slate-400">No audit logs match your filter.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-mono text-indigo-400 font-bold">
                      {log.actor_telegram_id}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-300 capitalize font-mono text-[11px]">
                      {log.entity_type || 'system'}
                    </td>
                    <td className="p-3.5 font-mono text-[10px] text-slate-400 truncate max-w-xs">
                      {JSON.stringify(log.metadata || {})}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setInspectLog(log)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Metadata Modal */}
      {inspectLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">Audit Entry Inspection</h3>
                <span className="text-[10px] text-slate-400 font-mono">ID: {inspectLog.id}</span>
              </div>
              <button onClick={() => setInspectLog(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Actor Telegram ID</span>
                  <span className="font-mono font-bold text-indigo-400">{inspectLog.actor_telegram_id}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Action</span>
                  <span className="font-bold text-white">{inspectLog.action}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-300 block mb-1">Metadata JSON:</span>
                <pre className="p-3 rounded-xl bg-black/60 border border-white/5 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(inspectLog.metadata || {}, null, 2)}
                </pre>
              </div>

              <div className="text-[10px] text-slate-500 font-mono text-right">
                Timestamp: {inspectLog.created_at}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
