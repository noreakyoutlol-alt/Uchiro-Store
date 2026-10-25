import { enrichWithTgEmojis, TELEGRAM_EMOJIS } from '../config/telegram-emojis';
import { stripLeadingEmoji } from './store-bot/keyboards';

function getFallbackForCustomEmojiId(id: string): string | undefined {
  for (const def of Object.values(TELEGRAM_EMOJIS)) {
    if (def.customEmojiId === id) {
      return def.fallback;
    }
  }
  return undefined;
}

/**
 * Telegram Outbound Guard:
 * Wraps bot.telegram.callApi once (tracked via instance flag _outboundGuardApplied).
 * - For sendMessage, editMessageText, and caption methods with parse_mode: 'HTML', runs enrichWithTgEmojis.
 * - Ensures buttons with icon_custom_emoji_id do not send duplicated leading unicode emoji in text.
 * - On a 400 error mentioning emoji/entities/button/premium, retries once with:
 *     1. <tg-emoji> tags stripped from text/caption.
 *     2. icon_custom_emoji_id removed from buttons, prepending __fallback + label if available.
 */
export function applyTelegramOutboundGuard(bot: any): void {
  if (!bot || !bot.telegram || bot._outboundGuardApplied) {
    return;
  }
  bot._outboundGuardApplied = true;

  const originalCallApi = bot.telegram.callApi.bind(bot.telegram);

  bot.telegram.callApi = async function (method: any, payload: any, ...rest: any[]) {
    const isTextMethod = method === 'sendMessage' || method === 'editMessageText';
    const isCaptionMethod =
      method === 'sendPhoto' ||
      method === 'sendVideo' ||
      method === 'sendDocument' ||
      method === 'editMessageCaption';

    if (payload && typeof payload === 'object') {
      if (payload.parse_mode === 'HTML') {
        if (isTextMethod && typeof payload.text === 'string') {
          payload.text = enrichWithTgEmojis(payload.text);
        } else if (isCaptionMethod && typeof payload.caption === 'string') {
          payload.caption = enrichWithTgEmojis(payload.caption);
        }
      }

      if (payload.reply_markup?.inline_keyboard && Array.isArray(payload.reply_markup.inline_keyboard)) {
        for (const row of payload.reply_markup.inline_keyboard) {
          if (Array.isArray(row)) {
            for (const btn of row) {
              if (btn && btn.icon_custom_emoji_id && typeof btn.text === 'string') {
                const fallback = (btn as any).__fallback || getFallbackForCustomEmojiId(btn.icon_custom_emoji_id);
                if (fallback) {
                  const baseFallback = fallback.replace(/[︎️]/g, '');
                  const baseText = btn.text.replace(/[︎️]/g, '');
                  if (btn.text.startsWith(fallback) || baseText.startsWith(baseFallback)) {
                    btn.text = stripLeadingEmoji(btn.text);
                  }
                }
              }
            }
          }
        }
      }
    }

    try {
      return await originalCallApi(method, payload, ...rest);
    } catch (err: any) {
      const errMsg = String(err?.message || err?.description || '').toLowerCase();
      const isEmojiError = /emoji|entities|button|premium|can't parse entities/.test(errMsg);
      if (err?.response?.error_code === 400 && isEmojiError) {
        const retryPayload = { ...payload };
        if (retryPayload.text && typeof retryPayload.text === 'string') {
          retryPayload.text = retryPayload.text.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1');
        }
        if (retryPayload.caption && typeof retryPayload.caption === 'string') {
          retryPayload.caption = retryPayload.caption.replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1');
        }
        if (retryPayload.reply_markup?.inline_keyboard) {
          retryPayload.reply_markup = {
            ...retryPayload.reply_markup,
            inline_keyboard: retryPayload.reply_markup.inline_keyboard.map((row: any[]) =>
              row.map((btn: any) => {
                const cleanBtn = { ...btn };
                if (cleanBtn.icon_custom_emoji_id) {
                  delete cleanBtn.icon_custom_emoji_id;
                  if (btn.__fallback && !cleanBtn.text.startsWith(btn.__fallback)) {
                    cleanBtn.text = `${btn.__fallback} ${cleanBtn.text}`.trim();
                  }
                }
                return cleanBtn;
              })
            ),
          };
        }
        return await originalCallApi(method, retryPayload, ...rest);
      }
      throw err;
    }
  };
}
