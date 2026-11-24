import type { Coupon, Courier, Order, OrderEvent, OrderStatus, PaymentStatus, PriceTier, Product, RateCard, Settings, ShippingRules, Spec, Totals } from './types';

/** A product can be bought only when the owner has not marked it out of stock and quantity > 0. */
export const isAvailable = (p: Product): boolean => p.available !== false && p.stock > 0;

export function couponDiscount(c: Coupon, subtotal: number): number {
  let d = c.type === 'percent' ? (subtotal * c.value) / 100 : Math.min(c.value, subtotal);
  if (c.type === 'percent' && c.maxDiscount > 0) d = Math.min(d, c.maxDiscount);
  return Math.max(0, Math.round(d));
}

export type CouponResult = { ok: true; coupon: Coupon; discount: number } | { ok: false; error: string };

export function evaluateCoupon(code: string, subtotal: number, coupons: Coupon[], now: Date = new Date()): CouponResult {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return { ok: false, error: 'Enter a coupon code.' };
  const c = coupons.find((x) => x.code.trim().toUpperCase() === wanted);
  if (!c) return { ok: false, error: 'This coupon code is not valid.' };
  if (!c.active) return { ok: false, error: 'This coupon is not active.' };
  if (c.expiresAt && new Date(c.expiresAt + 'T23:59:59').getTime() < now.getTime()) {
    return { ok: false, error: 'This coupon has expired.' };
  }
  if (subtotal < c.minOrder) {
    return { ok: false, error: `Add items worth ${inr(c.minOrder - subtotal)} more (excl. GST) to use this coupon.` };
  }
  return { ok: true, coupon: c, discount: couponDiscount(c, subtotal) };
}

/** `shippingCharge` = the chosen option's charge for this cart, or null while it cannot be known yet (no courier or state chosen). */
export function computeTotals(subtotal: number, settings: Settings, coupon: Coupon | null, shippingCharge: number | null): Totals {
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  const taxable = Math.max(0, subtotal - discount);
  const gst = (taxable * settings.gstRate) / 100;
  const free = settings.freeShippingAbove > 0 && taxable >= settings.freeShippingAbove;
  const shipping = subtotal === 0 || free || shippingCharge === null ? 0 : shippingCharge;
  return {
    subtotal,
    discount,
    gst,
    shipping,
    total: taxable + gst + shipping,
    shippingPending: subtotal > 0 && !free && shippingCharge === null,
  };
}

/* ---------- product photos ---------- */

export const productImages = (p: Pick<Product, 'image' | 'images'>): string[] =>
  p.images && p.images.length > 0 ? p.images.filter(Boolean) : p.image ? [p.image] : [];

/* ---------- quantity price tiers ---------- */

/** Tiers sorted by starting quantity, one per start quantity (the first one wins), never below 1. */
export function cleanTiers(tiers: PriceTier[] | undefined): PriceTier[] {
  const seen = new Set<number>();
  return [...(tiers ?? [])]
    .map((t) => ({ minQty: Math.max(1, Math.floor(Number(t.minQty) || 1)), price: Number(t.price) || 0 }))
    .sort((a, b) => a.minQty - b.minQty)
    .filter((t) => (seen.has(t.minQty) ? false : (seen.add(t.minQty), true)));
}

/** Unit price for a quantity: the bracket whose range contains it, otherwise the flat price. */
export function unitPriceFor(p: Pick<Product, 'price' | 'priceTiers'>, qty: number): number {
  const tiers = cleanTiers(p.priceTiers);
  let price = p.price;
  for (const t of tiers) if (qty >= t.minQty) price = t.price;
  return price;
}

export interface TierRange {
  from: number;
  /** null = no upper limit (the final bracket) */
  to: number | null;
  price: number;
}

