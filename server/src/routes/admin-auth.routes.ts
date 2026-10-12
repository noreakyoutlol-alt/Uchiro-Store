import { Router } from 'express';
import { getTelegramUserId } from '../auth/telegram';
import {
  isAdminPinConfigured,
  issueAdminSession,
  pinMatches,
  requireAdminIdentity,
} from '../auth/admin-session';
import { supabase } from '../database/supabase';

export const adminAuthRouter = Router();

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

adminAuthRouter.post('/admin/verify-pin', requireAdminIdentity, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!isAdminPinConfigured()) {
    console.error('[admin] ADMIN_SECRET_PIN (6 digits) or ADMIN_SESSION_SECRET (>= 32 chars) is not configured');
    res.status(503).json({ error: 'PIN_NOT_CONFIGURED' });
    return;
  }

  const telegramId = getTelegramUserId(res);
  const body = (req.body ?? {}) as { pin?: unknown };
  const pin = typeof body.pin === 'string' ? body.pin : '';

  try {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count, error } = await supabase
      .from('admin_pin_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('telegram_id', telegramId)
      .eq('success', false)
      .gte('created_at', since);
    if (error) throw new Error(error.message);

    if ((count ?? 0) >= MAX_FAILURES) {
      res.status(429).json({ error: 'LOCKED', retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) });
      return;
    }

    const ok = pinMatches(pin);
    const { error: insertError } = await supabase
      .from('admin_pin_attempts')
      .insert({ telegram_id: telegramId, success: ok });
    if (insertError) throw new Error(insertError.message);

    if (!ok) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }

    const session = issueAdminSession(telegramId);
    res.json({ success: true, token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    console.error('[admin] verify-pin failed:', err instanceof Error ? err.message : 'unknown error');
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});
