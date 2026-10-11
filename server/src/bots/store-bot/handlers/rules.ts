import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import {
  buildMainRulesKeyboard,
  buildSubRulesKeyboard,
} from '../keyboards';
import { isMessageNotModifiedError } from './orders';

/**
 * Handle Store Rules & Warranties Main Screen (cb_main_rules / /rules)
 */
export async function handleMainRules(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const text =
    `📜 <b>ច្បាប់ទូទៅ និងគោលការណ៍ UCHIRO STORE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ <b>ការធានាគណនី (14-Day Warranty):</b>\n` +
    `• គណនីហ្គេមទាំងអស់មានការធានារយៈពេល 14 ថ្ងៃពេញ។\n` +
    `• ប្តូរថ្មី ឬសងប្រាក់វិញភ្លាមៗ ប្រសិនបើមានបញ្ហាជាប់សោរ ឬខុសពីការពិពណ៌នា។\n\n` +
    `⚠️ <b>កាតព្វកិច្ចអតិថិជន:</b>\n` +
    `• ត្រូវផ្លាស់ប្តូរ Password និងភ្ជាប់ Email/2FA ផ្ទាល់ខ្លួនភ្លាមៗក្រោយពេលទិញ។\n` +
    `• ហាងមិនទទួលខុសត្រូវករណីចែករំលែក Password ឬកូដ 2FA ទៅកាន់អ្នកដទៃឡើយ។\n\n` +
    `🎰 <b>ច្បាប់ Gacha & Streak:</b>\n` +
    `• ពិន្ទុ Streak នឹង Reset ទៅថ្ងៃទី 1 ប្រសិនបើអាក់ខាន Claim លើសពី 48 ម៉ោង។\n` +
    `• រង្វាន់ Gacha ចូលទៅក្នុង 🎒 Vault ដោយស្វ័យប្រវត្តិក្នងរយៈពេល 3 វិនាទី។\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildMainRulesKeyboard(userLang);

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
      console.warn('[Rules Menu] Render warning:', err);
    }
  }
}

/**
 * Handle Detailed Gacha Rules (cb_gacha_rules)
 */
export async function handleGachaRules(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🎰 <b>ច្បាប់ និងរបៀបលេង GACHA លម្អិត</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>តម្លៃសំបុត្រ:</b> <code>50 Pts</code> ក្នុង 1 សំបុត្របង្វិល\n\n` +
    `⚡ <b>អត្រាធ្លាក់រង្វាន់ (Drop Rates):</b>\n` +
    `• 🔴 <b>Mythical (Jackpot):</b> <code>1.5%</code> (Account កម្រិតខ្ពស់ / ផ្លែឈើ Mythical)\n` +
    `• 🟣 <b>Legendary:</b> <code>5.0%</code> (Item កម្រ / Dark Blade)\n` +
    `• 🔵 <b>Epic:</b> <code>15.0%</code> (Vouchers / Items)\n` +
    `• 🟢 <b>Rare:</b> <code>30.0%</code> (Codes / Small Vouchers)\n` +
    `• ⚪ <b>Common:</b> <code>48.5%</code> (Points ត្រឡប់មកវិញ)\n\n` +
    `📦 <b>ការផ្ញើរង្វាន់:</b>\n` +
    `• គណនី ឬ Code ដែលឈ្នះ នឹងត្រូវផ្ញើចូលទៅក្នុង <b>🎒 កាតាបឥវ៉ាន់ (Vault)</b> របស់អ្នកដោយស្វ័យប្រវត្តិក្នង 3 វិនាទី។\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Rules] Render warning:', err);
    }
  }
}

/**
 * Handle Detailed Daily Streak Rules (cb_daily_rules)
 */
export async function handleDailyRules(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🎁 <b>ច្បាប់ពិន្ទុប្រចាំថ្ងៃ & STREAK (DAILY RULES)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏳ <b>រយៈពេល Cooldown:</b>\n` +
    `• ចន្លោះការ Claim នីមួយៗត្រូវមានគម្លាត ២៤ ម៉ោងគត់ (Rolling 24-hour Lock)។\n\n` +
    `🔥 <b>រង្វាន់តាម Streak ជាប់គ្នា:</b>\n` +
    `• <b>ថ្ងៃទី ១ ដល់ ថ្ងៃទី ៦:</b> ទទួលបាន <code>+5 Pts</code> ក្នុងមួយថ្ងៃ\n` +
    `• <b>ថ្ងៃទី ៧ (រង្វាន់ធំ):</b> ទទួលបាន <code>+20 Pts</code> ពិសេស!\n\n` +
    `⚠️ <b>លក្ខខណ្ឌ Reset Streak:</b>\n` +
    `• ប្រសិនបើអ្នកអាក់ខានមិនបានចូល Claim លើសពី ៤៨ ម៉ោង ប្រព័ន្ធនឹង Reset Streak ត្រឡប់ទៅថ្ងៃទី ១ វិញដោយស្វ័យប្រវត្តិ។\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Daily Rules] Render warning:', err);
    }
  }
}

/**
 * Handle 14-Day Warranty Policy Details (cb_warranty_policy)
 */
export async function handleWarrantyPolicy(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🔐 <b>គោលការណ៍ធានា ១៤ ថ្ងៃពេញ (14-DAY WARRANTY)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ <b>ការការពារ ១០០%:</b>\n` +
    `• គណនីទាំងអស់ត្រូវបានត្រួតពិនិត្យសុវត្ថិភាពយ៉ាងហ្មត់ចត់មុននឹងដាក់លក់។\n` +
    `• រយៈពេលធានា ១៤ ថ្ងៃគិតចាប់ពីនាទីដែលទទួលបានទំនិញជោគជ័យ។\n\n` +
    `✅ <b>ករណីដែលទទួលបានការធានា:</b>\n` +
    `• គណនីខុសពីការពិពណ៌នា\n` +
    `• ពាក្យសម្ងាត់មិនត្រឹមត្រូវតាំងពីដំបូង\n` +
    `• មានបញ្ហាជាប់សោរ (Locked) ដោយមិនមែនជាកំហុសរបស់អ្នកទិញ\n\n` +
    `❌ <b>ករណីមិនធានា:</b>\n` +
    `• យកទៅប្រើប្រាស់ Hack / Exploit / Script នាំឱ្យជាប់ Ban\n` +
    `• ចែករំលែក Password ឬលេខកូដ 2FA ទៅកាន់អ្នកដទៃ\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Warranty Policy] Render warning:', err);
    }
  }
}
