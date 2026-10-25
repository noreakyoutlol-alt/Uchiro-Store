import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Layers,
  Send,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Users,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { AdminAPI } from '../services/api';
import {
  BatchPreviewResponse,
  BatchPublishResult,
  RegisteredGroup,
  StockAnnouncementBatchSummary,
} from '../types';

export const StockBatchAnnouncement: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [preview, setPreview] = useState<BatchPreviewResponse | null>(null);
  const [groups, setGroups] = useState<RegisteredGroup[]>([]);
  const [batches, setBatches] = useState<StockAnnouncementBatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

  // Publish & Retry States
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<BatchPublishResult | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<BatchPublishResult | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Group Form State
  const [newChatId, setNewChatId] = useState('');
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [newChatType, setNewChatType] = useState<'group' | 'supergroup' | 'channel'>('supergroup');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  // Collapsible drawers
  const [showExcluded, setShowExcluded] = useState(false);
  const [showGroupsList, setShowGroupsList] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setErrorMessage(null);
      const [prevData, grpData, histData] = await Promise.all([
        AdminAPI.previewStockBatch().catch((err) => {
          console.error('[Preview Fetch Error]:', err);
          return null;
        }),
        AdminAPI.getRegisteredGroups().catch((err) => {
          console.error('[Groups Fetch Error]:', err);
          return [];
        }),
        AdminAPI.getStockBatchHistory(10).catch((err) => {
          console.error('[History Fetch Error]:', err);
          return [];
        }),
      ]);

      if (prevData) setPreview(prevData);
      if (Array.isArray(grpData)) setGroups(grpData);
      if (Array.isArray(histData)) setBatches(histData);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load stock batch announcement data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  const handlePublishAll = async () => {
    if (isPublishing) return;
    setIsPublishing(true);
    setErrorMessage(null);
    setPublishResult(null);
    setShowConfirmModal(false);

    try {
      const idempotencyKey = `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const res = await AdminAPI.publishStockBatch(idempotencyKey);
      setPublishResult(res);
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Publish failed';
      setErrorMessage(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRetryFailed = async (batchId: string) => {
    if (isRetrying) return;
    setIsRetrying(true);
    setErrorMessage(null);
    try {
      const res = await AdminAPI.retryFailedStockBatch(batchId);
      setRetryResult(res);
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Retry failed';
      setErrorMessage(msg);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRemoveProductFromPending = async (productId: string) => {
    try {
      await AdminAPI.unmarkProductForBatch(productId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove product from pending batch');
    }
  };

  const handleRegisterGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatId.trim() || !newGroupTitle.trim()) return;
    setIsSubmittingGroup(true);
    try {
      await AdminAPI.registerGroup({
        chat_id: newChatId.trim(),
        title: newGroupTitle.trim(),
        chat_type: newChatType,
      });
      setNewChatId('');
      setNewGroupTitle('');
      setShowAddGroupModal(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to register Telegram group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleToggleGroup = async (group: RegisteredGroup) => {
    try {
      await AdminAPI.updateRegisteredGroup(group.id, { is_active: !group.is_active });
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update group status');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to remove this authorized Telegram group?')) return;
    try {
      await AdminAPI.deleteRegisteredGroup(groupId);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove group');
    }
  };

  const activeGroupsCount = groups.filter((g) => g.is_active && g.bot_can_post).length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <span className="text-xs text-slate-400 font-medium">Loading pending stock batch...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar & Overview Banner ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-[#161c28] to-[#111622] border border-amber-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Prompt 5 Authoritative Engine
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" /> Auto-sync with live inventory
            </span>
          </div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <span>Pending Stock Batch → Preview → Consolidated Publish</span>
          </h3>
          <p className="text-xs text-slate-300 max-w-2xl">
            Automatically aggregates newly created and restocked products. Publishes <b>one consolidated announcement</b> grouped by category to all authorized Telegram groups with real available stock and Buy Here links.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            disabled={!preview || preview.eligible_count === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Eye className="w-4 h-4" />
            <span>Preview Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            disabled={!preview || preview.eligible_count === 0 || activeGroupsCount === 0 || isPublishing}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 shadow-lg shadow-amber-500/30 transition-all"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publish All New Stock</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider">Announcement Notice</h4>
            <p className="text-xs text-red-400">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Publish / Retry Result Banner ── */}
      {(publishResult || retryResult) && (
        <div
          className={`p-5 rounded-2xl border shadow-xl space-y-3 ${
            (publishResult || retryResult)?.status === 'succeeded'
              ? 'bg-emerald-950/30 border-emerald-500/30'
              : (publishResult || retryResult)?.status === 'partial'
              ? 'bg-amber-950/30 border-amber-500/30'
              : 'bg-red-950/30 border-red-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(publishResult || retryResult)?.status === 'succeeded' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (publishResult || retryResult)?.status === 'partial' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                Batch Delivery Result: {(publishResult || retryResult)?.status}
              </h4>
            </div>

            {(publishResult || retryResult)?.status !== 'succeeded' && (publishResult || retryResult)?.batch_id && (
              <button
                type="button"
                onClick={() => handleRetryFailed((publishResult || retryResult)!.batch_id!)}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Failed Groups</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Succeeded Groups</span>
              <span className="text-sm font-black text-emerald-400">
                {(publishResult || retryResult)?.succeeded_groups || 0} / {(publishResult || retryResult)?.total_groups || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Failed Groups</span>
              <span className="text-sm font-black text-red-400">
                {(publishResult || retryResult)?.failed_groups || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Announced Products</span>
              <span className="text-sm font-black text-white">
                {(publishResult || retryResult)?.published_products_count || 0}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span className="text-slate-400 block">Skipped Ineligible</span>
              <span className="text-sm font-black text-slate-400">
                {(publishResult || retryResult)?.skipped_products_count || 0}
              </span>
            </div>
          </div>

          {/* Group Delivery Logs */}
          {(publishResult || retryResult)?.deliveries && (publishResult || retryResult)!.deliveries!.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Per-Group Delivery Status:
              </span>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {(publishResult || retryResult)!.deliveries!.map((del) => (
                  <div
                    key={del.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {del.status === 'succeeded' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                      <span className="font-semibold text-white">{del.group_title}</span>
                      {del.total_chunks > 1 && (
                        <span className="text-[10px] text-slate-400">
                          (Part {del.chunk_index + 1}/{del.total_chunks})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {del.error_message ? (
                        <span className="text-[10px] text-red-400 max-w-xs truncate">{del.error_message}</span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-medium">Delivered</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Main 2-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Column 1 & 2: Pending Products by Category ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  <span>Pending Stock Items ({preview?.eligible_count || 0})</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Products waiting for publication grouped by category and type.
                </p>
              </div>

              {preview && preview.excluded_count > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExcluded(!showExcluded)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  <span>{preview.excluded_count} excluded</span>
                  {showExcluded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
            </div>

            {/* Excluded Drawer */}
            {showExcluded && preview && preview.excluded_products.length > 0 && (
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 space-y-2">
                <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">
                  Excluded from Announcement (No stock / Draft / Inactive):
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {preview.excluded_products.map((exc) => (
                    <div key={exc.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/20">
                      <span className="text-slate-300 font-medium truncate">{exc.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-900/40 text-red-300 border border-red-800/40">
                        {exc.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!preview || preview.grouped_preview.length === 0) && (
              <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                <Package className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">No new or restocked products are currently pending.</p>
                <p className="text-[11px] text-slate-500">
                  When you add stock or create products, they will automatically appear here.
                </p>
              </div>
            )}

            {/* Grouped Categories & Products */}
            {preview && preview.grouped_preview.length > 0 && (
              <div className="space-y-4">
                {preview.grouped_preview.map((group) => (
                  <div
                    key={`${group.category_id}__${group.product_type}`}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <h5 className="text-xs font-black text-amber-300 uppercase tracking-wide">
                          {group.group_label}
                        </h5>
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {group.products.length} product(s)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.products.map((prod) => (
                        <div
                          key={prod.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0 pr-4">
                            <h6 className="text-xs font-bold text-white truncate">{prod.title}</h6>
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="text-emerald-400 font-semibold">${prod.price.toFixed(2)} USD</span>
                              <span className="text-slate-400">{prod.quantity_label}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <a
                              href={prod.buy_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-indigo-300 transition-colors"
                              title="Open Buy Here link"
                            >
                              <span>Buy Here</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromPending(prod.id)}
                              className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove from next batch"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Column 3: Authorized Registered Groups ── */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Authorized Groups ({activeGroupsCount})</span>
                </h4>
                <p className="text-[11px] text-slate-400">Only enabled groups receive broadcasts.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddGroupModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Group</span>
              </button>
            </div>

            {/* Groups list */}
            {groups.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10 space-y-2">
                <Users className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No Telegram groups registered yet.</p>
                <p className="text-[10px] text-slate-500">
                  Register your official Telegram group or channel below to enable stock announcements.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((grp) => (
                  <div
                    key={grp.id}
                    className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <span className="text-xs font-bold text-white block truncate">{grp.title}</span>
                        <span className="text-[10px] text-slate-500 block">ID: {grp.chat_id} ({grp.chat_type})</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleGroup(grp)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                            grp.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-700/50 text-slate-400 border border-white/5'
                          }`}
                        >
                          {grp.is_active ? 'ENABLED' : 'DISABLED'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(grp.id)}
                          className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Batch History Card ── */}
          <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 shadow-xl space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Recent Batches</span>
            </h4>

            {batches.length === 0 ? (
              <p className="text-xs text-slate-500">No stock batches published yet.</p>
            ) : (
              <div className="space-y-2">
                {batches.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            b.status === 'succeeded'
                              ? 'bg-emerald-950 text-emerald-400'
                              : b.status === 'partial'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-red-950 text-red-400'
                          }`}
                        >
                          {b.status}
                        </span>
                        <span className="text-slate-400">
                          {new Date(b.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-300 block">
                        {b.published_products} product(s) to {b.succeeded_groups}/{b.total_groups} group(s)
                      </span>
                    </div>

                    {b.failed_groups > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRetryFailed(b.id)}
                        disabled={isRetrying}
                        className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold transition-colors"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Preview Announcement ── */}
      {showPreviewModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-[#111622] border border-white/10 shadow-2xl space-y-4 p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>Consolidated Announcement Preview</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Exact formatted message that will be sent to {preview.groups_count} authorized group(s).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-slate-200 whitespace-pre-wrap">
              <div dangerouslySetInnerHTML={{ __html: preview.preview_text }} />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs text-slate-400">
                Chunks: <b>{preview.chunks_count}</b> message(s) per group
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPreviewModal(false);
                    setShowConfirmModal(true);
                  }}
                  disabled={preview.eligible_count === 0 || activeGroupsCount === 0}
                  className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                >
                  Publish All New Stock
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Confirm Publish ── */}
      {showConfirmModal && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#111622] border border-amber-500/30 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <Send className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Stock Publish</h3>
                <p className="text-xs text-slate-400">Review batch summary before sending</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Eligible Products:</span>
                <span className="font-bold text-white">{preview.eligible_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Telegram Groups:</span>
                <span className="font-bold text-emerald-400">{activeGroupsCount} active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Message Parts:</span>
                <span className="font-bold text-white">{preview.chunks_count} chunk(s)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              This will send <b>one consolidated announcement</b> to each registered group. Live stock will be verified again at send time.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishAll}
                disabled={isPublishing}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 transition-all"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm & Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Telegram Group ── */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleRegisterGroup}
            className="w-full max-w-md rounded-2xl bg-[#111622] border border-white/10 shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Register Telegram Group</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddGroupModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Group Title / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Uchiro Official Community"
                  value={newGroupTitle}
                  onChange={(e) => setNewGroupTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Telegram Chat ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. -1001234567890"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Add Store Bot as administrator in your group, then paste the group ID.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Chat Type</label>
                <select
                  value={newChatType}
                  onChange={(e) => setNewChatType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="supergroup">Supergroup</option>
                  <option value="channel">Channel</option>
                  <option value="group">Group</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAddGroupModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingGroup || !newChatId || !newGroupTitle}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white"
              >
                {isSubmittingGroup ? 'Saving...' : 'Register Group'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
