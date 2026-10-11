import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
import {
  buildGachaKeyboard,
  buildSubGachaKeyboard,
} from '../keyboards';
import { escapeHtml, isMessageNotModifiedError } from './orders';

export interface GachaLiveInfo {
  tickets: number;
  points: number;
  ticket_price_pts: number;
  top_mythical_item: string;
  top_legendary_item: string;
  mythical_drop_rate: number;
}

export async function fetchGachaLiveInfo(telegramId: number | string): Promise<GachaLiveInfo> {
  const tid = String(telegramId);
  const numId = Number(telegramId);

  let tickets = 0;
  let points = 0;
  const ticket_price_pts = 50;
  let top_mythical_item = '🍎 Kitsune Fruit Permanent (Jackpot)';
  let top_legendary_item = '⚔️ Dark Blade (Yoru) Account';
  let mythical_drop_rate = 1.5;

  // 1. Fetch user data from Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tid)
        .maybeSingle();

      if (userRow) {
        points = userRow.points ?? 0;
        tickets = (userRow.extra as any)?.gacha_tickets ?? 0;
      }
    } catch {
      // Graceful fallback
    }
  }

  // Fallback to DataStore
  if (!points) {
    const dsUser = DataStore.getTelegramUser(numId);
    const dsProfile = DataStore.getProfile(numId);
    if (dsUser) {
      points = dsUser.points || points;
    }
    if (dsProfile) {
      points = dsProfile.points || points;
      tickets = dsProfile.gacha_tickets || tickets;
    }
  }

  // Fetch pool prizes from DataStore
  try {
    const activePool = DataStore.getActiveGachaPool();
    if (activePool) {
      const poolPrizes = DataStore.getGachaPrizesByPoolId(activePool.id);
      const mythicalPrize = poolPrizes.find((p) => p.rarity === 'mythical');
      if (mythicalPrize) {
        top_mythical_item = `${mythicalPrize.icon || '🔴'} ${mythicalPrize.name} (Jackpot)`;
        if (mythicalPrize.drop_rate) {
          mythical_drop_rate = mythicalPrize.drop_rate;
        }
      }
      const legPrize = poolPrizes.find((p) => p.rarity === 'legendary');
      if (legPrize) {
        top_legendary_item = `${legPrize.icon || '🟣'} ${legPrize.name}`;
      }
    }
  } catch {}

  return {
    tickets,
    points,
    ticket_price_pts,
    top_mythical_item,
    top_legendary_item,
    mythical_drop_rate,
  };
}

/**
 * Handle Live Gacha Dashboard (cb_gacha_menu / /gacha)
 */
export async function handleGachaMenu(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const gacha = await fetchGachaLiveInfo(telegramId);
  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const text =
    `🎰 <b>UCHIRO MYTHICAL GACHA — ព័ត៌មានបច្ចុប្បន្នភាព</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>សំបុត្ររបស់អ្នក:</b> <code>${gacha.tickets}</code> សំបុត្រ\n` +
    `💎 <b>ពិន្ទុរបស់អ្នក:</b> <code>${gacha.points}</code> Pts\n` +
    `💰 <b>តម្លៃសំបុត្របច្ចុប្បន្ន:</b> <code>${gacha.ticket_price_pts}</code> Pts / សំបុត្រ\n\n` +
    `🏆 <b>រង្វាន់ធំក្នុង Pool:</b>\n` +
    `• 🔴 ${escapeHtml(gacha.top_mythical_item)}\n` +
    `• 🟣 ${escapeHtml(gacha.top_legendary_item)}\n` +
    `• ⚡ អត្រាឈ្នះ Mythical: <b>${gacha.mythical_drop_rate}%</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildGachaKeyboard(storeUrl, userLang);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Menu] Render warning:', err);
    }
  }
}

/**
 * Handle In-Bot Ticket Buy (cb_gacha_buy_ticket)
 */
export async function handleBuyGachaTicket(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const tid = String(telegramId);
  const numId = Number(telegramId);
  const TICKET_COST = 50;

  let currentPoints = 0;
  let currentTickets = 0;

  // Check Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tid)
        .maybeSingle();

      if (userRow) {
        currentPoints = userRow.points ?? 0;
        currentTickets = (userRow.extra as any)?.gacha_tickets ?? 0;
      }
    } catch {}
  }

  // Fallback check DataStore
  if (!currentPoints) {
    const dsUser = DataStore.getTelegramUser(numId);
    const dsProfile = DataStore.getProfile(numId);
    if (dsUser) currentPoints = dsUser.points || currentPoints;
    if (dsProfile) {
      currentPoints = dsProfile.points || currentPoints;
      currentTickets = dsProfile.gacha_tickets || currentTickets;
    }
  }

  if (currentPoints < TICKET_COST) {
    try {
      await ctx.answerCbQuery(
        `⚠️ ពិន្ទុរបស់អ្នកមិនគ្រប់គ្រាន់ទេ (ត្រូវការ ${TICKET_COST} Pts, អ្នកមាន ${currentPoints} Pts)`,
        { show_alert: true }
      );
    } catch {}
    return;
  }

  // Deduct points and credit ticket in Supabase
  let success = false;
  let newBalance = currentPoints - TICKET_COST;
  let newTickets = currentTickets + 1;

  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('adjust_points', {
        p_telegram_id: tid,
        p_delta: -TICKET_COST,
        p_reason: 'in_bot_gacha_ticket_purchase',
      });

      if (!rpcErr && rpcRes && (rpcRes as any).success) {
        newBalance = (rpcRes as any).points;
        // Update tickets in user extra
        await supabase
          .from('users')
          .update({
            extra: { gacha_tickets: newTickets },
            updated_at: new Date().toISOString(),
          })
          .eq('telegram_id', tid);
        success = true;
      }
    } catch {
      // Fallback to local
    }
  }

  // Update in DataStore
  const dsProfile = DataStore.getProfile(numId);
  if (dsProfile) {
    dsProfile.points = Math.max(0, dsProfile.points - TICKET_COST);
    dsProfile.gacha_tickets = (dsProfile.gacha_tickets || 0) + 1;
    newBalance = dsProfile.points;
    newTickets = dsProfile.gacha_tickets;
    success = true;
  }
  const dsUser = DataStore.getTelegramUser(numId);
  if (dsUser) {
    dsUser.points = newBalance;
  }

  // Show Toast Confirmation Alert
  try {
    await ctx.answerCbQuery(
      `🎉 ប្តូរសំបុត្រ Gacha បានជោគជ័យ! (+1 សំបុត្រ, -${TICKET_COST} Pts)\nសំបុត្រសរុប: ${newTickets} សន្លឹក`,
      { show_alert: true }
    );
  } catch {}

  // Refresh Gacha Dashboard with new numbers
  const gacha = await fetchGachaLiveInfo(telegramId);
  gacha.points = newBalance;
  gacha.tickets = newTickets;

  const text =
    `🎰 <b>UCHIRO MYTHICAL GACHA — ព័ត៌មានបច្ចុប្បន្នភាព</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>សំបុត្ររបស់អ្នក:</b> <code>${newTickets}</code> សំបុត្រ\n` +
    `💎 <b>ពិន្ទុរបស់អ្នក:</b> <code>${newBalance}</code> Pts\n` +
    `💰 <b>តម្លៃសំបុត្របច្ចុប្បន្ន:</b> <code>${gacha.ticket_price_pts}</code> Pts / សំបុត្រ\n\n` +
    `🏆 <b>រង្វាន់ធំក្នុង Pool:</b>\n` +
    `• 🔴 ${escapeHtml(gacha.top_mythical_item)}\n` +
    `• 🟣 ${escapeHtml(gacha.top_legendary_item)}\n` +
    `• ⚡ អត្រាឈ្នះ Mythical: <b>${gacha.mythical_drop_rate}%</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildGachaKeyboard(storeUrl, 'km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Buy Ticket] Render warning:', err);
    }
  }
}

