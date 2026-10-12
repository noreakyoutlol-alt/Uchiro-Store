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

export async function verifyPin(pin: string): Promise<boolean> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;

  const res = await fetch('/api/admin/verify-pin', {
    method: 'POST',
    headers,
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { success: boolean; sessionToken?: string };
  if (!body.success || !body.sessionToken) return false;
  setAdminSessionToken(body.sessionToken);
  return true;
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
