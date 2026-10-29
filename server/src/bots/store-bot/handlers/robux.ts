import { Context, Markup } from 'telegraf';
import { RobuxService, RobloxAccountInfo, RobuxOrder } from '../../../services/robux.service';
import { tgEmoji, formatTelegramHtml } from '../index';
import { cb, urlBtn } from '../keyboards';
import { DataStore } from '../../../database/data-store';
import { isMessageNotModifiedError } from './orders';
import { KHPayService } from '../../../services/khpay.service';
import QRCode from 'qrcode';

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
  confirmationChecked?: boolean;
  buyerAge18Confirmed?: boolean;
  buyerUnder18?: boolean;
  orderCode?: string;
  isGeneratingPayment?: boolean;
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
    policyNoticeText: (username: string, amount: number, price?: number) => {
      const p = price !== undefined ? price.toFixed(2) : ((amount / 1000) * 3.5).toFixed(2);
      return (
        `👤 <b>Confirmed Recipient:</b> <code>${username}</code>\n` +
        `💎 <b>Selected Robux Package:</b> ${amount.toLocaleString()} Robux\n` +
        `💵 <b>Total Price:</b> $${p} USD\n\n` +
        `🛡️ <b>Robux Top-Up Policy & Safety Notice:</b>\n` +
        `• This store delivers Robux top-ups directly to your verified Roblox account (<code>${username}</code>).\n\n` +
        `Press <b>Pay Now</b> to generate your secure KHQR payment code:`
      );
    },
    paymentDisabledNotice:
      '🛡️ <b>Payment Notice:</b> Please complete your payment using the generated KHQR code or visit official Roblox channels at roblox.com/upgrades/robux.',
    cancelledNotice: 'Robux request cancelled.',
    ageConfirmTitle: 'BUYER AGE CONFIRMATION',
    ageConfirmDesc: (amount: number, username: string) =>
      `👤 <b>Confirmed Recipient:</b> <code>${username}</code>\n` +
      `💎 <b>Robux Package:</b> ${amount.toLocaleString()} R$\n\n` +
      `🛡️ <b>Account Tiers Overview:</b>\n` +
      `• <b>Roblox Kids (Ages 5–8 / Under 9)</b>: Cannot purchase\n` +
      `• <b>Roblox Select (Ages 9–15)</b>: Cannot purchase\n` +
      `• <b>Unchecked Accounts</b>: Cannot purchase\n` +
      `• <b>Roblox Standard (Ages 16+ / Age-Verified)</b>: Eligible to purchase\n\n` +
      `⚠️ <b>Important Notice (No Refund):</b>\n` +
      `If your account falls under an ineligible tier and you buy wrong, orders are <b>strictly non-refundable (No Refund)</b>.\n\n` +
      `Press <b>Confirm</b> to proceed to the safety & policy notice:`,
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
    policyNoticeText: (username: string, amount: number, price?: number) => {
      const p = price !== undefined ? price.toFixed(2) : ((amount / 1000) * 3.5).toFixed(2);
      return (
        `👤 <b>គណនីទទួល:</b> <code>${username}</code>\n` +
        `💎 <b>កញ្ចប់ Robux:</b> ${amount.toLocaleString()} Robux\n` +
        `💵 <b>តម្លៃសរុប:</b> $${p} USD\n\n` +
        `🛡️ <b>គោលការណ៍បញ្ចូល Robux Top-Up:</b>\n` +
        `• ហាងនេះផ្តល់សេវាបញ្ចូលទឹកប្រាក់ Robux ទៅកាន់គណនី Roblox របស់អ្នកដោយផ្ទាល់ (<code>${username}</code>)។\n\n` +
        `សូមចុច <b>Pay Now</b> ដើម្បីបង្កើតកូដទូទាត់ KHQR:`
      );
    },
    paymentDisabledNotice:
      '🛡️ <b>សេចក្តីជូនដំណឹងអំពីការទូទាត់:</b> សូមបំពេញការទូទាត់តាមរយៈកូដ KHQR ឬទិញតាមបណ្តាញផ្លូវការ roblox.com/upgrades/robux។',
    cancelledNotice: 'បានបោះបង់ការស្នើសុំ Robux។',
    ageConfirmTitle: 'ការបញ្ជាក់អាយុរបស់អ្នកទិញ',
    ageConfirmDesc: (amount: number, username: string) =>
      `👤 <b>គណនីទទួល:</b> <code>${username}</code>\n` +
      `💎 <b>កញ្ចប់ Robux:</b> ${amount.toLocaleString()} R$\n\n` +
      `🛡️ <b>Account Tiers Overview:</b>\n\n` +
      `• <b>Roblox Kids (Ages 5–8 / Under 9)</b>: មិនអាចទិញបានទេ\n` +
      `• <b>Roblox Select (Ages 9–15)</b>: មិនអាចទិញបានទេ\n` +
      `• <b>Unchecked Accounts</b>: មិនអាចទិញបានទេ\n` +
      `• <b>Roblox Standard (Ages 16+ / Age-Verified)</b>: អាចទិញបាន\n\n` +
      `⚠️ <b>សេចក្តីបញ្ជាក់សំខាន់ (No Refund):</b>\n` +
      `ប្រភេទគណនីដែលមិនអាចទិញបាន ប្រសិនបើអ្នកទិញខុស ខាងយើងខ្ញុំ<b>មិនមានការបង្វិលប្រាក់សងវិញជាដាច់ខាត (No Refund)</b>។\n\n` +
      `សូមចុច <b>Confirm</b> ដើម្បីបន្តទៅកាន់សេចក្តីជូនដំណឹងអំពីសុវត្ថិភាព:`,
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
  session.confirmationChecked = false; // Required checkbox starts unchecked

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
  const eligibility = RobuxService.checkEligibility(account);
  const eligibilityNotice = eligibility.isEligible
    ? (lang === 'km'
        ? `• <b>សិទ្ធិទិញ៖</b> ✅ អាចទិញបាន (គណនីស្តង់ដារផ្ទៀងផ្ទាត់អាយុ)\n`
        : `• <b>Eligibility:</b> ✅ Eligible (Age-Verified Standard Account)\n`)
    : (lang === 'km'
        ? `• <b>សិទ្ធិទិញ៖</b> ❌ មិនអាចទិញបាន (${eligibility.reason})\n`
        : `• <b>Eligibility:</b> ❌ Ineligible (${eligibility.reason})\n`);

  const confirmationNotice =
    lang === 'km'
      ? `\n☑️ <b>ការបញ្ជាក់៖</b> [ មិនទាន់ធីក ]\n<i>ខ្ញុំបញ្ជាក់ថានេះពិតជាគណនីទទួលរបស់ខ្ញុំពិតប្រាកដ ហើយយល់ព្រមថាការបញ្ចូល Robux មិនអាចបង្វិលប្រាក់វិញបានទេបន្ទាប់ពីបានប្រគល់រួច។</i>\n\n`
      : `\n☑️ <b>Confirmation:</b> [ UNCHECKED ]\n<i>I confirm this is my exact recipient account and understand Robux top-ups are non-refundable once delivered, subject to applicable law.</i>\n\n`;

  const caption =
    `${check} <b>${t.profileReviewTitle}</b>\n\n` +
    `• ${t.usernameLabel}: <code>${account.username}</code>\n` +
    `• ${t.displayNameLabel}: <b>${account.displayName}</b>\n` +
    `• ${t.userIdLabel}: <code>${account.userId}</code>\n` +
    (createdStr ? `• ${t.createdDateLabel}: <b>${createdStr}</b>\n` : '') +
    eligibilityNotice +
    confirmationNotice +
    `${t.confirmNotice}`;

  // The account-confirmation screen has exactly two buttons: Confirm and Back Home
  const keyboard = Markup.inlineKeyboard([
    [cb('Confirm', 'cb_rbx_confirm_account', 'CHECK')],
    [cb('Back Home', 'cb_main_menu', 'HOME')],
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
    try {
      await ctx.answerCbQuery('Session expired. Please review your account again.', { show_alert: true });
    } catch {}
    return handleRobuxMenu(ctx);
  }

  const lang = getLang(telegramId);
  const isKm = lang === 'km';

  // 1. Roblox account eligibility: Roblox Kids, Roblox Select, and Unchecked / not age-verified accounts must not purchase Robux
  const eligibility = RobuxService.checkEligibility(session.robloxInfo);
  if (!eligibility.isEligible) {
    const errorMsg =
      eligibility.reason ||
      (isKm
        ? 'គណនីមិនមានសិទ្ធិ: គណនី Roblox Kids, Roblox Select និងគណនីមិនទាន់ផ្ទៀងផ្ទាត់អាយុ មិនអាចទិញ Robux បានទេ។'
        : 'Ineligible Account: Roblox Kids, Roblox Select, and Unchecked / not age-verified accounts must not purchase Robux.');
    try {
      await ctx.answerCbQuery(errorMsg, { show_alert: true });
    } catch {}
    return;
  }

  // 2. Confirmed profile
  session.confirmationChecked = true;
  session.state = 'account_confirmed';

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
    cb('Back Home', 'cb_main_menu', 'HOME'),
  ]);

  const keyboard = Markup.inlineKeyboard(buttons);

  await sendOrEditRobuxMessage(ctx, text, keyboard);
}

