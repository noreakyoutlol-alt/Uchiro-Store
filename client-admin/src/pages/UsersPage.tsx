import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Coins,
  Ticket,
  ShoppingBag,
  Flame,
  Calendar,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { AdminAPI } from '../services/api';

interface UsersPageProps {
  users: any[];
}

export const UsersPage: React.FC<UsersPageProps> = ({ users }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userDetailData, setUserDetailData] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const filteredUsers = useMemo(() => {
    return users.filter((entry) => {
      const u = entry.user || entry;
      const p = entry.profile || {};
      const q = searchQuery.toLowerCase();

      const nameMatch = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q);
      const usernameMatch = (u.username || '').toLowerCase().includes(q);
      const idMatch = String(u.telegram_id || '').includes(q);
      const robloxMatch = (p.roblox_username || '').toLowerCase().includes(q);

      return nameMatch || usernameMatch || idMatch || robloxMatch;
    });
  }, [users, searchQuery]);

  const handleOpenDetail = async (entry: any) => {
    const u = entry.user || entry;
    setSelectedUser(entry);
    setIsLoadingDetail(true);
    try {
      const data = await AdminAPI.getUserDetail(u.telegram_id);
      setUserDetailData(data);
    } catch (err) {
      console.error('Failed to load user detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>REGISTERED CUSTOMERS & PROFILES</span>
          </h2>
          <p className="text-xs text-slate-400">
            Verified Telegram shoppers, Uchiro Points totals, gacha tickets, and lifetime spend.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-[#111622] border border-white/5 flex gap-3 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Telegram ID, name, username, or Roblox username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#111622] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-black/40 uppercase text-[10px] text-slate-400 font-bold border-b border-white/10">
              <tr>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Telegram ID</th>
                <th className="p-3.5">Roblox Account</th>
                <th className="p-3.5">Points</th>
                <th className="p-3.5">Gacha Tickets</th>
                <th className="p-3.5">Total Orders</th>
                <th className="p-3.5">Total Spent</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-indigo-400" />
                    <p className="font-bold text-slate-400">No customer profiles match your search.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((entry, idx) => {
                  const u = entry.user || entry;
                  const p = entry.profile || {};

                  return (
                    <tr key={u.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white">
                          {u.first_name} {u.last_name || ''}
                        </div>
                        {u.username && (
                          <span className="text-[10px] text-indigo-400 block font-mono">
                            @{u.username}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-slate-400">
                        {u.telegram_id}
                      </td>

                      <td className="p-3.5">
                        {p.roblox_username ? (
                          <span className="font-bold text-[#FFD166] font-mono text-[11px]">
                            {p.roblox_username}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-amber-400 inline-flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          {p.points_balance || 0}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-bold text-purple-400 inline-flex items-center gap-1">
                          <Ticket className="w-3.5 h-3.5" />
                          {p.gacha_tickets || 0}
                        </span>
                      </td>

                      <td className="p-3.5 font-bold text-white">
                        {p.total_orders || 0}
                      </td>

                      <td className="p-3.5 font-bold text-emerald-400">
                        ${(p.total_spent || 0).toFixed(2)}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenDetail(entry)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-bold transition-all inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-black text-white">
                  Customer Profile & Ledger
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  Telegram ID: {selectedUser.user?.telegram_id || selectedUser.telegram_id}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setUserDetailData(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading customer details...</span>
              </div>
            ) : userDetailData ? (
              <div className="space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 block">Points</span>
                    <span className="text-base font-black text-amber-400">
                      {userDetailData.profile?.points_balance || 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 block">Gacha Tickets</span>
                    <span className="text-base font-black text-purple-400">
                      {userDetailData.profile?.gacha_tickets || 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 block">Total Orders</span>
                    <span className="text-base font-black text-white">
                      {userDetailData.orders?.length || 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                    <span className="text-[10px] text-slate-400 block">Total Spent</span>
                    <span className="text-base font-black text-emerald-400">
                      ${(userDetailData.profile?.total_spent || 0).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Orders History ({userDetailData.orders?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {userDetailData.orders?.length === 0 ? (
                      <p className="text-xs text-slate-500">No purchases yet.</p>
                    ) : (
                      userDetailData.orders?.map((o: any) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs"
                        >
                          <span className="font-mono text-indigo-400 font-bold">
                            #{o.order_number}
                          </span>
                          <span className="text-slate-300">{o.items?.[0]?.product_title || 'Item'}</span>
                          <span className="font-bold text-emerald-400">${o.total_amount.toFixed(2)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            o.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {o.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Point Ledger */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Recent Points Transactions ({userDetailData.ledger?.length || 0})
                  </h4>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {userDetailData.ledger?.length === 0 ? (
                      <p className="text-xs text-slate-500">No point transactions yet.</p>
                    ) : (
                      userDetailData.ledger?.slice(0, 10).map((l: any) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-[11px]"
                        >
                          <span className="text-slate-400">{l.description}</span>
                          <span
                            className={`font-mono font-bold ${
                              l.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {l.amount >= 0 ? `+${l.amount}` : l.amount} pts
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
