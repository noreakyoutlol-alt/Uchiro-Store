export function isAuthorizedAdmin(telegramId: number | string | undefined): boolean {
  if (telegramId === undefined || telegramId === null) return false;
  const id = String(telegramId).trim();
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_USER_IDS || '').split(',').map((s) => s.trim());
  return envAdmins.includes(id);
}
