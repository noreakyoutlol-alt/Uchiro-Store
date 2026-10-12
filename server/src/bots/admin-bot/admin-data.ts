import { DataStore } from '../../database/data-store';

export async function getTodayStats(): Promise<{
  todayOrders: number;
  todayRevenueUsd: number;
  pendingFulfillment: number;
}> {
  const allOrders = DataStore.getAllOrdersAdmin();
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();

  const isPaid = (status: string) =>
    status === 'paid' || status === 'delivered' || status === 'completed' || status === 'fulfillment';

  const todayOrdersList = allOrders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    return !Number.isNaN(t) && t >= startOfToday;
  });

  const todayOrders = todayOrdersList.length;
  const todayRevenueUsd = todayOrdersList
    .filter((o) => isPaid(o.status))
    .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

  const pendingFulfillment = allOrders.filter(
    (o) => o.status === 'paid' || o.status === 'fulfillment'
  ).length;

  return {
    todayOrders,
    todayRevenueUsd,
    pendingFulfillment,
  };
}

export async function getRecentOrders(limit = 5): Promise<
  Array<{ id: string; shortId: string; totalUsd: number; status: string; customer: string }>
> {
  const allOrders = DataStore.getAllOrdersAdmin();
  const allUsers = DataStore.getAllUsersAdmin();

  const sorted = [...allOrders].sort((a, b) => {
    const ta = new Date(a.created_at).getTime() || 0;
    const tb = new Date(b.created_at).getTime() || 0;
    return tb - ta;
  });

  return sorted.slice(0, limit).map((o) => {
    const user = allUsers.find(
      (u) => u.user?.telegram_id === o.telegram_id || (u as any).telegram_id === o.telegram_id
    );
    const customer =
      o.roblox_username ||
      user?.user?.username ||
      (user as any)?.username ||
      user?.user?.first_name ||
      (user as any)?.first_name ||
      'anon';
    return {
      id: o.id,
      shortId: o.order_number || o.id.slice(0, 8),
      totalUsd: Number(o.total_amount) || 0,
      status: o.status || 'unknown',
      customer,
    };
  });
}

export async function getLowStockItems(
  threshold = 3
): Promise<Array<{ name: string; remaining: number }>> {
  const products = DataStore.getAllProductsAdmin();
  const lowStock: Array<{ name: string; remaining: number }> = [];

  for (const p of products) {
    if (!p.is_active || p.is_draft) continue;
    const remaining = typeof p.stock === 'number' ? p.stock : (p.stock_count ?? 0);
    if (remaining <= threshold) {
      lowStock.push({
        name: (p as any).name || p.title || 'unnamed',
        remaining,
      });
    }
  }

  return lowStock;
}
