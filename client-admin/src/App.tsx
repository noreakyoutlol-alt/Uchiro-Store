import React, { useState, useEffect } from 'react';
import { AdminLayout, AdminTab } from './components/layout/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { ClaimsPage } from './pages/ClaimsPage';
import { CouponsPage } from './pages/CouponsPage';
import { UsersPage } from './pages/UsersPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { GachaPage } from './pages/GachaPage';
import { BackupPage } from './pages/BackupPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  DashboardStats,
  Order,
  Product,
  InventoryItem,
  GachaClaim,
  Coupon,
  CustomerUser,
  AuditLog,
} from './types';
import { AdminAPI } from './services/api';
import { Loader2, AlertOctagon } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<AdminTab>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);
  const [adminName, setAdminName] = useState('Admin');

  // Admin Data State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [claims, setClaims] = useState<GachaClaim[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [initialInventoryProductId, setInitialInventoryProductId] = useState<string | undefined>(undefined);

  const loadData = async () => {
    try {
      const [
        statsData,
        ordersData,
        productsData,
        catsData,
        invData,
        claimsData,
        couponsData,
        usersData,
        logsData,
      ] = await Promise.all([
        AdminAPI.getStats(),
        AdminAPI.getOrders(),
        AdminAPI.getProducts(),
        AdminAPI.getCategories().catch(() => []),
        AdminAPI.getInventory(),
        AdminAPI.getPendingClaims(),
        AdminAPI.getCoupons(),
        AdminAPI.getUsers(),
        AdminAPI.getAuditLogs(),
      ]);

      setStats(statsData);
      setOrders(ordersData);
      setProducts(productsData);
      setCategories(catsData);
      setInventory(invData);
      setClaims(claimsData);
      setCoupons(couponsData);
      setUsers(usersData);
      setLogs(logsData);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setIsAuthorized(false);
      }
    }
  };

  useEffect(() => {
    const initAdmin = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();
          tg.setHeaderColor('#0A0D14');
        }

        const initData = tg?.initData || '';
        const user = tg?.initDataUnsafe?.user;

        // Verify Telegram Mini App context is present
        if (!initData && !user) {
          console.warn('[ADMIN SECURITY] No Telegram Mini App context detected.');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Authenticate with server to validate Telegram User ID against Admin Whitelist
        const authRes = await AdminAPI.authenticateAdmin(initData);
        if (!authRes || !authRes.token) {
          setIsAuthorized(false);
          return;
        }

        setAdminName(authRes.admin?.display_name || authRes.admin?.role || 'Admin');
        await loadData();
      } catch (err: any) {
        console.error('Admin init error:', err);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    initAdmin();
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0A0D14] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-xs font-bold">Verifying Administrator Access...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="fixed inset-0 bg-[#0A0D14] flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3">
        <AlertOctagon className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-black text-white">ACCESS DENIED</h2>
        <p className="text-xs max-w-sm text-slate-400 leading-relaxed">
          Your Telegram account is not on the authorized Uchiro Store Administrator roster. Access is restricted.
        </p>
      </div>
    );
  }

  return (
    <AdminLayout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      adminName={adminName}
    >
      {currentTab === 'dashboard' && (
        <DashboardPage stats={stats} orders={orders} onNavigateTab={setCurrentTab} />
      )}
      {currentTab === 'orders' && (
        <OrdersPage orders={orders} onRefreshOrders={loadData} />
      )}
      {currentTab === 'products' && (
        <ProductsPage
          products={products}
          categories={categories}
          onRefreshProducts={loadData}
          onNavigateToInventory={(productId?: string) => {
            setInitialInventoryProductId(productId);
            setCurrentTab('inventory');
          }}
        />
      )}
      {currentTab === 'inventory' && (
        <InventoryPage
          inventory={inventory}
          products={products}
          initialProductId={initialInventoryProductId}
          onRefreshInventory={loadData}
        />
      )}
      {currentTab === 'gacha' && <GachaPage />}
      {currentTab === 'claims' && (
        <ClaimsPage claims={claims} onRefreshClaims={loadData} />
      )}
      {currentTab === 'coupons' && (
        <CouponsPage coupons={coupons} onRefreshCoupons={loadData} />
      )}
      {currentTab === 'users' && <UsersPage users={users} />}
      {currentTab === 'broadcast' && <BroadcastPage />}
      {currentTab === 'settings' && <SettingsPage />}
      {currentTab === 'backup' && <BackupPage onRefreshAll={loadData} />}
      {currentTab === 'logs' && <AuditLogsPage logs={logs} />}
    </AdminLayout>
  );
};
