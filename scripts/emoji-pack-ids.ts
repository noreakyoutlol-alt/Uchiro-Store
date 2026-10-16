import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
dotenv.config();

const token = process.env.STORE_BOT_TOKEN;
if (!token) {
  console.error('Error: STORE_BOT_TOKEN environment variable not set.');
  process.exit(1);
}

const packName = process.argv[2];
if (!packName) {
  console.error('Usage: ts-node scripts/emoji-pack-ids.ts <pack_name>');
  process.exit(1);
}

const bot = new Telegraf(token);

async function main() {
  try {
    const set = await bot.telegram.getStickerSet(packName);
    console.log(`=== Sticker Set: ${set.name} (${set.title}) ===`);
    console.log(`Total stickers: ${set.stickers.length}`);
    for (const sticker of set.stickers) {
      const customEmojiId = (sticker as any).custom_emoji_id;
      console.log(`Emoji: ${sticker.emoji || 'N/A'} | ID: ${customEmojiId || 'N/A'}`);
    }
  } catch (err: any) {
    console.error('Failed to get sticker set:', err.message);
    process.exit(1);
  }
}

main();
