import React, { useState, useEffect } from 'react';
import { TabType, BottomNav } from './components/navigation/BottomNav';
import { HeaderTopBar } from './components/navigation/HeaderTopBar';
import { Gear5Atmosphere } from './components/background/Gear5Atmosphere';
import { GamingDoodlePattern } from './components/background/GamingDoodlePattern';
import { HomePage } from './components/home/HomePage';
import { ShopPage } from './components/shop/ShopPage';
import { GachaPage } from './components/gacha/GachaPage';
import { OrdersPage } from './components/orders/OrdersPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { ProductDetailModal } from './components/product/ProductDetailModal';
import { CheckoutModal } from './components/checkout/CheckoutModal';
import { KHQRPaymentScreen } from './components/payment/KHQRPaymentScreen';
import { DeliveredOrderModal } from './components/orders/DeliveredOrderModal';
import { OrderReceiptModal } from './components/orders/OrderReceiptModal';
import { TelegramBrowserBlocked } from './components/common/TelegramBrowserBlocked';
import { Product, Category, Order, TelegramUser, Profile, GachaPool } from './types';
import { StoreAPI } from './services/api';
import { Loader2 } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AudioProvider } from './context/AudioPlayerContext';

const StoreAppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isLoading, setIsLoading] = useState(true);

  // User & Profile
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Sync points state across the app on daily reward claim
  useEffect(() => {
    const handleSync = (e: any) => {
      if (typeof e.detail?.points === 'number') {
        setProfile((prev: any) =>
          prev
            ? {
                ...prev,
                points: e.detail.points,
                loyalty_points: e.detail.points,
                reward_points: e.detail.points,
              }
            : prev
        );
      }
    };
    window.addEventListener('uchiro_points_sync', handleSync);
    window.addEventListener('uchiro_points_updated', handleSync);
    return () => {
      window.removeEventListener('uchiro_points_sync', handleSync);
      window.removeEventListener('uchiro_points_updated', handleSync);
    };
  }, []);

  // Store Catalog Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [homeInStockProducts, setHomeInStockProducts] = useState<Product[]>([]);
  const [allShopProducts, setAllShopProducts] = useState<Product[]>([]);
  const [gachaPools, setGachaPools] = useState<GachaPool[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [shopCategorySlug, setShopCategorySlug] = useState<string | null>(null);

  // Modals & Flows
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Dedicated Product Detail Navigation (/product/:id)
  const handleSelectProduct = (product: Product | null) => {
    setSelectedProduct(product);
    if (product) {
      const targetPath = `/product/${product.id}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ productId: product.id }, '', targetPath);
      }
    } else {
      if (window.location.pathname.startsWith('/product/')) {
        window.history.pushState(null, '', '/');
      }
    }
  };

  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutQuantity, setCheckoutQuantity] = useState<number>(1);
  const [checkoutRobloxUsername, setCheckoutRobloxUsername] = useState<string | undefined>();
  const [checkoutRobloxDisplayName, setCheckoutRobloxDisplayName] = useState<string | undefined>();
  const [checkoutRobloxUserId, setCheckoutRobloxUserId] = useState<string | undefined>();
  const [activePaymentOrder, setActivePaymentOrder] = useState<Order | null>(null);
  const [activePayment, setActivePayment] = useState<any | null>(null);
  const [deliveredOrderModal, setDeliveredOrderModal] = useState<Order | null>(null);
  const [receiptOrderModal, setReceiptOrderModal] = useState<Order | null>(null);

  useEffect(() => {
    initializeApp();

    // Session heartbeat tracking for honest live shopper metrics (throttled to 25s, pauses on background)
    let sessId = sessionStorage.getItem('uchiro_session_id');
    if (!sessId) {
      sessId = `uch_sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      sessionStorage.setItem('uchiro_session_id', sessId);
    }
    StoreAPI.sendHeartbeat(sessId);

    const sendHeartbeatIfVisible = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (sessId) {
        StoreAPI.sendHeartbeat(sessId);
      }
    };

    const hbInterval = setInterval(sendHeartbeatIfVisible, 25000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && sessId) {
        StoreAPI.sendHeartbeat(sessId);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(hbInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  const initializeApp = async () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
      }

      const initData = tg?.initData || '';
      try {
        const authData = await StoreAPI.authenticateTelegram(initData);
        if (authData) {
          const mergedUser = {
            ...authData.user,
            photo_url: authData.user?.photo_url || tg?.initDataUnsafe?.user?.photo_url || null,
          };
          setUser(mergedUser);
          setProfile(authData.profile);
        }
      } catch (authErr) {
        console.warn('Telegram auth fallback:', authErr);
        if (tg?.initDataUnsafe?.user) {
          const u = tg.initDataUnsafe.user;
          setUser({
            id: String(u.id),
            telegram_id: u.id,
            username: u.username || null,
            first_name: u.first_name || '',
            last_name: u.last_name || null,
            photo_url: u.photo_url || null,
            language_code: u.language_code || 'en',
          });
        }
      }

      // Fetch Catalog, Categories, In-Stock Products & Gacha Pools
      const [cats, inStock, shopProducts, pools] = await Promise.all([
        StoreAPI.getCategories().catch(() => []),
        StoreAPI.getHomeInStockProducts().catch(() => []),
        StoreAPI.getShopProducts({}).catch(() => []),
        StoreAPI.getGachaPools().catch(() => []),
      ]);

      setCategories(cats);
      setHomeInStockProducts(inStock);
      setAllShopProducts(shopProducts);
      setGachaPools(pools);

      // Fetch User's Orders
      let userOrders: Order[] = [];
      try {
        userOrders = await StoreAPI.getOrders();
        setOrders(userOrders);
      } catch {
        setOrders([]);
      }

      // Handle Telegram Deep Link query parameters: ?order=...&view=receipt|delivery
      const urlParams = new URLSearchParams(window.location.search);
      const orderParam = urlParams.get('order');
      const viewParam = urlParams.get('view');
      if (orderParam) {
        let targetOrder = userOrders.find((o) => o.order_number === orderParam || o.id === orderParam);
        if (!targetOrder) {
          try {
            targetOrder = await StoreAPI.getOrder(orderParam);
          } catch {
            // non-fatal
          }
        }
        if (targetOrder) {
          if (viewParam === 'receipt') {
            setReceiptOrderModal(targetOrder);
          } else {
            setDeliveredOrderModal(targetOrder);
          }
        }
      }

      // Check if URL path starts with /product/:id
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/product/')) {
        const prodId = currentPath.replace('/product/', '').split('/')[0].split('?')[0];
        if (prodId) {
          const found =
            inStock.find((p: Product) => p.id === prodId) ||
            shopProducts.find((p: Product) => p.id === prodId);
          if (found) {
            setSelectedProduct(found);
          } else {
            StoreAPI.getProductById(prodId).then((p: Product) => {
              if (p) setSelectedProduct(p);
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize Uchiro Store app:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync browser popstate navigation for /product/:id
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/product/')) {
        const prodId = path.replace('/product/', '').split('/')[0].split('?')[0];
        if (prodId) {
          const found =
            homeInStockProducts.find((p: Product) => p.id === prodId) ||
            allShopProducts.find((p: Product) => p.id === prodId);
          if (found) {
            setSelectedProduct(found);
          } else {
            StoreAPI.getProductById(prodId).then((p: Product) => {
              if (p) setSelectedProduct(p);
            }).catch(() => {});
          }
        }
      } else {
        setSelectedProduct(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [homeInStockProducts, allShopProducts]);

  const refreshProfileAndOrders = async () => {
    try {
      const [meData, userOrders, inStock, shopProducts] = await Promise.all([
        StoreAPI.getMe().catch(() => null),
        StoreAPI.getOrders().catch(() => []),
        StoreAPI.getHomeInStockProducts().catch(() => []),
        StoreAPI.getShopProducts({}).catch(() => []),
      ]);
      if (meData) {
        const tg = (window as any).Telegram?.WebApp;
        const mergedUser = {
          ...meData.user,
          photo_url: meData.user?.photo_url || tg?.initDataUnsafe?.user?.photo_url || null,
        };
        setUser(mergedUser);
        setProfile(meData.profile);
        if (typeof meData.profile?.points === 'number') {
          window.dispatchEvent(
            new CustomEvent('uchiro_points_updated', {
              detail: { points: meData.profile.points },
            })
          );
        }
      }
      setOrders(userOrders);
      setHomeInStockProducts(inStock);
      setAllShopProducts(shopProducts);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  };

  const handleQuickBuy = (product: Product) => {
    setSelectedProduct(null);
    setCheckoutProduct(product);
    setCheckoutQuantity(1);
  };

  const handleOrderCreated = (order: Order, payment: any) => {
    setCheckoutProduct(null);
    setActivePaymentOrder(order);
    setActivePayment(payment);
    refreshProfileAndOrders();
  };

  const handlePaymentSuccess = (deliveredOrder: Order) => {
    setActivePayment(null);
    setActivePaymentOrder(null);
    setDeliveredOrderModal(deliveredOrder);
    refreshProfileAndOrders();
  };

  const pendingOrdersCount = orders.filter((o) => o.status === 'pending_payment').length;

  // Telegram BackButton support for modals
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    if (selectedProduct) {
      tg.BackButton.show();
      const onBack = () => {
        handleSelectProduct(null);
      };
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton.offClick(onBack);
        if (!selectedProduct) {
          tg.BackButton.hide();
        }
      };
    } else if (!activePayment && !deliveredOrderModal && !checkoutProduct) {
      tg.BackButton.hide();
    }
  }, [selectedProduct, activePayment, deliveredOrderModal, checkoutProduct]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E63946] to-[#FFD166] p-0.5 animate-pulse">
          <div className="w-full h-full bg-[#0B0E14] rounded-[14px] flex items-center justify-center">
            <span className="font-black text-white text-base">U3</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-[#FFD166]" />
          <span>Starting Uchiro Store...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0E14] text-slate-900 dark:text-white flex flex-col relative selection:bg-[#E63946] selection:text-white transition-colors">
      {/* Background Pattern Layer */}
      <GamingDoodlePattern />

      {/* Sticky Top Bar */}
      <HeaderTopBar
        user={user}
        profile={profile}
        onOpenProfile={() => setActiveTab('profile')}
      />

      {/* Main Container Viewport (Mobile Pocket Layout 360px-410px) */}
      <main className="flex-1 max-w-md w-full mx-auto p-2.5 sm:p-3 relative z-10 overflow-x-hidden">
        {activeTab === 'home' && (
          <HomePage
            inStockProducts={homeInStockProducts}
            onSelectProduct={handleSelectProduct}
            onQuickBuy={handleSelectProduct}
            onNavigateToShop={(slug?: string) => {
              setShopCategorySlug(slug || null);
              setActiveTab('shop');
            }}
            onNavigateToGacha={() => setActiveTab('gacha')}
          />
        )}

        {activeTab === 'shop' && (
          <ShopPage
            products={allShopProducts}
            categories={categories}
            selectedCategorySlug={shopCategorySlug}
            onSelectCategory={setShopCategorySlug}
            onSelectProduct={handleSelectProduct}
            onQuickBuy={handleSelectProduct}
          />
        )}

        {activeTab === 'gacha' && (
          <GachaPage
            pools={gachaPools}
            userPoints={profile?.points || 0}
            onRefreshProfile={refreshProfileAndOrders}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersPage
            orders={orders}
            onSelectOrder={setDeliveredOrderModal}
            onPayOrder={(order) => {
              setActivePaymentOrder(order);
              setActivePayment(
                order.payment || {
                  id: (order as any).payment_id || order.id,
                  order_id: order.id,
                  amount: order.total_amount,
                  currency: 'USD',
                  qr_payload: (order as any).khqr_data || (order as any).qr_code || null,
                  qr_image_url: (order as any).khqr_image_url || (order as any).qr_image_url || null,
                  status: 'pending',
                  expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
                }
              );
            }}
            onViewReceipt={(order) => setReceiptOrderModal(order)}
            onNavigateToShop={() => setActiveTab('shop')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfilePage
            user={user}
            profile={profile}
            orders={orders}
            onSelectOrder={setDeliveredOrderModal}
            onNavigateToTab={setActiveTab}
            onRefreshProfile={refreshProfileAndOrders}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        ordersBadgeCount={pendingOrdersCount}
      />

      {/* Product Detail Dedicated View (/product/:id) */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          initialQuantity={1}
          onClose={() => handleSelectProduct(null)}
          onProceedToCheckout={(product, robloxUsername, robloxDisplayName, robloxUserId, quantity) => {
            handleSelectProduct(null);
            setCheckoutProduct(product);
            setCheckoutQuantity(quantity || 1);
            setCheckoutRobloxUsername(robloxUsername);
            setCheckoutRobloxDisplayName(robloxDisplayName);
            setCheckoutRobloxUserId(robloxUserId);
          }}
        />
      )}

      {/* Checkout Modal */}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          quantity={checkoutQuantity}
          initialQuantity={checkoutQuantity}
          robloxUsername={checkoutRobloxUsername}
          robloxDisplayName={checkoutRobloxDisplayName}
          robloxUserId={checkoutRobloxUserId}
          onClose={() => setCheckoutProduct(null)}
          onOrderCreated={handleOrderCreated}
        />
      )}

      {/* KHQR Real-time Payment Screen */}
      {activePayment && activePaymentOrder && (
        <KHQRPaymentScreen
          order={activePaymentOrder}
          payment={activePayment}
          onPaymentSuccess={handlePaymentSuccess}
          onClose={() => {
            setActivePayment(null);
            setActivePaymentOrder(null);
          }}
        />
      )}

      {/* Delivered Credentials & Authenticator Vault Modal */}
      {deliveredOrderModal && (
        <DeliveredOrderModal
          order={deliveredOrderModal}
          onClose={() => setDeliveredOrderModal(null)}
          onBackToHome={() => {
            setDeliveredOrderModal(null);
            setActiveTab('home');
          }}
          onViewReceipt={(order) => {
            setDeliveredOrderModal(null);
            setReceiptOrderModal(order);
          }}
        />
      )}

      {/* Official Order Receipt Modal */}
      {receiptOrderModal && (
        <OrderReceiptModal
          order={receiptOrderModal}
          onClose={() => setReceiptOrderModal(null)}
          onOpenDelivery={(order) => {
            setReceiptOrderModal(null);
            setDeliveredOrderModal(order);
          }}
          onBackToHome={() => {
            setReceiptOrderModal(null);
            setActiveTab('home');
          }}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const isTelegramMiniApp =
    (typeof window !== 'undefined' &&
      Boolean(
        window.Telegram?.WebApp?.initData &&
          window.Telegram.WebApp.initData.length > 5
      )) ||
    Boolean(
      (import.meta as any).env?.DEV &&
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('dev') === 'true'
    );

  if (!isTelegramMiniApp) {
    return <TelegramBrowserBlocked />;
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AudioProvider>
          <StoreAppContent />
        </AudioProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};
