import React, { useState, useEffect } from 'react';
import { TabType, BottomNav } from './components/navigation/BottomNav';
import { HeaderTopBar } from './components/navigation/HeaderTopBar';
import { Gear5Atmosphere } from './components/background/Gear5Atmosphere';
import { SeasonalAtmosphere } from './components/background/SeasonalAtmosphere';
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
import { VaultPage } from './components/vault/VaultPage';
import { TelegramBrowserBlocked } from './components/common/TelegramBrowserBlocked';
import { Product, Category, Order, TelegramUser, Profile, GachaPool } from './types';
import { StoreAPI, getStoredToken } from './services/api';
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
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [allShopProducts, setAllShopProducts] = useState<Product[]>([]);
  const [gachaPools, setGachaPools] = useState<GachaPool[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
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
  const [vaultOrderId, setVaultOrderId] = useState<string | undefined>();
  const [vaultAccountId, setVaultAccountId] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    const initializeApp = async () => {
      try {
        let inStock: Product[] = [];
        let shopProducts: Product[] = [];
        let userOrders: Order[] = [];

        // 1. Kick off catalog and public store data in parallel immediately
        const catalogPromise = Promise.allSettled([
          StoreAPI.getCategories(),
          StoreAPI.getHomeInStockProducts(),
          StoreAPI.getShopProducts({}),
          StoreAPI.getGachaPools(),
        ]).then((results) => {
          if (!isMounted) return;
          if (results[0].status === 'fulfilled') setCategories(results[0].value);
          if (results[1].status === 'fulfilled') {
            inStock = results[1].value;
            setHomeInStockProducts(results[1].value);
            setProductsError(null);
          } else {
            setProductsError('Failed to load products');
          }
          if (results[2].status === 'fulfilled') {
            shopProducts = results[2].value;
            setAllShopProducts(results[2].value);
          }
          if (results[3].status === 'fulfilled') setGachaPools(results[3].value);
        }).catch(() => {
          if (isMounted) setProductsError('Failed to load products');
        });

        // 2. Perform Telegram authentication safely
        let authDone = false;

        const attemptAuth = async (tgInstance: any): Promise<boolean> => {
          if (authDone) return true;
          const initData = tgInstance?.initData || '';
          if (initData && initData.length > 5) {
            try {
              const authData = await StoreAPI.authenticateTelegram(initData);
              if (authData && isMounted) {
                authDone = true;
                const resolvedPhoto = authData.user?.photo_url || tgInstance?.initDataUnsafe?.user?.photo_url || null;
                const tgId = authData.user?.telegram_id || tgInstance?.initDataUnsafe?.user?.id;
                if (resolvedPhoto && tgId) {
                  try {
                    localStorage.setItem(`tg_user_avatar_${tgId}`, resolvedPhoto);
                  } catch {}
                }
                const mergedUser = {
                  ...authData.user,
                  photo_url: resolvedPhoto,
                };
                setUser(mergedUser);
                setProfile(authData.profile);

                // Fetch User's Orders once authenticated
                try {
                  userOrders = await StoreAPI.getOrders();
                  if (isMounted) {
                    setOrders(userOrders);
                    setOrdersError(null);
                  }
                } catch (orderErr: any) {
                  if (isMounted) {
                    setOrders([]);
                    if (orderErr?.response?.status !== 401) {
                      setOrdersError(orderErr?.response?.data?.error?.message || orderErr?.message || 'Failed to load orders.');
                    }
                  }
                }
                return true;
              }
            } catch (authErr) {
              console.warn('Telegram auth attempt notice:', authErr);
            }
          }
          return false;
        };

        // Try existing stored session token first for immediate response
        const storedToken = getStoredToken();
        if (storedToken) {
          try {
            const meData = await StoreAPI.getMe();
            if (meData?.user && isMounted) {
              authDone = true;
              const tgId = meData.user?.telegram_id;
              let photo = meData.user?.photo_url;
              if (!photo && tgId) {
                try {
                  photo = localStorage.getItem(`tg_user_avatar_${tgId}`);
                } catch {}
              }
              const mergedUser = {
                ...meData.user,
                photo_url: photo || null,
              };
              setUser(mergedUser);
              setProfile(meData.profile || meData);
              try {
                userOrders = await StoreAPI.getOrders();
                if (isMounted) {
                  setOrders(userOrders);
                  setOrdersError(null);
                }
              } catch {}
            }
          } catch {
            // Stored token expired/invalid; continue to Telegram initData auth
          }
        }

        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          try {
            tg.ready();
            tg.expand();
          } catch (e) {
            console.warn('Telegram WebApp ready/expand warning:', e);
          }
          await attemptAuth(tg);
        }

        // Tolerant of delayed SDK availability: poll with short backoff if not authenticated yet
        if (!authDone) {
          const delays = [80, 200, 500, 1000];
          for (const delay of delays) {
            if (authDone || !isMounted) break;
            await new Promise((resolve) => setTimeout(resolve, delay));
            const lateTg = (window as any).Telegram?.WebApp;
            if (lateTg) {
              try {
                lateTg.ready?.();
                lateTg.expand?.();
              } catch {}
              if (await attemptAuth(lateTg)) break;
            }
          }
        }

        // Ensure catalog has completed loading
        await catalogPromise;

        if (!isMounted) return;

        // Handle Telegram Deep Link query parameters: ?tab=vault&orderId=...&accountId=...
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab');
        if (tabParam === 'vault') {
          setActiveTab('vault');
          const deepOrderId = urlParams.get('orderId') || urlParams.get('order');
          const deepAccountId = urlParams.get('accountId');
          if (deepOrderId) setVaultOrderId(deepOrderId);
          if (deepAccountId) setVaultAccountId(deepAccountId);
        } else if (tabParam === 'orders' || tabParam === 'shop' || tabParam === 'gacha' || tabParam === 'profile') {
          setActiveTab(tabParam as TabType);
        }

        const orderParam = urlParams.get('order');
        const viewParam = urlParams.get('view');
        if (orderParam && tabParam !== 'vault') {
          let targetOrder = userOrders.find((o) => o.order_number === orderParam || o.id === orderParam);
          if (!targetOrder) {
            try {
              targetOrder = await StoreAPI.getOrder(orderParam);
            } catch {
              // non-fatal
            }
          }
          if (targetOrder && isMounted) {
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
            if (found && isMounted) {
              setSelectedProduct(found);
            } else {
              StoreAPI.getProductById(prodId).then((p: Product) => {
                if (p && isMounted) setSelectedProduct(p);
              }).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize Uchiro Store app:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

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
      isMounted = false;
      clearInterval(hbInterval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

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
      setOrdersError(null);
      setHomeInStockProducts(inStock);
      setProductsError(null);
      setAllShopProducts(shopProducts);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  };

  const handleRetryProducts = async () => {
    setIsProductsLoading(true);
    setProductsError(null);
    try {
      const inStock = await StoreAPI.getHomeInStockProducts();
      setHomeInStockProducts(inStock);
      setProductsError(null);
    } catch (err: any) {
      setProductsError(err?.message || 'Failed to load products');
    } finally {
      setIsProductsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setIsOrdersLoading(true);
    setOrdersError(null);
    try {
      const userOrders = await StoreAPI.getOrders();
      setOrders(userOrders);
      setIsOrdersLoading(false);
      setOrdersError(null);
    } catch (err: any) {
      setIsOrdersLoading(false);
      if (err?.response?.status === 401) {
        setOrders([]);
        setOrdersError(null);
      } else {
        setOrdersError(err?.response?.data?.error?.message || err?.message || 'Failed to load orders. Please check your network connection.');
      }
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

  // Comprehensive Telegram BackButton navigation stack
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const hasOpenModal = Boolean(
      receiptOrderModal ||
      deliveredOrderModal ||
      activePayment ||
      checkoutProduct ||
      selectedProduct
    );
    const canGoBack = hasOpenModal || activeTab !== 'home';

    if (canGoBack) {
      tg.BackButton.show();
      const onBack = () => {
        if (receiptOrderModal) {
          setReceiptOrderModal(null);
        } else if (deliveredOrderModal) {
          setDeliveredOrderModal(null);
        } else if (activePayment) {
          setActivePayment(null);
          setActivePaymentOrder(null);
        } else if (checkoutProduct) {
          setCheckoutProduct(null);
        } else if (selectedProduct) {
          handleSelectProduct(null);
        } else if (activeTab !== 'home') {
          setActiveTab('home');
        }
      };
      tg.BackButton.onClick(onBack);
      return () => {
        tg.BackButton.offClick(onBack);
      };
    } else {
      tg.BackButton.hide();
    }
  }, [
    receiptOrderModal,
    deliveredOrderModal,
    activePayment,
    checkoutProduct,
    selectedProduct,
    activeTab,
  ]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#070A14] flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E63946] to-[#FFD166] p-0.5 animate-pulse">
          <div className="w-full h-full bg-[#070A14] rounded-[14px] flex items-center justify-center">
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
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#070A14] text-slate-900 dark:text-white flex flex-col relative selection:bg-[#E63946] selection:text-white transition-colors">
      {/* Background Pattern Layer & Seasonal Atmosphere (Prompt 6) */}
      <SeasonalAtmosphere />

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
            isLoadingProducts={isProductsLoading}
            productsError={productsError}
            onRetryProducts={handleRetryProducts}
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
            isLoading={isProductsLoading}
            error={productsError}
            onRetry={handleRetryProducts}
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
            isLoading={isOrdersLoading}
            error={ordersError}
            onRetry={fetchOrders}
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

        {activeTab === 'vault' && (
          <VaultPage
            onBack={() => setActiveTab('shop')}
            initialOrderId={vaultOrderId}
            initialAccountId={vaultAccountId}
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
          onBackToOrders={() => {
            setDeliveredOrderModal(null);
            setActiveTab('orders');
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
          onBackToOrders={() => {
            setReceiptOrderModal(null);
            setActiveTab('orders');
          }}
        />
      )}
    </div>
  );
};

export function detectTelegram(): boolean {
  if (typeof window === 'undefined') return false;

  const w = window as any;
  const tg = w.Telegram?.WebApp;
  const hasInitData = Boolean(tg?.initData && tg.initData.length > 0);
  const hasPlatform = Boolean(tg?.platform && tg.platform !== 'unknown');
  const hasTgObject = Boolean(w.TelegramWebviewProxy || (w.Telegram && tg));
  const hasTelegramBridge = Boolean(
    w.TelegramWebviewProxy ||
    w.webkit?.messageHandlers?.webAppOpenLink ||
    (typeof w.parent !== 'undefined' && w.parent !== w)
  );

  const href = window.location.href;
  const hasTgHashOrQuery =
    href.includes('tgWebAppData') ||
    href.includes('tgWebAppVersion') ||
    href.includes('tgWebAppPlatform') ||
    href.includes('tgWebAppThemeParams') ||
    href.includes('tgWebAppStartParam');

  const ua = (navigator.userAgent || '').toLowerCase();
  const hasTgUA = ua.includes('telegram') || ua.includes('tg/');

  const isDevOrWeb = Boolean(
    (import.meta as any).env?.DEV ||
    new URLSearchParams(window.location.search).get('dev') === 'true' ||
    new URLSearchParams(window.location.search).get('web') === 'true' ||
    new URLSearchParams(window.location.search).get('guest') === 'true'
  );

  return hasInitData || hasPlatform || hasTgObject || hasTelegramBridge || hasTgHashOrQuery || hasTgUA || isDevOrWeb;
}

export const App: React.FC = () => {
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
