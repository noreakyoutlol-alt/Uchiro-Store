import { Context } from 'telegraf';
import {
  getCustomerDeliveredAccounts,
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
import { DataStore } from '../../../database/data-store';

/**
 * Vault & Accounts Menu (cb_vault_menu / /vault)
 */
export async function handleVaultDashboard(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const text =
    lang === 'km'
      ? `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីហ្គេម</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `គ្រប់គ្រងគណនីហ្គេមដែលបានប្រគល់ជូន និងទទួលកូដ 2FA OTP ភ្លាមៗ៖\n\n` +
        `• <b>🔑 Get Live 2FA Code:</b> បង្កើតលេខកូដ 2FA ៦ ខ្ទង់ភ្លាមៗ\n` +
        `• <b>🎒 View Delivered Accounts:</b> មើលព័ត៌មានគណនី និងលេខកូដបម្រុង\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`
      : `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Manage your delivered game accounts and access live 2FA OTP codes:\n\n` +
        `• <b>🔑 Get Live 2FA Code:</b> Instant 6-digit TOTP generator\n` +
        `• <b>🎒 View Delivered Accounts:</b> Full credentials &amp; recovery codes\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildVaultMenuKeyboard(lang);

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

  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';
  const accounts = await getCustomerDeliveredAccounts(telegramId);
  const twoFaAccounts = accounts.filter(a => Boolean(a.two_factor_secret));

  if (twoFaAccounts.length === 0) {
    const text =
      lang === 'km'
        ? `🔑 <b>ប្រព័ន្ធបង្កើតកូដ 2FA LIVE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `អ្នកមិនទាន់មានគណនីដែលមានប្រព័ន្ធការពារ 2FA នៅឡើយទេ។\n\n` +
          `👉 សូមពិនិត្យមើលបញ្ជីគណនីដែលបានប្រគល់ជូនរបស់អ្នក៖`
        : `🔑 <b>LIVE 2FA CODE GENERATOR</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `You don't have any accounts with 2FA protection yet.\n\n` +
          `👉 Check your delivered accounts list:`;

    const keyboard = buildVaultMenuKeyboard(lang);
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
      lang === 'km'
        ? `🔑 <b>កូដ 2FA LIVE ពេលនេះ (OTP)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎮 <b>គណនី៖</b> ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})\n` +
          `📦 <b>លេខបញ្ជាទិញ៖</b> <code>${escapeHtml(account.order_code)}</code>\n\n` +
          `⚡ <b>កូដ 2FA Live របស់អ្នក៖</b>\n` +
          `<code>${code}</code> <i>(ចុចលើកូដដើម្បីចម្លង)</i>\n\n` +
          `⏳ <b>ផុតកំណត់ក្នុងរយៈពេល៖</b> <b>${remainingSeconds} វិនាទី</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━`
        : `🔑 <b>CURRENT 2FA CODE (LIVE OTP)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎮 <b>Account:</b> ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})\n` +
          `📦 <b>Order Code:</b> <code>${escapeHtml(account.order_code)}</code>\n\n` +
          `⚡ <b>Your Live 2FA Code:</b>\n` +
          `<code>${code}</code> <i>(Tap code to copy)</i>\n\n` +
          `⏳ <b>Expires in:</b> <b>${remainingSeconds}s</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━`;

    const keyboard = buildTwoFactorKeyboard(account.account_id, lang);
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

  // Multiple 2FA accounts: show selection list
  const text =
    lang === 'km'
      ? `🔑 <b>ជ្រើសរើសគណនីសម្រាប់កូដ 2FA៖</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `អ្នកមានគណនីចំនួន <b>${twoFaAccounts.length}</b> ដែលមានប្រព័ន្ធ 2FA Authenticator៖\n\n` +
        `👇 <i>ចុចលើគណនីខាងក្រោមដើម្បីមើលកូដ OTP Live៖</i>`
      : `🔑 <b>SELECT AN ACCOUNT FOR 2FA CODE:</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have <b>${twoFaAccounts.length}</b> accounts configured with 2FA Authenticator:\n\n` +
        `👇 <i>Tap an account below to view its live OTP code:</i>`;

  const keyboard = buildVaultListKeyboard(twoFaAccounts, storeUrl, 5, lang);
  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch {
    await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
  }
}

/**
 * Handle Delivered Accounts List (cb_vault_accounts)
 */
export async function handleVaultAccounts(ctx: Context, storeUrl: string, page: number = 0): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';
  const accounts = await getCustomerDeliveredAccounts(telegramId);

  if (accounts.length === 0) {
    const text =
      lang === 'km'
        ? `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីហ្គេម</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `អ្នកមិនទាន់មានគណនីហ្គេមដែលបានប្រគល់នៅឡើយទេ។\n\n` +
          `👉 ចុចខាងក្រោមដើម្បីចូលមើលទំនិញក្នុងហាង៖`
        : `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `You don't have any delivered game accounts yet.\n\n` +
          `👉 Tap below to explore the store catalog:`;

    const keyboard = buildEmptyVaultKeyboard(storeUrl, lang);
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

  const text =
    lang === 'km'
      ? `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីហ្គេម</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `អ្នកមានគណនីហ្គេមចំនួន <b>${accounts.length}</b> នៅក្នុងកាតាបរបស់អ្នក៖\n\n` +
        `👇 <i>ចុចលើគណនីខាងក្រោមដើម្បីមើលព័ត៌មានគណនី &amp; កូដ 2FA Live៖</i>`
      : `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `You have <b>${accounts.length}</b> game accounts in your vault:\n\n` +
        `👇 <i>Tap an account below to view credentials & live 2FA code:</i>`;

  const keyboard = buildVaultListKeyboard(accounts, page, 5, lang);
  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch {
    await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
  }
}
