import React, { useState } from 'react';
import { verifyPin } from '../services/admin-auth';

interface Props {
  onSuccess: () => void;
}

export const AdminLockScreen: React.FC<Props> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!pin || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await verifyPin(pin.trim());
      if (ok) {
        onSuccess();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch {
      setError('Network error, try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0b0f19', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '1rem',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: '320px', background: '#111827', padding: '2rem',
        borderRadius: '12px', border: '1px solid #1f2937', boxSizing: 'border-box',
      }}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', textAlign: 'center' }}>Admin Access</h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center' }}>
          Enter PIN to unlock this session
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="PIN"
          style={{
            width: '100%', padding: '0.75rem', fontSize: '1.25rem', textAlign: 'center',
            letterSpacing: '0.25em', background: '#0b0f19', border: '1px solid #374151',
            borderRadius: '8px', color: '#fff', boxSizing: 'border-box',
          }}
        />
        {error ? (
          <p style={{ color: '#ef4444', fontSize: '0.8125rem', margin: '0.75rem 0 0', textAlign: 'center' }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting || !pin}
          style={{
            width: '100%', marginTop: '1.25rem', padding: '0.75rem', fontSize: '0.9375rem',
            fontWeight: 600, background: '#2563eb', color: '#fff', border: 0,
            borderRadius: '8px', cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !pin ? 0.6 : 1,
          }}
        >
          {submitting ? 'Verifying…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
};