/**
 * Step 4: Handle Pack Selection -> Enforce Age Confirmation Screen First
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
    try {
      await ctx.answerCbQuery('Please review and confirm your Roblox profile first.', {
        show_alert: true,
      });
    } catch {}
    return handleRobuxMenu(ctx);
  }

  const stock = await RobuxService.getStockConfig();
  const availableRobux = Math.max(0, stock.total_balance - stock.reserved_balance);

  if (availableRobux < denomination) {
    const lang = getLang(telegramId);
    try {
      await ctx.answerCbQuery(I18N[lang].soldOutAlert(denomination), { show_alert: true });
    } catch {}
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
      [cb('Confirm', 'cb_rbx_confirm_age', 'CHECK')],
      [cb('Back Home', 'cb_main_menu', 'HOME')],
    ]);

    await sendOrEditRobuxMessage(ctx, text, keyboard);
    return;
  }

  session.state = 'amount_selected';

  const lang = getLang(telegramId);
  const t = I18N[lang];
  const shield = tgEmoji('SHIELD', '🛡️');
  const priceUsd = Number(((denomination / 1000) * stock.rate_per_1000).toFixed(2));

  const text =
    `${shield} <b>${t.policyGateTitle}</b>\n\n` +
    `${t.policyNoticeText(session.robloxInfo.username, denomination, priceUsd)}`;

  const keyboard = Markup.inlineKeyboard([
    [cb('Pay Now', 'cb_rbx_pay_now', 'CARD')],
    [cb('Back Home', 'cb_main_menu', 'HOME')],
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
  session.confirmationChecked = true;
  session.buyerUnder18 = false;
  session.state = 'amount_selected';

  const denomination = session.selectedAmount || 100;
  const stock = await RobuxService.getStockConfig();
  const priceUsd = Number(((denomination / 1000) * stock.rate_per_1000).toFixed(2));

  const lang = getLang(telegramId);
  const t = I18N[lang];
  const shield = tgEmoji('SHIELD', '🛡️');

  const text =
    `${shield} <b>${t.policyGateTitle}</b>\n\n` +
    `${t.policyNoticeText(session.robloxInfo.username, denomination, priceUsd)}`;

  const keyboard = Markup.inlineKeyboard([
    [cb('Pay Now', 'cb_rbx_pay_now', 'CARD')],
    [cb('Back Home', 'cb_main_menu', 'HOME')],
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
 * Step 9: Generate Order-Specific Payment QR on "Pay Now" Press
 * Step 10: Prevents duplicate orders or charges from repeated button presses.
 */
