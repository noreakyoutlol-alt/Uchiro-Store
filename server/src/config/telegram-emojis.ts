export interface TelegramEmojiDef {
  fallback: string;
  customEmojiId?: string;
}

export const TELEGRAM_EMOJIS: Record<string, TelegramEmojiDef> = {
  // ─── Preserved Configured Custom Emojis ──────────────────────────────────
  LIGHTNING:     { fallback: '⚡', customEmojiId: '5456140674028019486' },
  KEY:           { fallback: '🔑', customEmojiId: '5193070340850327783' },
  SHIELD:        { fallback: '🛡️', customEmojiId: '5197288647275071607' },
  LOCK:          { fallback: '🔐', customEmojiId: '5836690092306992715' },
  RECEIPT:       { fallback: '🧾', customEmojiId: '5444856076954520455' },
  REFRESH:       { fallback: '🔄', customEmojiId: '5346269127059196142' },
  PHONE:         { fallback: '📲', customEmojiId: '5406809207947142040' },
  SUPPORT:       { fallback: '💬', customEmojiId: '6106980145250177382' },
  SUCCESS:       { fallback: '✅', customEmojiId: '6109293985866453915' },
  CHECK:         { fallback: '✅', customEmojiId: '6109293985866453915' },
  ALERT:         { fallback: '⚠️', customEmojiId: '5420323339723881652' },
  FIRE:          { fallback: '🔥', customEmojiId: '6106937569239372743' },
  PACKAGE:       { fallback: '📦', customEmojiId: '5854908544712707500' },
  USER:          { fallback: '👤', customEmojiId: '5258011929993026890' },
  SWORD:         { fallback: '⚔️', customEmojiId: '6084765169940961891' },
  KNIFE:         { fallback: '🔪', customEmojiId: '5258304503165249923' },
  TARGET:        { fallback: '🎯', customEmojiId: '5310278924616356636' },
  CROWN:         { fallback: '👑', customEmojiId: '5433758796289685818' },
  MONEY:         { fallback: '💵', customEmojiId: '6301016442582081020' },
  GEM:           { fallback: '💎', customEmojiId: '6107301563422740787' },
  DIAMOND:       { fallback: '💎', customEmojiId: '6107301563422740787' },
  TICKET:        { fallback: '🎟️', customEmojiId: '5291994784980813319' },
  ROBOT:         { fallback: '🤖', customEmojiId: '5287684458881756303' },
  BELL:          { fallback: '🔔', customEmojiId: '5458603043203327669' },
  STAR:          { fallback: '⭐', customEmojiId: '6310066561445008183' },
  GIFT:          { fallback: '🎁', customEmojiId: '5203996991054432397' },

  // ─── Codebase Scan Discovered Emojis ─────────────────────────────────────
  SIREN:         { fallback: '🚨', customEmojiId: '5395695537687123235' },
  HANDSHAKE:     { fallback: '🤝', customEmojiId: '5463249828450424568' },
  ID_BADGE:      { fallback: '🆔', customEmojiId: '5969696910112463071' },
  PADLOCK:       { fallback: '🔒', customEmojiId: '5296369303661067030' },
  CROSS:         { fallback: '❌', customEmojiId: '6300696192640620174' },
  HOURGLASS:     { fallback: '⏳', customEmojiId: '5213452215527677338' },
  DOCUMENT:      { fallback: '📄', customEmojiId: '5258477770735885832' },
  GAMEPAD:       { fallback: '🎮', customEmojiId: '5224737297932503025' },
  CAMERA:        { fallback: '📷', customEmojiId: '5260623291583831521' },
  NUMBERS:       { fallback: '🔢', customEmojiId: '5226513232549664618' },
  INFO:          { fallback: 'ℹ️', customEmojiId: '5334544901428229844' },
  STOPWATCH:     { fallback: '⏱️', customEmojiId: '5958272262745365730' },
  STOP_BUTTON:   { fallback: '⏹️', customEmojiId: '5785086330828494553' },
  BLACK_STAR:    { fallback: '★', customEmojiId: '5337156404752966663' },
  GEAR:          { fallback: '⚙️', customEmojiId: '5341715473882955310' },
  NO_ENTRY:      { fallback: '⛔', customEmojiId: '5247149163132493357' },
  SPARKLES:      { fallback: '✨', customEmojiId: '5852724394928905160' },
  RED_HEART:     { fallback: '❤️', customEmojiId: '5462920675041758858' },
  FLAG_UK:       { fallback: '🇬🇧', customEmojiId: '5458416160586342331' },
  FLAG_CAMBODIA: { fallback: '🇰🇭', customEmojiId: '5294018354527353443' },
  FLAG_US:       { fallback: '🇺🇸', customEmojiId: '5202021044105257611' },
  GLOBE:         { fallback: '🌐', customEmojiId: '6107376940098786484' },
  PARTY_POPPER:  { fallback: '🎉', customEmojiId: '5904388148510593830' },
  FERRIS_WHEEL:  { fallback: '🎡', customEmojiId: '5271663509313173948' },
  SLOT_MACHINE:  { fallback: '🎰', customEmojiId: '5235989279024373566' },
  RUNNER:        { fallback: '🏃', customEmojiId: '5210965493887819972' },
  LIGHT_BULB:    { fallback: '💡', customEmojiId: '5422439311196834318' },
  MONEY_BAG:     { fallback: '💰', customEmojiId: '5224257782013769471' },
  CREDIT_CARD:   { fallback: '💳', customEmojiId: '6086818297452434600' },
  FOLDER:        { fallback: '📁', customEmojiId: '5298853345241358103' },
  CHART_UP:      { fallback: '📈', customEmojiId: '5429651785352501917' },
  BAR_CHART:     { fallback: '📊', customEmojiId: '5226508924697453639' },
  PIN:           { fallback: '📍', customEmojiId: '5292291996717690768' },
  SCROLL:        { fallback: '📜', customEmojiId: '5217939515754174728' },
  BACKPACK:      { fallback: '🎒' },
  VAULT:         { fallback: '🎒' },
  MEMO:          { fallback: '📝', customEmojiId: '5837003105228558796' },
  SATELLITE:     { fallback: '📡', customEmojiId: '5321141214735508486' },
  MEGAPHONE:     { fallback: '📢', customEmojiId: '6300742299114541958' },
  MOBILE_PHONE:  { fallback: '📱', customEmojiId: '5407025283456835913' },
  SEARCH:        { fallback: '🔍', customEmojiId: '5368460200875418560' },
  SEARCH_RIGHT:  { fallback: '🔎', customEmojiId: '5368460200875418560' },
  LINK:          { fallback: '🔗', customEmojiId: '5945206916396357400' },
  WRENCH:        { fallback: '🔧', customEmojiId: '5264908182886557148' },
  RED_CIRCLE:    { fallback: '🔴', customEmojiId: '5411225014148014586' },
  ROCKET:        { fallback: '🚀', customEmojiId: '5188481279963715781' },
  SHOPPING_BAGS: { fallback: '🛍️', customEmojiId: '5373052667671093676' },
  STOP_SIGN:     { fallback: '🛑', customEmojiId: '5399898931985399303' },
  SHOPPING_CART: { fallback: '🛒', customEmojiId: '5312361253610475399' },
  YELLOW_CIRCLE: { fallback: '🟡', customEmojiId: '6138465764518138820' },
  GREEN_CIRCLE:  { fallback: '🟢', customEmojiId: '5918199698182640933' },
  PURPLE_CIRCLE: { fallback: '🟣', customEmojiId: '5915954581338068740' },
  EGG:           { fallback: '🥚', customEmojiId: '5208541530310065351' },
  COPYRIGHT:     { fallback: '©', customEmojiId: '5323442290708985472' },
  ROBUX:         { fallback: '💎', customEmojiId: '5406705291213417505' },
  HOUSE:         { fallback: '🏠', customEmojiId: '5312486108309757006' },
  HOME:          { fallback: '🏠', customEmojiId: '5312486108309757006' },
  BACK:          { fallback: '🔙', customEmojiId: '5258236805890710909' },
  NUMBER_1:      { fallback: '1️⃣', customEmojiId: '5382322671679708881' },
  NUMBER_2:      { fallback: '2️⃣', customEmojiId: '5381990043642502553' },
  NUMBER_3:      { fallback: '3️⃣' },
  NUMBER_4:      { fallback: '4️⃣', customEmojiId: '5382054253403577563' },
  NUMBER_5:      { fallback: '5️⃣', customEmojiId: '5391197405553107640' },
  POINT_DOWN:    { fallback: '👇', customEmojiId: '5911229279793844738' },
  POINT_RIGHT:   { fallback: '👉', customEmojiId: '5911124933563388348' },
  COMPASS:       { fallback: '🧭' },
  QUESTION:      { fallback: '❓' },
  CLOCK:         { fallback: '⏳', customEmojiId: '5213452215527677338' },
  CARD:          { fallback: '💳', customEmojiId: '6086818297452434600' },
};

