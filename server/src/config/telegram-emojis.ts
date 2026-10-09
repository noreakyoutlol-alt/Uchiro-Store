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
};

export type TelegramEmojiKey = keyof typeof TELEGRAM_EMOJIS;

export function renderTgEmoji(key: keyof typeof TELEGRAM_EMOJIS | string): string {
  const item = TELEGRAM_EMOJIS[key as keyof typeof TELEGRAM_EMOJIS];
  if (!item) return '';
  if (item.customEmojiId && item.customEmojiId.trim() !== '') {
    return `<tg-emoji emoji-id="${item.customEmojiId.trim()}">${item.fallback}</tg-emoji>`;
  }
  return item.fallback;
}

export function enrichWithTgEmojis(text: string): string {
  if (!text) return '';
  let enriched = text;

  // Type predicate guarantees customEmojiId is a non-empty string for TypeScript TS18048
  const activeEntries = Object.values(TELEGRAM_EMOJIS)
    .filter((item): item is TelegramEmojiDef & { customEmojiId: string } => 
      typeof item.customEmojiId === 'string' && item.customEmojiId.trim() !== ''
    )
    .sort((a, b) => b.fallback.length - a.fallback.length);

  const seenFallbacks = new Set<string>();

  for (const item of activeEntries) {
    if (seenFallbacks.has(item.fallback)) continue;
    seenFallbacks.add(item.fallback);

    const tgTag = `<tg-emoji emoji-id="${item.customEmojiId.trim()}">${item.fallback}</tg-emoji>`;
    const escapedFallback = item.fallback.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!<tg-emoji[^>]*>)${escapedFallback}(?!<\\/tg-emoji>)`, 'g');
    enriched = enriched.replace(regex, tgTag);
  }
  return enriched;
}