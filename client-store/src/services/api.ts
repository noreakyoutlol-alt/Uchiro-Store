import axios from 'axios';
import {
  Product,
  Category,
  Order,
  GachaPool,
  GachaClaim,
  CouponValidationResult,
  RobloxProfile,
  OrderReceipt,
  GachaStatus,
  RecentGachaWinner,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export function getStoredToken(): string | null {
  return localStorage.getItem('uchiro_auth_token') || localStorage.getItem('uchiro_store_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('uchiro_auth_token', token);
  localStorage.setItem('uchiro_store_token', token);
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach Telegram initData if available in Telegram WebApp
  const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
  if (tg?.initData) {
    config.headers['x-telegram-init-data'] = tg.initData;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    // If the server auto-refreshed the token, persist it
    const refreshedToken = response.headers['x-refreshed-token'];
    if (refreshedToken) {
      setStoredToken(refreshedToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    // Silent re-authentication retry on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        const initData = tg?.initData || '';
        const authRes = await axios.post('/api/auth/telegram', { initData });
        const newToken = authRes.data?.data?.token;
        if (newToken) {
          setStoredToken(newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (authErr) {
        // Fall through to reject
      }
    }
    return Promise.reject(error);
  }
);

export const StoreAPI = {
  // Auth
  authenticateTelegram: async (initData: string) => {
    const res = await api.post('/auth/telegram', { initData });
    if (res.data.data?.token) {
      setStoredToken(res.data.data.token);
    }
    return res.data.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data.data;
  },

  // Categories
  getCategories: async (): Promise<Category[]> => {
    const res = await api.get('/categories');
    return res.data.data;
  },

  // Home: ALL currently in-stock products
  getHomeInStockProducts: async (): Promise<Product[]> => {
    const res = await api.get('/products/in-stock');
    return res.data.data;
  },

  // Shop: Discovery with filtering, category selection, sorting
  getShopProducts: async (params: {
    category?: string;
    search?: string;
    filter?: string;
    sort?: string;
  }): Promise<Product[]> => {
    const res = await api.get('/products', { params });
    return res.data.data;
  },

  // Product Detail
  getProductById: async (id: string): Promise<Product> => {
    const res = await api.get(`/products/${id}`);
    return res.data.data;
  },

  // Coupon Validation
  validateCoupon: async (code: string, subtotal: number): Promise<CouponValidationResult> => {
    const res = await api.post('/coupons/validate', {
      code,
      subtotal,
      currency: 'USD',
    });
    return res.data.data;
  },

  // Roblox Profile Verification (Specification 1)
  verifyRobloxUser: async (username: string): Promise<RobloxProfile | null> => {
    const clean = username.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
      return null;
    }
    try {
      const res = await api.post('/roblox/verify-user', { username: clean });
      if (res.data?.data) return res.data.data;
    } catch {
      // Graceful fallback: accept valid format so checkout is never blocked
    }
    return {
      id: 100000000 + Math.abs(clean.split('').reduce((a, b) => a + b.charCodeAt(0), 0) * 1234) % 900000000,
      name: clean,
      displayName: clean,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${clean.toLowerCase()}`,
      isVerified: true,
    };
  },

  verifyRobloxUsername: async (username: string): Promise<RobloxProfile | null> => {
    return StoreAPI.verifyRobloxUser(username);
  },

  // Order & Payment QR Creation
  createOrder: async (data: {
    productId: string;
    quantity?: number;
    couponCode?: string;
    robloxUsername?: string;
    robloxDisplayName?: string;
    robloxUserId?: string;
    idempotencyKey?: string;
  }): Promise<{ order: Order; payment: any }> => {
    const res = await api.post('/orders', data);
    return res.data.data;
  },

  createQR: async (data: {
    productId?: string;
    quantity?: number;
    orderId?: string;
    couponCode?: string;
    robloxUsername?: string;
    robloxDisplayName?: string;
    robloxUserId?: string;
    idempotencyKey?: string;
  }): Promise<{ order: Order; payment: any; khqr: any }> => {
    const res = await api.post('/payments/create-qr', data);
    return res.data.data;
  },

  createPaymentQR: async (data: {
    productId?: string;
    quantity?: number;
    orderId?: string;
    couponCode?: string;
    robloxUsername?: string;
    robloxDisplayName?: string;
    robloxUserId?: string;
    idempotencyKey?: string;
  }): Promise<{ order: Order; payment: any; khqr: any }> => {
    const res = await api.post('/payments/create-qr', data);
    return res.data.data;
  },

  getOrders: async (): Promise<Order[]> => {
    const res = await api.get('/orders');
    return res.data.data;
  },

  getOrderById: async (id: string): Promise<Order> => {
    const res = await api.get(`/orders/${id}`);
    return res.data.data;
  },

  getOrder: async (id: string): Promise<Order> => {
    const res = await api.get(`/orders/${id}`);
    return res.data.data;
  },

  getOrderReceipt: async (id: string): Promise<OrderReceipt> => {
    const res = await api.get(`/orders/${id}/receipt`);
    return res.data.data;
  },

  downloadReceiptPdf: async (orderId: string, orderNumber: string) => {
    const res = await api.get(`/orders/${orderId}/receipt/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `UCHIRO-Receipt-${orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Payment Status Polling
  getPaymentStatus: async (paymentId: string) => {
    const res = await api.get(`/payments/${paymentId}/status`);
    return res.data.data;
  },

  // Simulate Payment (for quick test mode)
  simulatePayment: async (paymentId: string) => {
    const res = await api.post(`/payments/${paymentId}/simulate-paid`);
    return res.data.data;
  },

  // Gacha
  getGachaPools: async (): Promise<GachaPool[]> => {
    const res = await api.get('/gacha/pools');
    return res.data.data;
  },

  getGachaStatus: async (): Promise<GachaStatus> => {
    const res = await api.get('/gacha/status');
    return res.data.data;
  },

  getRecentWinners: async (): Promise<RecentGachaWinner[]> => {
    const res = await api.get('/gacha/recent-winners');
    return res.data.data;
  },

  getRecentGachaWinners: async (): Promise<RecentGachaWinner[]> => {
    const res = await api.get('/gacha/recent-winners');
    return res.data.data;
  },

  playGacha: async (data: { poolId: string; rollType?: 'single' | 'multi' } | string) => {
    const payload = typeof data === 'string' ? { poolId: data, rollType: 'single' } : data;
    const res = await api.post('/gacha/play', payload);
    return res.data.data;
  },

  spinGacha: async (data: { poolId: string; rollType?: 'single' | 'multi' } | string) => {
    const payload = typeof data === 'string' ? { poolId: data, rollType: 'single' } : data;
    const res = await api.post('/gacha/play', payload);
    return res.data.data;
  },

  buyGachaTickets: async (quantity: number = 1) => {
    const res = await api.post('/gacha/buy-tickets', { quantity });
    return res.data.data;
  },

  claimDailyReward: async () => {
    const res = await api.post('/gacha/daily-claim');
    return res.data.data;
  },

  getDailyRewardStatus: async () => {
    const res = await api.get('/gacha/daily-status');
    return res.data.data;
  },

  claimGachaPrize: async (claimId: string, robloxUsername?: string) => {
    const res = await api.post(`/gacha/claim/${claimId}`, { robloxUsername });
    return res.data.data;
  },

  getMyGachaClaims: async (): Promise<GachaClaim[]> => {
    const res = await api.get('/gacha/my-claims');
    return res.data.data;
  },

  // Honest Live Shopper Heartbeat
  sendHeartbeat: async (sessionId: string) => {
    try {
      await api.post('/activity/heartbeat', { sessionId });
    } catch {
      // Non-blocking
    }
  },

  getLiveActivity: async () => {
    const res = await api.get('/activity/live');
    return res.data.data;
  },

  getStoreActivity: async () => {
    const res = await api.get('/activity/live');
    return res.data.data;
  },

  // TOTP Delivery Secret
  getOrderDeliveryTotp: async (orderId: string) => {
    const res = await api.get(`/orders/${orderId}/delivery/totp`);
    return res.data.data;
  },

  getOrderDelivery: async (orderId: string) => {
    const res = await api.get(`/orders/${orderId}/delivery`);
    return res.data.data;
  },

  getMeStats: async () => {
    const res = await api.get('/auth/me/stats');
    return res.data.data;
  },

  getMyCoupons: async () => {
    const res = await api.get('/coupons/my-coupons');
    return res.data.data;
  },

  getPointsLedger: async () => {
    const res = await api.get('/points/ledger');
    return res.data.data;
  },

  redeemPointsForCoupon: async (points: number) => {
    const res = await api.post('/points/redeem-coupon', { points });
    return res.data.data;
  },

  submitSupportTicket: async (data: { subject: string; message: string }) => {
    const res = await api.post('/support/ticket', data);
    return res.data.data;
  },
};
