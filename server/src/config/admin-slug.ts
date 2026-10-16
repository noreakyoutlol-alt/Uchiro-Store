const DEFAULT_SLUG = 'noreakyoutadmindashboard';
const FORBIDDEN = new Set(['admin', 'api', 'assets', 'emojis']);

function resolveSlug(): string {
  const raw = process.env.ADMIN_SECRET_SLUG || process.env.ADMIN_SECRET_PATH || process.env.ADMIN_BASE_PATH || DEFAULT_SLUG;
  const cleaned = raw.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_-]/g, '');
  const slug = cleaned.length > 0 ? cleaned : DEFAULT_SLUG;
  if (FORBIDDEN.has(slug.toLowerCase())) {
    throw new Error(`FATAL: ADMIN_SECRET_SLUG "${slug}" is reserved`);
  }
  return slug;
}

export const ADMIN_SLUG: string = resolveSlug();
export const ADMIN_BASE_PATH = `/${ADMIN_SLUG}`;
