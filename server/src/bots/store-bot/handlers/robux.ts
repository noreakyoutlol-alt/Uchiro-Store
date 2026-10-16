import { Context, Markup } from 'telegraf';
import { RobuxService, RobloxAccountInfo } from '../../../services/robux.service';
import { tgEmoji, formatTelegramHtml } from '../index';
import { cb, urlBtn } from '../keyboards';
import { adminBot } from '../../admin-bot';

// Session state storage for multi-step Robux checkout
interface RobuxUserSession {
  state: 'idle' | 'awaiting_username' | 'confirming_profile';
  selectedAmount?: number;
  robloxInfo?: RobloxAccountInfo;
  orderCode?: string;
}

const userSessions = new Map<number, RobuxUserSession>();

export function getRobuxSession(telegramId: number): RobuxUserSession {
  if (!userSessions.has(telegramId)) {
    userSessions.set(telegramId, { state: 'idle' });
  }
  return userSessions.get(telegramId)!;
}

export function clearRobuxSession(telegramId: number): void {
  userSessions.delete(telegramId);
}

/**
 * Handle Buy Robux Menu Display
 */
export async function handleRobuxMenu(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const supportUsername = (process.env.SUPPORT_TELEGRAM_USERNAME || 'uchirosupport').replace(/^@/, '');
  const stock = await RobuxService.getStockConfig();

  // Compliance gate: Direct third-party Robux transfer held pending platform licensing verification
  if (!stock.is_active) {
    const text =
      `💎 <b>BUY ROBUX SERVICES</b>\n\n` +
      `🛡️ <b>Compliance Notice: Direct Fulfillment Verification in Progress</b>\n\n` +
      `In adherence to digital asset platform terms of service and Roblox commercial guidelines, direct automated third-party Robux resale or transfer flows require official authorized distribution clearance.\n\n` +
      `Direct in-chat transfers are temporarily held pending platform compliance clearance. You may browse our full verified catalog of accounts and items in the Store Mini App or contact support.\n\n` +
      `💬 <b>Contact Support:</b> https://t.me/${supportUsername}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url('💬 Contact Support', `https://t.me/${supportUsername}`)],
      [Markup.button.callback('🏠 Back Home', 'cb_main_menu')],
    ]);

    try {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(formatTelegramHtml(text), {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } else {
        await ctx.reply(formatTelegramHtml(text), {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }
    } catch {
      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
    return;
  }

  const tiers = RobuxService.calculateTiers(stock);

  const diamond = tgEmoji('DIAMOND', '💎');

  let text =
    `${diamond} <b>BUY ROBUX (INSTANT DELIVERY)</b>\n\n` +
    `📦 <b>Current Shared Stock Pool:</b> ${stock.total_balance - stock.reserved_balance} R$\n` +
    `💵 <b>Current Rate:</b> $${stock.rate_per_1000.toFixed(2)} per 1,000 R$\n\n` +
    `<i>Choose your desired Robux pack below:</i>`;

  const buttons: any[] = [];
  for (let i = 0; i < tiers.length; i += 2) {
    const row: any[] = [];
    const t1 = tiers[i];
    if (t1) {
      const label = t1.is_sold_out
        ? `${t1.denomination} R$ (SOLD OUT)`
        : `${t1.denomination} R$ — $${t1.price_usd.toFixed(2)}`;
      row.push(Markup.button.callback(label, `cb_rbx_pack_${t1.denomination}`));
    }

    const t2 = tiers[i + 1];
    if (t2) {
      const label = t2.is_sold_out
        ? `${t2.denomination} R$ (SOLD OUT)`
        : `${t2.denomination} R$ — $${t2.price_usd.toFixed(2)}`;
      row.push(Markup.button.callback(label, `cb_rbx_pack_${t2.denomination}`));
    }
    buttons.push(row);
  }

  buttons.push([Markup.button.callback('🏠 Back Home', 'cb_main_menu')]);

  const keyboard = Markup.inlineKeyboard(buttons);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err: any) {
    await ctx.reply(formatTelegramHtml(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  }
}

/**
 * Handle Denomination Selection
 */
export async function handleSelectPack(ctx: Context, denomination: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const stock = await RobuxService.getStockConfig();
  const availableRobux = stock.total_balance - stock.reserved_balance;

  if (availableRobux < denomination) {
    await ctx.answerCbQuery(
      `❌ ${denomination} Robux is currently sold out! Please select a smaller pack.`,
      { show_alert: true }
    );
    return;
  }

  const session = getRobuxSession(telegramId);
  session.state = 'awaiting_username';
  session.selectedAmount = denomination;

  const priceUsd = Number(((denomination / 1000) * stock.rate_per_1000).toFixed(2));
  const diamond = tgEmoji('DIAMOND', '💎');

  const text =
    `${diamond} <b>You selected: ${denomination} Robux ($${priceUsd.toFixed(2)})</b>\n\n` +
    `👤 Please type and send your exact <b>Roblox Username</b> (NOT display name):\n` +
    `<i>Example: builderman</i>\n\n` +
    `⚠️ <b>Security Notice:</b> We will verify your avatar and account age. We will <b>NEVER</b> ask for your password or cookies.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('❌ Cancel', 'cb_rbx_cancel')],
  ]);

  await ctx.editMessageText(formatTelegramHtml(text), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}

/**
 * Handle Username Input text message
 */
export async function handleRobuxUsernameInput(ctx: Context, text: string): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const session = getRobuxSession(telegramId);
  if (session.state !== 'awaiting_username' || !session.selectedAmount) {
    return false;
  }

  const username = text.trim();
  if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    await ctx.reply(
      '❌ <b>Invalid Roblox Username format!</b>\nRoblox usernames must be between 3 and 20 characters and contain only letters, numbers, and underscores.\n\nPlease try again:',
      { parse_mode: 'HTML' }
    );
    return true;
  }

  const statusMsg = await ctx.reply('🔍 <i>Verifying Roblox account with Roblox API...</i>', {
    parse_mode: 'HTML',
  });

  const account = await RobuxService.resolveRobloxUser(username);
  if (!account) {
    await ctx.reply(
      `❌ <b>Roblox Account Not Found!</b>\n` +
      `We could not find any active Roblox account with the username: <code>${username}</code>.\n\n` +
      `Please check the spelling and try sending your username again, or click cancel:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cb_rbx_cancel')],
        ]),
      }
    );
    return true;
  }

  session.state = 'confirming_profile';
  session.robloxInfo = account;

  const stock = await RobuxService.getStockConfig();
  const priceUsd = Number(((session.selectedAmount / 1000) * stock.rate_per_1000).toFixed(2));

  const caption =
    `✅ <b>ROBLOX ACCOUNT FOUND!</b>\n\n` +
    `👤 <b>Username:</b> <code>${account.username}</code>\n` +
    `🏷️ <b>Display Name:</b> ${account.displayName}\n` +
    `🆔 <b>User ID:</b> <code>${account.userId}</code>\n` +
    (account.accountAgeDays !== undefined ? `📅 <b>Account Age:</b> ${account.accountAgeDays} days\n` : '') +
    `\n💎 <b>Order:</b> ${session.selectedAmount} Robux ($${priceUsd.toFixed(2)})\n\n` +
    `⚠️ <b>Please verify carefully:</b> Is this your public Roblox profile?`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Confirm My Username', 'cb_rbx_confirm')],
    [Markup.button.callback('🔄 Enter Different Username', `cb_rbx_pack_${session.selectedAmount}`)],
    [Markup.button.callback('🔙 Back to Main Menu', 'cb_back_home')],
    [Markup.button.callback('❌ Cancel', 'cb_rbx_cancel')],
  ]);

  if (account.avatarUrl) {
    try {
      await ctx.replyWithPhoto(account.avatarUrl, {
        caption: formatTelegramHtml(caption),
        parse_mode: 'HTML',
        ...keyboard,
      });
      return true;
    } catch {}
  }

  await ctx.reply(formatTelegramHtml(caption), {
    parse_mode: 'HTML',
    ...keyboard,
  });
  return true;
}

