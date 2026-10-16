const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const args = process.argv.slice(2);
const doTypecheck = args.includes('--typecheck');

console.log('=== CHECK-UCHIRO VERIFICATION SUITE ===\n');

// ----------------------------------------------------
// [1] Typecheck
// ----------------------------------------------------
console.log('[1] TYPECHECK');
if (doTypecheck) {
  let hasErrors = false;
  const workspaces = ['server', 'client-store', 'client-admin'];
  for (const ws of workspaces) {
    try {
      process.stdout.write(`  Checking ${ws}... `);
      execSync('npm run build', { cwd: path.join(rootDir, ws), stdio: 'pipe' });
      console.log('OK (0 errors)');
    } catch (err) {
      console.log('FAILED');
      console.error(err.stdout ? err.stdout.toString() : err.message);
      hasErrors = true;
    }
  }
  if (hasErrors) {
    console.log('  Result: TYPECHECK FAILED\n');
  } else {
    console.log('  Result: ALL WORKSPACES OK (0 errors)\n');
  }
} else {
  console.log('  (Skipped. Pass --typecheck to run full build)\n');
}

// ----------------------------------------------------
// [2] Bot Buttons & Orphan Check
// ----------------------------------------------------
console.log('[2] BOT BUTTONS & ORPHANS');
try {
  const keyboardsFile = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/keyboards.ts'), 'utf8');
  const indexFile = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/index.ts'), 'utf8');

  // Find all callback_data in keyboards.ts
  const cbRegex1 = /Markup\.button\.callback\s*\(\s*[^,]+,\s*['"`]([^'"`]+)['"`]/g;
  const cbRegex2 = /callback_data\s*:\s*['"`]([^'"`]+)['"`]/g;
  const cbRegex3 = /\bcb\s*\(\s*[^,]+,\s*['"`]([^'"`]+)['"`]/g;
  const foundCallbacks = new Set();
  let match;
  while ((match = cbRegex1.exec(keyboardsFile)) !== null) {
    foundCallbacks.add(match[1]);
  }
  while ((match = cbRegex2.exec(keyboardsFile)) !== null) {
    foundCallbacks.add(match[1]);
  }
  while ((match = cbRegex3.exec(keyboardsFile)) !== null) {
    foundCallbacks.add(match[1]);
  }

  // Check which are handled in index.ts
  const orphans = [];
  for (const cb of foundCallbacks) {
    // If dynamic callback like cb_view_acc_
    const isDynamic = cb.includes('${') || cb.endsWith('_');
    if (isDynamic) {
      const prefix = cb.split(/[$_]/)[0];
      if (!indexFile.includes(prefix)) orphans.push(cb);
      continue;
    }
    // Check direct mention or regex match in index.ts
    if (!indexFile.includes(`'${cb}'`) && !indexFile.includes(`"${cb}"`) && !indexFile.includes(`\`${cb}\``)) {
      // Check if handled by regex
      const handled = [
        /^cb_view_acc_/.test(cb) && indexFile.includes('cb_view_acc_'),
        /^cb_gen_2fa_/.test(cb) && indexFile.includes('cb_gen_2fa_'),
        /^set_lang:/.test(cb) && indexFile.includes('set_lang:'),
        /^view_order:/.test(cb) && indexFile.includes('view_order:'),
      ].some(Boolean);
      if (!handled) orphans.push(cb);
    }
  }

  if (orphans.length === 0) {
    console.log('  OK: no orphan buttons found');
  } else {
    console.log('  ORPHANS found:');
    orphans.forEach((o) => console.log(`    - ${o}`));
  }
} catch (e) {
  console.log('  Error reading bot keyboards:', e.message);
}
console.log();

// ----------------------------------------------------
// [2b] Database Wiring
// ----------------------------------------------------
console.log('[2b] DATABASE WIRING');
try {
  const dataStoreFile = fs.readFileSync(path.join(rootDir, 'server/src/database/data-store.ts'), 'utf8');
  const authRoutes = fs.readFileSync(path.join(rootDir, 'server/src/routes/auth.routes.ts'), 'utf8');
  const userRoutes = fs.readFileSync(path.join(rootDir, 'server/src/routes/user.routes.ts'), 'utf8');
  const storeRoutes = fs.readFileSync(path.join(rootDir, 'server/src/routes/store.routes.ts'), 'utf8');
  const gachaHandler = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/handlers/gacha.ts'), 'utf8');
  const dailyHandler = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/handlers/daily.ts'), 'utf8');
  const ordersHandler = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/handlers/orders.ts'), 'utf8');
  const profileHandler = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/handlers/profile.ts'), 'utf8');

  // Check syncUserFromPostgres & getUserSnapshot assign points on user and profile
  const syncAssigns = dataStoreFile.includes('existingUser.points = pts') && dataStoreFile.includes('profile.points = pts');
  const snapshotAssigns = dataStoreFile.includes('existingUser.points = points') && dataStoreFile.includes('profile.points = points');
  console.log(`  syncUserFromPostgres assigns user & profile points: ${syncAssigns ? 'YES' : 'NO'}`);
  console.log(`  getUserSnapshot assigns user & profile points: ${snapshotAssigns ? 'YES' : 'NO'}`);

  // Check endpoints use getUserSnapshot
  const authUsesSnap = authRoutes.includes('getUserSnapshot');
  const userUsesSnap = userRoutes.includes('getUserSnapshot');
  const storeUsesSnap = storeRoutes.includes('getUserSnapshot');
  const gachaUsesSnap = gachaHandler.includes('getUserSnapshot');
  console.log(`  routes/auth.routes.ts uses getUserSnapshot: ${authUsesSnap ? 'YES' : 'NO'}`);
  console.log(`  routes/user.routes.ts uses getUserSnapshot: ${userUsesSnap ? 'YES' : 'NO'}`);
  console.log(`  routes/store.routes.ts uses getUserSnapshot: ${storeUsesSnap ? 'YES' : 'NO'}`);
  console.log(`  handlers/gacha.ts uses getUserSnapshot: ${gachaUsesSnap ? 'YES' : 'NO'}`);

  // Bot handlers call module-level claimDailyReward/getUserSnapshot (never DataStore.claimDailyReward)
  const noMemoryClaim = !dailyHandler.includes('DataStore.claimDailyReward') &&
                        !ordersHandler.includes('DataStore.claimDailyReward') &&
                        !profileHandler.includes('DataStore.claimDailyReward') &&
                        !userRoutes.includes('DataStore.claimDailyReward');
  console.log(`  daily, orders, profile, user never use DataStore.claimDailyReward (module-level only): ${noMemoryClaim ? 'YES' : 'NO'}`);

  // Persistence deltas
  const persistTickets = dataStoreFile.includes('persistTicketsDelta');
  const persistPoints = dataStoreFile.includes('persistPointsDelta');
  console.log(`  gacha tickets & points persist via deltas: ${persistTickets && persistPoints ? 'YES' : 'NO'}`);

  // Daily routes telegram auth
  const dailyAuth1 = storeRoutes.includes("requireTelegramAuth, handleDailyRewardClaim");
  const dailyAuth2 = userRoutes.includes("requireTelegramAuth");
  console.log(`  daily claim routes enforce Telegram auth: ${dailyAuth1 && dailyAuth2 ? 'YES' : 'NO'}`);

  // Hardcoded Admin IDs
  const adminBotGuards = fs.readFileSync(path.join(rootDir, 'server/src/bots/admin-bot/admin-guards.ts'), 'utf8');
  const noHardcodedAdmins = !adminBotGuards.includes('7109268804') && adminBotGuards.includes('ADMIN_TELEGRAM_USER_IDS');
  console.log(`  no hardcoded admin IDs (env-only): ${noHardcodedAdmins ? 'YES' : 'NO'}`);
} catch (e) {
  console.log('  Error checking database wiring:', e.message);
}
console.log();

// ----------------------------------------------------
// [3] Khmer UI Text Outside Dictionaries
// ----------------------------------------------------
console.log('[3] KHMER UI TEXT CHECK');
try {
  function getKhmerFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'locales' || entry.name === 'i18n' || entry.name === '.git') {
          continue;
        }
        results.push(...getKhmerFiles(fullPath));
      } else if (entry.isFile() && /\.(tsx?|jsx?|html)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (/[ក-៿]/.test(content)) {
          results.push(path.relative(rootDir, fullPath));
        }
      }
    }
    return results;
  }

  const khmerFiles = [
    ...getKhmerFiles(path.join(rootDir, 'client-store/src')),
    ...getKhmerFiles(path.join(rootDir, 'client-admin/src')),
    ...getKhmerFiles(path.join(rootDir, 'server/src')),
  ];

  console.log(`  Files with Khmer outside dictionaries: ${khmerFiles.length}`);
  if (khmerFiles.length > 0) {
    khmerFiles.forEach((f) => console.log(`    - ${f}`));
  }
} catch (e) {
  console.log('  Error checking Khmer text:', e.message);
}
console.log();

