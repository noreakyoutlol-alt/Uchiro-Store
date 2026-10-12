import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { buildMainMenuKeyboard } from '../keyboards';
import { getWelcomeMessage, formatTelegramHtml } from '../index';

export async function handleStart(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  DataStore.upsertTelegramUser({
    telegram_id: from.id,
    username: from.username,
    first_name: from.first_name,
    last_name: from.last_name,
    language_code: from.language_code || 'en',
  });

  const welcomeText = getWelcomeMessage('en');
  return ctx.reply(formatTelegramHtml(welcomeText), {
    parse_mode: 'HTML',
    reply_markup: buildMainMenuKeyboard(),
  });
}
