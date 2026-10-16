import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { buildMainMenuKeyboard, getLanguageSelectionKeyboard } from '../keyboards';
import { getWelcomeMessage, formatTelegramHtml } from '../index';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { renderTgEmoji } from '../../../config/telegram-emojis';

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const savedLang = DataStore.getUserLanguagePreference(from.id);

  if (!savedLang) {
    DataStore.upsertTelegramUser({
      telegram_id: from.id,
      username: from.username,
      first_name: from.first_name,
      last_name: from.last_name,
      language_code: from.language_code || 'en',
    });

    const langPrompt =
      `${renderTgEmoji('GLOBE', '🌐')} <b>Welcome to UCHIRO STORE | សូមស្វាគមន៍</b>\n\n` +
      `Please select your preferred language to continue:\n` +
      `សូមជ្រើសរើសភាសារបស់អ្នកដើម្បីបន្ត៖`;

    const keyboard = getLanguageSelectionKeyboard(false);
    return ctx.reply(enrichWithTgEmojis(formatTelegramHtml(langPrompt)), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }

  DataStore.upsertTelegramUser({
    telegram_id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name,
    language_preference: savedLang,
  });

  const welcomeText = getWelcomeMessage(savedLang);
  const keyboard = buildMainMenuKeyboard();
  await ctx.reply(enrichWithTgEmojis(formatTelegramHtml(welcomeText)), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}
