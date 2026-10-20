import { Markup } from 'telegraf';
import { BroadcastService, getStoreUrl, validateButtonLabel, validateButtonUrl } from '../../services/broadcast.service';
import { BroadcastType, BroadcastMediaType, BroadcastButtonConfig, BroadcastCampaign } from '../../types';
import { isAuthorizedAdmin } from './admin-guards';
import { makeAdminButton, AdminView } from './admin-actions';
import { TELEGRAM_EMOJIS } from '../../config/telegram-emojis';

export interface WizardSession {
  step:
    | 'select_type'
    | 'enter_text'
    | 'enter_btn_label'
    | 'enter_btn_url'
    | 'enter_media'
    | 'enter_caption'
    | 'enter_media_btn_choice'
    | 'enter_media_btn_label'
    | 'enter_media_btn_url'
    | 'preview_confirm';
  type: BroadcastType;
  text?: string;
  media_type?: BroadcastMediaType;
  media_url?: string;
  button_label?: string;
  button_url?: string;
  campaignId?: string;
  updatedAt: number;
}

const sessions: Map<number, WizardSession> = new Map();

export function hasActiveBroadcastWizard(telegramId: number): boolean {
  return sessions.has(telegramId);
}

export function getBroadcastWizardSession(telegramId: number): WizardSession | undefined {
  return sessions.get(telegramId);
}

export function clearBroadcastWizardSession(telegramId: number): void {
  sessions.delete(telegramId);
}

/**
 * Initiates the Telegram Admin Broadcast Wizard
 */
export function startBroadcastWizard(telegramId: number): AdminView {
  sessions.set(telegramId, {
    step: 'select_type',
    type: 'text_only',
    updatedAt: Date.now(),
  });

  const text =
    `📢 <b>Store Broadcast Wizard</b>\n\n` +
    `Choose the type of announcement to broadcast to customers:\n\n` +
    `• <b>Text Only</b> — Plain announcement\n` +
    `• <b>Text + Shop Now</b> — Message with official store Mini App button\n` +
    `• <b>Text + Custom Button</b> — Message with custom button label & URL\n` +
    `• <b>Media + Caption</b> — Photo or video with caption & optional button`;

  return {
    text,
    replyMarkup: {
      inline_keyboard: [
        [
          makeAdminButton({ text: 'Text Only', callbackData: 'wiz_bc_type:text_only', iconKey: 'RECEIPT' }),
          makeAdminButton({ text: 'Text + Shop Now', callbackData: 'wiz_bc_type:text_shop_now', iconKey: 'PACKAGE' }),
        ],
        [
          makeAdminButton({ text: 'Text + Custom Button', callbackData: 'wiz_bc_type:text_custom_button', iconKey: 'KEY' }),
          makeAdminButton({ text: 'Media + Caption', callbackData: 'wiz_bc_type:media_caption', iconKey: 'FIRE' }),
        ],
        [
          makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'BACK' }),
        ],
      ],
    },
  };
}

/**
 * Handles callback queries for wizard navigation and selection
 */
