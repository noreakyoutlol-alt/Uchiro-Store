import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Plus,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { AdminAPI } from '../services/api';

interface SecurityStats {
  activeBlocks: number;
  totalBlocks: number;
  totalIncidents: number;
  maxAttempts: number;
  windowMinutes: number;
  blockHours: number;
}

interface BlockedIpRecord {
  id: string;
  ip_address: string;
  reason: string;
  blocked_until: string | null;
  is_permanent: boolean;
  failed_attempts: number;
  created_at: string;
  unbanned_at: string | null;
  unbanned_by: string | null;
}

interface SecurityIncident {
  id: string;
  ip_address: string;
  event_type: string;
  details: Record<string, any>;
  user_agent: string | null;
  created_at: string;
}

export const SecurityPage: React.FC = () => {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [blockedIps, setBlockedIps] = useState<BlockedIpRecord[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'expired' | 'unbanned'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual Ban Modal State
  const [showBanModal, setShowBanModal] = useState(false);
  const [banIp, setBanIp] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<number>(60); // minutes
  const [isPermanent, setIsPermanent] = useState(false);
  const [banSubmitting, setBanSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setIsRefreshing(true);
      const [statsRes, bansRes, logsRes] = await Promise.all([
        AdminAPI.getSecurityStats(),
        AdminAPI.getBlockedIps({ status: statusFilter, search: searchQuery || undefined }),
        AdminAPI.getSecurityAuditLogs({ limit: 50 }),
      ]);

      if (statsRes) setStats(statsRes);
      if (bansRes?.data) setBlockedIps(bansRes.data);
      if (logsRes?.data) setIncidents(logsRes.data);
    } catch (err: any) {
      console.error('Failed to load security data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banIp.trim()) return;

    try {
      setBanSubmitting(true);
      await AdminAPI.blockIp({
        ip: banIp.trim(),
        reason: banReason.trim() || 'Manually blocked by administrator',
        durationMinutes: isPermanent ? undefined : banDuration,
        permanent: isPermanent,
      });

      setFeedbackMsg({ type: 'success', text: `IP ${banIp} successfully blocked.` });
      setShowBanModal(false);
      setBanIp('');
      setBanReason('');
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.response?.data?.message || err?.response?.data?.error || 'Failed to block IP.',
      });
    } finally {
      setBanSubmitting(false);
    }
  };

  const handleUnban = async (ip: string) => {
    if (!window.confirm(`Are you sure you want to unban IP ${ip}?`)) return;

    try {
      await AdminAPI.unbanIp(ip);
      setFeedbackMsg({ type: 'success', text: `IP ${ip} has been unbanned.` });
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: 'Failed to unban IP address.' });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <ShieldAlert className="w-7 h-7 text-red-500" />
            Security & IP Firewall
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated brute-force defense, login security, and real-time IP blacklisting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm transition-colors border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowBanModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-600/20"
          >
            <Plus className="w-4 h-4" />
            Ban IP Address
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between border ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {feedbackMsg.text}
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#111622] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Bans</span>
            <Lock className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400">{stats?.activeBlocks ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Currently blocked IPs</div>
        </div>

        <div className="bg-[#111622] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Incidents</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats?.totalIncidents ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">Recorded security events</div>
        </div>

        <div className="bg-[#111622] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Brute-Force Rule</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {stats?.maxAttempts ?? 5} tries / {stats?.windowMinutes ?? 15}m
          </div>
          <div className="text-xs text-slate-500 mt-1">Automatic threshold</div>
        </div>

        <div className="bg-[#111622] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Lockout Duration</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white">{stats?.blockHours ?? 1} Hour(s)</div>
          <div className="text-xs text-slate-500 mt-1">Default ban period</div>
        </div>
      </div>

      {/* Blocked IPs Section */}
      <div className="bg-[#111622] border border-white/10 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="font-semibold text-white">IP Ban List</h2>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-white/10">
              {blockedIps.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg bg-slate-900 p-0.5 border border-white/10 text-xs">
              {(['active', 'all', 'expired', 'unbanned'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md font-medium capitalize transition-colors ${
                    statusFilter === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search IP or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </form>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">IP Address</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Attempts</th>
                <th className="px-4 py-3 font-semibold">Status / Expiry</th>
                <th className="px-4 py-3 font-semibold">Date Blocked</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {blockedIps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No IP blocks matching current filter.
                  </td>
                </tr>
              ) : (
                blockedIps.map((block) => {
                  const isBlocked =
                    !block.unbanned_at &&
                    (block.is_permanent || (block.blocked_until && new Date(block.blocked_until).getTime() > Date.now()));

                  return (
                    <tr key={block.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-white flex items-center gap-2">
                        {block.ip_address}
                        {block.is_permanent && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-sans font-bold">
                            PERMANENT
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-400 text-xs">{block.reason}</td>
                      <td className="px-4 py-3 font-mono text-xs">{block.failed_attempts}</td>
                      <td className="px-4 py-3 text-xs">
                        {block.unbanned_at ? (
                          <span className="text-slate-500 flex items-center gap-1">
                            <Unlock className="w-3.5 h-3.5 text-slate-400" />
                            Unbanned by {block.unbanned_by || 'Admin'}
                          </span>
                        ) : isBlocked ? (
                          <span className="text-red-400 flex items-center gap-1 font-medium">
                            <Lock className="w-3.5 h-3.5" />
                            {block.is_permanent
                              ? 'Permanent Ban'
                              : `Until ${new Date(block.blocked_until!).toLocaleTimeString()}`}
                          </span>
                        ) : (
                          <span className="text-slate-500">Expired</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(block.created_at).toLocaleDateString()} {new Date(block.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isBlocked && (
                          <button
                            onClick={() => handleUnban(block.ip_address)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 rounded text-xs font-medium transition-colors"
                          >
                            Unban
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Incidents / Audit Logs */}
      <div className="bg-[#111622] border border-white/10 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Recent Security Incidents
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history of failed authentications, brute-force detections, and administrative bans.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/50 text-xs uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold">Event Type</th>
                <th className="px-4 py-3 font-semibold">Origin IP</th>
                <th className="px-4 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-sm">
                    No recent security incidents logged.
                  </td>
                </tr>
              ) : (
                incidents.slice(0, 30).map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(inc.created_at).toLocaleTimeString()}{' '}
                      <span className="text-slate-600">({new Date(inc.created_at).toLocaleDateString()})</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          inc.event_type.includes('FAIL')
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : inc.event_type.includes('BAN')
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {inc.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-white">{inc.ip_address}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 max-w-md truncate">
                      {JSON.stringify(inc.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111622] border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                Manually Ban IP Address
              </h3>
              <button
                onClick={() => setShowBanModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleManualBan} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">IP Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 192.168.1.100"
                  value={banIp}
                  onChange={(e) => setBanIp(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Reason for Ban</label>
                <input
                  type="text"
                  placeholder="e.g. Suspicious automated login attempts"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="permBan"
                  checked={isPermanent}
                  onChange={(e) => setIsPermanent(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="permBan" className="text-xs text-slate-300 font-medium">
                  Permanent Ban (no expiration)
                </label>
              </div>

              {!isPermanent && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Ban Duration</label>
                  <select
                    value={banDuration}
                    onChange={(e) => setBanDuration(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
                  >
                    <option value={60}>1 Hour</option>
                    <option value={360}>6 Hours</option>
                    <option value={1440}>24 Hours</option>
                    <option value={10080}>7 Days</option>
                    <option value={43200}>30 Days</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBanModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={banSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {banSubmitting ? 'Banning...' : 'Confirm Ban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