// ----------------------------------------------------
// [4] Bot Premium Emoji, Middleware & Order History
// ----------------------------------------------------
console.log('[4] BOT PREMIUM EMOJI & MIDDLEWARE');
try {
  const keyboardsFile = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/keyboards.ts'), 'utf8');
  const indexFile = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/index.ts'), 'utf8');
  const ordersHandler = fs.readFileSync(path.join(rootDir, 'server/src/bots/store-bot/handlers/orders.ts'), 'utf8');

  const iconEmoji = keyboardsFile.includes('icon_custom_emoji_id') || indexFile.includes('icon_custom_emoji_id');
  const callApiGuard = indexFile.includes('callApi') && indexFile.includes('enrichWithTgEmojis');
  const answerCbGuard = indexFile.includes('answerCbQuery');
  const realOrderHistory = ordersHandler.includes('listOrdersByUser');

  console.log(`  icon_custom_emoji_id: ${iconEmoji ? 'YES' : 'NO'}`);
  console.log(`  callApi guard: ${callApiGuard ? 'YES' : 'NO'}`);
  console.log(`  answerCbQuery middleware: ${answerCbGuard ? 'YES' : 'NO'}`);
  console.log(`  order-history: ${realOrderHistory ? 'YES' : 'NO'}`);

  const tgEmojiComponentExists = fs.existsSync(path.join(rootDir, 'client-store/src/components/common/TgEmoji.tsx'));
  console.log(`  Mini App TgEmoji component: ${tgEmojiComponentExists ? 'YES' : 'NO'}`);
} catch (e) {
  console.log('  Error in [4] check:', e.message);
}
console.log();

