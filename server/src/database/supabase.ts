import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL;
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(rawUrl && rawKey && rawUrl !== 'https://placeholder.supabase.co');
}

const url = rawUrl || 'https://placeholder.supabase.co';
const key = rawKey || 'placeholder-key';

export const supabase: SupabaseClient = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function assertDatabaseReachable(): Promise<void> {
  if (!rawUrl || !rawKey) {
    throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const { error } = await supabase.from('users').select('telegram_id').limit(1);
  if (error) {
    throw new Error(`FATAL: Supabase unreachable or schema missing: ${error.message}`);
  }
}

export async function checkSupabaseHealth(): Promise<{ configured: boolean; reachable: boolean; connected: boolean; url: string; error?: string }> {
  try {
    await assertDatabaseReachable();
    return { configured: true, reachable: true, connected: true, url: url || '' };
  } catch (err) {
    return { configured: Boolean(url && key), reachable: false, connected: false, url: url || '', error: err instanceof Error ? err.message : String(err) };
  }
}
