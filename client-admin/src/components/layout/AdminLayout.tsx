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
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'inventory'
  | 'gacha'
  | 'claims'
  | 'coupons'
  | 'users'
  | 'broadcast'
  | 'settings'
  | 'backup'
  | 'logs';

interface AdminLayoutProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  adminName: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  adminName,
  children,
}) => {
  const menuItems: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: Package },
    { id: 'products', label: 'Products', icon: Boxes },
    { id: 'inventory', label: 'Inventory', icon: Layers },
    { id: 'gacha', label: 'Gacha Wheels', icon: Sparkles },
    { id: 'claims', label: 'Gacha Claims', icon: Gift },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'users', label: 'Customers', icon: Users },
    { id: 'broadcast', label: 'Broadcast', icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'backup', label: 'Backup & Restore', icon: Database },
    { id: 'logs', label: 'Audit Logs', icon: History },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar for Desktop / Header for Mobile */}
      <aside className="w-full md:w-64 bg-[#111622] border-b md:border-b-0 md:border-r border-white/10 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-xs shadow-md">
              UA
            </div>
            <div>
              <h1 className="font-black text-sm text-white tracking-wide">UCHIRO ADMIN</h1>
              <span className="text-[10px] text-indigo-400 font-bold">OPERATIONS</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-semibold">{adminName}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto scrollbar-none flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area: Compact Mobile-First Pocket UI */}
      <main className="flex-1 p-2.5 sm:p-4 overflow-y-auto overflow-x-hidden w-full max-w-full">
        <div className="max-w-6xl mx-auto space-y-3 w-full">{children}</div>
      </main>
    </div>
  );
};