/** Brackets as ranges. If the first tier starts above 1, quantities below it use the flat price. */
export function tierRanges(p: Pick<Product, 'price' | 'priceTiers'>): TierRange[] {
  const tiers = cleanTiers(p.priceTiers);
  if (tiers.length === 0) return [];
  const out: TierRange[] = [];
  if (tiers[0].minQty > 1) out.push({ from: 1, to: tiers[0].minQty - 1, price: p.price });
  tiers.forEach((t, i) => out.push({ from: t.minQty, to: i < tiers.length - 1 ? tiers[i + 1].minQty - 1 : null, price: t.price }));
  return out;
}

export const rangeLabel = (r: TierRange): string => (r.to === null ? `${r.from}+` : r.from === r.to ? `${r.from}` : `${r.from} to ${r.to}`);

/** Returns an error text, or '' when the tiers are fine. */
export function tierProblem(tiers: PriceTier[]): string {
  if (tiers.length === 0) return '';
  const seen = new Set<number>();
  for (const t of tiers) {
    const q = Number(t.minQty);
    if (!Number.isInteger(q) || q < 1) return 'Each price bracket needs a whole starting quantity of 1 or more.';
    if (seen.has(q)) return `Two brackets start at quantity ${q}. Each start quantity must be different.`;
    seen.add(q);
    if (!(Number(t.price) > 0)) return `Enter a price above 0 for the bracket starting at ${q}.`;
  }
  return '';
}

/** The owner's margin goes on top of a vendor's price (and on every bracket). Own products are untouched. */
export function withMargin(p: Product, pct: number): Product {
  if (!p.vendorId) return p;
  const up = (n: number) => Math.round(n * (1 + pct / 100));
  return { ...p, vendorPrice: p.price, price: up(p.price), priceTiers: p.priceTiers?.map((t) => ({ ...t, price: up(t.price) })) };
}

/* ---------- courier charges (state + weight) ---------- */

export const rateCardFor = (rules: ShippingRules, state: string): RateCard => rules.states[state] ?? rules.defaultRate;

/** Charge for a total shipment weight: the first slab that holds it, or the last slab plus extra per further kg (rounded up). */
export function weightCharge(card: RateCard, kg: number): number {
  const slabs = [...card.slabs].sort((a, b) => a.upToKg - b.upToKg);
  if (slabs.length === 0) return 0;
  const hit = slabs.find((s) => kg <= s.upToKg);
  if (hit) return hit.charge;
  const last = slabs[slabs.length - 1];
  return last.charge + Math.ceil(kg - last.upToKg) * card.extraPerKg;
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

export const netWeight = (lines: { qty: number; weightKg?: number }[]): number =>
  r3(lines.reduce((s, l) => s + (Number(l.weightKg) || 0) * l.qty, 0));

/** Net weight plus the packing box. Zero for an empty cart. */
export const shipmentWeight = (rules: ShippingRules, netKg: number): number => (netKg > 0 || rules.boxWeightKg > 0 ? r3(netKg + rules.boxWeightKg) : 0);

export const isWeightBased = (settings: Settings, c: Courier): boolean => settings.shipping.enabled && Boolean(c.weightBased);

/** Charge of one delivery option for this cart. null = needs the destination state first. */
export function optionCharge(settings: Settings, c: Courier, state: string, netKg: number): number | null {
  if (!isWeightBased(settings, c)) return c.charge;
  if (!state) return null;
  const kg = shipmentWeight(settings.shipping, netKg);
  return Math.round(weightCharge(rateCardFor(settings.shipping, state), kg) * (c.multiplier ?? 1));
}

const MAX_IMAGE_CHARS = 350_000; // ~260 KB of image data, keeps browser storage from filling up

interface Decoded {
  source: CanvasImageSource;
  w: number;
  h: number;
  release: () => void;
}

/** Decode an image file. createImageBitmap also applies the photo's rotation (EXIF). */
async function decodeImage(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function' && file.type !== 'image/svg+xml') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch {
      /* fall through to the <img> decoder */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('unreadable'));
      el.src = url;
    });
    return { source: img, w: img.naturalWidth || 300, h: img.naturalHeight || 300, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This image format is not supported by your browser. Save it as a JPG or PNG and try again.');
  }
}

