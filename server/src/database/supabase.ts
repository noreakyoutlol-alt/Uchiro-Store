import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Backend Supabase Client Configuration
 *
 * NOTE ON KEYS & SECURITY ARCHITECTURE:
 * - Frontend Mini Apps only communicate with backend REST endpoints (/api/*) and NEVER receive direct Supabase keys.
 * - Backend uses SUPABASE_SECRET_KEY (legacy alias: SUPABASE_SERVICE_ROLE_KEY) exclusively on the server to:
 *   1. Bypass Row-Level Security (RLS) for server-side order fulfillment & encrypted inventory assignment
 *   2. Run background payment monitoring worker jobs without active customer browser sessions
 *   3. Execute Telegram bot webhook operations and point ledger transaction management
 * - Never expose SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to client-side bundles.
 */

const backendSecretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(
  env.SUPABASE_URL &&
  env.SUPABASE_URL.startsWith('https://') &&
  !env.SUPABASE_URL.includes('your-project') &&
  backendSecretKey &&
  !backendSecretKey.includes('your-service-role-key') &&
  !backendSecretKey.includes('your-secret-key')
);

export const supabase = createClient(
  env.SUPABASE_URL || 'https://placeholder.supabase.co',
  backendSecretKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function checkSupabaseHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  url: string;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      configured: false,
      connected: false,
      url: env.SUPABASE_URL,
    };
  }

  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      return {
        configured: true,
        connected: false,
        url: env.SUPABASE_URL,
        error: error.message,
      };
    }
    return {
      configured: true,
      connected: true,
      url: env.SUPABASE_URL,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      url: env.SUPABASE_URL,
      error: err.message,
    };
  }
}
