const SESSION_HEADER = 'X-Admin-Session';
const STORAGE_KEY = 'uchiro_admin_session_token';
const UNAUTH_EVENT = 'uchiro:admin:unauthorized';

export function getAdminSessionToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminSessionToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore storage errors */
  }
}

export function clearAdminSessionToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

/** Attach to EVERY outbound fetch/axios call from the admin app. */
export function adminAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;
  const token = getAdminSessionToken();
  if (token) headers[SESSION_HEADER] = token;
  return headers;
}

export async function verifyPin(pin: string): Promise<{ success: boolean; message?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;

  try {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers,
      body: JSON.stringify({ pin }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      sessionToken?: string;
      token?: string;
      message?: string;
      error?: string;
    };
    const token = body.sessionToken || body.token;
    if (!res.ok || !body.success || !token) {
      return {
        success: false,
        message: body.message || 'Access Denied. Incorrect Security PIN.',
      };
    }
    setAdminSessionToken(token);
    return { success: true };
  } catch {
    return { success: false, message: 'Network communication failed. Please retry.' };
  }
}

/** Call on any 401 response from an admin API. */
export function notifyUnauthorized(): void {
  clearAdminSessionToken();
  window.dispatchEvent(new CustomEvent(UNAUTH_EVENT));
}

export function onUnauthorized(handler: () => void): () => void {
  const listener = (): void => handler();
  window.addEventListener(UNAUTH_EVENT, listener);
  return () => window.removeEventListener(UNAUTH_EVENT, listener);
}