// ----------------------------------------------------
// [4b] Emoji Registry Check
// ----------------------------------------------------
console.log('[4b] EMOJI REGISTRY (Lacking Custom Emoji IDs)');
try {
  const emojiFile = fs.readFileSync(path.join(rootDir, 'server/src/config/telegram-emojis.ts'), 'utf8');
  // Match key: { fallback: '...', ... }
  const lacking = [];
  const regex = /([A-Z0-9_]+)\s*:\s*\{\s*fallback:\s*['"`]([^'"`]+)['"`](?:,\s*customEmojiId:\s*['"`]([^'"`]*)['"`])?/g;
  let emMatch;
  while ((emMatch = regex.exec(emojiFile)) !== null) {
    const key = emMatch[1];
    const fallback = emMatch[2];
    const id = emMatch[3];
    if (!id || id.trim() === '') {
      lacking.push(`${key} (${fallback})`);
    }
  }
  if (lacking.length === 0) {
    console.log('  All registered emojis have IDs.');
  } else {
    console.log(`  Count lacking IDs: ${lacking.length}`);
    lacking.forEach((item) => console.log(`    - ${item}`));
  }
} catch (e) {
  console.log('  Error checking emojis:', e.message);
}
console.log();

// ----------------------------------------------------
// [5b] Mini App Points & Language Check
// ----------------------------------------------------
console.log('[5b] MINI APP POINTS & LANGUAGE');
try {
  const useMeExists = fs.existsSync(path.join(rootDir, 'client-store/src/hooks/useMe.ts')) ||
                      fs.existsSync(path.join(rootDir, 'client-store/src/context/MeContext.tsx'));
  console.log(`  shared useMe hook defined: ${useMeExists ? 'YES' : 'NO'}`);

  // Check language context forces 'en' and no KH chip
  const langContextPath = path.join(rootDir, 'client-store/src/context/LanguageContext.tsx');
  let noKhChip = true;
  if (fs.existsSync(langContextPath)) {
    const langContent = fs.readFileSync(langContextPath, 'utf8');
    const forcesEn = langContent.includes("'en'");
    // Check if KH chip is rendered in TopBar or Nav
    const topBarPath = path.join(rootDir, 'client-store/src/components/navigation/TopBar.tsx');
    if (fs.existsSync(topBarPath)) {
      const tb = fs.readFileSync(topBarPath, 'utf8');
      if (tb.includes('KH') || tb.includes('🇰🇭')) noKhChip = false;
    }
    console.log(`  no KH chip: ${noKhChip ? 'YES' : 'NO'}`);
  }

  // Check files rendering PTS
  function checkPtsUsage(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'dist') checkPtsUsage(fullPath);
      } else if (/\.(tsx|jsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (/\b(PTS|Pts)\b/.test(content)) {
          const usesMe = content.includes('useMe') || content.includes('useAuth');
          console.log(`  ${path.relative(rootDir, fullPath)}: uses useMe: ${usesMe ? 'yes' : 'no'}`);
        }
      }
    }
  }
  checkPtsUsage(path.join(rootDir, 'client-store/src'));
} catch (e) {
  console.log('  Error in [5b] check:', e.message);
}

console.log('\n=== END OF CHECK-UCHIRO ===');
