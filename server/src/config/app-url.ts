import { env } from './env';
import { ADMIN_BASE_PATH } from './admin-slug';

/**
 * Returns true if the string is a valid non-placeholder HTTPS or HTTP URL.
 * Strictly excludes dead/placeholder domains such as web-production-2d8bd and your-production-app.
 */
export function isValidUrl(candidate?: string | null): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const trimmed = candidate.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return false;
  // Exclude defunct and dummy template placeholders
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('web-production-2d8bd') ||
    lower.includes('your-production-app') ||
    lower.includes('your-app') ||
    lower.includes('example.com') ||
    lower.includes('<placeholder') ||
    lower.includes('<your')
  ) {
    return false;
  }
  return true;
}

/**
 * Returns true if the URL is a valid public HTTPS URL suitable for Telegram webhooks/Mini Apps
 * (not an internal localhost/0.0.0.0/127.0.0.1 address).
 */
export function isPublicHttpsUrl(candidate?: string | null): boolean {
  if (!isValidUrl(candidate)) return false;
  const trimmed = (candidate as string).trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('https://')) return false;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Canonical Store Public URL resolver.
 * Evaluates candidate env variables in order of specificity.
 * Prioritizes public HTTPS endpoints required by Telegram Mini Apps.
 */
export function resolveStoreUrl(): string {
  const candidates = [
    process.env.STORE_MINIAPP_URL,
    process.env.STORE_WEBAPP_URL,
    process.env.STORE_URL,
    process.env.CLIENT_STORE_URL,
    process.env.SERVER_URL,
    process.env.PUBLIC_URL,
    process.env.APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '',
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '',
    env.STORE_WEBAPP_URL,
    env.CLIENT_STORE_URL,
    env.PUBLIC_URL,
    env.APP_URL,
  ];

  // Telegram Mini Apps strictly require public HTTPS endpoints
  for (const c of candidates) {
    if (isPublicHttpsUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  // Accept any valid non-dummy URL for local dev or testing
  for (const c of candidates) {
    if (isValidUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  return (process.env.STORE_URL || process.env.SERVER_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
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

  // Pass 1: Prioritize public HTTPS URLs (strictly required for Telegram webhooks)
  for (const c of candidates) {
    if (isPublicHttpsUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  // Pass 2: Accept any valid non-dummy URL (e.g. local dev / testing)
  for (const c of candidates) {
    if (isValidUrl(c)) {
      return (c as string).trim().replace(/\/+$/, '');
    }
  }

  return resolveStoreUrl();
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
