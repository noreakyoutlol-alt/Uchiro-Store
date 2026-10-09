import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  QrCode,
  Clock,
  Layers,
} from 'lucide-react';
import { AdminAPI } from '../../services/api';
import {
  generateBase32Secret,
  buildOtpAuthUri,
  computeTotpCode,
} from '../../utils/totp';

interface AccountInventoryDepositModalProps {
  productId: string;
  productTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AccountInventoryDepositModal: React.FC<AccountInventoryDepositModalProps> = ({
  productId,
  productTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasAuthenticator, setHasAuthenticator] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [notes, setNotes] = useState('');

  // Live TOTP preview
  const [currentOtp, setCurrentOtp] = useState<string>('------');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isCopied, setIsCopied] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setHasAuthenticator(false);
      setTotpSecret('');
      setNotes('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Live TOTP loop when authenticator is enabled and secret is valid
  useEffect(() => {
    if (!hasAuthenticator || !totpSecret.trim()) {
      setCurrentOtp('------');
      setSecondsRemaining(30);
      return;
    }

    let isMounted = true;
    const updateOtp = async () => {
      const res = await computeTotpCode(totpSecret.trim());
      if (isMounted) {
        setCurrentOtp(res.code);
        setSecondsRemaining(res.secondsRemaining);
      }
    };

    updateOtp();
    const interval = setInterval(updateOtp, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [hasAuthenticator, totpSecret]);

  if (!isOpen) return null;

  const handleGenerateSecret = () => {
    const newSecret = generateBase32Secret(16);
    setTotpSecret(newSecret);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(label);
    setTimeout(() => setIsCopied(null), 2000);
  };

  const otpauthUrl = totpSecret.trim()
    ? buildOtpAuthUri({
        accountName: username.trim() || 'UchiroAccount',
        secret: totpSecret.trim(),
        issuer: 'Uchiro Store',
      })
    : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Username and Password are required.');
      return;
    }

    if (hasAuthenticator && !totpSecret.trim()) {
      setErrorMsg('Please enter or generate a TOTP secret when Authenticator is enabled.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await AdminAPI.addInventoryItem({
        productId,
        product_id: productId,
        account_username: username.trim(),
        raw_password: password.trim(),
        raw_2fa: hasAuthenticator ? totpSecret.trim() : null,
        notes: notes.trim() || null,
        status: 'available',
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to deposit stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#121622] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white">Deposit Account Stock</h3>
              <p className="text-[10px] text-slate-400 line-clamp-1">{productTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* USERNAME */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Account Username <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. RobloxGamer2024"
                className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Password <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="e.g. P@ssw0rd!Secure"
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Stored server-side with AES-256-GCM encryption.
            </span>
          </div>

          {/* AUTHENTICATOR YES / NO TOGGLE */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">Authenticator 2FA</span>
                <span className="text-[10px] text-slate-400">
                  Does this account require a TOTP authenticator code?
                </span>
              </div>

              {/* Yes / No Toggle buttons */}
              <div className="flex rounded-lg bg-black/60 p-0.5 border border-white/15">
                <button
                  type="button"
                  onClick={() => setHasAuthenticator(false)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    !hasAuthenticator
                      ? 'bg-white/20 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasAuthenticator(true);
                    if (!totpSecret.trim()) handleGenerateSecret();
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                    hasAuthenticator
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            {/* IF AUTHENTICATOR = YES */}
            {hasAuthenticator && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-emerald-400">
                      RFC 6238 Base32 Secret Key <span className="text-rose-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateSecret}
                      className="text-[10px] text-[#FFD166] hover:underline font-bold flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Generate Secret
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required={hasAuthenticator}
                      value={totpSecret}
                      onChange={(e) => setTotpSecret(e.target.value.toUpperCase())}
                      placeholder="e.g. JBSWY3DPEHPK3PXP"
                      className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-emerald-500/30 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(totpSecret, 'secret')}
                      className="px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                      title="Copy Secret"
                    >
                      {isCopied === 'secret' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Real-time Code & OtpAuth Preview */}
                {totpSecret.trim() && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Live 2FA Code Preview
                      </span>
                      <span className="text-[10px] text-emerald-300 font-mono">
                        {secondsRemaining}s left
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-lg font-mono font-black text-white tracking-widest">
                        {currentOtp.slice(0, 3)} {currentOtp.slice(3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(currentOtp, 'otp')}
                        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1"
                      >
                        {isCopied === 'otp' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        Copy Code
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-1000"
                        style={{ width: `${(secondsRemaining / 30) * 100}%` }}
                      />
                    </div>

                    {/* OtpAuth URL Preview */}
                    <div className="pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                      <span className="truncate max-w-[240px]">{otpauthUrl}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(otpauthUrl, 'otpauth')}
                        className="text-emerald-400 hover:underline font-bold"
                      >
                        {isCopied === 'otpauth' ? 'Copied' : 'Copy URI'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!hasAuthenticator && (
              <p className="text-[11px] text-slate-400 italic">
                Authenticator fields will be omitted. Customer will receive direct username and password.
              </p>
            )}
          </div>

          {/* NOTES */}
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Internal Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier Batch #4, Max Beli"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white placeholder:text-slate-500 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Deposit into Vault</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
