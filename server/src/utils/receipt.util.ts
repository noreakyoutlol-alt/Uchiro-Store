import PDFDocument from 'pdfkit';

export interface OrderReceiptData {
  id: string;
  order_number: string;
  created_at?: string;
  total_amount: number;
  product_title?: string;
  delivery_mode?: string;
  telegram_id?: number;
  roblox_username?: string | null;
  warranty_days?: number;
  warranty_notes?: string;
  items?: Array<{
    title: string;
    price: number;
    quantity: number;
  }>;
}

/**
 * Generates an official PDF receipt for an Uchiro Store order.
 * Includes Store header, Order ID, Date, Item Title, Amount ($USD via KHPay/KHQR),
 * and strict Warranty terms with elegant luxury dark styling.
 */
export async function generateReceiptPdf(orderData: OrderReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Receipt_${orderData.order_number || orderData.id}`,
          Author: 'Uchiro Store',
          Subject: 'Official Order Receipt & Warranty Certificate',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      // 1. Sleek luxury dark background
      doc.rect(0, 0, pageWidth, pageHeight).fill('#0B0E14');

      // 2. Top gold/crimson accent bar
      doc.rect(0, 0, pageWidth, 6).fill('#F59E0B');

      // 3. Card Container
      const cardX = 35;
      const cardY = 35;
      const cardW = pageWidth - 70;
      const cardH = pageHeight - 70;
      doc.roundedRect(cardX, cardY, cardW, cardH, 10).fill('#131823');
      doc.roundedRect(cardX, cardY, cardW, cardH, 10).lineWidth(1).stroke('#263248');

      // 4. Header: UCHIRO STORE
      doc.fillColor('#F59E0B')
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('UCHIRO STORE', 60, 60);

      doc.fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(10)
        .text('OFFICIAL DIGITAL GOODS RECEIPT & WARRANTY CERTIFICATE', 60, 92);

      // Status Badge
      doc.roundedRect(pageWidth - 180, 62, 120, 26, 4).fill('#064E3B');
      doc.fillColor('#10B981')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('PAID / CONFIRMED', pageWidth - 170, 70);

      // Divider line
      doc.moveTo(60, 115).lineTo(pageWidth - 60, 115).lineWidth(1).stroke('#1E293B');

      // 5. Order Information Grid
      const orderDate = orderData.created_at
        ? new Date(orderData.created_at).toUTCString()
        : new Date().toUTCString();
      const productTitle =
        orderData.product_title ||
        (orderData.items && orderData.items[0]?.title) ||
        'Premium Roblox Account';
      const warrantyDays = orderData.warranty_days || 7;

      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('ORDER NUMBER', 60, 135);
      doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(12).text(`#${orderData.order_number || orderData.id}`, 60, 150);

      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('DATE & TIME', 230, 135);
      doc.fillColor('#F8FAFC').font('Helvetica').fontSize(10).text(orderDate, 230, 150);

      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('PAYMENT METHOD', 420, 135);
      doc.fillColor('#F8FAFC').font('Helvetica').fontSize(10).text('KHPay KHQR Gateway (USD)', 420, 150);

      // Divider
      doc.moveTo(60, 180).lineTo(pageWidth - 60, 180).lineWidth(0.5).stroke('#1E293B');

      // 6. Purchased Item Table
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('ITEM DESCRIPTION', 60, 200);
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('DELIVERY MODE', 330, 200);
      doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(9).text('AMOUNT (USD)', 450, 200, { align: 'right' });

      doc.moveTo(60, 218).lineTo(pageWidth - 60, 218).lineWidth(1).stroke('#334155');

      // Item Row
      doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(11).text(productTitle, 60, 230, { width: 250 });
      doc.fillColor('#10B981').font('Helvetica').fontSize(10).text('Instant Account Delivery', 330, 230);
      doc.fillColor('#F59E0B').font('Helvetica-Bold').fontSize(12).text(`$${orderData.total_amount.toFixed(2)}`, 450, 230, { align: 'right' });

      if (orderData.roblox_username) {
        doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text(`Linked Recipient: @${orderData.roblox_username}`, 60, 255);
      }

      // Divider
      doc.moveTo(60, 280).lineTo(pageWidth - 60, 280).lineWidth(1).stroke('#334155');

      // Total Summary Box
      doc.roundedRect(pageWidth - 260, 295, 200, 50, 6).fill('#1E293B');
      doc.fillColor('#94A3B8').font('Helvetica').fontSize(10).text('TOTAL PAID:', pageWidth - 245, 312);
      doc.fillColor('#F59E0B').font('Helvetica-Bold').fontSize(16).text(`$${orderData.total_amount.toFixed(2)} USD`, pageWidth - 245, 310, { align: 'right', width: 170 });

      // 7. Official Warranty Certificate Card
      const wCardY = 370;
      doc.roundedRect(60, wCardY, pageWidth - 120, 200, 8).fill('#0F172A');
      doc.roundedRect(60, wCardY, pageWidth - 120, 200, 8).lineWidth(1).stroke('#3B82F6');

      doc.fillColor('#60A5FA').font('Helvetica-Bold').fontSize(12).text('🛡️ OFFICIAL WARRANTY & REVERT PROTECTION TERMS', 80, wCardY + 18);

      doc.fillColor('#F8FAFC').font('Helvetica-Bold').fontSize(10).text(`Coverage Period: ${warrantyDays} Days from Delivery`, 80, wCardY + 40);

      const termsText =
        '1. VALIDITY: Warranty is fully active while 2-Factor Authentication (2FA) and security email remain untouched as delivered.\n\n' +
        '2. VOID CONDITIONS: Warranty is STRICTLY VOID if 2FA is deactivated, recovery keys are cleared, or the original security email is altered without staff authorization.\n\n' +
        '3. INSTANT SUPPORT: If you encounter any login issue or account revert during the active warranty period, contact Uchiro Support immediately with this receipt.';

      doc.fillColor('#CBD5E1').font('Helvetica').fontSize(9).text(termsText, 80, wCardY + 62, { width: pageWidth - 160, lineGap: 3 });

      // 8. Footer & Verification Watermark
      const footerY = pageHeight - 85;
      doc.moveTo(60, footerY - 15).lineTo(pageWidth - 60, footerY - 15).lineWidth(0.5).stroke('#1E293B');
      doc.fillColor('#64748B').font('Helvetica').fontSize(8).text('UCHIRO STORE V3 • AUTOMATED SECURE DELIVERY ENGINE • POWERED BY KHPAY BAKONG GATEWAY', 60, footerY, { align: 'center', width: pageWidth - 120 });
      doc.fillColor('#64748B').font('Helvetica').fontSize(8).text('Need assistance? Telegram Support: @UchiroSupport', 60, footerY + 14, { align: 'center', width: pageWidth - 120 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
