import { Markup } from 'telegraf';
import { DeliveredAccount } from '../../database/data-store';

export function createWebAppOrUrlButton(text: string, url: string) {
  if (url.startsWith('https://')) {
    return Markup.button.webApp(text, url);
  }
  return Markup.button.url(text, url);
}

export function buildVaultListKeyboard(accounts: DeliveredAccount[], storeUrl: string) {
  const buttons: any[][] = accounts.map((acc) => [
    Markup.button.callback(
      `🎮 [#${acc.order_code}] ${acc.game_title} (@${acc.username})`,
      `cb_view_acc_${acc.account_id}`
    ),
  ]);

  const webAppVaultUrl = storeUrl.includes('?') ? `${storeUrl}&tab=vault` : `${storeUrl}?tab=vault`;

  buttons.push([createWebAppOrUrlButton('📱 បើក Vault ក្នុង Mini App', webAppVaultUrl)]);
  buttons.push([Markup.button.callback('🔙 ត្រឡប់ទៅដើម (Back Home)', 'cb_main_menu')]);

  return Markup.inlineKeyboard(buttons);
}

export function buildEmptyVaultKeyboard(storeUrl: string) {
  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ ចូលហាងទំនិញ (Open Store)', storeUrl)],
    [Markup.button.callback('🔙 ត្រឡប់ទៅដើម (Back Home)', 'cb_main_menu')],
  ]);
}

export function buildAccountDetailKeyboard(account: DeliveredAccount, storeUrl: string) {
  const accountId = account.account_id;
  const webAppDetailUrl = storeUrl.includes('?')
    ? `${storeUrl}&tab=vault&orderId=${account.order_code}&accountId=${accountId}`
    : `${storeUrl}?tab=vault&orderId=${account.order_code}&accountId=${accountId}`;

  const rows: any[][] = [
    [createWebAppOrUrlButton('📱 បើកក្នុង Mini App (1-Click Copy)', webAppDetailUrl)],
  ];

  if (account.two_factor_secret) {
    rows.push([
      Markup.button.callback('🔄 ពិនិត្យកូដ 2FA ផ្ទាល់ (Live 2FA)', `cb_gen_2fa_${accountId}`),
    ]);
  }

  rows.push([Markup.button.callback('🔙 ត្រឡប់ទៅបញ្ជីគណនី', 'cb_vault_menu')]);
  rows.push([Markup.button.callback('🏠 ត្រឡប់ទៅដើម (Back Home)', 'cb_main_menu')]);

  return Markup.inlineKeyboard(rows);
}

export function buildTwoFactorKeyboard(accountId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 កូដថ្មី (Refresh)', `cb_gen_2fa_${accountId}`)],
    [Markup.button.callback('🔙 ត្រឡប់ទៅគណនី (Back)', `cb_view_acc_${accountId}`)],
    [Markup.button.callback('🏠 ត្រឡប់ទៅដើម (Back Home)', 'cb_main_menu')],
  ]);
}