export async function handleBroadcastWizardCallback(
  data: string,
  from: { id: number; username?: string }
): Promise<AdminView | null> {
  const session = sessions.get(from.id);

  // 1. Cancel action (always allowed)
  if (data === 'wiz_bc_cancel') {
    if (session?.campaignId) {
      try {
        BroadcastService.cancelCampaign(from.id, session.campaignId);
      } catch {
        // Ignored
      }
    }
    clearBroadcastWizardSession(from.id);
    return {
      text: `❌ <b>Broadcast Cancelled</b>\n\nNo messages were sent to customers.`,
      replyMarkup: {
        inline_keyboard: [
          [makeAdminButton({ text: '« Back to Admin Menu', callbackData: 'admin_menu', iconKey: 'BACK' })],
        ],
      },
    };
  }

  // 2. If no active session, prompt to start
  if (!session) {
    if (data === 'cb_admin_broadcast' || data === 'admin_broadcast') {
      return startBroadcastWizard(from.id);
    }
    return {
      text: `⚠️ No active broadcast wizard found. Tap below to start:`,
      replyMarkup: {
        inline_keyboard: [
          [makeAdminButton({ text: 'Start Broadcast Wizard', callbackData: 'admin_broadcast', iconKey: 'MEGAPHONE' })],
          [makeAdminButton({ text: '« Back to Admin Menu', callbackData: 'admin_menu', iconKey: 'BACK' })],
        ],
      },
    };
  }

  // 3. Type Selection
  if (data.startsWith('wiz_bc_type:')) {
    const selectedType = data.replace('wiz_bc_type:', '') as BroadcastType;
    session.type = selectedType;
    session.updatedAt = Date.now();

    if (selectedType === 'media_caption') {
      session.step = 'enter_media';
      return {
        text:
          `🖼️ <b>Step 1: Send Media (Photo or Video)</b>\n\n` +
          `Please upload or send a photo, a video, or reply with an HTTPS image/video URL.\n\n` +
          `<i>Send media or type your URL in chat:</i>`,
        replyMarkup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      };
    }

    // Text types
    session.step = 'enter_text';
    return {
      text:
        `✍️ <b>Enter Broadcast Message</b>\n\n` +
        `Please type the message text you wish to broadcast to customers.\n` +
        `You can use HTML tags (<b>bold</b>, <i>italic</i>, <code>code</code>).\n\n` +
        `<i>Type your message and send it as a chat reply:</i>`,
      replyMarkup: {
        inline_keyboard: [
          [
            makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
            makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
          ],
        ],
      },
    };
  }

  // 4. Media button choice
  if (data.startsWith('wiz_bc_med_btn:')) {
    const choice = data.replace('wiz_bc_med_btn:', '');
    if (choice === 'shop_now') {
      session.button_label = '🛍️ Shop Now';
      session.button_url = getStoreUrl();
      return renderPreviewConfirmView(session, from.id);
    } else if (choice === 'none') {
      session.button_label = undefined;
      session.button_url = undefined;
      return renderPreviewConfirmView(session, from.id);
    } else if (choice === 'custom') {
      session.step = 'enter_media_btn_label';
      return {
        text:
          `🔘 <b>Enter Button Label</b>\n\n` +
          `Please send the English label for your button (max 64 characters, e.g. "Join Community" or "Claim Bonus"):`,
        replyMarkup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      };
    }
  }

  // 5. Back navigation
  if (data === 'wiz_bc_back') {
    if (session.step === 'enter_text' || session.step === 'enter_media') {
      return startBroadcastWizard(from.id);
    }
    if (session.step === 'enter_btn_label') {
      session.step = 'enter_text';
      return {
        text: `✍️ <b>Enter Broadcast Message</b>\n\nPlease type your message text:`,
        replyMarkup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      };
    }
    if (session.step === 'enter_btn_url') {
      session.step = 'enter_btn_label';
      return {
        text: `🔘 <b>Enter Button Label</b>\n\nPlease send the English label:`,
        replyMarkup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      };
    }
    if (session.step === 'preview_confirm') {
      return startBroadcastWizard(from.id);
    }
    return startBroadcastWizard(from.id);
  }

  // 6. Confirm Send
  if (data === 'wiz_bc_confirm') {
    if (!isAuthorizedAdmin(from.id)) {
      return {
        text: `⛔ Access denied. You are not an authorized admin.`,
        replyMarkup: { inline_keyboard: [] },
      };
    }

    if (session.step !== 'preview_confirm' || !session.campaignId) {
      return {
        text: `⚠️ Broadcast is not ready for confirmation or has already been dispatched.`,
        replyMarkup: {
          inline_keyboard: [
            [makeAdminButton({ text: 'Start Over', callbackData: 'admin_broadcast', iconKey: 'MEGAPHONE' })],
          ],
        },
      };
    }

    const campaignId = session.campaignId;
    clearBroadcastWizardSession(from.id); // Clear immediately to prevent double submissions

    try {
      const dispatched = await BroadcastService.confirmAndDispatch(from.id, campaignId);
      return {
        text:
          `✅ <b>Broadcast Dispatched!</b>\n\n` +
          `• Campaign ID: <code>${dispatched.id}</code>\n` +
          `• Target Recipients: <b>${dispatched.target_count}</b> customers\n` +
          `• Type: <b>${dispatched.type}</b>\n\n` +
          `🚀 Delivery is processing in the background under Telegram rate limits (25 msgs/sec).\n` +
          `You can monitor real-time completion in the Admin Portal.`,
        replyMarkup: {
          inline_keyboard: [
            [makeAdminButton({ text: '« Back to Admin Menu', callbackData: 'admin_menu', iconKey: 'BACK' })],
          ],
        },
      };
    } catch (err: any) {
      return {
        text: `❌ <b>Dispatch Failed:</b> ${err?.message || 'Unknown error'}`,
        replyMarkup: {
          inline_keyboard: [
            [makeAdminButton({ text: 'Try Again', callbackData: 'admin_broadcast', iconKey: 'REFRESH' })],
            [makeAdminButton({ text: '« Back to Admin Menu', callbackData: 'admin_menu', iconKey: 'BACK' })],
          ],
        },
      };
    }
  }

  return null;
}

