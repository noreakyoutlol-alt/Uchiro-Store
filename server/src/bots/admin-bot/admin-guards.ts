import { DataStore } from '../../database/data-store';

export function isAuthorizedAdmin(telegramId: number | string | undefined): boolean {
  if (telegramId === undefined || telegramId === null) return false;
  const id = String(telegramId).trim();
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_USER_IDS || '').split(',').map((s) => s.trim());
  if (envAdmins.includes(id)) return true;

  try {
    const dbAdmins = DataStore.getAdminUsers();
    if (dbAdmins.some((a) => String(a.telegram_id) === id && a.is_active)) return true;
  } catch {
    // DataStore fallback
  }

  return false;
}
