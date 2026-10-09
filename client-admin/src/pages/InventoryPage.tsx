import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  Plus,
  KeyRound,
  UserCheck,
  CheckCircle2,
  Lock,
  X,
  Loader2,
  Trash2,
  Edit2,
  FileSpreadsheet,
  AlertCircle,
  Search,
  Filter,
  Package,
  Clock,
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { InventoryItem, Product } from '../types';
import { AdminAPI } from '../services/api';
import {
  generateBase32Secret,
  buildOtpAuthUri,
  computeTotpCode,
} from '../utils/totp';

interface InventoryPageProps {
  inventory: InventoryItem[];
  products: Product[];
  initialProductId?: string;
  onRefreshInventory: () => void;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  inventory,
  products,
  initialProductId,
  onRefreshInventory,
}) => {
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Add form states
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [selectedProductId, setSelectedProductId] = useState(
    initialProductId || products[0]?.id || ''
  );

  // Single Account & Code fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasAuthenticator, setHasAuthenticator] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [bulkText, setBulkText] = useState('');

  // Live TOTP preview for Add Modal
  const [addOtpCode, setAddOtpCode] = useState('------');
  const [addSecondsLeft, setAddSecondsLeft] = useState(30);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edit form states
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editHasAuth, setEditHasAuth] = useState(false);
  const [edit2fa, setEdit2fa] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editStatus, setEditStatus] = useState<'available' | 'reserved' | 'consumed' | 'sold'>('available');
  const [editNotes, setEditNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'reserved' | 'consumed' | 'sold'>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [deliveryModeFilter, setDeliveryModeFilter] = useState<string>('all');

  // Update selectedProductId if initialProductId changes
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const isAccountProduct =
    selectedProduct?.delivery_mode === 'auto_account' ||
    selectedProduct?.product_type === 'account' ||
    !selectedProduct?.delivery_mode ||
    selectedProduct?.delivery_mode !== 'digital_code';

  // Live TOTP calculation in Add Modal
  useEffect(() => {
    if (!hasAuthenticator || !totpSecret.trim()) {
      setAddOtpCode('------');
      setAddSecondsLeft(30);
      return;
    }

    let isMounted = true;
    const tick = async () => {
      const res = await computeTotpCode(totpSecret.trim());
      if (isMounted) {
        setAddOtpCode(res.code);
        setAddSecondsLeft(res.secondsRemaining);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [hasAuthenticator, totpSecret]);

  // Summary Metrics
  const summary = useMemo(() => {
    const total = inventory.length;
    const available = inventory.filter((i) => i.status === 'available').length;
    const reserved = inventory.filter((i) => i.status === 'reserved').length;
    const consumed = inventory.filter((i) => i.status === 'consumed').length;
    return { total, available, reserved, consumed };
  }, [inventory]);

  // Filtered Inventory List
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;

      // Product filter
      if (productFilter !== 'all' && item.product_id !== productFilter) return false;

      const prod = products.find((p) => p.id === item.product_id);

      // Delivery mode filter
      if (deliveryModeFilter !== 'all') {
        const itemDeliveryMode = prod?.delivery_mode || (item.digital_code ? 'digital_code' : 'auto_account');
        if (itemDeliveryMode !== deliveryModeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const uname = (item.account_username || item.payload?.username || '').toLowerCase();
        const dcode = (item.digital_code || item.payload?.code || '').toLowerCase();
        const note = (item.notes || item.payload?.notes || '').toLowerCase();
        const oid = (item.order_id || '').toLowerCase();
        const pTitle = (prod?.title || '').toLowerCase();
        const pCat = (prod?.category?.name || '').toLowerCase();

        return (
          uname.includes(q) ||
          dcode.includes(q) ||
          note.includes(q) ||
          oid.includes(q) ||
          pTitle.includes(q) ||
          pCat.includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [inventory, products, statusFilter, productFilter, deliveryModeFilter, searchQuery]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (activeTab === 'single') {
        if (isAccountProduct) {
          if (!username.trim() || !password.trim()) {
            throw new Error('Username and Password are required for account deposit.');
          }
          if (hasAuthenticator && !totpSecret.trim()) {
            throw new Error('Please enter or generate a TOTP secret when Authenticator is enabled.');
          }

          await AdminAPI.addInventoryItem({
            productId: selectedProductId,
            product_id: selectedProductId,
            account_username: username.trim(),
            raw_password: password.trim(),
            raw_2fa: hasAuthenticator ? totpSecret.trim() : null,
            notes: notes.trim() || null,
            status: 'available',
          });
        } else {
          if (!code.trim()) {
            throw new Error('Digital code is required.');
          }

          await AdminAPI.addInventoryItem({
            productId: selectedProductId,
            product_id: selectedProductId,
            digital_code: code.trim(),
            notes: notes.trim() || null,
            status: 'available',
          });
        }
      } else {
        // Bulk import parsing
        const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
        const parsedItems: any[] = [];

        if (isAccountProduct) {
          for (const line of lines) {
            const parts = line.split(/[:|\t]/);
            if (parts.length >= 2) {
              parsedItems.push({
                username: parts[0]?.trim(),
                password: parts[1]?.trim(),
                twoFactor: parts[2]?.trim() || null,
              });
            }
          }
        } else {
          for (const line of lines) {
            parsedItems.push({
              code: line.trim(),
            });
          }
        }

        if (parsedItems.length === 0) {
          throw new Error('No valid format lines found. Use username:password or codes.');
        }

        await AdminAPI.bulkAddInventory(selectedProductId, parsedItems);
      }

      setUsername('');
      setPassword('');
      setHasAuthenticator(false);
      setTotpSecret('');
      setCode('');
      setNotes('');
      setBulkText('');
      setIsAddModalOpen(false);
      onRefreshInventory();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error?.message || err.message || 'Failed to deposit stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditUsername(item.account_username || item.payload?.username || '');
    setEditPassword('');
    const has2fa = Boolean(item.encrypted_account_2fa || item.payload?.twoFactor);
    setEditHasAuth(has2fa);
    setEdit2fa('');
    setEditCode(item.digital_code || item.payload?.code || '');
    setEditStatus(item.status);
    setEditNotes(item.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsEditing(true);

    try {
      const updates: Record<string, any> = {
        status: editStatus,
        notes: editNotes,
      };

      if (editUsername !== undefined) updates.account_username = editUsername;
      if (editPassword.trim()) updates.raw_password = editPassword.trim();

      if (!editHasAuth) {
        updates.raw_2fa = ''; // Clear 2fa
      } else if (edit2fa.trim()) {
        updates.raw_2fa = edit2fa.trim();
      }

      if (editCode !== undefined) updates.digital_code = editCode;

      await AdminAPI.updateInventoryItem(editingItem.id, updates);
      setIsEditModalOpen(false);
      setEditingItem(null);
      onRefreshInventory();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || err.message || 'Error updating stock item');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Delete this stock item permanently? Product stock count will update.')) return;
    setDeletingId(id);
    try {
      await AdminAPI.deleteInventoryItem(id);
      onRefreshInventory();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Error deleting stock item');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>VAULT INVENTORY & AUTOMATION</span>
          </h2>
          <p className="text-xs text-slate-400">
            Source-of-truth stock vault. Available inventory determines live customer stock.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsAddModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Deposit Stock Item</span>
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#111622] border border-white/5 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Vault Items</span>
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{summary.total}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#111622] border border-emerald-500/10 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Available to Sell</span>
            <CheckSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{summary.available}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#111622] border border-amber-500/10 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Reserved in Orders</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{summary.reserved}</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#111622] border border-purple-500/10 space-y-1 shadow-lg">
          <div className="flex items-center justify-between text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Consumed / Fulfilled</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">{summary.consumed}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#111622] border border-white/5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, order ID, or product name..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-semibold focus:outline-none"
          >
            <option value="all">All States ({inventory.length})</option>
            <option value="available">🟢 Available ({summary.available})</option>
            <option value="reserved">🟡 Reserved ({summary.reserved})</option>
            <option value="consumed">🟣 Consumed ({summary.consumed})</option>
          </select>

          {/* Product Filter */}
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-semibold focus:outline-none max-w-xs truncate"
          >
            <option value="all">All Associated Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border border-white/10 bg-[#111622] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-black/40 text-slate-400 font-bold uppercase tracking-wider border-b border-white/10 text-[10px]">
              <tr>
                <th className="py-3 px-4">Credential Details</th>
                <th className="py-3 px-4">Associated Product</th>
                <th className="py-3 px-4">Game / Category</th>
                <th className="py-3 px-4">Delivery Mode</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4">Linked Order</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium text-slate-300">
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-slate-400">No vault inventory items match your filter</p>
                    <p className="text-[11px]">Deposit automated accounts or codes to start fulfillment.</p>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const prod = products.find((p) => p.id === item.product_id);
                  const isDeleting = deletingId === item.id;
                  const has2fa = Boolean(item.encrypted_account_2fa || item.payload?.twoFactor);

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Credential Details */}
                      <td className="py-3 px-4">
                        {item.account_username || item.payload?.username ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {item.account_username || item.payload?.username}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px]">
                              {has2fa ? (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-0.5">
                                  <ShieldCheck className="w-2.5 h-2.5" /> TOTP Enabled
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-slate-500/15 text-slate-400 font-medium">
                                  No 2FA
                                </span>
                              )}
                              <span className="text-slate-500">• Encrypted Pass</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5 font-mono">
                            <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                              <KeyRound className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {item.digital_code || item.payload?.code || 'Key Voucher'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block">Digital Voucher Code</span>
                          </div>
                        )}
                      </td>

                      {/* Associated Product */}
                      <td className="py-3 px-4 max-w-[180px]">
                        <p className="font-bold text-white line-clamp-1">{prod?.title || 'Unknown Product'}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {item.product_id ? item.product_id.slice(0, 8) : 'N/A'}...
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10 text-[10px] font-bold">
                          {prod?.category?.name || 'General Game'}
                        </span>
                      </td>

                      {/* Delivery Mode */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          prod?.delivery_mode === 'auto_account'
                            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                        }`}>
                          {prod?.delivery_mode === 'auto_account' ? 'Auto Account' : 'Digital Code'}
                        </span>
                      </td>

                      {/* Stock Status */}
                      <td className="py-3 px-4">
                        {item.status === 'available' ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold text-[10px] inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Available
                          </span>
                        ) : item.status === 'reserved' ? (
                          <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Reserved
                          </span>
                        ) : item.status === 'sold' ? (
                          <span className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/20 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Sold
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/20 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Consumed
                          </span>
                        )}
                      </td>

                      {/* Linked Order */}
                      <td className="py-3 px-4">
                        {item.order_id ? (
                          <span className="font-mono text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                            #{item.order_id.slice(0, 8)}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            title="Edit Stock Item"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={isDeleting}
                            title="Delete Stock Item"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT STOCK MODAL */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Edit Vault Stock Item</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Username */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Account Username:
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Password update (Optional) */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  New Password (leave empty to keep current):
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password to overwrite..."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Authenticator Toggle */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Authenticator 2FA</span>
                  <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/15">
                    <button
                      type="button"
                      onClick={() => setEditHasAuth(false)}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        !editHasAuth ? 'bg-white/20 text-white' : 'text-slate-400'
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditHasAuth(true)}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        editHasAuth ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      Yes
                    </button>
                  </div>
                </div>

                {editHasAuth && (
                  <div>
                    <label className="text-[10px] font-bold text-emerald-400 block mb-1">
                      New Base32 Secret Key:
                    </label>
                    <input
                      type="text"
                      value={edit2fa}
                      onChange={(e) => setEdit2fa(e.target.value.toUpperCase())}
                      placeholder="e.g. JBSWY3DPEHPK3PXP"
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Stock Status Changer */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Vault Stock Status:
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  <option value="available">🟢 Available (Live Sellable Stock)</option>
                  <option value="reserved">🟡 Reserved (Order In-Progress)</option>
                  <option value="sold">🔴 Sold (Account Delivered)</option>
                  <option value="consumed">🟣 Consumed (Fulfilled / Used)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Product stock count updates automatically when status changes.
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Notes:</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal audit notes..."
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STOCK MODAL (Requirement 2) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#141826] border border-white/10 p-6 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Deposit Stock into Vault</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switching: Single Item vs Bulk */}
            <div className="flex rounded-xl bg-black/40 p-1 border border-white/5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'single'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Single Item
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bulk')}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'bulk'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Bulk Import</span>
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              {/* Product Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Target Product:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.delivery_mode}) — Stock: {p.stock}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === 'single' ? (
                <>
                  {isAccountProduct ? (
                    <div className="space-y-3">
                      {/* USERNAME */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Account Username <span className="text-rose-400">*</span>:
                        </label>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g. RobloxGamer2024"
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      {/* PASSWORD */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-300 block mb-1">
                          Password (Stored Encrypted) <span className="text-rose-400">*</span>:
                        </label>
                        <input
                          type="text"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="e.g. P@ssw0rd!Secure"
                          className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      {/* AUTHENTICATOR YES / NO TOGGLE (Requirement 2) */}
                      <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white block">Authenticator 2FA</span>
                            <span className="text-[10px] text-slate-400">
                              Configure live TOTP for this account?
                            </span>
                          </div>

                          <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/15">
                            <button
                              type="button"
                              onClick={() => setHasAuthenticator(false)}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                !hasAuthenticator ? 'bg-white/20 text-white' : 'text-slate-400'
                              }`}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setHasAuthenticator(true);
                                if (!totpSecret.trim()) setTotpSecret(generateBase32Secret(16));
                              }}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                hasAuthenticator ? 'bg-emerald-600 text-white' : 'text-slate-400'
                              }`}
                            >
                              Yes
                            </button>
                          </div>
                        </div>

                        {/* IF AUTHENTICATOR = YES */}
                        {hasAuthenticator && (
                          <div className="space-y-2.5 pt-2 border-t border-white/10">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-bold text-emerald-400">
                                  RFC 6238 Base32 Secret <span className="text-rose-400">*</span>:
                                </label>
                                <button
                                  type="button"
                                  onClick={() => setTotpSecret(generateBase32Secret(16))}
                                  className="text-[10px] text-[#FFD166] hover:underline font-bold flex items-center gap-1"
                                >
                                  <Sparkles className="w-3 h-3" /> Generate Real Secret
                                </button>
                              </div>
                              <input
                                type="text"
                                required={hasAuthenticator}
                                value={totpSecret}
                                onChange={(e) => setTotpSecret(e.target.value.toUpperCase())}
                                placeholder="e.g. JBSWY3DPEHPK3PXP"
                                className="w-full p-2.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            {/* Live TOTP Code Preview */}
                            {totpSecret.trim() && (
                              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-emerald-400">LIVE 2FA PREVIEW</span>
                                  <span className="text-emerald-300 font-mono">{addSecondsLeft}s left</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-base font-black font-mono text-white tracking-widest">
                                    {addOtpCode.slice(0, 3)} {addOtpCode.slice(3)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(addOtpCode, 'add_code')}
                                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold"
                                  >
                                    {copiedKey === 'add_code' ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {!hasAuthenticator && (
                          <p className="text-[10px] text-slate-400 italic">
                            No authenticator required. Customer will receive username and password.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Digital Code Product */
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Digital Code / Voucher:
                      </label>
                      <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="e.g. ROBLOX-VOUCHER-XXXX"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Batch Notes (Optional):
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Supplier Batch #4, Max Frag"
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              ) : (
                /* Bulk Import */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300">Format:</span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {isAccountProduct ? 'username:password or username:password:2fa' : 'one code per line'}
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={
                      isAccountProduct
                        ? 'user1:pass1\nuser2:pass2:JBSWY3DPEHPK3PXP\nuser3:pass3'
                        : 'CODE-AAA-111\nCODE-BBB-222'
                    }
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Deposit into Vault</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
