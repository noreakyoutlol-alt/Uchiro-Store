import { Context } from 'telegraf';
import {
  getCustomerDeliveredAccounts,
  getCustomerDeliveredAccountById,
  isMessageNotModifiedError,
  escapeHtml,
} from './orders';
import {
  buildVaultMenuKeyboard,
  buildVaultListKeyboard,
  buildEmptyVaultKeyboard,
  buildTwoFactorKeyboard,
} from '../keyboards';
import { TOTPService } from '../../../security/totp';
import { enrichWithTgEmojis } from '../utils/emoji-registry';

/**
 * Vault & Accounts Menu (cb_vault_menu / /vault)
 * Buttons:
 * 🔑 Get Live 2FA Code (cb_vault_2fa)
 * 🎒 View Delivered Accounts (cb_vault_accounts)
 * 🔙 Back Home (cb_main_menu)
 */
export async function handleVaultDashboard(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីសុវត្ថិភាព (VAULT &amp; 2FA)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `គ្រប់គ្រងគណនីហ្គេមដែលបានទិញ និងស្នើសុំលេខកូដសុវត្ថិភាព 2FA៖\n\n` +
    `• <b>🔑 Get Live 2FA Code:</b> បង្កើតលេខកូដ 6 ខ្ទង់ OTP ភ្លាមៗ\n` +
    `• <b>🎒 View Delivered Accounts:</b> បញ្ជីគណនី និងពាក្យសម្ងាត់ទាំងអស់\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildVaultMenuKeyboard();

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Vault Dashboard] Render warning:', err);
    }
  }
}

/**
 * Handle 2FA Quick Menu (cb_vault_2fa)
 */
export async function handleVault2fa(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const accounts = await getCustomerDeliveredAccounts(telegramId);
  const twoFaAccounts = accounts.filter(a => Boolean(a.two_factor_secret));

  if (twoFaAccounts.length === 0) {
    const text =
      `🔑 <b>កូដសុវត្ថិភាព 2FA (LIVE 2FA GENERATOR)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `អ្នកមិនទាន់មានគណនីដែលបានភ្ជាប់ 2FA នៅឡើយទេ។\n\n` +
      `👉 ចូលទៅកាន់បញ្ជីគណនីដើម្បីពិនិត្យទំនិញរបស់អ្នក៖`;

    const keyboard = buildVaultMenuKeyboard();
    try {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch {
      await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
    }
    return;
  }

  // If exactly 1 account with 2FA, generate immediately
  if (twoFaAccounts.length === 1) {
    const account = twoFaAccounts[0];
    const generated = TOTPService.generateCode(account.two_factor_secret || '');
    const code = generated.code;
    const remainingSeconds = generated.secondsRemaining;

    const text =
      `🔑 <b>កូដសុវត្ថិភាព 2FA បច្ចុប្បន្ន (LIVE OTP)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎮 <b>គណនី:</b> ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})\n` +
      `📦 <b>កូដកុម្ម៉ង់:</b> <code>${escapeHtml(account.order_code)}</code>\n\n` +
      `⚡ <b>កូដ 2FA OTP របស់អ្នក:</b>\n` +
      `<code>${code}</code> <i>(ចុចលើលេខដើម្បី Copy)</i>\n\n` +
      `⏳ <b>ផុតកំណត់ក្នុងរយៈពេល:</b> <b>${remainingSeconds} វិនាទី</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = buildTwoFactorKeyboard(account.account_id);
    try {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch {
      await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
    }
    return;
  }

  // If multiple, show account picker
  const text =
    `🔑 <b>ជ្រើសរើសគណនីដើម្បីយកកូដ 2FA:</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `អ្នកមាន <b>${twoFaAccounts.length}</b> គណនីដែលប្រើប្រាស់ 2FA Authenticator:\n\n` +
    `👇 <i>ចុចលើគណនីដែលអ្នកចង់ Login៖</i>`;

  const keyboard = buildVaultListKeyboard(twoFaAccounts, storeUrl);
  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch {
    await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
  }
}