/**
 * Handle View All Gacha Prizes (cb_gacha_prizes)
 */
export async function handleGachaPrizes(ctx: Context, storeUrl: string): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const activePool = DataStore.getActiveGachaPool();
  const poolPrizes = activePool ? DataStore.getGachaPrizesByPoolId(activePool.id) : [];

  let prizeList = '';
  if (poolPrizes.length > 0) {
    prizeList = poolPrizes
      .map((p) => {
        const rarityBadge =
          p.rarity === 'mythical'
            ? '🔴 Mythical'
            : p.rarity === 'legendary'
            ? '🟣 Legendary'
            : p.rarity === 'epic'
            ? '🔵 Epic'
            : p.rarity === 'rare'
            ? '🟢 Rare'
            : '⚪ Common';
        return `• <b>[${rarityBadge}]</b> ${escapeHtml(p.name)} (${p.drop_rate}%)`;
      })
      .join('\n');
  } else {
    prizeList =
      `• 🔴 <b>[Mythical]</b> Kitsune Fruit Permanent (1.5%)\n` +
      `• 🟣 <b>[Legendary]</b> Dark Blade (Yoru) Account (5.0%)\n` +
      `• 🔵 <b>[Epic]</b> Buddha Perm + Leopard (15.0%)\n` +
      `• 🟢 <b>[Rare]</b> Gamepass 2x Mastery Voucher (30.0%)\n` +
      `• ⚪ <b>[Common]</b> 20 Points Cashback (48.5%)`;
  }

  const text =
    `🏆 <b>បញ្ជីរង្វាន់ GACHA POOL បច្ចុប្បន្ន</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    prizeList + `\n\n` +
    `💡 <i>រង្វាន់គណនី និងកូដទាំងអស់នឹងត្រូវបញ្ជូនចូលទៅក្នុង 🎒 Vault របស់អ្នកភ្លាមៗ!</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubGachaKeyboard(storeUrl, 'km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Prizes] Render warning:', err);
    }
  }
}

/**
 * Handle Gacha Drop Rates / Odds (cb_gacha_odds)
 */
export async function handleGachaOdds(ctx: Context, storeUrl: string): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `⚡ <b>អត្រាធ្លាក់រង្វាន់ GACHA (OFFICIAL DROP RATES)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔴 <b>MYTHICAL (Jackpot):</b> <code>1.50%</code>\n` +
    `• ឱកាសឈ្នះ Account កម្រិតខ្ពស់ ឬ Perm Fruits កម្របំផុត\n\n` +
    `🟣 <b>LEGENDARY:</b> <code>5.00%</code>\n` +
    `• ឱកាសឈ្នះ Dark Blade, Godhuman Accounts\n\n` +
    `🔵 <b>EPIC:</b> <code>15.00%</code>\n` +
    `• Vouchers បញ្ចុះតម្លៃ 50% ឬ Fruit codes\n\n` +
    `🟢 <b>RARE:</b> <code>30.00%</code>\n` +
    `• Gamepass Codes, 2x Money & Mastery\n\n` +
    `⚪ <b>COMMON:</b> <code>48.50%</code>\n` +
    `• Points រង្វាន់លួងចិត្ត (Cashback)\n\n` +
    `🔒 <i>ប្រព័ន្ធធានាសមភាព (Provably Fair RNG Engine) 100% គ្មានការបន្លំ។</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubGachaKeyboard(storeUrl, 'km');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Odds] Render warning:', err);
    }
  }
}