/**
 * Handles incoming chat messages from admins when in a wizard session
 */
export async function handleBroadcastWizardMessage(ctx: any): Promise<boolean> {
  const fromId = ctx.from?.id;
  if (!fromId) return false;
  const session = sessions.get(fromId);
  if (!session) return false;

  const text = ctx.message?.text?.trim() || '';

  // Handle /cancel command inside wizard
  if (text === '/cancel') {
    if (session.campaignId) {
      try {
        BroadcastService.cancelCampaign(fromId, session.campaignId);
      } catch {
        // Ignored
      }
    }
    clearBroadcastWizardSession(fromId);
    await ctx.reply(
      `❌ <b>Broadcast Cancelled</b>\n\nNo messages were sent to customers.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [makeAdminButton({ text: '« Back to Admin Menu', callbackData: 'admin_menu', iconKey: 'BACK' })],
          ],
        },
      }
    );
    return true;
  }

  // 1. Text Entry Step
  if (session.step === 'enter_text') {
    if (!text || text.length === 0) {
      await ctx.reply(`⚠️ Message cannot be empty. Please send your broadcast text:`);
      return true;
    }
    if (text.length > 4096) {
      await ctx.reply(`⚠️ Message exceeds Telegram limit of 4,096 characters (currently ${text.length}). Please shorten your message:`);
      return true;
    }

    session.text = text;
    session.updatedAt = Date.now();

    if (session.type === 'text_only' || session.type === 'text_shop_now') {
      const view = await renderPreviewConfirmView(session, fromId);
      await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
      return true;
    }

    if (session.type === 'text_custom_button') {
      session.step = 'enter_btn_label';
      await ctx.reply(
        `🔘 <b>Enter Button Label</b>\n\n` +
        `Please send the English label for your button (max 64 characters, e.g. "Join Discord" or "Claim Reward"):`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
                makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
              ],
            ],
          },
        }
      );
      return true;
    }
  }

  // 2. Button Label Step
  if (session.step === 'enter_btn_label' || session.step === 'enter_media_btn_label') {
    const val = validateButtonLabel(text);
    if (!val.valid) {
      await ctx.reply(`⚠️ ${val.error}. Please enter a valid English button label (max 64 characters):`);
      return true;
    }

    session.button_label = text;
    session.step = session.step === 'enter_media_btn_label' ? 'enter_media_btn_url' : 'enter_btn_url';
    session.updatedAt = Date.now();

    await ctx.reply(
      `🔗 <b>Enter Button Destination URL</b>\n\n` +
      `Please send the destination URL (must start with https:// or http://):`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      }
    );
    return true;
  }

  // 3. Button URL Step
  if (session.step === 'enter_btn_url' || session.step === 'enter_media_btn_url') {
    const val = validateButtonUrl(text);
    if (!val.valid) {
      await ctx.reply(`⚠️ ${val.error}. Please enter a valid URL starting with http:// or https://:`);
      return true;
    }

    session.button_url = text;
    session.updatedAt = Date.now();

    const view = await renderPreviewConfirmView(session, fromId);
    await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
    return true;
  }

  // 4. Media Upload Step
  if (session.step === 'enter_media') {
    // Check if photo uploaded
    if (ctx.message?.photo && ctx.message.photo.length > 0) {
      const bestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      session.media_type = 'photo';
      session.media_url = bestPhoto.file_id;
      if (ctx.message.caption) {
        session.text = ctx.message.caption.trim();
      }
    } else if (ctx.message?.video) {
      session.media_type = 'video';
      session.media_url = ctx.message.video.file_id;
      if (ctx.message.caption) {
        session.text = ctx.message.caption.trim();
      }
    } else if (text && text.startsWith('https://')) {
      const val = validateButtonUrl(text);
      if (!val.valid) {
        await ctx.reply(`⚠️ ${val.error}. Please provide a valid https:// media URL or upload a file:`);
        return true;
      }
      session.media_type = /\.(mp4|mov|webm)$/i.test(text) ? 'video' : 'photo';
      session.media_url = text;
    } else {
      await ctx.reply(
        `⚠️ Please upload a photo, a video, or send a direct https:// URL to your image or video:`
      );
      return true;
    }

    session.updatedAt = Date.now();

    // If caption was already included in the media upload
    if (session.text) {
      return promptMediaButtonChoice(ctx, session);
    }

    // Prompt for caption
    session.step = 'enter_caption';
    await ctx.reply(
      `✍️ <b>Enter Caption (Optional)</b>\n\n` +
      `Please send the caption text for this media (max 1,024 characters), or send <code>/skip</code> if you do not want a caption:`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
              makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
            ],
          ],
        },
      }
    );
    return true;
  }

  // 5. Caption Step
  if (session.step === 'enter_caption') {
    if (text !== '/skip' && text.length > 0) {
      if (text.length > 1024) {
        await ctx.reply(`⚠️ Caption exceeds Telegram limit of 1,024 characters (currently ${text.length}). Please shorten your caption:`);
        return true;
      }
      session.text = text;
    } else {
      session.text = undefined;
    }

    session.updatedAt = Date.now();
    return promptMediaButtonChoice(ctx, session);
  }

  return false;
}

