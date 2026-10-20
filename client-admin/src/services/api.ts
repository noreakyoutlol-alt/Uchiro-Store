import axios from 'axios';
import { adminAuthHeaders, notifyUnauthorized } from './admin-auth';
import {
  DashboardStats,
  Order,
  Product,
  InventoryItem,
  GachaClaim,
  Coupon,
  CustomerUser,
  AuditLog,
  RedeemCode,
  RedeemCodeUsage,
  CreateRedeemCodeDTO,
} from '../types';

const api = axios.create({
  baseURL: '/api/admin',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const headers = adminAuthHeaders();
  for (const [key, val] of Object.entries(headers)) {
    config.headers[key] = val;
  }
  const token = localStorage.getItem('uchiro_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      notifyUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const AdminAPI = {
  // Auth
  authenticateAdmin: async (initData: string) => {
    const res = await axios.post('/api/auth/admin', { initData });
    if (res.data.data?.token) {
      localStorage.setItem('uchiro_admin_token', res.data.data.token);
    }
    return res.data.data;
  },

  // Stats
  getStats: async (): Promise<DashboardStats> => {
    const res = await api.get('/stats');
    return res.data.data;
  },

  // Orders
  getOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders');
    return res.data.data;
  },

  getOrderById: async (id: string): Promise<Order> => {
    const res = await api.get(`/orders/${id}`);
    return res.data.data;
  },

  fulfillOrder: async (id: string, notes?: string, credentials?: any[]) => {
    const res = await api.post(`/orders/${id}/fulfill`, { notes, credentials });
    return res.data.data;
  },

  // Warranty & Re-delivery Operations (Section 31 & 32)
  replaceWarrantyOrder: async (id: string, data: { replacement_notes: string; credentials?: any[] }) => {
    const res = await api.post(`/orders/${id}/warranty-replace`, data);
    return res.data.data;
  },

  invalidateWarranty: async (id: string, reason: string) => {
    const res = await api.post(`/orders/${id}/warranty-invalidate`, { reason });
    return res.data.data;
  },

  reDeliverOrder: async (id: string) => {
    const res = await api.post(`/orders/${id}/redeliver`);
    return res.data.data;
  },

  // Categories
  getCategories: async (): Promise<any[]> => {
    const res = await api.get('/categories');
    return res.data.data;
  },

  // Products
  getProducts: async (): Promise<Product[]> => {
    const res = await api.get('/products');
    return res.data.data;
  },

  saveProduct: async (productData: Partial<Product>) => {
    const res = await api.post('/products', productData);
    return res.data.data;
  },

  updateProduct: async (id: string, productData: Partial<Product>) => {
    const res = await api.put(`/products/${id}`, productData);
    return res.data.data;
  },

  deleteProduct: async (id: string) => {
    const res = await api.delete(`/products/${id}`);
    return res.data.success;
  },

  // Inventory
  getInventory: async (): Promise<InventoryItem[]> => {
    const res = await api.get('/inventory');
    return res.data.data;
  },

  addInventoryItem: async (data: any) => {
    const res = await api.post('/inventory', data);
    return res.data.data;
  },

  verifyTotp: async (secret?: string, username?: string) => {
    const res = await api.post('/inventory/verify-totp', { secret, username });
    return res.data.data;
  },

  updateInventoryItem: async (id: string, updates: Record<string, any>) => {
    const res = await api.put(`/inventory/${id}`, updates);
    return res.data.data;
  },

  deleteInventoryItem: async (id: string) => {
    const res = await api.delete(`/inventory/${id}`);
    return res.data.success;
  },

  bulkAddInventory: async (productId: string, items: any[]) => {
    const res = await api.post('/inventory/bulk', { productId, items });
    return res.data.data;
  },

  // Gacha Claims
  getPendingClaims: async (): Promise<GachaClaim[]> => {
    const res = await api.get('/claims');
    return res.data.data;
  },

  resolveClaim: async (
    id: string,
    status: 'fulfilled' | 'rejected',
    notes?: string,
    deliveryData?: Record<string, any>
  ) => {
    const res = await api.post(`/claims/${id}/resolve`, {
      status,
      notes,
      deliveryData,
    });
    return res.data.data;
  },

  // Coupons
  getCoupons: async (): Promise<Coupon[]> => {
    const res = await api.get('/coupons');
    return res.data.data;
  },

  createCoupon: async (data: Partial<Coupon>) => {
    const res = await api.post('/coupons', data);
    return res.data.data;
  },

  updateCoupon: async (id: string, updates: Partial<Coupon>) => {
    const res = await api.put(`/coupons/${id}`, updates);
    return res.data.data;
  },

  deleteCoupon: async (id: string) => {
    const res = await api.delete(`/coupons/${id}`);
    return res.data.success;
  },

  // Users
  getUsers: async (): Promise<any[]> => {
    const res = await api.get('/users');
    return res.data.data;
  },

  getUserDetail: async (telegramId: number) => {
    const res = await api.get(`/users/${telegramId}`);
    return res.data.data;
  },

  // Support
  getSupportTickets: async () => {
    const res = await api.get('/support');
    return res.data.data;
  },

  replySupportTicket: async (id: string, reply: string, status?: string) => {
    const res = await api.post(`/support/${id}/reply`, { reply, status });
    return res.data.data;
  },

  // Audit Logs
  getAuditLogs: async (): Promise<AuditLog[]> => {
    const res = await api.get('/audit-logs');
    return res.data.data;
  },

  // Broadcast (legacy stock alert)
  broadcast: async (message: string) => {
    const res = await api.post('/broadcast', { message });
    return res.data.data;
  },

  getOrderDrafts: async () => {
    const res = await api.get('/broadcast/drafts');
    return res.data.data;
  },

  broadcastOrderDraft: async (id: string) => {
    const res = await api.post(`/broadcast/drafts/${id}/send`);
    return res.data.data;
  },

  dismissOrderDraft: async (id: string) => {
    const res = await api.post(`/broadcast/drafts/${id}/dismiss`);
    return res.data.data;
  },

  // Broadcast Center (Unified)
  listBroadcastCampaigns: async () => {
    const res = await api.get('/broadcast/campaigns');
    return res.data.data;
  },

  getBroadcastCampaign: async (id: string) => {
    const res = await api.get(`/broadcast/campaigns/${id}`);
    return res.data.data;
  },

  previewBroadcast: async (params: any) => {
    const res = await api.post('/broadcast/preview', params);
    return res.data.data;
  },

  createBroadcastCampaign: async (params: any, idempotencyKey?: string) => {
    const res = await api.post('/broadcast/campaigns', { ...params, idempotency_key: idempotencyKey });
    return res.data.data;
  },

  confirmBroadcast: async (campaignId: string) => {
    const res = await api.post(`/broadcast/campaigns/${campaignId}/confirm`);
    return res.data.data;
  },

  cancelBroadcast: async (campaignId: string) => {
    const res = await api.post(`/broadcast/campaigns/${campaignId}/cancel`);
    return res.data.data;
  },

  // Gacha Management
  getGachaPools: async () => {
    const res = await api.get('/gacha/pools');
    return res.data.data;
  },

  saveGachaPool: async (data: any) => {
    const res = await api.post('/gacha/pools', data);
    return res.data.data;
  },

  saveGachaPrize: async (data: any) => {
    const res = await api.post('/gacha/prizes', data);
    return res.data.data;
  },

  deleteGachaPrize: async (id: string) => {
    const res = await api.delete(`/gacha/prizes/${id}`);
    return res.data.success;
  },

  promoteGachaPrize: async (id: string) => {
    const res = await api.post(`/gacha/prizes/${id}/promote`);
    return res.data.data;
  },

  validatePoolProbabilities: async (poolId: string) => {
    const res = await api.get(`/gacha/pools/${poolId}/validate-probabilities`);
    return res.data;
  },

  updatePoolProbabilities: async (poolId: string, probabilities: { prizeId: string; probability: number }[]) => {
    const res = await api.put(`/gacha/pools/${poolId}/probabilities`, { probabilities });
    return res.data.data;
  },

  // Store Settings
  getSettings: async () => {
    const res = await api.get('/settings');
    return res.data.data;
  },

  updateSettings: async (settings: any) => {
    const res = await api.put('/settings', settings);
    return res.data.data;
  },

  // Robux Shared Stock Pool (Prompt 11)
  getRobuxStock: async () => {
    const res = await api.get('/robux/stock');
    return res.data.data;
  },

  updateRobuxStock: async (data: { total: number; rate_per_1000?: number; is_active?: boolean; reason?: string }) => {
    const res = await api.put('/robux/stock', data);
    return res.data.data;
  },

  // System Backup & Restore
  getBackup: async () => {
    const res = await api.get('/backup');
    return res.data.data;
  },

  restoreBackup: async (bundle: any) => {
    const res = await api.post('/restore', bundle);
    return res.data;
  },

  // Security & IP Firewall
  getSecurityStats: async () => {
    const res = await api.get('/security/stats');
    return res.data.data;
  },

  getBlockedIps: async (params?: { search?: string; status?: string; limit?: number; offset?: number }) => {
    const res = await api.get('/security/blocked-ips', { params });
    return res.data;
  },

  blockIp: async (data: { ip: string; reason: string; durationMinutes?: number; permanent?: boolean }) => {
    const res = await api.post('/security/block-ip', data);
    return res.data.data;
  },

  unbanIp: async (ip: string) => {
    const res = await api.post('/security/unban-ip', { ip });
    return res.data;
  },

  getSecurityAuditLogs: async (params?: { limit?: number; offset?: number }) => {
    const res = await api.get('/security/audit-logs', { params });
    return res.data;
  },

  // Redeem Code Management (Prompt 12)
  getRedeemCodes: async (params?: { search?: string; reward_type?: string; status?: string }): Promise<RedeemCode[]> => {
    const res = await api.get('/redeem-codes', { params });
    return res.data.data;
  },

  getRedeemCode: async (id: string): Promise<RedeemCode> => {
    const res = await api.get(`/redeem-codes/${id}`);
    return res.data.data;
  },

  getRedeemCodeUsages: async (id: string): Promise<RedeemCodeUsage[]> => {
    const res = await api.get(`/redeem-codes/${id}/usages`);
    return res.data.data;
  },

  createRedeemCode: async (data: CreateRedeemCodeDTO): Promise<RedeemCode> => {
    const res = await api.post('/redeem-codes', data);
    return res.data.data;
  },

  generateRedeemCode: async (): Promise<string> => {
    const res = await api.post('/redeem-codes/generate');
    return res.data.data.code;
  },

  updateRedeemCode: async (id: string, data: Partial<CreateRedeemCodeDTO>): Promise<RedeemCode> => {
    const res = await api.put(`/redeem-codes/${id}`, data);
    return res.data.data;
  },

  toggleRedeemCodeActive: async (id: string): Promise<RedeemCode> => {
    const res = await api.post(`/redeem-codes/${id}/toggle-active`);
    return res.data.data;
  },

  deleteRedeemCode: async (id: string): Promise<boolean> => {
    const res = await api.delete(`/redeem-codes/${id}`);
    return res.data.success;
  },
};