export async function handleRobuxPayNow(ctx: Context) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const session = getRobuxSession(telegramId);
  const lang = getLang(telegramId);
  const isKm = lang === 'km';

  // Step 10: Prevent duplicate orders from repeated button presses
  if (session.isGeneratingPayment) {
    try {
      await ctx.answerCbQuery(isKm ? 'កំពុងបង្កើតកូដទូទាត់...' : 'Generating payment QR, please wait...');
    } catch {}
    return;
  }

  // If order already created for this session, display existing order without creating duplicate
  if (session.orderCode) {
    const existingOrder = await RobuxService.getOrderByCode(session.orderCode);
    if (existingOrder) {
      try {
        await ctx.answerCbQuery(isKm ? 'ការបញ្ជាទិញមានរួចហើយ' : 'Order already created. Displaying QR code...');
      } catch {}
      return sendPaymentQrMessage(ctx, existingOrder, lang);
    }
  }

  // Server & session validation — reject unconfirmed / ineligible accounts
  if (
    !session.robloxInfo ||
    !session.selectedAmount ||
    (!session.confirmationChecked && !session.buyerAge18Confirmed)
  ) {
    try {
      await ctx.answerCbQuery(
        isKm ? 'សូមបញ្ជាក់គណនីរបស់អ្នកជាមុនសិន។' : 'Account confirmation is required before payment.',
        { show_alert: true }
      );
    } catch {}
    return handleRobuxMenu(ctx);
  }

  const eligibility = RobuxService.checkEligibility(session.robloxInfo);
  if (!eligibility.isEligible) {
    try {
      await ctx.answerCbQuery(
        eligibility.reason || 'Roblox Kids, Roblox Select, and unverified accounts cannot purchase Robux.',
        { show_alert: true }
      );
    } catch {}
    return handleRobuxMenu(ctx);
  }

  session.isGeneratingPayment = true;
  try {
    try {
      await ctx.answerCbQuery(isKm ? 'កំពុងបង្កើតកូដទូទាត់...' : 'Generating order and payment QR...');
    } catch {}

    const orderRes = await RobuxService.createOrder({
      telegramId: String(telegramId),
      robloxUsername: session.robloxInfo.username,
      robloxUserId: String(session.robloxInfo.userId),
      robuxAmount: session.selectedAmount,
    });

    if (!orderRes.success || !orderRes.order) {
      session.isGeneratingPayment = false;
      const errMsg = orderRes.error === 'INSUFFICIENT_ROBUX_STOCK'
        ? (isKm ? 'អស់ស្តុក Robux ហើយ' : 'Insufficient Robux in shared stock pool.')
        : (isKm ? 'បរាជ័យក្នុងការបង្កើតការបញ្ជាទិញ' : 'Failed to create Robux order.');
      try {
        await ctx.answerCbQuery(errMsg, { show_alert: true });
      } catch {}
      return;
    }

    const order = orderRes.order;
    session.orderCode = order.order_code;

    // Generate KHQR Payment via KHPayService
    let qrPayload = `KHPAY:ROBUX:${order.order_code}:${order.price_usd}`;
    try {
      const khqr = await KHPayService.generateKHQRPayment({
        orderId: order.id,
        orderNumber: order.order_code,
        amount: order.price_usd,
        currency: 'USD',
        validityMinutes: 10,
      });
      if (khqr?.qr_payload) {
        qrPayload = khqr.qr_payload;
      }
      DataStore.savePayment({
        id: khqr.transaction_id || khqr.md5_hash || order.order_code,
        order_id: order.id,
        customer_id: String(telegramId),
        provider: 'KHQR / Bakong',
        currency: 'USD',
        amount: order.price_usd,
        qr_payload: khqr.qr_payload,
        qr_image_url: khqr.qr_image_url,
        md5_hash: khqr.md5_hash,
        bakong_deep_link: khqr.bakong_deep_link,
        aba_deep_link: khqr.aba_deep_link,
        status: 'pending',
        transaction_reference: khqr.transaction_id || null,
        expires_at: khqr.expires_at,
        expires_in: khqr.expires_in,
        provider_expires_in: khqr.expires_in,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (paymentErr: any) {
      console.warn('[handleRobuxPayNow] KHPay payment generation warning:', paymentErr?.message);
    }

    await sendPaymentQrMessage(ctx, order, lang, qrPayload);
  } catch (err: any) {
    console.error('[handleRobuxPayNow error]:', err?.message);
    try {
      await ctx.answerCbQuery(isKm ? 'មានបញ្ហាក្នុងការបង្កើតកូដទូទាត់' : 'Error generating payment QR.', { show_alert: true });
    } catch {}
  } finally {
    session.isGeneratingPayment = false;
  }
}

async function sendPaymentQrMessage(
  ctx: Context,
  order: RobuxOrder,
  lang: 'en' | 'km',
  qrPayload?: string
): Promise<void> {
  const isKm = lang === 'km';
  const diamond = tgEmoji('DIAMOND', '💎');

  const caption =
    `${diamond} <b>${isKm ? 'ការទូទាត់ ROBUX' : 'ROBUX PAYMENT'} — #${order.order_code}</b>\n\n` +
    `👤 <b>${isKm ? 'គណនីទទួល' : 'Recipient'}:</b> <code>@${order.roblox_username}</code>\n` +
    `💎 <b>${isKm ? 'ចំនួន Robux' : 'Amount'}:</b> ${order.robux_amount.toLocaleString()} Robux\n` +
    `💵 <b>${isKm ? 'តម្លៃសរុប' : 'Total Due'}:</b> $${order.price_usd.toFixed(2)} USD\n` +
    `⏱️ <b>${isKm ? 'សុពលភាព' : 'Expires In'}:</b> 10 ${isKm ? 'នាទី' : 'Minutes'}\n\n` +
    `📱 <b>${isKm ? 'ការណែនាំអំពីការទូទាត់' : 'Payment Instructions'}:</b>\n` +
    `${isKm ? 'សូមស្កេនកូដ KHQR នេះតាមរយៈ Bakong ឬកម្មវិធីធនាគារនានា (ABA, ACLEDA...) ដើម្បីទូទាត់ប្រាក់។' : 'Scan this KHQR code with Bakong or any Cambodian mobile banking app to complete payment.'}\n\n` +
    `<i>${isKm ? 'ការបញ្ចូល Robux នឹងត្រូវបានបំពេញបន្ទាប់ពីការទូទាត់បានជោគជ័យ។' : 'Your Robux top-up will be processed once payment is confirmed.'}</i>`;

  const keyboard = Markup.inlineKeyboard([
    [cb('Check Payment Status', `cb_rbx_check_${order.order_code}`, 'REFRESH')],
    [cb('Back Home', 'cb_main_menu', 'HOME')],
  ]);

  const payload = qrPayload || `KHPAY:ROBUX:${order.order_code}:${order.price_usd}`;

  try {
    const qrBuffer = await QRCode.toBuffer(payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    if (typeof (ctx as any).replyWithPhoto === 'function') {
      await (ctx as any).replyWithPhoto(
        { source: qrBuffer },
        {
          caption: formatTelegramHtml(caption),
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
      return;
    }
  } catch (err: any) {
    console.warn('[sendPaymentQrMessage] QR buffer generation error:', err?.message);
  }

  // Fallback to text message
  await sendOrEditRobuxMessage(ctx, caption, keyboard);
}

/**
 * Handle Payment Trigger (Gated & Disabled by Policy)
 */
export async function handleDisabledPayment(ctx: Context) {
  return handleRobuxPayNow(ctx);
}