export type TelegramEmojiKey = keyof typeof TELEGRAM_EMOJIS;

export function renderTgEmoji(key: keyof typeof TELEGRAM_EMOJIS | string, fallback?: string): string {
  const item = TELEGRAM_EMOJIS[key as keyof typeof TELEGRAM_EMOJIS];
  if (!item) return fallback || '';
  if (item.customEmojiId && item.customEmojiId.trim() !== '') {
    return `<tg-emoji emoji-id="${item.customEmojiId.trim()}">${fallback || item.fallback}</tg-emoji>`;
  }
  return fallback || item.fallback;
}

export function tgEmoji(key: keyof typeof TELEGRAM_EMOJIS | string, fallback?: string): string {
  return renderTgEmoji(key, fallback);
}

export function enrichWithTgEmojis(text: string): string {
  if (!text) return '';

  const activeEntries = Object.values(TELEGRAM_EMOJIS)
    .filter((item): item is TelegramEmojiDef & { customEmojiId: string } =>
      typeof item.customEmojiId === 'string' && item.customEmojiId.trim() !== ''
    )
    .sort((a, b) => b.fallback.length - a.fallback.length);

  const emojiMap = new Map<string, { id: string; rawFallback: string }>();
  for (const item of activeEntries) {
    const baseGlyph = item.fallback.replace(/️/g, '');
    if (!emojiMap.has(baseGlyph)) {
      emojiMap.set(baseGlyph, { id: item.customEmojiId.trim(), rawFallback: item.fallback });
    }
  }

  return text.replace(/(<tg-emoji[^>]*>[\s\S]*?<\/tg-emoji>|<[^>]+>)|([^<]+)/gi, (match, tag, textChunk) => {
    if (tag) return tag;
    if (!textChunk) return match;

    let enrichedChunk = textChunk;
    for (const [baseGlyph, { id, rawFallback }] of emojiMap.entries()) {
      const escaped = baseGlyph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${escaped}(?:\\uFE0F)?`, 'gu');
      enrichedChunk = enrichedChunk.replace(regex, `<tg-emoji emoji-id="${id}">${rawFallback}</tg-emoji>`);
    }
    return enrichedChunk;
  });
}

// ─── Local Static & Animated Asset Classification ───────────────────────────
export const WEBM_EMOJI_IDS = new Set<string>([
  '5193070340850327783', // KEY
  '5213452215527677338', // HOURGLASS
  '5260623291583831521', // CAMERA
  '5292291996717690768', // PIN
  '5294018354527353443', // FLAG_CAMBODIA
  '5337156404752966663', // BLACK_STAR
  '5854908544712707500', // PACKAGE
  '6138465764518138820', // YELLOW_CIRCLE
  '6300742299114541958', // MEGAPHONE
]);

export const WEBM_EMOJI_NAMES = new Set<string>([
  'KEY', 'HOURGLASS', 'CAMERA', 'PIN', 'FLAG_CAMBODIA', 'BLACK_STAR', 'PACKAGE', 'YELLOW_CIRCLE', 'MEGAPHONE',
  'key', 'hourglass', 'camera', 'pin', 'flag_cambodia', 'black_star', 'package', 'yellow_circle', 'megaphone',
]);

export const WEBP_EMOJI_IDS = new Set<string>([
  '5208541530310065351', // EGG
  '5210965493887819972', // RUNNER
  '5258304503165249923', // KNIFE
  '5264908182886557148', // WRENCH
  '5291994784980813319', // TICKET
  '5368460200875418560', // SEARCH / SEARCH_RIGHT
  '5399898931985399303', // STOP_SIGN
  '5785086330828494553', // STOP_BUTTON
  '5969696910112463071', // ID_BADGE
  '6084765169940961891', // SWORD
  '6086818297452434600', // CREDIT_CARD
]);

export const WEBP_EMOJI_NAMES = new Set<string>([
  'EGG', 'RUNNER', 'KNIFE', 'WRENCH', 'TICKET', 'SEARCH', 'SEARCH_RIGHT', 'STOP_SIGN', 'STOP_BUTTON', 'ID_BADGE', 'SWORD', 'CREDIT_CARD', 'TARGET', 'LIGHTNING', 'GAMEPAD',
  'egg', 'runner', 'knife', 'wrench', 'ticket', 'search', 'search_right', 'stop_sign', 'stop_button', 'id_badge', 'sword', 'credit_card', 'target', 'lightning', 'gamepad',
]);
