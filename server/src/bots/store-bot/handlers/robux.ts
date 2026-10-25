import { Context, Markup } from 'telegraf';
import { RobuxService, RobloxAccountInfo } from '../../../services/robux.service';
import { tgEmoji, formatTelegramHtml } from '../index';
import { cb, urlBtn } from '../keyboards';
import { DataStore } from '../../../database/data-store';
import { isMessageNotModifiedError } from './orders';

async function sendOrEditRobuxMessage(ctx: Context, text: string, keyboard: any): Promise<void> {
  const formattedHtml = formatTelegramHtml(text);
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err: any) {
    if (isMessageNotModifiedError(err)) return;
    if (
      err?.description?.includes('there is no text in the message to edit') ||
      err?.message?.includes('there is no text in the message to edit')
    ) {
      try {
        await ctx.reply(formattedHtml, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } catch {}
    }
  }
}

// Session state storage for multi-step Robux checkout
export interface RobuxUserSession {
  state:
    | 'idle'
    | 'awaiting_username'
    | 'reviewing_account'
    | 'account_confirmed'
    | 'awaiting_age_confirm'
    | 'age_confirmed'
    | 'amount_selected';
  robloxInfo?: RobloxAccountInfo;
  selectedAmount?: number;
  buyerAge18Confirmed?: boolean;
  buyerUnder18?: boolean;
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

// Localized strings (Page labels, account-review info, status & errors)
// Note: Button labels remain English as explicitly required by Prompt 11 Section 6.
const I18N = {
  en: {
    menuTitle: 'BUY ROBUX — ACCOUNT REVIEW FIRST',
    menuDesc:
      'Please enter your exact <b>Roblox Username</b> (NOT your display name) to review and verify your account profile before choosing any Robux amount:\n\n' +
      '<i>Example: builderman</i>\n\n' +
      '🛡️ <b>Security Safeguard:</b> We only query public profile data from official Roblox APIs. We will <b>NEVER</b> ask for your account password, session cookies, or 2FA codes.',
    invalidUsername:
      '❌ <b>Invalid Roblox Username format!</b>\nRoblox usernames must be between 3 and 20 characters and contain only letters, numbers, and underscores.\n\nPlease try again:',
    verifying: '🔍 <i>Verifying public Roblox profile via official Roblox API...</i>',
    notFound: (u: string) =>
      `❌ <b>Roblox Account Not Found!</b>\n` +
      `We could not find any active public Roblox account with the username: <code>${u}</code>.\n\n` +
      `Please check the spelling and try sending your exact username again, or click cancel:`,
    bannedAccount:
      '❌ <b>Account Ineligible:</b> This Roblox account is currently banned or inactive. Orders cannot be fulfilled for inactive accounts.',
    profileReviewTitle: 'ROBLOX ACCOUNT PROFILE REVIEW',
    usernameLabel: 'Username',
    displayNameLabel: 'Display Name',
    userIdLabel: 'User ID',
    createdDateLabel: 'Account Created',
    confirmNotice:
      '⚠️ <b>Important Profile Confirmation:</b>\n' +
      'Please carefully verify that this is your exact Roblox account before continuing to amount selection. Deliveries cannot be redirected once processed.\n\n' +
      '<i>Do you confirm this account profile?</i>',
    selectAmountTitle: 'SELECT ROBUX AMOUNT',
    confirmedAccountLabel: 'Confirmed Account',
    availableStockLabel: 'Available Shared Pool',
    rateLabel: 'Current Rate',
    selectPrompt: '<i>Choose your desired Robux amount below:</i>',
    soldOutAlert: (d: number) => `❌ ${d} Robux is currently sold out in the shared stock pool!`,
    policyGateTitle: 'ROBUX PURCHASE POLICY & SAFETY NOTICE',
    policyNoticeText: (username: string, amount: number) =>
      `👤 <b>Confirmed Account:</b> <code>${username}</code>\n` +
      `💎 <b>Selected Amount:</b> ${amount.toLocaleString()} Robux\n\n` +
      `⚠️ <b>Official Roblox Terms Notice:</b>\n` +
      `Roblox's official Terms of Use (effective May 19, 2026) specify that Robux may only be acquired through channels and mechanisms provided or approved by Roblox. Third-party services for selling, transferring, or purchasing Robux without official platform authorization are prohibited.\n\n` +
      `Because there is no documented Roblox-approved purchase or distribution integration in this project, real-money Robux purchases, QR payments, and automated fulfillments are <b>safely disabled</b> to protect your account and comply with platform terms.\n\n` +
      `👉 <b>Official Acquisition Route:</b>\n` +
      `Please acquire Robux or official Roblox Gift Cards directly from the official Roblox Store at <a href="https://www.roblox.com/upgrades/robux">roblox.com/upgrades/robux</a> or <a href="https://www.roblox.com/giftcards">roblox.com/giftcards</a>.\n\n` +
      `For game accounts, digital keys, and verified catalog items, visit our Store Mini App.`,
    paymentDisabledNotice:
      '🛡️ <b>Payment Disabled:</b> Direct third-party Robux purchase/payment is held safely disabled pending documented Roblox authorization.',
    cancelledNotice: 'Robux request cancelled.',
    ageConfirmTitle: 'BUYER AGE CONFIRMATION (MANDATORY SELF-DECLARATION)',
    ageConfirmDesc: (amount: number, username: string) =>
      `👤 <b>Confirmed Recipient:</b> <code>${username}</code>\n` +
      `💎 <b>Robux Package:</b> ${amount.toLocaleString()} R$\n\n` +
      `🛡️ <b>Age Requirement Notice:</b>\n` +
      `Buyers must be at least 18 years of age to purchase products on Uchiro Store.\n` +
      `<i>Note: This is an explicit self-declaration by the buyer and does not claim independent third-party legal age verification.</i>\n\n` +
      `Please confirm your age to proceed to final checkout:`,
    under18BlockedTitle: 'UNDER-18 PURCHASE BLOCKED',
    under18BlockedDesc:
      '❌ <b>Purchase Restricted:</b>\n\n' +
      'Buyers under 18 years of age are not permitted to complete purchases. Your transaction has been stopped.\n\n' +
      'If you are a minor, please ask a parent or legal guardian to complete authorized purchases directly via official Roblox channels.',
  },
  km: {
    menuTitle: 'ទិញ ROBUX — ផ្ទៀងផ្ទាត់គណនីជាមុន',
    menuDesc:
      'សូមបញ្ចូល <b>ឈ្មោះគណនី Roblox (Username)</b> របស់អ្នក (មិនមែន Display Name ទេ) ដើម្បីពិនិត្យ និងផ្ទៀងផ្ទាត់គណនីមុនពេលជ្រើសរើសចំនួន Robux:\n\n' +
      '<i>ឧទាហរណ៍: builderman</i>\n\n' +
      '🛡️ <b>សុវត្ថិភាពខ្ពស់:</b> យើងផ្ទៀងផ្ទាត់តែទិន្នន័យសាធារណៈពី Roblox API ប៉ុណ្ណោះ។ យើង <b>មិនដែល</b> សួររកលេខសម្ងាត់ (Password), Cookie ឬកូដ 2FA ឡើយ។',
    invalidUsername:
      '❌ <b>ទម្រង់ឈ្មោះគណនីមិនត្រឹមត្រូវ!</b>\nឈ្មោះ Roblox ត្រូវមានពី 3 ដល់ 20 តួអក្សរ (អក្សរ លេខ ឬ _ តែប៉ុណ្ណោះ)។\n\nសូមសាកល្បងម្តងទៀត:',
    verifying: '🔍 <i>កំពុងផ្ទៀងផ្ទាត់ទិន្នន័យសាធារណៈតាមរយៈ Roblox API...</i>',
    notFound: (u: string) =>
      `❌ <b>រកមិនឃើញគណនី Roblox ទេ!</b>\n` +
      `យើងរកមិនឃើញគណនីសកម្មណាមួយដែលមានឈ្មោះ: <code>${u}</code> ឡើយ។\n\n` +
      `សូមពិនិត្យអក្ខរាវិរុទ្ធ ហើយបញ្ចូលឈ្មោះម្តងទៀត ឬចុចបោះបង់:`,
    bannedAccount:
      '❌ <b>គណនីមិនមានសិទ្ធិ:</b> គណនី Roblox នេះត្រូវបានបិទ ឬផ្អាកដំណើរការ។ មិនអាចដំណើរការការបញ្ជាទិញបានទេ។',
    profileReviewTitle: 'ការពិនិត្យមើលគណនី ROBLOX',
    usernameLabel: 'ឈ្មោះគណនី (Username)',
    displayNameLabel: 'ឈ្មោះបង្ហាញ (Display Name)',
    userIdLabel: 'លេខសម្គាល់ (User ID)',
    createdDateLabel: 'កាលបរិច្ឆេទបង្កើត',
    confirmNotice:
      '⚠️ <b>ការបញ្ជាក់គណនីសំខាន់:</b>\n' +
      'សូមពិនិត្យឱ្យបានច្បាស់លាស់ថា នេះពិតជាគណនី Roblox របស់អ្នក មុនពេលបន្តទៅការជ្រើសរើសចំនួន Robux។\n\n' +
      '<i>តើអ្នកបញ្ជាក់ថាគណនីនេះត្រឹមត្រូវដែរឬទេ?</i>',
    selectAmountTitle: 'ជ្រើសរើសចំនួន ROBUX',
    confirmedAccountLabel: 'គណនីដែលបានបញ្ជាក់',
    availableStockLabel: 'ស្តុកដែលមានក្នុងប្រព័ន្ធ',
    rateLabel: 'តម្លៃបច្ចុប្បន្ន',
    selectPrompt: '<i>សូមជ្រើសរើសចំនួន Robux ខាងក្រោម:</i>',
    soldOutAlert: (d: number) => `❌ ${d} Robux ដាច់ស្តុកហើយក្នុងប្រព័ន្ធ!`,
    policyGateTitle: 'សេចក្តីជូនដំណឹងអំពីគោលការណ៍ និងសុវត្ថិភាព ROBUX',
    policyNoticeText: (username: string, amount: number) =>
      `👤 <b>គណនីដែលបានបញ្ជាក់:</b> <code>${username}</code>\n` +
      `💎 <b>ចំនួនដែលបានជ្រើសរើស:</b> ${amount.toLocaleString()} Robux\n\n` +
      `⚠️ <b>សេចក្តីជូនដំណឹងអំពីលក្ខខណ្ឌផ្លូវការរបស់ Roblox:</b>\n` +
      `លក្ខខណ្ឌប្រើប្រាស់ផ្លូវការរបស់ Roblox (ចូលជាធរមានថ្ងៃទី 19 ឧសភា 2026) ចែងថា Robux អាចទទួលបានតែតាមរយៈបណ្តាញ និងយន្តការដែលបានផ្តល់ ឬអនុម័តដោយ Roblox ប៉ុណ្ណោះ។ សេវាកម្មភាគីទីបីក្នុងការលក់ ផ្ទេរ ឬទិញ Robux ដោយគ្មានការអនុញ្ញាតត្រូវបានហាមឃាត់យ៉ាងតឹងរ៉ឹង។\n\n` +
      `ដោយសារប្រព័ន្ធនេះមិនមានកិច្ចព្រមព្រៀងចែកចាយផ្លូវការដែលបានអនុម័តពី Roblox ការទិញ Robux ដោយប្រាក់ពិត ការទូទាត់ QR និងការផ្ទេរស្វ័យប្រវត្តិត្រូវបាន <b>ផ្អាកដំណើរការដោយសុវត្ថិភាព</b> ដើម្បីការពារគណនីរបស់អ្នក។\n\n` +
      `👉 <b>មធ្យោបាយទិញផ្លូវការ:</b>\n` +
      `សូមទិញ Robux ឬកាត Roblox Gift Card ដោយផ្ទាល់ពី Roblox នៅ <a href="https://www.roblox.com/upgrades/robux">roblox.com/upgrades/robux</a> ឬ <a href="https://www.roblox.com/giftcards">roblox.com/giftcards</a>។`,
    paymentDisabledNotice:
      '🛡️ <b>ការទូទាត់ត្រូវបានបិទ:</b> ការទិញ Robux ត្រូវបានផ្អាកដំណើរការដោយសុវត្ថិភាព ដើម្បីអនុលោមតាមគោលការណ៍ផ្លូវការរបស់ Roblox។',
    cancelledNotice: 'បានបោះបង់ការស្នើសុំ Robux។',
    ageConfirmTitle: 'ការបញ្ជាក់អាយុរបស់អ្នកទិញ (ការប្រកាសផ្ទាល់ខ្លួន)',
    ageConfirmDesc: (amount: number, username: string) =>
      `👤 <b>គណនីទទួល:</b> <code>${username}</code>\n` +
      `💎 <b>កញ្ចប់ Robux:</b> ${amount.toLocaleString()} R$\n\n` +
      `🛡️ <b>សេចក្តីជូនដំណឹងអំពីលក្ខខណ្ឌអាយុ:</b>\n` +
      `អ្នកទិញត្រូវតែមានអាយុយ៉ាងតិច ១៨ ឆ្នាំឡើងទៅដើម្បីធ្វើការបញ្ជាទិញនៅលើ Uchiro Store។\n` +
      `<i>ចំណាំ៖ នេះជាការប្រកាសបញ្ជាក់ផ្ទាល់ខ្លួនរបស់អ្នកទិញ មិនមែនជាការផ្ទៀងផ្ទាត់ដោយភាគីទីបីឡើយ។</i>\n\n` +
      `សូមបញ្ជាក់អាយុរបស់អ្នកដើម្បីបន្តទៅការទូទាត់ប្រាក់ចុងក្រោយ:`,
    under18BlockedTitle: 'ការទិញត្រូវបានរារាំង (អាយុក្រោម ១៨ ឆ្នាំ)',
    under18BlockedDesc:
      '❌ <b>ការទិញត្រូវបានរារាំង:</b>\n\n' +
      'អ្នកទិញដែលមានអាយុក្រោម ១៨ ឆ្នាំមិនត្រូវបានអនុញ្ញាតឱ្យធ្វើការបញ្ជាទិញទេ។ ប្រតិបត្តិការរបស់អ្នកត្រូវបានបញ្ឈប់។\n\n' +
      'ប្រសិនបើអ្នកជាអនីតិជន សូមឱ្យឪពុកម្តាយ ឬអាណាព្យាបាលទិញដោយផ្ទាល់តាមរយៈបណ្តាញផ្លូវការរបស់ Roblox។',
  },
};

function getLang(telegramId?: number): 'en' | 'km' {
  if (!telegramId) return 'en';
  const pref = DataStore.getUserLanguagePreference(telegramId);
  return pref === 'km' ? 'km' : 'en';
}

/**
 * Step 1: Entry Point — Account Review First (Prompt 11 Section 4)
 * Demands Roblox Username before presenting any amount options.
 */
export async function handleRobuxMenu(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const lang = getLang(telegramId);
  const t = I18N[lang];

  // Initialize or reset session to awaiting_username
  const session = getRobuxSession(telegramId);
  session.state = 'awaiting_username';
  delete session.robloxInfo;
  delete session.selectedAmount;
  delete session.buyerAge18Confirmed;
  delete session.buyerUnder18;
  delete session.orderCode;

  const diamond = tgEmoji('DIAMOND', '💎');

  const text =
    `${diamond} <b>${t.menuTitle}</b>\n\n` +
    `${t.menuDesc}`;

  const keyboard = Markup.inlineKeyboard([
    [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
  ]);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Step 2: Handle Username Input Text Message
 * Resolves public profile via official Roblox API, validates eligibility, and requests confirmation.
 */
export async function handleRobuxUsernameInput(ctx: Context, text: string): Promise<boolean> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const session = getRobuxSession(telegramId);
  if (session.state !== 'awaiting_username') {
    return false;
  }

  const lang = getLang(telegramId);
  const t = I18N[lang];
  const username = text.trim();

  // Validate Roblox Username format strictly
  if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    await ctx.reply(formatTelegramHtml(t.invalidUsername), { parse_mode: 'HTML' });
    return true;
  }

  // Intermediate status indication
  try {
    await ctx.reply(formatTelegramHtml(t.verifying), { parse_mode: 'HTML' });
  } catch {}

  const account = await RobuxService.resolveRobloxUser(username);

  // Handle account not found or API failure — NEVER fabricate profile
  if (!account) {
    await ctx.reply(formatTelegramHtml(t.notFound(username)), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
        [cb('Cancel', 'cb_rbx_cancel', 'CROSS')],
      ]),
    });
    return true;
  }

  if (account.isBanned) {
    await ctx.reply(formatTelegramHtml(t.bannedAccount), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[cb('Cancel', 'cb_rbx_cancel', 'CROSS')]]),
    });
    return true;
  }

  // Account verified — transition to reviewing_account state
  session.state = 'reviewing_account';
  session.robloxInfo = account;

  let createdStr = '';
  if (account.createdDate) {
    try {
      createdStr = new Date(account.createdDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      createdStr = account.createdDate;
    }
  }

  const check = tgEmoji('CHECK', '✅');

  const caption =
    `${check} <b>${t.profileReviewTitle}</b>\n\n` +
    `• ${t.usernameLabel}: <code>${account.username}</code>\n` +
    `• ${t.displayNameLabel}: <b>${account.displayName}</b>\n` +
    `• ${t.userIdLabel}: <code>${account.userId}</code>\n` +
    (createdStr ? `• ${t.createdDateLabel}: <b>${createdStr}</b>\n` : '') +
    `\n${t.confirmNotice}`;

  // Button labels remain English as required
  const keyboard = Markup.inlineKeyboard([
    [cb('Confirm Profile & Select Amount', 'cb_rbx_confirm_account', 'CHECK')],
    [cb('Enter Different Username', 'cb_rbx_reenter_username', 'REFRESH')],
    [cb('Cancel', 'cb_rbx_cancel', 'CROSS')],
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
 * Step 3: Handle Account Profile Confirmation -> Show Amount Options (Prompt 11 Section 4)
 * Amount options are ONLY displayed AFTER the buyer confirms their verified profile.
 */
export async function handleConfirmAccountProfile(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  if (
    (session.state !== 'reviewing_account' &&
      session.state !== 'account_confirmed' &&
      session.state !== 'awaiting_age_confirm') ||
    !session.robloxInfo
  ) {
    await ctx.answerCbQuery('Session expired. Please review your account again.', { show_alert: true });
    return handleRobuxMenu(ctx);
  }

  session.state = 'account_confirmed';

  const lang = getLang(telegramId);
  const t = I18N[lang];

  const stock = await RobuxService.getStockConfig();
  const availableRobux = Math.max(0, stock.total_balance - stock.reserved_balance);
  const tiers = RobuxService.calculateTiers(stock);

  const diamond = tgEmoji('DIAMOND', '💎');

  const text =
    `${diamond} <b>${t.selectAmountTitle}</b>\n\n` +
    `👤 <b>${t.confirmedAccountLabel}:</b> <code>${session.robloxInfo.username}</code> (@${session.robloxInfo.displayName})\n` +
    `📦 <b>${t.availableStockLabel}:</b> ${availableRobux.toLocaleString()} R$\n` +
    `💵 <b>${t.rateLabel}:</b> $${stock.rate_per_1000.toFixed(2)} per 1,000 R$\n\n` +
    `${t.selectPrompt}`;

  const buttons: any[] = [];
  for (let i = 0; i < tiers.length; i += 2) {
    const row: any[] = [];
    const t1 = tiers[i];
    if (t1) {
      const label = t1.is_sold_out
        ? `${t1.denomination} R$ (SOLD OUT)`
        : `${t1.denomination} R$ — $${t1.price_usd.toFixed(2)}`;
      const callback = t1.is_sold_out
        ? `cb_rbx_soldout_${t1.denomination}`
        : `cb_rbx_pack_${t1.denomination}`;
      row.push(Markup.button.callback(label, callback));
    }

    const t2 = tiers[i + 1];
    if (t2) {
      const label = t2.is_sold_out
        ? `${t2.denomination} R$ (SOLD OUT)`
        : `${t2.denomination} R$ — $${t2.price_usd.toFixed(2)}`;
      const callback = t2.is_sold_out
        ? `cb_rbx_soldout_${t2.denomination}`
        : `cb_rbx_pack_${t2.denomination}`;
      row.push(Markup.button.callback(label, callback));
    }
    buttons.push(row);
  }

  buttons.push([
    cb('Enter Different Username', 'cb_rbx_reenter_username', 'REFRESH'),
    cb('Cancel', 'cb_rbx_cancel', 'CROSS'),
  ]);

  const keyboard = Markup.inlineKeyboard(buttons);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Step 4: Handle Amount Selection -> Policy Gate & Official Guidance (Prompt 11 Section 5)
 * Keeps real-money purchase safely disabled because no Roblox-approved distribution agreement exists.
 */
export async function handleSelectPack(ctx: Context, denomination: number) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  // Step 3: Mandatory Buyer Age Confirmation (18+ Self-Declaration; unchecked by default)
  if (session.buyerUnder18 === true) {
    return handleRobuxAgeUnder18(ctx);
  }

  if (session.state !== 'account_confirmed' || !session.robloxInfo) {
    await ctx.answerCbQuery('Please verify your Roblox account first.', { show_alert: true });
    return handleRobuxMenu(ctx);
  }

  const stock = await RobuxService.getStockConfig();
  const availableRobux = Math.max(0, stock.total_balance - stock.reserved_balance);

  if (availableRobux < denomination) {
    const lang = getLang(telegramId);
    await ctx.answerCbQuery(I18N[lang].soldOutAlert(denomination), { show_alert: true });
    return;
  }

  session.selectedAmount = denomination;

  if (session.buyerAge18Confirmed !== true) {
    session.state = 'awaiting_age_confirm';

    const lang = getLang(telegramId);
    const t = I18N[lang];
    const shield = tgEmoji('SHIELD', '🛡️');

    const text =
      `${shield} <b>${t.ageConfirmTitle}</b>\n\n` +
      `${t.ageConfirmDesc(denomination, session.robloxInfo.username)}`;

    const keyboard = Markup.inlineKeyboard([
      [cb('I am 18 or older (Self-Declaration)', 'cb_rbx_age_18_plus', 'CHECK')],
      [cb('I am under 18', 'cb_rbx_age_under_18', 'CROSS')],
      [cb('Back to Packages', 'cb_rbx_back_packs', 'BACK')],
      [cb('Cancel', 'cb_rbx_cancel', 'CROSS')],
    ]);

    await sendOrEditRobuxMessage(ctx, text, keyboard);
    return;
  }

  session.state = 'amount_selected';

  const lang = getLang(telegramId);
  const t = I18N[lang];
  const shield = tgEmoji('SHIELD', '🛡️');

  const text =
    `${shield} <b>${t.policyGateTitle}</b>\n\n` +
    `${t.policyNoticeText(session.robloxInfo.username, denomination)}`;

  const keyboard = Markup.inlineKeyboard([
    [urlBtn('Official Roblox Store', 'https://www.roblox.com/upgrades/robux', 'ROBUX')],
    [urlBtn('Official Gift Cards', 'https://www.roblox.com/giftcards', 'GIFT')],
    [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
  ]);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Step 3: Age Confirmation — User declares 18+ (Explicit Self-Declaration)
 */
export async function handleRobuxAgeConfirmed(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  if (!session.robloxInfo) {
    return handleRobuxMenu(ctx);
  }

  session.buyerAge18Confirmed = true;
  session.buyerUnder18 = false;
  session.state = 'amount_selected';

  const denomination = session.selectedAmount || 100;
  const lang = getLang(telegramId);
  const t = I18N[lang];
  const shield = tgEmoji('SHIELD', '🛡️');

  const text =
    `${shield} <b>${t.policyGateTitle}</b>\n\n` +
    `${t.policyNoticeText(session.robloxInfo.username, denomination)}`;

  const keyboard = Markup.inlineKeyboard([
    [urlBtn('Official Roblox Store', 'https://www.roblox.com/upgrades/robux', 'ROBUX')],
    [urlBtn('Official Gift Cards', 'https://www.roblox.com/giftcards', 'GIFT')],
    [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
  ]);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Step 3: Age Confirmation — User indicates under 18 (Purchase Blocked)
 */
export async function handleRobuxAgeUnder18(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  session.buyerUnder18 = true;
  session.buyerAge18Confirmed = false;
  session.state = 'idle';

  const lang = getLang(telegramId);
  const t = I18N[lang];
  const alert = tgEmoji('ALERT', '⚠️');

  const text =
    `${alert} <b>${t.under18BlockedTitle}</b>\n\n` +
    `${t.under18BlockedDesc}`;

  const keyboard = Markup.inlineKeyboard([
    [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
  ]);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Handle Sold-out pack click
 */
export async function handleSoldOutPack(ctx: Context, denomination: number) {
  const lang = getLang(ctx.from?.id);
  await ctx.answerCbQuery(I18N[lang].soldOutAlert(denomination), { show_alert: true });
}

/**
 * Handle Re-entering Username
 */
export async function handleReenterUsername(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const session = getRobuxSession(telegramId);
    session.state = 'awaiting_username';
    delete session.robloxInfo;
    delete session.selectedAmount;
  }
  return handleRobuxMenu(ctx);
}

/**
 * Handle Cancellation
 */
export async function handleCancelRobux(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    clearRobuxSession(telegramId);
  }
  try {
    await ctx.answerCbQuery('Robux request cancelled.', { show_alert: false });
  } catch {}
  return handleRobuxMenu(ctx);
}

/**
 * Handle Payment Trigger (Gated & Disabled by Policy)
 */
export async function handleDisabledPayment(ctx: Context) {
  const lang = getLang(ctx.from?.id);
  await ctx.answerCbQuery(
    '🛡️ Robux payment is safely disabled in compliance with Roblox Terms of Use. Please use official channels.',
    { show_alert: true }
  );
  await ctx.reply(formatTelegramHtml(I18N[lang].paymentDisabledNotice), {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [urlBtn('Official Gift Cards', 'https://www.roblox.com/giftcards', 'GIFT')],
      [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
    ]),
  });
}
