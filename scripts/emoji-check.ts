import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { TELEGRAM_EMOJIS } from '../server/src/config/telegram-emojis';
dotenv.config();

const token = process.env.STORE_BOT_TOKEN;
if (!token) {
  console.error('Error: STORE_BOT_TOKEN environment variable not set.');
  process.exit(1);
}

const bot = new Telegraf(token);

async function main() {
  const allEntries = Object.entries(TELEGRAM_EMOJIS).filter(
    ([, def]) => typeof def.customEmojiId === 'string' && def.customEmojiId.trim() !== ''
  );

  console.log(`Validating ${allEntries.length} registered custom emoji IDs...`);

  const chunkSize = 200;
  for (let i = 0; i < allEntries.length; i += chunkSize) {
    const chunk = allEntries.slice(i, i + chunkSize);
    const ids = chunk.map(([, def]) => (def.customEmojiId as string).trim());

    try {
      const stickers = await (bot.telegram as any).callApi('getCustomEmojiStickers', {
        custom_emoji_ids: ids,
      });

      console.log(`Batch ${i / chunkSize + 1}: verified ${stickers.length}/${ids.length} stickers.`);
      const returnedIds = new Set(stickers.map((s: any) => s.custom_emoji_id));
      for (const [key, def] of chunk) {
        const id = (def.customEmojiId as string).trim();
        if (!returnedIds.has(id)) {
          console.warn(`  [INVALID] ${key} ID ${id} not found on Telegram servers.`);
        }
      }
    } catch (err: any) {
      console.error(`Batch validation failed:`, err.message);
    }
  }

  console.log('Validation complete.');
}

main();