/**
 * Handle Account Confirmation -> Create Order & Show Payment
 */
export async function handleConfirmAccount(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  if (session.state !== 'confirming_profile' || !session.robloxInfo || !session.selectedAmount) {
    await ctx.answerCbQuery('Session expired. Please start over.', { show_alert: true });
    return handleRobuxMenu(ctx);
  }

  const { success, order, error } = await RobuxService.createOrder({
    telegramId: String(telegramId),
    robloxUsername: session.robloxInfo.username,
    robloxUserId: String(session.robloxInfo.userId),
    robuxAmount: session.selectedAmount,
  });

  if (!success || !order) {
    await ctx.answerCbQuery(
      error === 'INSUFFICIENT_ROBUX_STOCK'
        ? '❌ Sorry, stock was just reserved by another buyer. Please choose a different pack.'
        : '❌ Failed to create order. Please try again.',
      { show_alert: true }
    );
    clearRobuxSession(telegramId);
    return handleRobuxMenu(ctx);
  }

  session.orderCode = order.order_code;
  session.state = 'idle';

  const check = tgEmoji('CHECK', '✅');
  const receipt = tgEmoji('RECEIPT', '🧾');
  const lightning = tgEmoji('LIGHTNING', '⚡');

  const text =
    `${check} <b>ORDER CREATED SUCCESSFULLY!</b>\n\n` +
    `${receipt} <b>Order Code:</b> <code>${order.order_code}</code>\n` +
    `💎 <b>Amount:</b> ${order.robux_amount} Robux\n` +
    `👤 <b>Roblox Account:</b> <code>${order.roblox_username}</code>\n` +
    `💵 <b>Total Due:</b> $${order.price_usd.toFixed(2)}\n\n` +
    `⏳ <b>Stock is reserved for 15 minutes!</b>\n` +
    `Please proceed with payment below to receive your Robux:`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🇰🇭 Pay with KHQR / Bakong', `cb_rbx_pay_${order.order_code}`)],
    [Markup.button.callback('🔄 Check Payment Status', `cb_rbx_check_${order.order_code}`)],
    [Markup.button.callback('❌ Cancel Order', `cb_rbx_cancel_order_${order.order_code}`)],
  ]);

  await ctx.reply(formatTelegramHtml(text), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}

/**
 * Handle Order Cancellation
 */
export async function handleCancelRobuxOrder(ctx: Context, orderCode: string) {
  await RobuxService.releaseReservation(orderCode);
  clearRobuxSession(ctx.from!.id);
  await ctx.answerCbQuery('Order cancelled and reserved stock released.', { show_alert: true });
  return handleRobuxMenu(ctx);
}
