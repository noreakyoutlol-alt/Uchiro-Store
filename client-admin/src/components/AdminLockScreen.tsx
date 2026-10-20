import React, { useState, useEffect, useCallback } from 'react';
import { verifyPin } from '../services/admin-auth';
import { AdminSpaceBackground } from './background/AdminSpaceBackground';

interface Props {
  onSuccess: () => void;
}

export const AdminLockScreen: React.FC<Props> = ({ onSuccess }) => {
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptUnlock = useCallback(async (candidatePin: string): Promise<void> => {
    if (!candidatePin || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await verifyPin(candidatePin.trim());
      if (ok) {
        onSuccess();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setError('Network error, please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, onSuccess]);

  // Auto-submit immediately once '1686' is entered
  useEffect(() => {
    if (pin === '1686' && !submitting) {
      attemptUnlock('1686');
    }
  }, [pin, submitting, attemptUnlock]);

  const handleDigit = (digit: string) => {
    if (submitting || pin.length >= 6) return;
    const nextPin = pin + digit;
    setPin(nextPin);
  };

  const handleDelete = () => {
    if (submitting) return;
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (submitting) return;
    setPin('');
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent): void => {
    if (e) e.preventDefault();
    if (pin.length >= 4 && !submitting) {
      attemptUnlock(pin);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#070A14',
      color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '1rem',
      position: 'relative',
    }}>
      <AdminSpaceBackground />
      <div style={{
        width: '100%', maxWidth: '340px', background: '#111622', padding: '2rem 1.75rem',
        borderRadius: '16px', border: '1px solid #1f2937', boxSizing: 'border-box',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            marginBottom: '0.75rem', fontSize: '1.5rem',
          }}>
            🛡️
          </div>
          <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700 }}>Admin Session Lock</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
            Enter 4-digit PIN to authenticate
          </p>
        </div>

        {/* Pin Dots Display */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '0.75rem',
          margin: '1.5rem 0',
        }}>
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: isFilled ? '#3b82f6' : '#374151',
                  border: isFilled ? '2px solid #60a5fa' : '2px solid #4b5563',
                  transition: 'all 0.15s ease',
                  boxShadow: isFilled ? '0 0 10px rgba(59, 130, 246, 0.7)' : 'none',
                }}
              />
            );
          })}
        </div>

        {/* Hidden keyboard input for accessibility and physical keyboards */}
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setPin(val);
            }}
            placeholder="••••"
            style={{
              width: '100%', padding: '0.625rem', fontSize: '1.25rem', textAlign: 'center',
              letterSpacing: '0.5em', background: '#0b0f19', border: '1px solid #374151',
              borderRadius: '8px', color: '#fff', boxSizing: 'border-box', marginBottom: '1.25rem',
            }}
          />

          {error && (
            <div style={{
              color: '#f87171', background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.5rem',
              borderRadius: '6px', fontSize: '0.8125rem', margin: '0 0 1rem', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* Numeric Keypad Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem',
            marginBottom: '1rem',
          }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((item) => {
              const isAction = item === 'C' || item === '⌫';
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    if (item === 'C') handleClear();
                    else if (item === '⌫') handleDelete();
                    else handleDigit(item);
                  }}
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 0', fontSize: isAction ? '1rem' : '1.25rem',
                    fontWeight: 600, color: isAction ? '#9ca3af' : '#f3f4f6',
                    background: isAction ? '#1f2937' : '#1e293b',
                    border: '1px solid #334155', borderRadius: '10px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    userSelect: 'none', transition: 'all 0.1s ease',
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={submitting || pin.length < 4}
            style={{
              width: '100%', padding: '0.75rem', fontSize: '0.9375rem',
              fontWeight: 600, background: '#2563eb', color: '#fff', border: 0,
              borderRadius: '8px', cursor: submitting || pin.length < 4 ? 'not-allowed' : 'pointer',
              opacity: submitting || pin.length < 4 ? 0.6 : 1, transition: 'opacity 0.2s',
            }}
          >
            {submitting ? 'Verifying…' : 'Unlock Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
};
