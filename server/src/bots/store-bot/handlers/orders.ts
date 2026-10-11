import { Context } from 'telegraf';
import { DataStore, DeliveredAccount } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
import { TOTPService } from '../../../security/totp';
import {
  buildAccountDetailKeyboard,
  buildEmptyVaultKeyboard,
  buildTwoFactorKeyboard,
  buildVaultListKeyboard,
} from '../keyboards';

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function isMessageNotModifiedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes('message is not modified');
}

/**
 * Fetch delivered accounts for a customer from Supabase (if available) or DataStore.
 */
export async function getCustomerDeliveredAccounts(
  telegramId: number | string
): Promise<DeliveredAccount[]> {
  const tid = String(telegramId);

  // Check Supabase vault_accounts if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('vault_accounts')
        .select('*')
        .eq('telegram_id', tid)
        .order('delivered_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as any[]).map((row) => ({
          account_id: row.id || row.account_id,
          order_code: row.order_code,
          game_title: row.game_title,
          username: row.username,
          password: row.password || '',
          two_factor_secret: row.two_factor_secret || row.twoFactorSecret,
          backup_codes: Array.isArray(row.backup_codes) ? row.backup_codes : undefined,
          notes: row.notes,
          delivered_at: row.delivered_at,
        }));
      }
    } catch {
      // Graceful fallback to DataStore on any query or schema error
    }
  }

  // Fallback to DataStore
  return DataStore.getDeliveredAccountsByTelegramId(telegramId);
}

/**
 * Fetch a single delivered account by its ID.
 */
export async function getCustomerDeliveredAccountById(
  telegramId: number | string,
  accountId: string
): Promise<DeliveredAccount | null> {
  const accounts = await getCustomerDeliveredAccounts(telegramId);
  return (
    accounts.find(
      (a) =>
        a.account_id === accountId ||
        a.account_id.startsWith(accountId) ||
        accountId.startsWith(a.account_id)
    ) || null
  );
}

/**
 * Step 1: Render and send/edit Vault & Orders List
 */
export async function handleVaultMenu(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const accounts = await getCustomerDeliveredAccounts(telegramId);

  if (accounts.length === 0) {
    const text =
      `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីរបស់អ្នក (MY VAULT)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `អ្នកមិនទាន់មានគណនីហ្គេមដែលបានទិញនៅឡើយទេ។\n\n` +
      `👉 ចុចប៊ូតុងខាងក្រោមដើម្បីចូលមើលហាងទំនិញ៖`;

    const keyboard = buildEmptyVaultKeyboard(storeUrl);
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (err) {
      if (!isMessageNotModifiedError(err)) {
        await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
      }
    }
    return;
  }

  const text =
    `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីរបស់អ្នក (MY VAULT)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `អ្នកមានគណនីហ្គេមសរុប: <b>${accounts.length}</b> គណនី\n\n` +
    `👇 <i>ចុចលើគណនីខាងក្រោមដើម្បីមើល Password និងកូដសុវត្ថិភាព 2FA៖</i>`;

  const keyboard = buildVaultListKeyboard(accounts, storeUrl);

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    }
  }
}

/**
 * Step 2: Render and send/edit Credentials Detail View
 */
export async function handleViewAccount(
  ctx: Context,
  accountId: string,
  storeUrl: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const account = await getCustomerDeliveredAccountById(telegramId, accountId);
  if (!account) {
    try {
      await ctx.answerCbQuery('រកមិនឃើញគណនីនេះទេ / Account not found', { show_alert: true });
    } catch {}
    return;
  }

  const twoFactorSecret = account.two_factor_secret
    ? `<code>${escapeHtml(account.two_factor_secret)}</code>`
    : '—';

  const backupCodesList =
    account.backup_codes && account.backup_codes.length > 0
      ? account.backup_codes.map((c) => `<code>${escapeHtml(c)}</code>`).join('\n')
      : '—';

  const text =
    `🔐 <b>ព័ត៌មានលម្អិតគណនី (ACCOUNT CREDENTIALS)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 <b>ទំនិញ:</b> ${escapeHtml(account.game_title)}\n` +
    `📦 <b>លេខកូដ:</b> <code>${escapeHtml(account.order_code)}</code>\n` +
    `📅 <b>កាលបរិច្ឆេទ:</b> ${escapeHtml(formatDate(account.delivered_at))}\n\n` +
    `👤 <b>Username / ID:</b>\n` +
    `<code>${escapeHtml(account.username)}</code> <i>(ចុចលើអក្សរដើម្បី Copy)</i>\n\n` +
    `🔑 <b>Password / ពាក្យសម្ងាត់:</b>\n` +
    `<tg-spoiler><b>${escapeHtml(account.password)}</b></tg-spoiler> <i>(ចុចលើប្រអប់ខ្មៅដើម្បីបើកមើល)</i>\n\n` +
    `🛡️ <b>2FA Authenticator Key:</b>\n` +
    `${twoFactorSecret}\n\n` +
    `📑 <b>Backup / Recovery Codes:</b>\n` +
    `${backupCodesList}\n\n` +
    `⚠️ <b>ចំណាំសំខាន់:</b> សូមប្តូរពាក្យសម្ងាត់ និងចងភ្ជាប់ Email ផ្ទាល់ខ្លួនរបស់អ្នកភ្លាមៗដើម្បីសុវត្ថិភាព ១០០%។\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildAccountDetailKeyboard(account, storeUrl);

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
    }
  }
}

/**
 * Step 3: Live 2FA Code Generator
 */
export async function handleGen2fa(
  ctx: Context,
  accountId: string,
  _storeUrl: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const account = await getCustomerDeliveredAccountById(telegramId, accountId);
  if (!account || !account.two_factor_secret) {
    try {
      await ctx.answerCbQuery('គណនីនេះមិនមានកូដ 2FA ទេ / No 2FA configured', { show_alert: true });
    } catch {}
    return;
  }

  const cleanSecret = account.two_factor_secret.replace(/\s+/g, '').toUpperCase();
  const totp = TOTPService.generateCode(cleanSecret, Date.now());
  const remainingSeconds = totp.secondsRemaining;
  const totpCode = totp.code;

  // 1. Show interactive Telegram alert popup for instant view
  try {
    await ctx.answerCbQuery(
      `🔢 កូដ 2FA បច្ចុប្បន្នរបស់អ្នកគឺ: [ ${totpCode} ] (នៅសល់ ${remainingSeconds} វិនាទី)`,
      { show_alert: true }
    );
  } catch {}

  // 2. Also update panel text for convenient 1-tap copy
  const text =
    `🔢 <b>កូដ 2FA បច្ចុប្បន្នរបស់អ្នកគឺ:</b>\n\n` +
    `[ <b>${totpCode.slice(0, 3)} ${totpCode.slice(3)}</b> ] <i>(នៅសល់ ${remainingSeconds} វិនាទី)</i>\n` +
    `<code>${totpCode}</code> <i>(ចុចលើលេខដើម្បី Copy)</i>\n\n` +
    `🎮 ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})`;

  const keyboard = buildTwoFactorKeyboard(account.account_id);

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      // Ignored if unmodified
    }
  }
}
