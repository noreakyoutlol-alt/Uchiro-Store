import dotenv from 'dotenv';
dotenv.config();

const token = process.env.ADMIN_BOT_TOKEN;
const serverUrl = (
  process.env.ADMIN_WEBAPP_URL ??
  process.env.ADMIN_URL ??
  process.env.SERVER_URL ??
  process.env.PUBLIC_URL ??
  process.env.APP_URL ??
  ''
).replace(/\/+$/, '');
const slug = (
  process.env.ADMIN_URL_SLUG ||
  process.env.ADMIN_SECRET_SLUG ||
  process.env.ADMIN_SECRET_PATH ||
  process.env.ADMIN_BASE_PATH ||
  'noreakyoutadmindashboard'
).replace(/^\/+/, '').trim();
const rawIds = process.env.ADMIN_TELEGRAM_USER_IDS ?? '';

if (!token) {
  console.error('ERROR: ADMIN_BOT_TOKEN is not set.');
  process.exit(1);
}
if (!serverUrl || !slug || !/^[A-Za-z0-9_-]{10,64}$/.test(slug)) {
  console.error('ERROR: SERVER_URL and a valid admin slug (10-64 chars) are required.');
  process.exit(1);
}

const adminIds = rawIds.split(',').map((s) => s.trim()).filter(Boolean);
if (adminIds.length === 0) {
  console.error('ERROR: ADMIN_TELEGRAM_USER_IDS has no valid IDs.');
  process.exit(1);
}

const webAppUrl = `${serverUrl}/${slug}`;

async function callTelegram(method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function main(): Promise<void> {
  // 1. Default for the bot: commands-only menu button (or default)
  const defaultRes = await callTelegram('setChatMenuButton', {
    menu_button: { type: 'commands' },
  });
  console.log('[menu-button] default (all chats) set to commands:', defaultRes.ok ? 'OK' : defaultRes.description);

  // 2. Per authorized admin chat: custom web_app menu button opening the secret URL
  for (const rawId of adminIds) {
    const chatId = Number(rawId);
    if (!Number.isSafeInteger(chatId)) {
      console.warn(`[menu-button] skipping invalid id: ${rawId}`);
      continue;
    }
    const res = await callTelegram('setChatMenuButton', {
      chat_id: chatId,
      menu_button: {
        type: 'web_app',
        text: '🛡️ Admin App',
        web_app: { url: webAppUrl },
      },
    });
    console.log(`[menu-button] admin chat ${chatId}:`, res.ok ? 'OK' : res.description);
  }
}

main().catch((err) => {
  console.error('[menu-button] fatal:', err);
  process.exit(1);
});
