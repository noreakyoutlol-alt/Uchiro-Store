import { env } from './env';
import { ADMIN_BASE_PATH } from './admin-slug';

/**
 * Returns true if the string is a valid non-placeholder HTTPS or HTTP URL.
 */
function isValidUrl(candidate?: string | null): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return false;
  // Exclude defunct/placeholder domains
  if (trimmed.includes('web-production-2d8bd') || trimmed.includes('your-production-app')) {
    return false;
  }
  return true;
}

/**
 * Canonical Store Public URL resolver.
 * Evaluates candidate env variables in order of specificity and filters out defunct placeholders.
 */
export function resolveStoreUrl(): string {
  const candidates = [
    process.env.STORE_MINIAPP_URL,
    process.env.STORE_WEBAPP_URL,
    process.env.STORE_URL,
    process.env.CLIENT_STORE_URL,
    process.env.PUBLIC_URL,
    process.env.SERVER_URL,
    process.env.APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '',
    env.STORE_WEBAPP_URL,
    env.CLIENT_STORE_URL,
    env.PUBLIC_URL,
    env.APP_URL,
  ];

  for (const c of candidates) {
    if (isValidUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  return 'https://web-production-2d8bd.up.railway.app';
}

/**
 * Canonical Server Backend URL resolver (for webhooks, API endpoints).
 */
export function resolveServerUrl(): string {
  const candidates = [
    process.env.SERVER_URL,
    process.env.PUBLIC_URL,
    process.env.APP_URL,
    process.env.STORE_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '',
    env.PUBLIC_URL,
    env.APP_URL,
  ];

  for (const c of candidates) {
    if (isValidUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  return (process.env.SERVER_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
}

/**
 * Canonical Admin Portal URL resolver (preserves existing custom secret slug).
 */
export function resolveAdminPortalUrl(): string {
  const explicit = (
    process.env.ADMIN_WEBAPP_URL ||
    process.env.ADMIN_URL ||
    process.env.ADMIN_MINIAPP_URL ||
    ''
  ).trim();

  if (isValidUrl(explicit)) {
    try {
      const parsed = new URL(explicit);
      if (parsed.pathname && parsed.pathname !== '/') {
        return explicit.replace(/\/$/, '');
      }
      return `${parsed.origin}${ADMIN_BASE_PATH}`;
    } catch {
      return explicit.replace(/\/$/, '');
    }
  }

  const base = resolveStoreUrl();
  try {
    const origin = new URL(base).origin;
    return `${origin}${ADMIN_BASE_PATH}`;
  } catch {
    return `${base.replace(/\/+$/, '')}${ADMIN_BASE_PATH}`;
  }
}
