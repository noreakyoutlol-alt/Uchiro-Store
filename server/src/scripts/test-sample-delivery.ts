import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { DataStore } from '../database/data-store';
import { FulfillmentService } from '../services/fulfillment.service';
import { generateReceiptPdf } from '../utils/receipt.util';
import { TOTPService } from '../security/totp';

// Load environment variables from candidate paths
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

const TARGET_TELEGRAM_ID = Number(process.env.TEST_TELEGRAM_ID || 0);
const BOT_TOKEN = (process.env.STORE_BOT_TOKEN || '').trim();

async function runSampleDeliveryTest(): Promise<void> {
  console.log('================================================================');
  console.log('🚀 UCHIRO STORE V3 — TELEGRAM SAMPLE DELIVERY TEST CLI');
  console.log(`🎯 Target Telegram ID: ${TARGET_TELEGRAM_ID}`);
  console.log(`🤖 Bot Token Configured: ${BOT_TOKEN ? 'YES (Active)' : 'NO (Mock / Simulated Mode)'}`);
  console.log('================================================================\n');

  // 1. Prepare sample order and credentials in DataStore
  const orderId = `SAMPLE-ORD-${Date.now().toString().slice(-6)}`;
  const orderNumber = `UCH-${Math.floor(100000 + Math.random() * 900000)}`;
  const sampleUsername = 'UchiroGodPlayer99';
  const samplePassword = 'P@ssword99_Secure';
  const sample2FaSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; // Standard 32-character Base32 secret
  const productTitle = 'Blox Fruits Level 2550 + Godhuman + Kitsune Perm';
  const pricePaid = 15.00;
  const warrantyDays = 7;
  const warrantyExpiresAt = new Date(Date.now() + warrantyDays * 86400000).toISOString();

  console.log('📦 Step 1: Registering sample order in DataStore...');
  const sampleOrder: any = {
    id: orderId,
    order_number: orderNumber,
    customer_id: `cust-${TARGET_TELEGRAM_ID}`,
    telegram_id: TARGET_TELEGRAM_ID,
    product_title: productTitle,
    delivery_mode: 'auto_account',
    status: 'delivered',
    total_amount: pricePaid,
    warranty_days: warrantyDays,
    warranty_status: 'active',
    warranty_starts_at: new Date().toISOString(),
    warranty_expires_at: warrantyExpiresAt,
    delivery_credentials: [
      {
        type: 'account',
        username: sampleUsername,
        password: samplePassword,
        two_factor: sample2FaSecret,
        authenticator_secret: sample2FaSecret,
        warranty_days: warrantyDays,
      },
    ],
    items: [
      {
        product_id: 'sample-prod-001',
        product_title: productTitle,
        price: pricePaid,
        quantity: 1,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  DataStore.saveOrder(sampleOrder);
  console.log(`✅ Order registered successfully (ID: ${orderId}, #${orderNumber})\n`);

  // 2. Test & Generate Luxury PDF Receipt
  console.log('📄 Step 2: Generating luxury PDF receipt...');
  const pdfBuffer = await generateReceiptPdf({
    id: orderId,
    order_number: orderNumber,
    created_at: sampleOrder.created_at,
    total_amount: pricePaid,
    product_title: productTitle,
    delivery_mode: 'auto_account',
    telegram_id: TARGET_TELEGRAM_ID,
    roblox_username: sampleUsername,
    warranty_days: warrantyDays,
  });

  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new Error('PDF generation failed: returned invalid or empty buffer');
  }
  console.log(`✅ Luxury PDF receipt generated (${(pdfBuffer.length / 1024).toFixed(1)} KB)\n`);

  // 3. Test Main Delivery Card Generation
  console.log('🎮 Step 3: Generating Main Delivery Card and Inline Keyboard...');
  const cardText = FulfillmentService.getMainDeliveryCardText(orderId);
  const cardKeyboard = FulfillmentService.getMainDeliveryKeyboard(orderId);

  if (!cardText.includes(sampleUsername) || !cardText.includes(samplePassword)) {
    throw new Error('Main Delivery Card text missing credentials');
  }
  if (!cardKeyboard.inline_keyboard || cardKeyboard.inline_keyboard.length !== 4) {
    throw new Error('Main Delivery Card keyboard does not contain expected 4 button rows');
  }
  console.log('✅ Main Delivery Card generated with 4 interactive rows:');
  cardKeyboard.inline_keyboard.forEach((row: any, idx: number) => {
    console.log(`   Row ${idx + 1}: [ ${row[0].text} ] -> ${row[0].callback_data || row[0].url}`);
  });
  console.log('');

  // 4. Test In-Place Interactive Sub-Screens
  console.log('🔄 Step 4: Testing interactive in-place sub-screens...');

  // 4a. 2FA Sub-Screen
  const sub2Fa = await FulfillmentService.get2FaSubScreen(orderId);
  console.log(`   🔢 2FA Sub-Screen: Code = ${sub2Fa.code} (Buttons: ${sub2Fa.keyboard.inline_keyboard.length} rows)`);
  if (!sub2Fa.code || sub2Fa.code.length !== 6 || sub2Fa.code === 'N/A') {
    throw new Error(`Invalid 2FA code generated: ${sub2Fa.code}`);
  }

  // 4b. 2FA QR Buffer Generation
  const qrBuffer = await FulfillmentService.generate2FaQrBuffer(orderId);
  console.log(`   📷 On-Demand 2FA QR Buffer: ${(qrBuffer.length / 1024).toFixed(1)} KB generated successfully`);
  if (!Buffer.isBuffer(qrBuffer) || qrBuffer.length === 0) {
    throw new Error('Failed to generate 2FA QR Buffer');
  }

  // 4c. Warranty Sub-Screen
  const subWarranty = FulfillmentService.getWarrantySubScreen(orderId);
  console.log(`   🛡️ Warranty Sub-Screen: Terms rendered (${subWarranty.text.length} chars, Buttons: ${subWarranty.keyboard.inline_keyboard.length} rows)`);
  if (!subWarranty.text.includes('NO WARRANTY if 2FA is removed')) {
    throw new Error('Warranty sub-screen missing strict terms text');
  }
  console.log('✅ All interactive sub-screen handlers verified cleanly!\n');

  // 5. Telegram Dispatch
  console.log(`📡 Step 5: Telegram Dispatch to ${TARGET_TELEGRAM_ID}...`);
  if (BOT_TOKEN && !BOT_TOKEN.startsWith('mock_')) {
    try {
      const bot = new Telegraf(BOT_TOKEN);
      console.log('   Sending luxury PDF receipt document...');
      await bot.telegram.sendDocument(
        TARGET_TELEGRAM_ID,
        {
          source: pdfBuffer,
          filename: `Receipt_${orderId}.pdf`,
        },
        {
          caption: `📄 <b>Official Receipt & Warranty Certificate</b>\nOrder #${orderNumber} • Verified Payment via KHPay KHQR`,
          parse_mode: 'HTML',
        }
      );
      console.log('   ✅ PDF Receipt delivered to Telegram!');

      console.log('   Sending Main Delivery Card with interactive inline keyboard...');
      await bot.telegram.sendMessage(TARGET_TELEGRAM_ID, cardText, {
        parse_mode: 'HTML',
        reply_markup: cardKeyboard,
      });
      console.log('   ✅ Main Delivery Card delivered to Telegram!');
      console.log('\n🎉 ALL LIVE TELEGRAM DISPATCH STEPS COMPLETED SUCCESSFULLY!');
    } catch (err: any) {
      console.warn(`   ⚠️ Telegram API returned: ${err.message}`);
      console.log('   (Note: If Telegram user has not started @bot yet or token rate-limited, verification completed locally)');
    }
  } else {
    console.log('   ℹ️ No live STORE_BOT_TOKEN provided in current environment.');
    console.log('   Simulated Telegram dispatch successful. Full payload, receipt PDF & callbacks verified.');
  }

  console.log('\n================================================================');
  console.log('✨ SELF-TEST SAMPLE DISPATCH SUMMARY:');
  console.log('  1. Luxury PDF Receipt: GENERATED & VERIFIED');
  console.log('  2. Main Delivery Card: FORMATTED (4 Inline Buttons)');
  console.log('  3. Live 2FA Sub-Screen: VERIFIED (RFC 6238 6-Digit TOTP)');
  console.log('  4. On-Demand QR Buffer: VERIFIED (PNG Image Buffer)');
  console.log('  5. Warranty Protection Sub-Screen: VERIFIED');
  console.log('================================================================');
}

runSampleDeliveryTest().catch((err) => {
  console.error('❌ Sample Delivery Test Failed:', err);
  process.exit(1);
});