async function promptMediaButtonChoice(ctx: any, session: WizardSession): Promise<boolean> {
  session.step = 'enter_media_btn_choice';
  await ctx.reply(
    `🔘 <b>Optional Action Button</b>\n\nWould you like to attach an interactive button to this media announcement?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [makeAdminButton({ text: '🛍️ Shop Now Button', callbackData: 'wiz_bc_med_btn:shop_now', iconKey: 'PACKAGE' })],
          [makeAdminButton({ text: '🔗 Custom Button', callbackData: 'wiz_bc_med_btn:custom', iconKey: 'KEY' })],
          [makeAdminButton({ text: '➡️ No Button (Skip)', callbackData: 'wiz_bc_med_btn:none', iconKey: 'CHECK' })],
          [
            makeAdminButton({ text: '« Back', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
            makeAdminButton({ text: 'Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
          ],
        ],
      },
    }
  );
  return true;
}

/**
 * Prepares and renders the faithful preview and confirmation view
 */
async function renderPreviewConfirmView(session: WizardSession, adminId: number): Promise<AdminView> {
  session.step = 'preview_confirm';
  session.updatedAt = Date.now();

  const button: BroadcastButtonConfig | undefined =
    session.type === 'text_custom_button' || session.button_label
      ? {
          label: session.button_label || 'Shop Now',
          url: session.button_url || getStoreUrl(),
        }
      : undefined;

  // Create or update draft campaign in DataStore
  const { campaign, preview } = await BroadcastService.createCampaign(adminId, {
    type: session.type,
    audience: 'all',
    text: session.text,
    media_type: session.media_type,
    media_url: session.media_url,
    button,
  });

  session.campaignId = campaign.id;

  const typeNames: Record<BroadcastType, string> = {
    text_only: 'Text Only',
    text_shop_now: 'Text + Shop Now',
    text_custom_button: 'Text + Custom Button',
    media_caption: 'Media + Caption',
  };

  let previewText =
    `👁️ <b>BROADCAST PREVIEW & CONFIRMATION</b>\n\n` +
    `• Type: <b>${typeNames[session.type]}</b>\n` +
    `• Target Audience: <b>All Registered Customers (${preview.target_count} users)</b>\n\n` +
    `────────── <b>PREVIEW</b> ──────────\n`;

  if (session.media_type && session.media_url) {
    previewText += `🖼️ [${session.media_type.toUpperCase()}: ${session.media_url.startsWith('https://') ? session.media_url : 'Uploaded Telegram File'}]\n\n`;
  }

  if (session.text) {
    previewText += `${session.text}\n\n`;
  }

  if (session.type === 'text_shop_now') {
    previewText += `[ 🛍️ Shop Now ] ➔ <code>${getStoreUrl()}</code>\n`;
  } else if (button) {
    previewText += `[ ${button.label} ] ➔ <code>${button.url}</code>\n`;
  }

  previewText +=
    `──────────────────────────\n\n` +
    `⚠️ <b>Notice:</b> Once confirmed, delivery will begin immediately across all eligible customers. This cannot be undone.`;

  return {
    text: previewText,
    replyMarkup: {
      inline_keyboard: [
        [
          makeAdminButton({ text: '🚀 Confirm Send', callbackData: 'wiz_bc_confirm', iconKey: 'LIGHTNING' }),
        ],
        [
          makeAdminButton({ text: '« Back / Edit', callbackData: 'wiz_bc_back', iconKey: 'BACK' }),
          makeAdminButton({ text: '❌ Cancel', callbackData: 'wiz_bc_cancel', iconKey: 'ALERT' }),
        ],
      ],
    },
  };
}
