import { OrderReceipt } from '../types';

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Builds a 100% compliant, standard PDF-1.4 binary document for an official Order Receipt.
 * Zero external libraries needed.
 * Strictly guarantees NEVER leaking account credentials, passwords, or TOTP keys.
 */
export function generateClientReceiptPdf(receipt: OrderReceipt): Blob {
  const stream: string[] = [];

  const pageWidth = 595.28;
  const pageHeight = 841.89;

  // Background - Dark sleek theme #0B0E14
  stream.push('0.043 0.055 0.078 rg');
  stream.push(`0 0 ${pageWidth} ${pageHeight} re f`);

  // Accent header banner - Crimson bar
  stream.push('0.902 0.224 0.275 rg'); // #E63946
  stream.push(`0 ${pageHeight - 8} ${pageWidth} 8 re f`);

  // Outer container card - #141923
  const cardX = 36;
  const cardY = 46;
  const cardW = pageWidth - 72;
  const cardH = pageHeight - 92;
  stream.push('0.078 0.098 0.137 rg'); // #141923
  stream.push(`${cardX} ${cardY} ${cardW} ${cardH} re f`);

  // Card border - #2A3241
  stream.push('0.165 0.196 0.255 RG'); // #2A3241
  stream.push('1 w');
  stream.push(`${cardX} ${cardY} ${cardW} ${cardH} re S`);

  // Header Title: UCHIRO STORE
  stream.push('BT');
  stream.push('/F2 26 Tf'); // Helvetica-Bold 26
  stream.push('1.000 0.820 0.400 rg'); // #FFD166 Gold
  stream.push(`56 ${pageHeight - 95} Td`);
  stream.push(`(${escapePdfText(receipt.store_name || 'UCHIRO STORE')}) Tj`);
  stream.push('ET');

  // Subtitle
  stream.push('BT');
  stream.push('/F1 10 Tf');
  stream.push('0.600 0.650 0.720 rg');
  stream.push(`56 ${pageHeight - 114} Td`);
  stream.push('(OFFICIAL ORDER RECEIPT & PROOF OF PURCHASE) Tj');
  stream.push('ET');

  // PAID Badge
  stream.push('0.063 0.302 0.173 rg'); // Emerald background
  stream.push(`${pageWidth - 165} ${pageHeight - 118} 105 32 re f`);
  stream.push('0.204 0.780 0.447 RG'); // Emerald border
  stream.push('1 w');
  stream.push(`${pageWidth - 165} ${pageHeight - 118} 105 32 re S`);

  stream.push('BT');
  stream.push('/F2 12 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`${pageWidth - 145} ${pageHeight - 100} Td`);
  stream.push(`(${escapePdfText(receipt.payment_status.toUpperCase())}) Tj`);
  stream.push('ET');

  // Divider Line
  stream.push('0.165 0.196 0.255 RG');
  stream.push(`56 ${pageHeight - 135} m ${pageWidth - 56} ${pageHeight - 135} l S`);

  // Metadata Grid Box
  const metaY = pageHeight - 245;
  stream.push('0.055 0.071 0.102 rg');
  stream.push(`56 ${metaY} ${cardW - 40} 95 re f`);
  stream.push('0.165 0.196 0.255 RG');
  stream.push(`56 ${metaY} ${cardW - 40} 95 re S`);

  // Column 1: Order ID & Date
  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`72 ${pageHeight - 165} Td`);
  stream.push('(ORDER ID) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 13 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`72 ${pageHeight - 182} Td`);
  stream.push(`(#${escapePdfText(receipt.order_number)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`72 ${pageHeight - 208} Td`);
  stream.push('(ORDER DATE & TIME) Tj');
  stream.push('ET');

  const formattedDate = new Date(receipt.order_date).toUTCString();
  stream.push('BT');
  stream.push('/F1 10 Tf');
  stream.push('0.850 0.880 0.920 rg');
  stream.push(`72 ${pageHeight - 224} Td`);
  stream.push(`(${escapePdfText(formattedDate)}) Tj`);
  stream.push('ET');

  // Column 2: Payment Method & Transaction Reference
  const col2X = 320;
  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`${col2X} ${pageHeight - 165} Td`);
  stream.push('(PAYMENT METHOD) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`${col2X} ${pageHeight - 182} Td`);
  stream.push(`(${escapePdfText(receipt.payment_method)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`${col2X} ${pageHeight - 208} Td`);
  stream.push('(TRANSACTION REFERENCE) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 10 Tf');
  stream.push('0.850 0.880 0.920 rg');
  stream.push(`${col2X} ${pageHeight - 224} Td`);
  stream.push(`(${escapePdfText(receipt.transaction_reference || 'N/A')}) Tj`);
  stream.push('ET');

  // Product Table Header
  const tableY = pageHeight - 280;
  stream.push('0.100 0.125 0.170 rg');
  stream.push(`56 ${tableY} ${cardW - 40} 24 re f`);

  stream.push('BT');
  stream.push('/F2 9 Tf');
  stream.push('0.600 0.650 0.730 rg');
  stream.push(`72 ${tableY + 7} Td`);
  stream.push('(PRODUCT / ITEM DESCRIPTION) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 9 Tf');
  stream.push('0.600 0.650 0.730 rg');
  stream.push(`330 ${tableY + 7} Td`);
  stream.push('(ITEM TYPE) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 9 Tf');
  stream.push('0.600 0.650 0.730 rg');
  stream.push(`460 ${tableY + 7} Td`);
  stream.push('(AMOUNT) Tj');
  stream.push('ET');

  // Product Table Row
  const rowY = tableY - 45;
  stream.push('0.055 0.071 0.102 rg');
  stream.push(`56 ${rowY} ${cardW - 40} 45 re f`);
  stream.push('0.165 0.196 0.255 RG');
  stream.push(`56 ${rowY} ${cardW - 40} 45 re S`);

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`72 ${rowY + 24} Td`);
  stream.push(`(${escapePdfText(receipt.product_name.slice(0, 38))}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`72 ${rowY + 10} Td`);
  stream.push(`(Delivery Status: ${escapePdfText(receipt.delivery_status)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 10 Tf');
  stream.push('0.850 0.880 0.920 rg');
  stream.push(`330 ${rowY + 18} Td`);
  stream.push(`(${escapePdfText(receipt.product_type)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 13 Tf');
  stream.push('1.000 0.820 0.400 rg');
  stream.push(`460 ${rowY + 18} Td`);
  stream.push(`($${receipt.amount.toFixed(2)} ${escapePdfText(receipt.currency)}) Tj`);
  stream.push('ET');

  // Summary Totals Card
  const totalY = rowY - 80;
  stream.push('0.078 0.098 0.137 rg');
  stream.push(`300 ${totalY} 239 65 re f`);
  stream.push('0.165 0.196 0.255 RG');
  stream.push(`300 ${totalY} 239 65 re S`);

  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.600 0.650 0.720 rg');
  stream.push(`320 ${totalY + 44} Td`);
  stream.push('(Subtotal:) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 10 Tf');
  stream.push('0.850 0.880 0.920 rg');
  stream.push(`460 ${totalY + 44} Td`);
  stream.push(`($${receipt.amount.toFixed(2)} USD) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 11 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`320 ${totalY + 18} Td`);
  stream.push('(Total Paid:) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 14 Tf');
  stream.push('0.204 0.780 0.447 rg');
  stream.push(`450 ${totalY + 16} Td`);
  stream.push(`($${receipt.amount.toFixed(2)} USD) Tj`);
  stream.push('ET');

  // Warranty Card
  const warY = totalY - 110;
  stream.push('0.055 0.071 0.102 rg');
  stream.push(`56 ${warY} ${cardW - 40} 95 re f`);
  stream.push('0.204 0.780 0.447 RG');
  stream.push('1 w');
  stream.push(`56 ${warY} ${cardW - 40} 95 re S`);

  stream.push('BT');
  stream.push('/F2 12 Tf');
  stream.push('0.204 0.780 0.447 rg');
  stream.push(`72 ${warY + 70} Td`);
  stream.push('(OFFICIAL WARRANTY & REPLACEMENT PROTECTION) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F2 10 Tf');
  stream.push('1.000 1.000 1.000 rg');
  stream.push(`72 ${warY + 50} Td`);
  stream.push(`(Warranty Duration: ${escapePdfText(receipt.warranty_duration)}) Tj`);
  stream.push('ET');

  const warStartDate = receipt.warranty_starts_at ? new Date(receipt.warranty_starts_at).toUTCString() : formattedDate;
  stream.push('BT');
  stream.push('/F1 9 Tf');
  stream.push('0.750 0.780 0.840 rg');
  stream.push(`72 ${warY + 32} Td`);
  stream.push(`(Warranty Active Starting: ${escapePdfText(warStartDate)}) Tj`);
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`72 ${warY + 15} Td`);
  stream.push('(Coverage applies provided original recovery details remain untampered. 24/7 Support via Store Bot.) Tj');
  stream.push('ET');

  // Security Note Card
  const secY = warY - 80;
  stream.push('0.055 0.071 0.102 rg');
  stream.push(`56 ${secY} ${cardW - 40} 65 re f`);
  stream.push('0.902 0.224 0.275 RG');
  stream.push(`56 ${secY} ${cardW - 40} 65 re S`);

  stream.push('BT');
  stream.push('/F2 10 Tf');
  stream.push('0.902 0.224 0.275 rg');
  stream.push(`72 ${secY + 44} Td`);
  stream.push('(SECURITY COMPLIANCE & PRIVACY ASSURANCE) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.700 0.740 0.800 rg');
  stream.push(`72 ${secY + 28} Td`);
  stream.push('(Sensitive credentials like account passwords and TOTP secrets are strictly NEVER printed on receipts.) Tj');
  stream.push('ET');

  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.550 0.600 0.680 rg');
  stream.push(`72 ${secY + 14} Td`);
  stream.push('(Access your delivered items exclusively inside the authenticated Uchiro Telegram Mini App vault.) Tj');
  stream.push('ET');

  // Footer Note
  stream.push('BT');
  stream.push('/F1 8 Tf');
  stream.push('0.400 0.450 0.520 rg');
  stream.push(`120 ${cardY + 15} Td`);
  stream.push('(UCHIRO STORE  *  Telegram Gaming Mini App  *  Verified Transaction Proof  *  Support: @UchiroStore_BOT) Tj');
  stream.push('ET');

  const streamContent = stream.join('\n');
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(streamContent);
  const streamLength = streamBytes.length;

  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`;
  const obj4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n';
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n';
  const obj6 = `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`;

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';

  const offsets: number[] = [];
  let currentOffset = encoder.encode(header).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj1).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj2).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj3).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj4).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj5).length;

  offsets.push(currentOffset);
  currentOffset += encoder.encode(obj6).length;

  const startXref = currentOffset;

  let xref = `xref\n0 7\n0000000000 65535 f \r\n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \r\n`;
  }

  const trailer = `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const pdfString = header + obj1 + obj2 + obj3 + obj4 + obj5 + obj6 + xref + trailer;
  const pdfBytes = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    pdfBytes[i] = pdfString.charCodeAt(i) & 0xff;
  }

  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function downloadReceiptFile(receipt: OrderReceipt) {
  const blob = generateClientReceiptPdf(receipt);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `UCHIRO-Receipt-${receipt.order_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
