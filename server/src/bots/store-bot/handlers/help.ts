import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import {
  buildMainHelpKeyboard,
  buildSubHelpKeyboard,
} from '../keyboards';
import { isMessageNotModifiedError } from './orders';

/**
 * Handle Main Help Center (cb_main_help / /help)
 */
export async function handleMainHelp(ctx: Context, supportUsername: string = 'UchiroSupport'): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const text =
    `❓ <b>មជ្ឈមណ្ឌលជំនួយ &amp; FAQ (HELP CENTER)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `ស្វែងរកចម្លើយរហ័សចំពោះចម្ងល់ញឹកញាប់៖\n\n` +
    `1️⃣ <b>របៀប Login គណនីដែលមាន 2FA:</b>\n` +
    `• ចូលទៅកាន់ <b>🎒 កាតាបឥវ៉ាន់</b> -> ជ្រើសរើស Account -> ចុច <b>🔑 ស្នើសុំកូដ 2FA</b> ដើម្បីទទួលបានលេខ 6 ខ្ទង់។\n\n` +
    `2️⃣ <b>របៀបទូទាត់ប្រាក់ KHQR:</b>\n` +
    `• ស្កេនទូទាត់តាម Bakong/ABA -> ប្រព័ន្ធផ្ទៀងផ្ទាត់ដោយស្វ័យប្រវត្តិក្នុង 5 វិនាទី។\n\n` +
    `3️⃣ <b>បញ្ហាចូលគណនីមិនកើត:</b>\n` +
    `• សូម Screenshot ផ្ញើទៅកាន់ក្រុមការងារ Support 24/7 ដើម្បីដោះស្រាយភ្លាមៗ។\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildMainHelpKeyboard(supportUsername, userLang);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Help Menu] Render warning:', err);
    }
  }
}

/**
 * Handle 2FA Authenticator Guide (cb_guide_2fa)
 */
export async function handleGuide2fa(ctx: Context, supportUsername: string = 'UchiroSupport'): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🔑 <b>មគ្គុទ្ទេសក៍ប្រើ 2FA AUTHENTICATOR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>ជំហានទី ១:</b>\n` +
    `• ចូលទៅកាន់ <b>🎒 កាតាបឥវ៉ាន់ (Vault)</b> ក្នុង Bot នេះ ឬក្នុង Mini App។\n\n` +
    `<b>ជំហានទី ២:</b>\n` +
    `• ចុចលើ Account ដែលបានទិញរួចរើសយក <b>🔑 ស្នើសុំកូដ 2FA OTP ផ្ទាល់</b>។\n\n` +
    `<b>ជំហានទី ៣:</b>\n` +
    `• Bot នឹងបង្ហាញលេខ 6 ខ្ទង់ភ្លាមៗ (កូដនីមួយៗមានសុពលភាព 30 វិនាទី)។\n` +
    `• យកលេខកូដនេះទៅបំពេញលើផ្ទាំង Roblox Login ជាការស្រេច!\n\n` +
    `💡 <i>អ្នកក៏អាច Copy 2FA Key យកទៅដាក់ក្នុង Google Authenticator ឬ Microsoft Authenticator ផ្ទាល់ខ្លួនបានផងដែរ។</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubHelpKeyboard(supportUsername, 'km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[2FA Guide] Render warning:', err);
    }
  }
}

/**
 * Handle Payment Guide (cb_guide_payment)
 */
export async function handleGuidePayment(ctx: Context, supportUsername: string = 'UchiroSupport'): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `💳 <b>របៀបទិញ និងបង់ប្រាក់តាម KHQR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>ជំហានទី ១:</b>\n` +
    `• បើកហាង Mini App ហើយជ្រើសរើសទំនិញដែលអ្នកចង់បាន រួចចុច <b>ទិញឥឡូវនេះ</b>។\n\n` +
    `<b>ជំហានទី ២:</b>\n` +
    `• ប្រព័ន្ធនឹងបង្ហាញ QR Code (Bakong KHQR) រួមជាមួយចំនួនទឹកប្រាក់ច្បាស់លាស់។\n\n` +
    `<b>ជំហានទី ៣:</b>\n` +
    `• បើកកម្មវិធីធនាគាររបស់អ្នក (ABA, Bakong, ACLEDA, Wing, etc.) ស្កេនទូទាត់ប្រាក់។\n\n` +
    `<b>ជំហានទី ៤:</b>\n` +
    `• បន្ទាប់ពីទូទាត់រួច ប្រព័ន្ធនឹងផ្ទៀងផ្ទាត់ដោយស្វ័យប្រវត្តិក្នងរយៈពេល <b>5 វិនាទី</b> ហើយផ្ញើ Account ចូលទៅកាន់ <b>🎒 កាតាបឥវ៉ាន់</b> របស់អ្នកភ្លាមៗ!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubHelpKeyboard(supportUsername, 'km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Payment Guide] Render warning:', err);
    }
  }
}
