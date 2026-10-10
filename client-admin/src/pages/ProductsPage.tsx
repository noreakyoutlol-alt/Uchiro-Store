import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Search,
  Sword,
  Skull,
  Crosshair,
  Zap,
  Flame,
  Egg,
  Ticket,
  Gamepad2,
  UserCheck,
  Gift,
  Repeat,
  ShieldCheck,
  Eye,
  KeyRound,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { Product, ProductType, DeliveryMode, Category, ProductMedia } from '../types';
import { AdminAPI } from '../services/api';
import { MediaManager } from '../components/products/MediaManager';
import { AccountInventoryDepositModal } from '../components/products/AccountInventoryDepositModal';

interface ProductsPageProps {
  products: Product[];
  categories?: Category[];
  onRefreshProducts: () => void;
  onNavigateToInventory?: (productId?: string) => void;
}

// 8 Primary Games / Categories (Requirement 1)
const REQUIRED_CATEGORIES = [
  { slug: 'blox-fruits', name: 'Blox Fruits', icon: Sword, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  { slug: 'mm2', name: 'MM2', icon: Skull, color: 'text-rose-400 border-rose-500/40 bg-rose-500/10' },
  { slug: 'rivals', name: 'Rivals', icon: Crosshair, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10' },
  { slug: 'blade-ball', name: 'Blade Ball', icon: Zap, color: 'text-purple-400 border-purple-500/40 bg-purple-500/10' },
  { slug: 'evade', name: 'Evade', icon: Flame, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  { slug: 'steal-egg', name: 'Steal Egg', icon: Egg, color: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10' },
  { slug: 'gamepasses', name: 'Gamepasses', icon: Ticket, color: 'text-pink-400 border-pink-500/40 bg-pink-500/10' },
  { slug: 'other', name: 'Other', icon: Gamepad2, color: 'text-slate-300 border-slate-500/40 bg-slate-500/10' },
];

const DEFAULT_CATEGORY_IDS: Record<string, string> = {
  'blox-fruits': '11111111-1111-1111-1111-111111111103',
  'mm2': '11111111-1111-1111-1111-111111111104',
  'blade-ball': '11111111-1111-1111-1111-111111111105',
  'rivals': '11111111-1111-1111-1111-111111111109',
  'evade': '11111111-1111-1111-1111-111111111106',
  'steal-egg': '11111111-1111-1111-1111-111111111107',
  'gamepasses': '11111111-1111-1111-1111-111111111110',
  'other': '11111111-1111-1111-1111-111111111108',
};

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  categories = [],
  onRefreshProducts,
  onNavigateToInventory,
}) => {
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Deposit Modal state for Account products
  const [depositModalProduct, setDepositModalProduct] = useState<{ id: string; title: string } | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // Dynamic Product Form State
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('blox-fruits');
  const [selectedProductType, setSelectedProductType] = useState<ProductType>('account');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number>(9.99);
  const [warrantyDays, setWarrantyDays] = useState<number>(14);
  const [description, setDescription] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('auto_account');
  const [stock, setStock] = useState<number>(1);
  const [isDraft, setIsDraft] = useState<boolean>(false);
  const [requiresRobloxUsername, setRequiresRobloxUsername] = useState<boolean>(false);
  const [media, setMedia] = useState<ProductMedia[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // Specs key-value pairs
  const [specs, setSpecs] = useState<Array<{ key: string; value: string }>>([
    { key: 'Level', value: '2550 (MAX)' },
    { key: 'Fruit', value: 'Kitsune (Awakened)' },
    { key: 'Fighting Style', value: 'Godhuman' },
    { key: 'Security', value: 'Unverified Email, No PIN' },
  ]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingProductId(null);
    setSelectedCategorySlug('blox-fruits');
    setSelectedProductType('account');
    setTitle('');
    setPrice(9.99);
    setWarrantyDays(14);
    setDescription('');
    setDeliveryMode('auto_account');
    setStock(0);
    setIsDraft(false);
    setRequiresRobloxUsername(false);
    setMedia([]);
    setVideoUrl('');
    setSpecs([
      { key: 'Level', value: '2550 (MAX)' },
      { key: 'Fruit', value: 'Kitsune (Awakened)' },
      { key: 'Fighting Style', value: 'Godhuman' },
      { key: 'Security', value: 'Unverified Email, No PIN' },
    ]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProductId(p.id);

    // Determine category slug
    const cat = categories.find((c) => c.id === p.category_id);
    const catSlug = cat?.slug || 'other';
    setSelectedCategorySlug(
      REQUIRED_CATEGORIES.some((c) => c.slug === catSlug) ? catSlug : 'other'
    );

    // Determine product type
    const pType: ProductType =
      p.product_type ||
      (p.delivery_mode === 'auto_account'
        ? 'account'
        : p.delivery_mode === 'manual_service'
        ? 'gift'
        : p.delivery_mode === 'trade_item'
        ? 'trade'
        : p.delivery_mode === 'digital_code'
        ? 'digital_code'
        : 'account');
    setSelectedProductType(pType);

    setTitle(p.title || '');
    setPrice(p.price || 0);
    setWarrantyDays(p.warranty_days || 14);
    setDescription(p.description || p.short_description || '');
    setDeliveryMode(p.delivery_mode || 'auto_account');
    setStock(p.stock || 0);
    setIsDraft(Boolean(p.is_draft));
    setRequiresRobloxUsername(Boolean(p.requires_roblox_username));
    setMedia(p.media || []);
    setVideoUrl(p.video_url || '');

    // Parse specs
    if (p.specifications && typeof p.specifications === 'object') {
      const parsedSpecs = Object.entries(p.specifications).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setSpecs(parsedSpecs.length > 0 ? parsedSpecs : [{ key: 'Details', value: 'Verified Item' }]);
    } else {
      setSpecs([{ key: 'Details', value: 'Verified Item' }]);
    }

    setIsModalOpen(true);
  };

  // Switch Product Type dynamically and initialize default presets
  const handleSelectProductType = (type: ProductType) => {
    setSelectedProductType(type);
    if (type === 'account') {
      setDeliveryMode('auto_account');
      setRequiresRobloxUsername(false);
      if (specs.length === 0 || specs[0].key === 'Trade Items' || specs[0].key === 'Gift Item') {
        setSpecs([
          { key: 'Level', value: '2550 (MAX)' },
          { key: 'Fruit', value: 'Mythical Fruit' },
          { key: 'Security', value: 'Unverified Email, No PIN' },
        ]);
      }
    } else if (type === 'gift') {
      setDeliveryMode('manual_service');
      setRequiresRobloxUsername(true); // Mandatory for Gift Item
      if (stock <= 0) setStock(5);
      if (specs.length === 0 || specs[0].key === 'Level') {
        setSpecs([
          { key: 'Gift Item', value: 'Gamepass / Fruit Gift' },
          { key: 'Delivery Method', value: 'In-Game Gift Transfer' },
          { key: 'Delivery Time', value: '5-15 Minutes' },
        ]);
      }
    } else if (type === 'trade') {
      setDeliveryMode('trade_item');
      setRequiresRobloxUsername(true);
      if (stock <= 0) setStock(1);
      if (specs.length === 0 || specs[0].key === 'Level') {
        setSpecs([
          { key: 'Trade Items', value: 'Offered In-Game Weapons / Pets' },
          { key: 'Server Region', value: 'Private VIP Trading Server' },
          { key: 'Instructions', value: 'Staff joins buyer in trading hub' },
        ]);
      }
    } else if (type === 'digital_code') {
      setDeliveryMode('digital_code');
      setRequiresRobloxUsername(false);
      if (stock <= 0) setStock(10);
      if (specs.length === 0 || specs[0].key === 'Level') {
        setSpecs([
          { key: 'Platform', value: 'Official Game / Roblox Voucher' },
          { key: 'Redemption', value: 'Instant Digital Code' },
          { key: 'Instructions', value: 'Redeem code in-game or on platform' },
        ]);
      }
    }
  };

  // Add / Remove / Update Spec
  const handleAddSpec = () => {
    setSpecs([...specs, { key: '', value: '' }]);
  };
  const handleRemoveSpec = (index: number) => {
    setSpecs(specs.filter((_, idx) => idx !== index));
  };
  const handleUpdateSpec = (index: number, field: 'key' | 'value', text: string) => {
    const updated = [...specs];
    updated[index][field] = text;
    setSpecs(updated);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Product title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Find matching category id
      const matchedCat =
        categories.find((c) => c.slug === selectedCategorySlug) ||
        categories.find((c) => c.slug.includes(selectedCategorySlug)) ||
        categories[0];

      // Convert specs array to Record<string, any>
      const specificationsObj: Record<string, any> = {};
      specs.forEach((s) => {
        if (s.key.trim()) {
          specificationsObj[s.key.trim()] = s.value.trim();
        }
      });

      const payload: Partial<Product> = {
        id: editingProductId || undefined,
        category_id: matchedCat?.id || DEFAULT_CATEGORY_IDS[selectedCategorySlug] || '11111111-1111-1111-1111-111111111103',
        title: title.trim(),
        slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: description.trim() || title.trim(),
        short_description: description.trim().slice(0, 150) || title.trim(),
        product_type: selectedProductType,
        price: Number(price) || 0,
        stock: deliveryMode === 'auto_account' ? 0 : Number(stock) || 0,
        delivery_mode: deliveryMode,
        warranty_days: deliveryMode === 'auto_account' ? Number(warrantyDays) || 14 : Number(warrantyDays) || 0,
        requires_roblox_username:
          deliveryMode === 'manual_service' || deliveryMode === 'trade_item' || selectedProductType === 'gift' || selectedProductType === 'trade'
            ? true
            : requiresRobloxUsername,
        requires_roblox_verification: deliveryMode === 'manual_service',
        is_draft: isDraft,
        is_active: !isDraft,
        is_featured: true,
        specifications: {
          ...specificationsObj,
          ...(deliveryMode === 'manual_service' ? { requires_roblox_verification: true } : {}),
        },
        media: media.length > 0 ? media : undefined,
        video_url: videoUrl.trim() || null,
      };

      if (editingProductId) {
        await AdminAPI.updateProduct(editingProductId, payload);
      } else {
        await AdminAPI.saveProduct(payload);
      }
      setIsModalOpen(false);
      onRefreshProducts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Error saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product? Associated inventory will be unlinked.')) return;
    try {
      await AdminAPI.deleteProduct(id);
      onRefreshProducts();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error deleting product');
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (filterCategory !== 'all') {
        const cat = categories.find((c) => c.id === p.category_id);
        const catSlug = cat?.slug || '';
        if (filterCategory === 'mm2') {
          if (catSlug !== 'mm2' && catSlug !== 'murder-mystery-2') return false;
        } else if (catSlug !== filterCategory) {
          return false;
        }
      }

      // Product Type filter
      if (filterType !== 'all') {
        const pType =
          p.product_type ||
          (p.delivery_mode === 'auto_account'
            ? 'account'
            : p.delivery_mode === 'manual_service'
            ? 'gift'
            : p.delivery_mode === 'trade_item'
            ? 'trade'
            : p.delivery_mode === 'digital_code'
            ? 'digital_code'
            : 'account');
        if (pType !== filterType) return false;
      }

      // Status filter
      if (filterStatus === 'published' && (p.is_draft || !p.is_active)) return false;
      if (filterStatus === 'draft' && !p.is_draft) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [products, categories, filterCategory, filterType, filterStatus, searchQuery]);

  return (
    <div className="space-y-3 animate-fadeIn pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[#FFD166]" />
            <span>PRODUCT MANAGEMENT</span>
          </h2>
          <p className="text-xs text-slate-400">
            Create dynamic Accounts, Gift Items, and Trade Items with automated vault fulfillment.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="h-8 sm:h-9 px-3 rounded-lg bg-gradient-to-r from-[#E63946] to-[#D90429] hover:brightness-110 active:scale-95 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-[#E63946]/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-[#111622] border border-white/5 space-y-2">
        {/* Top search & type filters */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title or description..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Product Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Product Types</option>
              <option value="account">👤 Accounts</option>
              <option value="gift">🎁 Gift Items</option>
              <option value="trade">🔄 Trade Items</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-semibold focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">🟢 Published Only</option>
              <option value="draft">🟡 Draft Only</option>
            </select>
          </div>
        </div>

        {/* 8 Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              filterCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            All Games ({products.length})
          </button>
          {REQUIRED_CATEGORIES.map((c) => {
            const Icon = c.icon;
            const isSelected = filterCategory === c.slug;
            return (
              <button
                key={c.slug}
                onClick={() => setFilterCategory(c.slug)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* PRODUCTS GRID */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center bg-[#111622] rounded-2xl border border-white/5 space-y-2">
          <Boxes className="w-10 h-10 text-slate-500 mx-auto opacity-40" />
          <h3 className="font-bold text-white text-sm">No products found</h3>
          <p className="text-xs text-slate-400">
            Create a new Account, Gift Item, or Trade Item above to populate the catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredProducts.map((p) => {
            const cat = categories.find((c) => c.id === p.category_id);
            const isAccount = p.delivery_mode === 'auto_account' || p.product_type === 'account';
            const isGift = p.delivery_mode === 'manual_service' || p.product_type === 'gift';
            const isTrade = p.delivery_mode === 'trade_item' || p.product_type === 'trade';
            const isKey = p.delivery_mode === 'digital_code' || p.product_type === 'digital_code';
            const primaryImage = p.media?.find((m) => m.is_primary)?.url || p.media?.[0]?.url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';

            return (
              <div
                key={p.id}
                className="p-2.5 sm:p-3 rounded-xl bg-[#111622] border border-white/5 hover:border-white/15 transition-all flex flex-col justify-between space-y-2 shadow-md group relative"
              >
                <div className="space-y-2.5">
                  {/* Image & Top Badges */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/60 border border-white/10">
                    <img
                      src={primaryImage}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Published / Draft Pill */}
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      {p.is_draft ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-600/40 text-amber-300 text-[10px] font-bold backdrop-blur-sm">
                          🟡 Draft
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 text-[10px] font-bold backdrop-blur-sm">
                          🟢 Published
                        </span>
                      )}
                    </div>

                    {/* Delivery Mode Pill */}
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/70 border border-white/20 text-white text-[10px] font-bold backdrop-blur-sm flex items-center gap-1">
                        {isAccount && <UserCheck className="w-3 h-3 text-emerald-400" />}
                        {isGift && <Gift className="w-3 h-3 text-pink-400" />}
                        {isTrade && <Repeat className="w-3 h-3 text-indigo-400" />}
                        {isKey && <KeyRound className="w-3 h-3 text-cyan-400" />}
                        <span>
                          {p.delivery_mode === 'auto_account'
                            ? 'Instant Account'
                            : p.delivery_mode === 'manual_service'
                            ? 'Roblox Gift'
                            : p.delivery_mode === 'trade_item'
                            ? 'In-Game Trade'
                            : 'Digital Key'}
                        </span>
                      </span>
                    </div>

                    {/* Stock status indicator pill */}
                    <div className="absolute bottom-2 left-2">
                      {isAccount ? (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black backdrop-blur-sm flex items-center gap-1 ${
                            p.stock > 0
                              ? 'bg-emerald-950/90 border border-emerald-600/60 text-emerald-300'
                              : 'bg-rose-950/90 border border-rose-700/60 text-rose-300'
                          }`}
                        >
                          <Zap className="w-3 h-3 text-[#FFD166]" />
                          <span>{p.stock > 0 ? `Vault: ${p.stock} Available` : 'Vault: SOLD OUT'}</span>
                        </span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold backdrop-blur-sm ${
                            p.stock > 0
                              ? 'bg-black/70 border border-emerald-500/40 text-emerald-400'
                              : 'bg-rose-950/90 border border-rose-700/60 text-rose-300 font-black'
                          }`}
                        >
                          {p.stock > 0 ? `${p.stock} in stock` : 'SOLD OUT'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Game */}
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mb-0.5">
                      <span>{cat?.name || 'Roblox Game'}</span>
                      {p.warranty_days ? (
                        <span>• {p.warranty_days}d Warranty</span>
                      ) : null}
                      {p.requires_roblox_username ? (
                        <span className="text-amber-400">• Roblox ID Required</span>
                      ) : null}
                    </div>
                    <h4 className="font-bold text-sm text-white line-clamp-1">{p.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                      {p.short_description || p.description}
                    </p>
                  </div>
                </div>

                {/* Bottom Bar: Price & Action Buttons */}
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-black text-white">${p.price.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-all"
                        title="Edit Product"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                        title="Delete Product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Account specific: Quick Deposit Button */}
                  {isAccount && (
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setDepositModalProduct({ id: p.id, title: p.title })}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-all"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Deposit Account Stock</span>
                      </button>

                      {onNavigateToInventory && (
                        <button
                          type="button"
                          onClick={() => onNavigateToInventory(p.id)}
                          className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] font-semibold"
                          title="View in Inventory Vault"
                        >
                          <Layers className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DYNAMIC CREATE / EDIT PRODUCT MODAL (Requirements 1, 2, 4, 5, 6) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="w-[95vw] max-w-2xl bg-[#111622] border border-white/10 rounded-2xl p-3 sm:p-5 space-y-3 my-auto max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E63946]/20 text-[#E63946] flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white uppercase tracking-wider">
                    {editingProductId ? 'EDIT PRODUCT' : 'CREATE DYNAMIC PRODUCT'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Step 1: Category &bull; Step 2: Product Type &bull; Step 3: Dynamic Specs & Media
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-5 text-xs">
              {/* STEP 1: GAME / CATEGORY SELECTION (Requirement 1) */}
              <div className="space-y-2">
                <label className="text-slate-300 font-bold block">
                  1. Select Game / Category <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {REQUIRED_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategorySlug === cat.slug;
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => setSelectedCategorySlug(cat.slug)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 border-indigo-400 text-white shadow-lg'
                            : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : cat.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs truncate">{cat.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: PRODUCT TYPE SELECTION (Requirement 1) */}
              <div className="space-y-2">
                <label className="text-slate-300 font-bold block">
                  2. Select Product Type <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Account */}
                  <button
                    type="button"
                    onClick={() => handleSelectProductType('account')}
                    className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                      selectedProductType === 'account'
                        ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-emerald-400 flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" /> Account
                      </span>
                      {selectedProductType === 'account' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Credentials Vault, optional TOTP authenticator, instant delivery.
                    </p>
                  </button>

                  {/* Gift Item */}
                  <button
                    type="button"
                    onClick={() => handleSelectProductType('gift')}
                    className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                      selectedProductType === 'gift'
                        ? 'bg-pink-950/60 border-pink-500 text-white shadow-lg shadow-pink-900/20'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-pink-400 flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5" /> Gift Item
                      </span>
                      {selectedProductType === 'gift' && <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      In-game gift transfer. Mandatory Roblox username verification.
                    </p>
                  </button>

                  {/* Trade Item */}
                  <button
                    type="button"
                    onClick={() => handleSelectProductType('trade')}
                    className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                      selectedProductType === 'trade'
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-indigo-400 flex items-center gap-1">
                        <Repeat className="w-3.5 h-3.5" /> Trade Item
                      </span>
                      {selectedProductType === 'trade' && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      In-game trade with Order ID copying and staff coordination.
                    </p>
                  </button>

                  {/* Digital Key / Voucher */}
                  <button
                    type="button"
                    onClick={() => handleSelectProductType('digital_code')}
                    className={`p-3 rounded-xl border text-left space-y-1 transition-all ${
                      selectedProductType === 'digital_code'
                        ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-lg shadow-cyan-900/20'
                        : 'bg-black/40 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-cyan-400 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" /> Digital Key
                      </span>
                      {selectedProductType === 'digital_code' && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Instant digital code or voucher redemption key.
                    </p>
                  </button>
                </div>
              </div>

              {/* STEP 3: DYNAMIC FORM FIELDS (Requirements 2, 4, 5) */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-white text-xs uppercase tracking-wider">
                    3. {selectedProductType === 'account' ? 'Account Product Fields' : selectedProductType === 'gift' ? 'Gift Item Fields' : selectedProductType === 'trade' ? 'Trade Item Fields' : 'Digital Key Fields'}
                  </span>
                  <span className="text-[10px] text-indigo-400 font-semibold capitalize">
                    Mode: {deliveryMode.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* COMMON: PRODUCT NAME */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Product Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      selectedProductType === 'account'
                        ? 'e.g. Blox Fruits Max Level Kitsune + Godhuman Account'
                        : selectedProductType === 'gift'
                        ? 'e.g. 2x Money Gamepass / Permanent Fruit Gift'
                        : 'e.g. MM2 Harvester + Corrupt Ancient Knife Trade'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* PRICE & (WARRANTY or STOCK) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">
                      Price ($ USD) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {selectedProductType === 'account' ? (
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">
                        Warranty (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={warrantyDays}
                        onChange={(e) => setWarrantyDays(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 14"
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">
                        Stock Quantity <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={stock}
                        onChange={(e) => setStock(parseInt(e.target.value) || 0)}
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* PRODUCT OVERVIEW */}
                <div>
                  <label className="text-slate-300 font-bold block mb-1">
                    Product Overview <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter detailed description, features, instructions for the customer..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* TYPE SPECIFIC DETAILS / SPECS */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold">
                      {selectedProductType === 'account'
                        ? 'Account & Item Specs'
                        : selectedProductType === 'gift'
                        ? 'Gift Item Details'
                        : 'Trade Details'}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      className="text-[11px] text-[#FFD166] hover:underline font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Detail Row
                    </button>
                  </div>

                  <div className="space-y-2">
                    {specs.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => handleUpdateSpec(idx, 'key', e.target.value)}
                          placeholder="Key (e.g. Fruit, Level, Trade Server)"
                          className="w-1/3 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs font-semibold"
                        />
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) => handleUpdateSpec(idx, 'value', e.target.value)}
                          placeholder="Value (e.g. Kitsune Perm, 2550, Trade Hub)"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/10 text-white text-xs"
                        />
                        {specs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSpec(idx)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* DELIVERY MODE & PUBLISHED TOGGLE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Delivery Mode</label>
                    <select
                      value={deliveryMode}
                      onChange={(e) => {
                        const newMode = e.target.value as DeliveryMode;
                        setDeliveryMode(newMode);
                        if (newMode === 'manual_service' || newMode === 'trade_item') {
                          setRequiresRobloxUsername(true);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="auto_account">Instant Account Delivery</option>
                      <option value="manual_service">Roblox Gift Delivery</option>
                      <option value="trade_item">In-Game Trade</option>
                      <option value="digital_code">Instant Digital Key</option>
                    </select>

                    {/* Informative note for Roblox Gift Delivery */}
                    {deliveryMode === 'manual_service' && (
                      <div className="mt-2 p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-start gap-1.5 text-pink-300 text-[11px] font-medium leading-tight">
                        <AlertCircle className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                        <span>Requires customer Roblox identity verification at checkout</span>
                      </div>
                    )}
                  </div>

                  {/* Published / Draft */}
                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Publishing Status</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDraft(false)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          !isDraft
                            ? 'bg-emerald-600 text-white shadow'
                            : 'bg-black/50 border border-white/10 text-slate-400'
                        }`}
                      >
                        🟢 Published
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDraft(true)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          isDraft
                            ? 'bg-amber-600 text-white shadow'
                            : 'bg-black/50 border border-white/10 text-slate-400'
                        }`}
                      >
                        🟡 Draft
                      </button>
                    </div>
                  </div>
                </div>

                {/* GIFT / TRADE NOTICE: Mandatory Roblox Verification */}
                {(selectedProductType === 'gift' || selectedProductType === 'trade') && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-300">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    <p className="text-[11px] leading-tight">
                      <strong>Customer Protection:</strong> Customer must verify their Roblox username before purchasing. Protected checkout flow will be enforced.
                    </p>
                  </div>
                )}
              </div>

              {/* MEDIA MANAGER: Image 1, Image 2, Image 3, Video (Requirement 6) */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                <MediaManager
                  media={media}
                  videoUrl={videoUrl}
                  onChangeMedia={setMedia}
                  onChangeVideoUrl={setVideoUrl}
                />
              </div>

              {/* MODAL FOOTER ACTIONS */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingProductId ? 'Update Product' : 'Publish Product'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK DEPOSIT ACCOUNT STOCK MODAL (Requirement 2 & 9) */}
      {depositModalProduct && (
        <AccountInventoryDepositModal
          productId={depositModalProduct.id}
          productTitle={depositModalProduct.title}
          isOpen={true}
          onClose={() => setDepositModalProduct(null)}
          onSuccess={() => {
            onRefreshProducts();
          }}
        />
      )}
    </div>
  );
};
