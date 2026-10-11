import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  User,
  Lock,
  ChevronDown,
  ChevronUp,
  Package,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { DeliveredAccount } from '../../types';
import { StoreAPI } from '../../services/api';
import { CategoryIcon } from '../common/CategoryIcon';

interface VaultPageProps {
  onBack: () => void;
  initialOrderId?: string;
  initialAccountId?: string;
}

export const VaultPage: React.FC<VaultPageProps> = ({
  onBack,
  initialOrderId,
  initialAccountId,
}) => {
  // Strictly In-Memory State only
  const [accounts, setAccounts] = useState<DeliveredAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Per-account UI state (in-memory)
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedKeyMap, setCopiedKeyMap] = useState<Record<string, boolean>>({});
  const [backupDrawerOpenMap, setBackupDrawerOpenMap] = useState<Record<string, boolean>>({});

  const triggerHaptic = (type: 'success' | 'warning' | 'error' = 'success') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch {}
  };

  const handleCopy = (text: string, copyKey: string) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      triggerHaptic('success');
      setCopiedKeyMap((prev) => ({ ...prev, [copyKey]: true }));
      setTimeout(() => {
        setCopiedKeyMap((prev) => ({ ...prev, [copyKey]: false }));
      }, 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  // Mask passwords whenever user switches tabs or window minimizes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setShowPasswordMap({});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Fetch accounts from /api/vault/accounts or fallback to orders
  const loadAccounts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Try dedicated Vault accounts endpoint
      const vaultAccounts = await StoreAPI.getVaultAccounts();
      if (vaultAccounts && vaultAccounts.length > 0) {
        setAccounts(vaultAccounts);
        return;
      }

      // 2. Fallback to extracting from orders
      const orders = await StoreAPI.getOrders();
      const extracted: DeliveredAccount[] = [];

      for (const order of orders) {
        if (order.status !== 'delivered' && order.status !== 'completed') continue;
        const creds = (order as any).delivery_credentials;
        if (!Array.isArray(creds) || creds.length === 0) continue;

        creds.forEach((c: any, idx: number) => {
          if (!c) return;
          if (c.type === 'code' && !c.username && !c.password) return;

          extracted.push({
            account_id: c.account_id || `${order.id}_${idx}`,
            order_code: order.order_number || order.id,
            game_title: order.items?.[0]?.product_title || (order as any).product_title || 'Gaming Account',
            username: c.username || c.login || 'N/A',
            password: c.password || '',
            two_factor_secret: c.two_factor || c.authenticator_secret || undefined,
            backup_codes: Array.isArray(c.backup_codes) ? c.backup_codes : (c.backup_codes ? [c.backup_codes] : undefined),
            notes: c.notes || order.fulfillment_notes || undefined,
            delivered_at: order.delivered_at || order.created_at,
          });
        });
      }

      setAccounts(extracted);
    } catch (err: any) {
      console.error('Failed to load vault accounts:', err);
      setError('មិនអាចទាញយកទិន្នន័យគណនីបានទេ / Failed to load vault accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('km-KH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#0B0E14]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ត្រឡប់ទៅហាង</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E63946] to-[#FFD166] flex items-center justify-center p-0.5 shadow-[0_0_12px_rgba(230,57,70,0.4)]">
            <div className="w-full h-full bg-[#0B0E14] rounded-[6px] flex items-center justify-center">
              <span className="text-xs">🎒</span>
            </div>
          </div>
          <h1 className="font-black text-sm tracking-wide text-white">
            កាតាបឥវ៉ាន់ &amp; គណនី <span className="text-[#FFD166] text-xs font-semibold">(My Vault)</span>
          </h1>
        </div>

        <button
          onClick={loadAccounts}
          disabled={isLoading}
          className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#FFD166]' : ''}`} />
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-[#FFD166]" />
            <p className="text-xs font-medium">កំពុងទាញយកទិន្នន័យគណនីរបស់អ្នក...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(255,209,102,0.15)]">
              🎒
            </div>
            <div>
              <h3 className="text-base font-bold text-white">កាតាបឥវ៉ាន់ទទេស្អាត</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                អ្នកមិនទាន់មានគណនីហ្គេមដែលបានទិញនៅឡើយទេ។ ចូលទៅកាន់ហាងដើម្បីទិញគណនីហ្គេម verified ជាមួយនឹងការធានា ១៤ ថ្ងៃ!
              </p>
            </div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-gradient-to-r from-[#E63946] to-[#FFD166] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-[#E63946]/20 hover:brightness-110 transition-all"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>ចូលមើលហាងទំនិញ (Shop Now)</span>
            </button>
          </div>
        )}

        {/* Accounts List */}
        {!isLoading &&
          !error &&
          accounts.map((acc, index) => {
            const isTarget =
              (initialAccountId && acc.account_id.includes(initialAccountId)) ||
              (initialOrderId && acc.order_code.includes(initialOrderId));

            const isPasswordVisible = !!showPasswordMap[acc.account_id];
            const isBackupOpen = !!backupDrawerOpenMap[acc.account_id];

            const otpauthUri = acc.two_factor_secret
              ? `otpauth://totp/Uchiro:${encodeURIComponent(acc.username)}?secret=${encodeURIComponent(
                  acc.two_factor_secret.replace(/\s+/g, '').toUpperCase()
                )}&issuer=Uchiro`
              : null;

            return (
              <div
                key={acc.account_id || index}
                id={`acc-${acc.account_id}`}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isTarget
                    ? 'bg-[#151A24] border-[#FFD166]/60 shadow-[0_0_20px_rgba(255,209,102,0.25)]'
                    : 'bg-[#121620] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Card Top: Game Icon, Title, Order Badge */}
                <div className="p-4 border-b border-white/5 bg-gradient-to-r from-white/[0.03] to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E63946]/30 to-[#FFD166]/20 border border-white/10 flex items-center justify-center flex-shrink-0 text-xl shadow-inner">
                        <CategoryIcon category={acc.game_title} size={22} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white truncate">{acc.game_title}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                            #{acc.order_code}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(acc.delivered_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      <span>បានផ្ញើជូន</span>
                    </div>
                  </div>
                </div>

                {/* Card Body: Credentials Fields */}
                <div className="p-4 space-y-3">
                  {/* Field: Username */}
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>Username / Login ID:</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-white truncate select-all">
                        {acc.username}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(acc.username, `user_${acc.account_id}`)}
                      className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium transition-colors flex-shrink-0"
                    >
                      {copiedKeyMap[`user_${acc.account_id}`] ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Field: Password */}
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-1">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Password / ពាក្យសម្ងាត់:</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-white truncate select-all">
                        {isPasswordVisible ? (
                          <span className="text-[#FFD166]">{acc.password}</span>
                        ) : (
                          <span className="text-slate-500 tracking-wider">••••••••••••</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() =>
                          setShowPasswordMap((prev) => ({
                            ...prev,
                            [acc.account_id]: !prev[acc.account_id],
                          }))
                        }
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg border border-white/10 transition-colors"
                        title={isPasswordVisible ? 'Hide Password' : 'Show Password'}
                      >
                        {isPasswordVisible ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => handleCopy(acc.password, `pass_${acc.account_id}`)}
                        className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium transition-colors"
                      >
                        {copiedKeyMap[`pass_${acc.account_id}`] ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Field: 2FA Authenticator Key */}
                  {acc.two_factor_secret && (
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                          <span>2FA Authenticator Secret:</span>
                        </div>

                        {otpauthUri && (
                          <a
                            href={otpauthUri}
                            className="flex items-center gap-1 text-[10px] font-bold text-[#FFD166] hover:underline"
                          >
                            <span>Add to Authenticator</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-xs font-bold text-emerald-400 truncate select-all">
                          {acc.two_factor_secret}
                        </div>
                        <button
                          onClick={() => handleCopy(acc.two_factor_secret!, `2fa_${acc.account_id}`)}
                          className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium transition-colors flex-shrink-0"
                        >
                          {copiedKeyMap[`2fa_${acc.account_id}`] ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 text-[11px]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Copy Key</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Backup Codes Drawer */}
                  {acc.backup_codes && acc.backup_codes.length > 0 && (
                    <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                      <button
                        onClick={() =>
                          setBackupDrawerOpenMap((prev) => ({
                            ...prev,
                            [acc.account_id]: !prev[acc.account_id],
                          }))
                        }
                        className="w-full px-3 py-2.5 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#FFD166]" />
                          <span>
                            Backup / Recovery Codes ({acc.backup_codes.length})
                          </span>
                        </div>
                        {isBackupOpen ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {isBackupOpen && (
                        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-slate-400">
                              រក្សាទុកកូដទាំងនេះសម្រាប់សង្គ្រោះគណនីពេលបាត់ 2FA
                            </span>
                            <button
                              onClick={() =>
                                handleCopy(
                                  acc.backup_codes!.join('\n'),
                                  `backup_all_${acc.account_id}`
                                )
                              }
                              className="text-[10px] font-bold text-[#FFD166] hover:underline flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              <span>
                                {copiedKeyMap[`backup_all_${acc.account_id}`]
                                  ? 'Copied All!'
                                  : 'Copy All'}
                              </span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            {acc.backup_codes.map((code, cIdx) => (
                              <button
                                key={cIdx}
                                onClick={() => handleCopy(code, `code_${acc.account_id}_${cIdx}`)}
                                className="font-mono text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-1.5 text-center text-slate-200 transition-colors flex items-center justify-between px-2"
                              >
                                <span>{code}</span>
                                {copiedKeyMap[`code_${acc.account_id}_${cIdx}`] ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Safety Note */}
                  <div className="text-[10px] text-slate-400 bg-white/[0.02] border border-white/5 rounded-xl p-2.5 flex items-start gap-2">
                    <span className="text-amber-400 flex-shrink-0">⚠️</span>
                    <span>
                      សូមប្តូរពាក្យសម្ងាត់ និងចងភ្ជាប់ Email ផ្ទាល់ខ្លួនរបស់អ្នកភ្លាមៗដើម្បីសុវត្ថិភាព ១០០%។ រាល់គណនីទាំងអស់មានការធានាការពាររយៈពេល ១៤ ថ្ងៃពេញ។
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default VaultPage;
