import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { buildMainMenuKeyboard } from '../keyboards';
import { getWelcomeMessage, formatTelegramHtml } from '../index';
import { enrichWithTgEmojis } from '../utils/emoji-registry';

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
  const keyboard = buildMainMenuKeyboard();
  await ctx.reply(enrichWithTgEmojis(formatTelegramHtml(welcomeText)), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}
