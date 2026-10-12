export function isAuthorizedAdmin(telegramId: number | string | undefined): boolean {
  if (telegramId === undefined || telegramId === null) return false;
  const raw = process.env.ADMIN_TELEGRAM_USER_IDS ?? '';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(String(telegramId));
}
