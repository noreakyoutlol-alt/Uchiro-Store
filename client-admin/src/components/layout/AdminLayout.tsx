import React from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Layers,
  Gift,
  Tag,
  Users,
  Megaphone,
  History,
  ShieldCheck,
  Sparkles,
  Settings,
  Database,
  ShieldAlert,
  Ticket,
  Lock,
} from 'lucide-react';
import { AdminSpaceBackground } from '../background/AdminSpaceBackground';

export type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'gacha'
  | 'claims'
  | 'coupons'
  | 'redeem_codes'
  | 'users'
  | 'broadcast'
  | 'security'
  | 'settings'
  | 'backup'
  | 'logs';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  adminName: string;
  children: React.ReactNode;
  onLock?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  adminName,
  children,
  onLock,
}) => {
  const menuItems: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'products', label: 'Products', icon: Boxes },
    { id: 'inventory', label: 'Inventory', icon: Layers },
    { id: 'gacha', label: 'Gacha Wheels', icon: Sparkles },
    { id: 'claims', label: 'Gacha Claims', icon: Gift },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'redeem_codes', label: 'Redeem Codes', icon: Ticket },
    { id: 'users', label: 'Customers', icon: Users },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'security', label: 'Security & IP', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'logs', label: 'Audit Logs', icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#070A14] text-slate-100 flex flex-col md:flex-row relative">
      {/* Space Background Layer */}
      <AdminSpaceBackground />

      {/* Sidebar for Desktop / Header for Mobile */}
      <aside className="w-full md:w-64 bg-[#0B0F1D]/90 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/10 flex flex-col flex-shrink-0 relative z-20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center font-black text-white text-xs shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/40">
              UA
            </div>
            <div>
              <h1 className="font-black text-sm text-white tracking-wide">UCHIRO ADMIN</h1>
              <span className="text-[10px] text-indigo-400 font-bold tracking-wider">COMMAND CENTER</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-semibold">{adminName}</span>
            </div>
            {onLock && (
              <button
                type="button"
                onClick={onLock}
                title="Lock admin session"
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-2 sm:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto scrollbar-none flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-[0.98] ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-[0_2px_12px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] border border-indigo-400/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area: Compact Mobile-First Pocket UI */}
      <main className="flex-1 p-2.5 sm:p-4 overflow-y-auto overflow-x-hidden w-full max-w-full relative z-10">
        <div className="max-w-6xl mx-auto space-y-3 w-full">{children}</div>
      </main>
    </div>
  );
};