/** Resize an uploaded image in the browser so it stays small enough for local storage. */
export async function resizeImage(file: File, maxDim: number, mime: 'image/jpeg' | 'image/png', quality = 0.82, maxChars = MAX_IMAGE_CHARS): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG, PNG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is larger than 25 MB. Choose a smaller one.');
  const dec = await decodeImage(file);
  try {
    let dim = maxDim;
    let q = quality;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, dim / Math.max(dec.w, dec.h));
      const w = Math.max(1, Math.round(dec.w * scale));
      const h = Math.max(1, Math.round(dec.h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Image processing is not available in this browser.');
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(dec.source, 0, 0, w, h);
      const out = canvas.toDataURL(mime, q);
      if (out.length <= maxChars || attempt === 5) return out;
      // still too big: shrink the picture, and lower the quality for JPEG
      dim = Math.round(dim * 0.75);
      if (mime === 'image/jpeg') q = Math.max(0.5, q - 0.08);
    }
    throw new Error('The image could not be compressed.');
  } finally {
    dec.release();
  }
}

export const inr = (n: number): string => '₹' + Math.round(n).toLocaleString('en-IN');

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function uid(prefix: string): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function orderId(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `VEL-${yy}${mm}${dd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** "Label: value" per line -> Spec[] */
export function parseSpecs(text: string): Spec[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      return i === -1 ? { label: l, value: '' } : { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    });
}

export const specsToText = (specs: Spec[]): string => specs.map((s) => `${s.label}: ${s.value}`).join('\n');

export const parseLines = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

export const discountPct = (price: number, mrp: number): number =>
  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

export const isValidGmail = (email: string): boolean => /^[a-z0-9._%+-]+@gmail\.com$/i.test(email.trim());
export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
export const isValidPhone = (phone: string): boolean => phone.replace(/[^\d]/g, '').length >= 10;

/* ---------- order tracking ---------- */

export const TRACK_STEPS = ['Placed', 'Packaged', 'Couriered', 'Out for delivery', 'Delivered'] as const;
export type TrackStep = (typeof TRACK_STEPS)[number];

const LEGACY: Record<string, OrderStatus> = { Processing: 'Packaged', Accepted: 'Packaged', Shipped: 'Couriered' };

/** Maps status names saved by older versions onto the current ones. */
export function normalizeStatus(s: string): OrderStatus {
  if (LEGACY[s]) return LEGACY[s];
  return (['Pending Owner Approval', 'Placed', 'Packaged', 'Couriered', 'Out for delivery', 'Delivered', 'Cancelled'] as string[]).includes(s) ? (s as OrderStatus) : 'Pending Owner Approval';
}

/** Orders saved before vendor approval existed: an unassigned "Placed" order is simply waiting for approval. */
export function normalizeOrder(o: Order): Order {
  let status = normalizeStatus(o.status);
  if (status === 'Placed' && !o.vendorId) status = 'Pending Owner Approval';
  const history = (o.history ?? [{ status: 'Placed' as OrderStatus, at: o.createdAt }]).map((e) => ({ ...e, status: normalizeStatus(e.status) }));
  return {
    ...o,
    status,
    history: status === 'Pending Owner Approval' && !o.vendorId ? history.map((e) => (e.status === 'Placed' ? { ...e, status: 'Pending Owner Approval' as OrderStatus } : e)) : history,
  };
}

export const STEP_LABEL: Record<TrackStep, string> = {
  Placed: 'Order placed',
  Packaged: 'Packaged',
  Couriered: 'Couriered',
  'Out for delivery': 'Out for delivery',
  Delivered: 'Delivered',
};

/** The stage a vendor may set next, or null when the order is finished, cancelled or not yet assigned. */
export function nextStage(status: OrderStatus): TrackStep | null {
  const i = TRACK_STEPS.indexOf(status as TrackStep);
  return i >= 0 && i < TRACK_STEPS.length - 1 ? TRACK_STEPS[i + 1] : null;
}

/** An order the owner can still assign, reassign or cancel. */
export const isOpenOrder = (o: Order): boolean => {
  const s = normalizeStatus(o.status);
  return s !== 'Delivered' && s !== 'Cancelled';
};

/** History with one more event. Every change keeps its own dated entry. */
export function nextHistory(order: Order, status: OrderStatus, now: string, note?: string): OrderEvent[] {
  const history: OrderEvent[] = order.history ?? [{ status: 'Pending Owner Approval', at: order.createdAt }];
  return [...history, note ? { status, at: now, note } : { status, at: now }];
}

export interface TimelineStep {
  step: TrackStep;
  label: string;
  date: string | null; // ISO, null = pending (or not recorded)
  done: boolean;
  current: boolean;
}

export function orderTimeline(order: Order): TimelineStep[] {
  const status = normalizeStatus(order.status);
  const hist = order.history ?? [];
  const reached =
    status === 'Cancelled'
      ? hist.reduce((n, e) => Math.max(n, TRACK_STEPS.indexOf(e.status as TrackStep)), -1)
      : TRACK_STEPS.indexOf(status as TrackStep);
  return TRACK_STEPS.map((step, i) => {
    // the latest entry for a step, so an order that was reassigned and restarted shows its new dates
    const ev = [...hist].reverse().find((e) => e.status === step);
    const date = i > reached ? null : ev ? ev.at : null;
    return { step, label: STEP_LABEL[step], date, done: i <= reached, current: status !== 'Cancelled' && i === reached };
  });
}

export function fmtDay(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One-sentence status for the top of an order card. */
export function statusSummary(order: Order): string {
  const status = normalizeStatus(order.status);
  const at = (st: OrderStatus) => [...(order.history ?? [])].reverse().find((e) => e.status === st)?.at;
  const on = (st: OrderStatus) => {
    const t = at(st);
    return t ? ` on ${fmtDay(t)}` : '';
  };
  const via = order.courier ? ` via ${order.courier}` : '';
  const eta = order.expectedDelivery ? ` Expected delivery: ${fmtDay(order.expectedDelivery)}.` : '';
  switch (status) {
    case 'Pending Owner Approval':
      return `We received your order on ${fmtDay(order.createdAt)}. It is waiting for approval and will be assigned to a seller shortly.`;
    case 'Placed':
      return `Your order was approved and placed${on('Placed')}. The seller is preparing it.`;
    case 'Packaged':
      return `Your order was packaged${on('Packaged')} and will be handed to the courier soon.${eta}`;
    case 'Couriered':
      return `Your order was handed to the courier${on('Couriered')}${via}.${eta}`;
    case 'Out for delivery':
      return `Your order is out for delivery${on('Out for delivery')}${via}.${eta}`;
    case 'Delivered':
      return `Your order was delivered${on('Delivered')}.`;
    default:
      return `This order was cancelled${on('Cancelled')}.${order.cancelReason ? ` Reason: ${order.cancelReason}.` : ''}`;
  }
}

/** The shop an ordered item belongs to. */
export const soldBy = (i: { vendorId?: string; vendorName?: string }): string => i.vendorName || (i.vendorId ? 'Vendor' : 'Vel Groups');

export const paymentStatusOf = (o: Order): PaymentStatus => o.paymentStatus ?? 'Pending';

/** Link to the courier's tracking page for this order, if one can be built. */
export function trackingLink(order: Order, couriers: Courier[]): string {
  if (order.shipMode === 'self' || !order.trackingNumber) return '';
  const raw = order.trackingUrl || couriers.find((c) => c.name === order.courier)?.trackingUrl || '';
  if (!raw) return '';
  const url = raw.replace('{id}', encodeURIComponent(order.trackingNumber));
  return /^https?:\/\//i.test(url) ? url : '';
}
