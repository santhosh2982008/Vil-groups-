import type { Company, Order } from './types';

/**
 * A tiny PDF writer with no libraries: text, lines and boxes in the built-in Helvetica fonts.
 * The built-in fonts have no rupee sign, so amounts in PDFs are written as "Rs.".
 */

const HELV: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

export const pdfMoney = (n: number): string => 'Rs. ' + Math.round(n).toLocaleString('en-IN');

function clean(s: string): string {
  return String(s ?? '')
    .replace(/₹/g, 'Rs. ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '?');
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of clean(s)) w += HELV[ch.charCodeAt(0) - 32] ?? 556;
  return ((w * (bold ? 1.06 : 1)) / 1000) * size;
}

export function wrapText(s: string, maxW: number, size: number, bold = false): string[] {
  const words = clean(s).split(' ').filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (textWidth(next, size, bold) <= maxW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export class PdfDoc {
  private pages: string[][] = [];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.addPage();
  }
  addPage() {
    this.pages.push([]);
  }
  private get ops() {
    return this.pages[this.pages.length - 1];
  }
  /** y is measured from the top of the page */
  text(x: number, y: number, s: string, size = 10, bold = false, align: 'left' | 'right' | 'center' = 'left') {
    const t = clean(s);
    const wd = textWidth(t, size, bold);
    const px = align === 'right' ? x - wd : align === 'center' ? x - wd / 2 : x;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${px.toFixed(2)} ${(this.h - y).toFixed(2)} Td (${esc(t)}) Tj ET`);
  }
  line(x1: number, y1: number, x2: number, y2: number, width = 0.7) {
    this.ops.push(`${width} w ${x1.toFixed(2)} ${(this.h - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.h - y2).toFixed(2)} l S`);
  }
  rect(x: number, y: number, w: number, h: number, width = 0.9, fill?: number) {
    const yy = (this.h - y - h).toFixed(2);
    if (fill !== undefined) this.ops.push(`${fill} g ${x.toFixed(2)} ${yy} ${w.toFixed(2)} ${h.toFixed(2)} re f 0 g`);
    this.ops.push(`${width} w ${x.toFixed(2)} ${yy} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  get pageCount() {
    return this.pages.length;
  }
  /** Wrapped paragraph; returns the y below it */
  paragraph(x: number, y: number, s: string, maxW: number, size: number, bold = false, lead = size * 1.3): number {
    for (const ln of wrapText(s, maxW, size, bold)) {
      this.text(x, y, ln, size, bold);
      y += lead;
    }
    return y;
  }
  build(): Uint8Array {
    const objs: string[] = [];
    const n = this.pages.length;
    // 1 catalog, 2 pages, 3 F1, 4 F2, then per page: page obj, content obj
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push(`<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`);
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.pages.forEach((ops, i) => {
      const content = ops.join('\n');
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.w} ${this.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
      objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((o, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}

const addressLines = (o: Order): string[] => [o.ship.line1, `${o.ship.city}, ${o.ship.state} - ${o.ship.pincode}`];

/** Shipping label: only the From and To addresses. */
export function shippingLabelPdf(order: Order, company: Company): Uint8Array {
  const W = 420;
  const H = 595; // A5 portrait
  const d = new PdfDoc(W, H);
  const m = 28;
  d.rect(m, m, W - 2 * m, H - 2 * m, 1.5);

  // FROM
  d.text(m + 14, m + 26, 'FROM', 10, true);
  d.line(m + 14, m + 32, W - m - 14, m + 32, 0.5);
  let y = m + 54;
  d.text(m + 14, y, company.name, 15, true);
  y += 20;
  y = d.paragraph(m + 14, y, company.address, W - 2 * m - 28, 11);
  d.text(m + 14, y + 2, `Phone: ${company.phone}`, 11);

  // TO
  const toTop = 250;
  d.line(m, toTop - 20, W - m, toTop - 20, 1.5);
  d.text(m + 14, toTop + 8, 'TO', 12, true);
  d.line(m + 14, toTop + 14, W - m - 14, toTop + 14, 0.5);
  y = toTop + 46;
  y = d.paragraph(m + 14, y, order.ship.name, W - 2 * m - 28, 24, true, 28);
  y += 8;
  for (const ln of addressLines(order)) y = d.paragraph(m + 14, y, ln, W - 2 * m - 28, 16, false, 21);
  y += 14;
  d.text(m + 14, y, `Phone: ${order.ship.phone}`, 15, true);
  return d.build();
}

/** Detailed invoice: From address, customer details and every ordered item with totals. */
export function invoicePdf(order: Order, company: Company, gstRate: number): Uint8Array {
  const W = 595;
  const H = 842; // A4
  const m = 40;
  const d = new PdfDoc(W, H);
  const right = W - m;

  d.text(m, 60, 'INVOICE', 24, true);
  d.text(right, 48, `Invoice no: ${order.id}`, 11, true, 'right');
  d.text(right, 64, `Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 11, false, 'right');
  d.text(right, 80, `Payment: ${order.payment}`, 11, false, 'right');
  d.line(m, 96, right, 96, 1.2);

  // From / customer
  const colW = (W - 2 * m - 20) / 2;
  d.text(m, 118, 'FROM', 9, true);
  d.text(m + colW + 20, 118, 'BILL TO / SHIP TO', 9, true);
  let yL = 134;
  d.text(m, yL, company.name, 13, true);
  yL = d.paragraph(m, yL + 16, company.address, colW, 10.5);
  d.text(m, yL, `Phone: ${company.phone}`, 10.5);
  yL += 14;
  d.text(m, yL, `Email: ${company.email}`, 10.5);
  yL += 14;

  let yR = 134;
  d.text(m + colW + 20, yR, order.ship.name, 13, true);
  yR += 16;
  for (const ln of addressLines(order)) yR = d.paragraph(m + colW + 20, yR, ln, colW, 10.5);
  d.text(m + colW + 20, yR, `Phone: ${order.ship.phone}`, 10.5);
  yR += 14;
  d.text(m + colW + 20, yR, `Customer: ${order.customerName} (${order.customerEmail})`.slice(0, 70), 9.5);
  yR += 14;

  let y = Math.max(yL, yR) + 14;

  // items table
  const cols = { n: m + 6, item: m + 30, qty: right - 190, unit: right - 100, amt: right - 6 };
  const header = (yy: number) => {
    d.rect(m, yy, right - m, 22, 0.6, 0.92);
    d.text(cols.n, yy + 15, '#', 9.5, true);
    d.text(cols.item, yy + 15, 'ITEM', 9.5, true);
    d.text(cols.qty, yy + 15, 'QTY', 9.5, true, 'right');
    d.text(cols.unit, yy + 15, 'UNIT PRICE', 9.5, true, 'right');
    d.text(cols.amt, yy + 15, 'AMOUNT', 9.5, true, 'right');
    return yy + 22;
  };
  y = header(y);
  order.items.forEach((it, i) => {
    const nameLines = wrapText(it.name, cols.qty - cols.item - 50, 10.5);
    const rowH = nameLines.length * 13 + 16;
    if (y + rowH > H - 190) {
      d.addPage();
      y = header(48);
    }
    nameLines.forEach((ln, k) => d.text(cols.item, y + 14 + k * 13, ln, 10.5, k === 0));
    d.text(cols.item, y + 14 + nameLines.length * 13, `SKU ${it.sku}  |  Sold by ${it.vendorName || (it.vendorId ? 'Vendor' : company.name)}`, 8.5);
    d.text(cols.n, y + 14, String(i + 1), 10.5);
    d.text(cols.qty, y + 14, String(it.qty), 10.5, false, 'right');
    d.text(cols.unit, y + 14, pdfMoney(it.price), 10.5, false, 'right');
    d.text(cols.amt, y + 14, pdfMoney(it.price * it.qty), 10.5, false, 'right');
    y += rowH;
    d.line(m, y, right, y, 0.4);
  });

  // totals
  if (y > H - 170) {
    d.addPage();
    y = 60;
  }
  y += 22;
  const row = (label: string, value: string, bold = false) => {
    d.text(right - 150, y, label, bold ? 12 : 10.5, bold);
    d.text(right - 6, y, value, bold ? 12 : 10.5, bold, 'right');
    y += bold ? 20 : 16;
  };
  row('Subtotal', pdfMoney(order.subtotal));
  if (order.discount) row(`Discount${order.coupon ? ` (${order.coupon})` : ''}`, '- ' + pdfMoney(order.discount));
  row(`GST (${gstRate}%)`, pdfMoney(order.gst));
  row(`Shipping${order.courier ? ` (${order.courier})` : ''}`.slice(0, 34), order.shipping === 0 ? 'Free' : pdfMoney(order.shipping));
  d.line(right - 150, y - 8, right, y - 8, 0.8);
  y += 4;
  row('TOTAL', pdfMoney(order.total), true);

  d.text(m, H - 50, 'Thank you for your business. This is a computer-generated invoice.', 9);
  d.text(right, H - 50, `${company.name}`, 9, true, 'right');
  return d.build();
}

/** Saves PDF bytes as a file in the browser. */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
