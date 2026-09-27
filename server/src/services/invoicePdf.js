const PDFDocument = require('pdfkit');

// Built-in PDF fonts have no ₹ glyph, so amounts print as "Rs."
const money = (n) =>
  `Rs. ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';

/**
 * Streams an invoice PDF (spec section 12) into `res`.
 * invoice: populated invoice doc, works: work entries, business, client, paid: amount received
 */
function streamInvoicePdf(res, { invoice, business, client, works, paid }) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  doc.pipe(res);

  const ink = '#1c2430';
  const muted = '#667085';
  const accent = '#d99a00';
  const left = 48;
  const right = doc.page.width - 48;
  const width = right - left;

  // Header band
  doc.rect(0, 0, doc.page.width, 8).fill(accent);
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(20).text(business.name, left, 36);
  doc.font('Helvetica').fontSize(9).fillColor(muted);
  [business.address, [business.phone, business.email].filter(Boolean).join('  |  '),
    business.gstNumber ? `GSTIN: ${business.gstNumber}` : null]
    .filter(Boolean).forEach((line) => doc.text(line, { width: 280 }));

  doc.font('Helvetica-Bold').fontSize(22).fillColor(ink).text('INVOICE', left, 36, { width, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(muted);
  doc.text(`No. ${invoice.invoiceNumber}`, left, 64, { width, align: 'right' });
  doc.text(`Date: ${fmtDate(invoice.date)}`, { width, align: 'right' });
  if (invoice.dueDate) doc.text(`Due: ${fmtDate(invoice.dueDate)}`, { width, align: 'right' });

  // Bill to
  let y = 140;
  doc.moveTo(left, y).lineTo(right, y).strokeColor('#e4e7ec').lineWidth(1).stroke();
  y += 14;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text('BILL TO', left, y);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(ink).text(client.name, left, y + 14);
  doc.font('Helvetica').fontSize(9).fillColor(muted);
  [client.contactPerson, client.address, [client.phone, client.email].filter(Boolean).join('  |  '),
    client.gstNumber ? `GSTIN: ${client.gstNumber}` : null]
    .filter(Boolean).forEach((line) => doc.text(line, { width: 300 }));

  // Table
  y = Math.max(doc.y + 20, 230);
  const cols = [
    { label: 'Date', x: left, w: 70 },
    { label: 'Work / Location', x: left + 70, w: 200 },
    { label: 'Vehicle', x: left + 270, w: 85 },
    { label: 'Hours', x: left + 355, w: 50, align: 'right' },
    { label: 'Amount', x: left + 405, w: width - 405, align: 'right' },
  ];
  doc.rect(left, y, width, 22).fill('#f2f4f7');
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(9);
  cols.forEach((c) => doc.text(c.label, c.x + 6, y + 7, { width: c.w - 12, align: c.align || 'left' }));
  y += 22;

  doc.font('Helvetica').fontSize(9);
  works.forEach((w) => {
    const desc = [w.location, w.pickup && w.destination ? `${w.pickup} to ${w.destination}` : null,
      `${w.startTime}-${w.endTime}`, w.notes].filter(Boolean).join('\n');
    const h = Math.max(doc.heightOfString(desc, { width: cols[1].w - 12 }), 12) + 12;
    if (y + h > doc.page.height - 160) {
      doc.addPage();
      y = 48;
    }
    const cells = [fmtDate(w.date), desc, w.vehicleId?.vehicleNumber || '-', String(w.hours ?? ''), money(w.amount)];
    doc.fillColor(ink);
    cols.forEach((c, i) => doc.text(cells[i], c.x + 6, y + 6, { width: c.w - 12, align: c.align || 'left' }));
    y += h;
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#eaecf0').stroke();
  });

  // Totals
  y += 12;
  const tx = right - 220;
  const line = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor(ink);
    doc.text(label, tx, y, { width: 110 });
    doc.text(value, tx + 110, y, { width: 110, align: 'right' });
    y += bold ? 20 : 16;
  };
  line('Subtotal', money(invoice.subtotal));
  if (invoice.gstPercent > 0) line(`GST (${invoice.gstPercent}%)`, money(invoice.gstAmount));
  doc.moveTo(tx, y).lineTo(right, y).strokeColor(ink).stroke();
  y += 6;
  line('Total', money(invoice.total), true);
  line('Received', money(paid));
  const balance = Math.max(invoice.total - paid, 0);
  line('Balance due', money(balance), true);

  const status = balance <= 0 ? 'PAID' : paid > 0 ? 'PARTIALLY PAID' : 'UNPAID';
  doc.font('Helvetica-Bold').fontSize(10).fillColor(balance <= 0 ? '#067647' : '#b42318')
    .text(status, left, y - 36, { width: 200 });

  if (invoice.notes) {
    y += 16;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(muted).text('NOTES', left, y);
    doc.font('Helvetica').fontSize(9).fillColor(ink).text(invoice.notes, left, y + 12, { width });
  }

  doc.font('Helvetica').fontSize(8).fillColor(muted)
    .text('This is a computer-generated invoice.', left, doc.page.height - 60, { width, align: 'center' });
  doc.end();
}

module.exports = { streamInvoicePdf };
