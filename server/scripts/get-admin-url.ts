import dotenv from 'dotenv';
dotenv.config();

const serverUrl = (process.env.SERVER_URL ?? process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
const slug = (process.env.ADMIN_URL_SLUG ?? '').trim();

if (!serverUrl) {
  console.error('ERROR: SERVER_URL (or PUBLIC_URL) is not set in environment.');
  process.exit(1);
}

if (!slug || !/^[A-Za-z0-9_-]{16,64}$/.test(slug)) {
  console.error('ERROR: ADMIN_URL_SLUG must be 16-64 characters of [A-Za-z0-9_-].');
  process.exit(1);
}

const fullUrl = `${serverUrl}/${slug}`;
console.log('');
console.log('=== UCHIRO SECRET ADMIN URL ===');
console.log(fullUrl);
console.log('===============================');
console.log('Treat this URL like a password. Do NOT post it in Telegram chats.');
console.log('To set up the Admin Bot Menu Button, run:');
console.log(`  npm run set-admin-menu-button`);
console.log('');
