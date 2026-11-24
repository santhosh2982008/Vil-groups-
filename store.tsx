import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CartLine,
  Category,
  Company,
  Coupon,
  Courier,
  Enquiry,
  EnquiryStatus,
  Order,
  OrderUpdate,
  PaymentPatch,
  PlaceResult,
  Product,
  Role,
  Service,
  Session,
  Settings,
  ShippingInfo,
  Totals,
  UserRecord,
  Vendor,
  VendorAddress,
  VendorDocs,
  VendorStatus,
} from './types';
import { ADMIN_EMAILS, INDIAN_STATES, KEY_PREFIX, LOCKOUT_MINUTES, MAX_FAILED_LOGINS, SESSION_HOURS } from './config';
import { SHARED_KEYS, registerShared, schedulePush } from './sync';
import { hashPassword, passwordProblems, timingSafeEqual } from './auth';
import { SEED_CATEGORIES, SEED_COMPANY, SEED_PRODUCTS, SEED_SERVICES, SEED_SETTINGS, normalizeSettings } from './seed';
import {
  computeTotals,
  evaluateCoupon,
  isAvailable,
  isValidEmail,
  isValidPhone,
  netWeight,
  nextHistory,
  nextStage,
  paymentStatusOf,
  normalizeOrder,
  normalizeStatus,
  isOpenOrder,
  optionCharge,
  orderId,
  productImages,
  shipmentWeight,
  tierProblem,
  cleanTiers,
  uid,
  unitPriceFor,
  withMargin,
} from './utils';

/* ---------- localStorage persistence (the "mock database") ---------- */

function loadKey<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveKey(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
  } catch {
    // Most often the browser's ~5 MB quota, caused by large uploaded images.
    window.dispatchEvent(new CustomEvent('vel-storage-error'));
  }
}

function usePersisted<T>(key: string, initial: T, normalize?: (v: T) => T, onRemote?: (prev: T, next: T) => void) {
  const [value, setValue] = useState<T>(() => {
    const v = loadKey<T>(key, initial);
    return normalize ? normalize(v) : v;
  });
  const lastRaw = useRef<string | null>(null);
  const latest = useRef<T>(value);
  const serverRaw = useRef<string | null>(null);
  const shared = SHARED_KEYS.includes(key);
  useEffect(() => {
    latest.current = value;
    lastRaw.current = JSON.stringify(value);
    saveKey(key, value);
    if (shared && lastRaw.current !== serverRaw.current) schedulePush(key);
  }, [key, value]);
  // Shared tables are mirrored to the server so every device and the installed app see the same data.
  useEffect(() => {
    if (!shared) return undefined;
    return registerShared(key, {
      current: () => latest.current,
      apply: (v) => {
        const next = normalize ? normalize(v as T) : (v as T);
        serverRaw.current = JSON.stringify(next);
        if (serverRaw.current === lastRaw.current) return;
        const prev = latest.current;
        setValue(next);
        onRemote?.(prev, next);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Live updates: when another tab of this site saves this key (for example the owner updating an
  // order), pick the change up here without a reload.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY_PREFIX + key || e.newValue === lastRaw.current) return;
      try {
        const v = e.newValue ? (JSON.parse(e.newValue) as T) : initial;
        const next = normalize ? normalize(v) : v;
        const prev = latest.current;
        setValue(next);
        onRemote?.(prev, next);
      } catch {
        /* ignore unreadable data */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, setValue] as const;
}

/* ---------- context ---------- */

interface Toast {
  id: number;
  message: string;
}

interface CartDetail {
  line: CartLine;
  product: Product;
  /** price per unit at this quantity (quantity brackets applied) */
  unitPrice: number;
  lineTotal: number;
}

export interface Quote {
  totals: Totals;
  coupon: Coupon | null;
  courier: Courier | null;
  couponError: string;
  /** products' net weight, and net + packing box, in kg */
  netKg: number;
  weightKg: number;
  /** charge of every enabled option for the chosen state; null = needs a state first */
  optionCharges: Record<string, number | null>;
}

export interface VendorForm {
  name: string;
  phone1: string;
  phone2: string;
  email: string;
  shopName: string;
  shopPhone: string;
  address: VendorAddress;
}

interface AppCtx {
  session: Session | null;
  role: Role;
  products: Product[];
  /** products the public can see (not hidden by the owner) */
  catalog: Product[];
  services: Service[];
  company: Company;
  settings: Settings;
  orders: Order[];
  enquiries: Enquiry[];
  cart: CartLine[];
  cartDetail: CartDetail[];
  cartCount: number;
  totals: Totals;
  quote: (couponCode: string, courierId: string, state?: string) => Quote;
  prefill: string;
  setPrefill: (topic: string) => void;
  toasts: Toast[];
  notify: (message: string) => void;
  register: (email: string, name: string, password: string) => Promise<string | null>;
  login: (email: string, password: string) => Promise<string | null>;
  signOut: () => void;
  addToCart: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  placeOrder: (ship: ShippingInfo, paymentId: string, courierId: string, couponCode: string) => PlaceResult;
  /** the signed-in account's vendor record, if any (pending, approved or rejected) */
  myVendor: Vendor | null;
  /** products this vendor manages (raw prices, before margin) */
  myProducts: Product[];
  vendors: Vendor[];
  registerVendor: (form: VendorForm, docs: VendorDocs) => string | null;
  decideVendor: (id: string, status: VendorStatus, note: string) => void;
  removeVendor: (id: string) => void;
  /** owner only */
  getVendorDocs: (id: string) => VendorDocs | null;
  submitEnquiry: (e: Omit<Enquiry, 'id' | 'createdAt' | 'status'>) => Enquiry;
  categories: Category[];
  saveCategory: (c: Category) => boolean;
  deleteCategory: (id: string) => void;
  saveProduct: (p: Product) => boolean;
  deleteProduct: (id: string) => void;
  saveService: (s: Service) => boolean;
  deleteService: (id: string) => void;
  saveCompany: (c: Company) => boolean;
  saveSettings: (s: Settings) => boolean;
  /** Owner: send a pending order to an approved vendor, or move it to a different one. Returns an error text or null. */
  assignOrder: (id: string, vendorId: string) => string | null;
  /** Owner: cancel an order that is not delivered yet. Returns an error text or null. */
  cancelOrder: (id: string, reason: string) => string | null;
  /** Assigned vendor only: set the next stage and/or the shipment details. Returns an error text or null. */
  updateOrder: (id: string, update: OrderUpdate) => string | null;
  setOrderPayment: (id: string, patch: PaymentPatch) => void;
  /** Customer: attach a GPay payment screenshot to their own order. The owner is told to verify it. Returns an error text or null. */
  submitPaymentProof: (orderId: string, image: string) => string | null;
  /** The screenshot of an order: the owner and the customer who placed it only. */
  getPaymentProof: (orderId: string) => string | null;
  setEnquiryStatus: (id: string, status: EnquiryStatus) => void;
  resetAll: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [storedSession, setSession] = usePersisted<Session | null>('session', null);
  const [users, setUsers] = usePersisted<UserRecord[]>('users', []);
  const [, setClock] = useState(0);
  // A session is only valid until its expiry time; older sessions (no expiry) are rejected.
  const session: Session | null =
    storedSession && typeof storedSession.expiresAt === 'number' && storedSession.expiresAt > Date.now() ? storedSession : null;
  const [products, setProducts] = usePersisted<Product[]>('products', SEED_PRODUCTS);
  const [services, setServices] = usePersisted<Service[]>('services', SEED_SERVICES);
  const [company, setCompany] = usePersisted<Company>('company', SEED_COMPANY);
  const [settings, setSettings] = usePersisted<Settings>('settings', SEED_SETTINGS, normalizeSettings);
  // Changes saved by another tab (the owner, a vendor or the customer) arrive here live; tell the person what changed.
  const remoteRef = useRef<((prev: Order[], next: Order[]) => void) | null>(null);
  const [orders, setOrders] = usePersisted<Order[]>('orders', [], (l) => l.map(normalizeOrder), (p, n) => remoteRef.current?.(p, n));
  const [enquiries, setEnquiries] = usePersisted<Enquiry[]>('enquiries', []);
  const [cart, setCart] = usePersisted<CartLine[]>('cart', []);
  const [categories, setCategories] = usePersisted<Category[]>('categories', SEED_CATEGORIES);
  const [proofs, setProofs] = usePersisted<Record<string, string>>('proofs', {});
  const [vendors, setVendors] = usePersisted<Vendor[]>('vendors', []);
  const [vendorDocs, setVendorDocs] = usePersisted<Record<string, VendorDocs>>('vendorDocs', {});
  const [prefill, setPrefill] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Role is derived from the signed-in email every render, never stored.
  const myVendor: Vendor | null = session ? vendors.find((v) => v.userEmail === session.email.toLowerCase()) ?? null : null;
  const role: Role = session
    ? ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(session.email.toLowerCase())
      ? 'admin'
      : myVendor?.status === 'Approved'
        ? 'vendor'
        : 'customer'
    : 'guest';

  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    const onFull = () => notify('Browser storage is full. Remove or shrink large images, then save again.');
    window.addEventListener('vel-storage-error', onFull);
    return () => window.removeEventListener('vel-storage-error', onFull);
  }, [notify]);

  remoteRef.current = (prev, next) => {
    if (!session) return;
    const before = new Map(prev.map((o) => [o.id, o]));
    for (const o of next) {
      const p = before.get(o.id);
      const status = normalizeStatus(o.status);
      if (!p) {
        if (role === 'admin') notify(`New order ${o.id} is waiting for approval`);
        continue;
      }
      const payMoved = (p.paymentStatus ?? 'Pending') !== (o.paymentStatus ?? 'Pending');
      if (payMoved && role === 'admin' && o.paymentStatus === 'Awaiting verification') notify(`Payment screenshot received for ${o.id}. Please verify it.`);
      if (payMoved && o.customerEmail === session.email && (o.paymentStatus === 'Paid' || o.paymentStatus === 'Failed')) notify(`Payment for ${o.id}: ${o.paymentStatus === 'Paid' ? 'verified, thank you' : 'could not be verified. Please check My Orders'}`);
      const moved = normalizeStatus(p.status) !== status;
      const assignedNow = p.vendorId !== o.vendorId;
      if (role === 'customer' || role === 'vendor') {
        if (o.customerEmail === session.email && (moved || assignedNow)) notify(`Your order ${o.id} is now: ${status}`);
      }
      if (role === 'vendor' && myVendor && o.vendorId === myVendor.id && assignedNow) notify(`Order ${o.id} was assigned to your shop`);
      if (role === 'admin' && moved && o.vendorId) notify(`${o.id} is now ${status}${o.vendorName ? ` (${o.vendorName})` : ''}`);
    }
  };

  const requireAdmin = (): boolean => {
    if (role !== 'admin') {
      notify('Administrator access required.');
      return false;
    }
    return true;
  };

  /* ----- auth ----- */
  // Re-check expiry every 30 s so an idle tab is signed out when its session runs out.
  useEffect(() => {
    const t = window.setInterval(() => setClock((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (storedSession && !session) setSession(null);
  }, [storedSession, session, setSession]);

  const startSession = (email: string, name: string) =>
    setSession({ email, name, expiresAt: Date.now() + SESSION_HOURS * 3600_000 });

  const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

  const register = async (email: string, name: string, password: string): Promise<string | null> => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e)) return 'Enter a valid email address.';
    if (name.trim().length < 2) return 'Enter your name.';
    const problems = passwordProblems(password);
    if (problems.length > 0) return `Your password needs ${problems.join(', ')}.`;
    if (users.some((u) => u.email === e)) return 'An account with this email already exists. Sign in instead.';
    try {
      const h = await hashPassword(password);
      const user: UserRecord = {
        email: e,
        name: name.trim(),
        ...h,
        createdAt: new Date().toISOString(),
        failed: 0,
        lockedUntil: 0,
      };
      setUsers((prev) => (prev.some((u) => u.email === e) ? prev : [...prev, user]));
      startSession(e, user.name);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not create the account.';
    }
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    const e = email.trim().toLowerCase();
    if (!isValidEmail(e) || !password) return GENERIC_LOGIN_ERROR;
    const user = users.find((u) => u.email === e);
    try {
      if (!user) {
        await hashPassword(password); // same work as a real check, so timing does not reveal unknown emails
        return GENERIC_LOGIN_ERROR;
      }
      if (user.lockedUntil > Date.now()) {
        const mins = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
        return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
      }
      const h = await hashPassword(password, user.salt, user.iterations);
      if (!timingSafeEqual(h.hash, user.hash)) {
        const failed = user.failed + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        setUsers((prev) =>
          prev.map((u) =>
            u.email === e ? { ...u, failed: lock ? 0 : failed, lockedUntil: lock ? Date.now() + LOCKOUT_MINUTES * 60000 : u.lockedUntil } : u,
          ),
        );
        return lock ? `Too many failed attempts. Sign-in is locked for ${LOCKOUT_MINUTES} minutes.` : GENERIC_LOGIN_ERROR;
      }
      setUsers((prev) => prev.map((u) => (u.email === e ? { ...u, failed: 0, lockedUntil: 0 } : u)));
      startSession(e, user.name);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Could not sign in.';
    }
  };

  const signOut = () => setSession(null);

  /* ----- catalog (hidden products never reach the public) ----- */
  // Vendor products show only while their vendor is approved, with the owner's margin already added.
  const catalog = useMemo(() => {
    const approved = new Set(vendors.filter((v) => v.status === 'Approved').map((v) => v.id));
    return products
      .filter((p) => !p.hidden && (!p.vendorId || approved.has(p.vendorId)))
      .map((p) => {
        const priced = withMargin(p, settings.vendorMarginPct);
        const imgs = productImages(priced);
        return { ...priced, images: imgs, image: imgs[0], vendorName: p.vendorId ? vendors.find((v) => v.id === p.vendorId)?.shopName ?? 'Vendor' : 'Vel Groups' };
      });
  }, [products, vendors, settings.vendorMarginPct]);
  const myProducts = useMemo(() => (myVendor ? products.filter((p) => p.vendorId === myVendor.id) : []), [products, myVendor]);

  /* ----- cart ----- */
  const addToCart = (productId: string, qty = 1) => {
    const p = catalog.find((x) => x.id === productId);
    if (!p || !isAvailable(p)) {
      notify('This product is out of stock.');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      const nextQty = Math.min((existing?.qty ?? 0) + qty, p.stock);
      if (existing) return prev.map((l) => (l.productId === productId ? { ...l, qty: nextQty } : l));
      return [...prev, { productId, qty: Math.min(qty, p.stock) }];
    });
    notify(`${p.name} added to cart`);
  };
  const setQty = (productId: string, qty: number) => {
    const p = catalog.find((x) => x.id === productId);
    if (!p) return;
    const q = Math.max(1, Math.min(Math.floor(qty) || 1, Math.max(p.stock, 1)));
    setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty: q } : l)));
  };
  const removeFromCart = (productId: string) => setCart((prev) => prev.filter((l) => l.productId !== productId));

  const cartDetail: CartDetail[] = useMemo(
    () =>
      cart
        .map((line) => ({ line, product: catalog.find((p) => p.id === line.productId) }))
        .filter((x): x is { line: CartLine; product: Product } => Boolean(x.product))
        .map(({ line, product }) => {
          const unitPrice = unitPriceFor(product, line.qty);
          return { line, product, unitPrice, lineTotal: unitPrice * line.qty };
        }),
    [cart, catalog],
  );
  const cartCount = cartDetail.reduce((n, d) => n + d.line.qty, 0);
  const subtotal = cartDetail.reduce((s, d) => s + d.lineTotal, 0);
  const netKg = netWeight(cartDetail.map((d) => ({ qty: d.line.qty, weightKg: d.product.weightKg })));
  const totals = computeTotals(subtotal, settings, null, null);

  /** Price the current cart with an optional coupon code, courier and destination state. */
  const quote = (couponCode: string, courierId: string, state = ''): Quote => {
    const enabled = settings.couriers.filter((c) => c.enabled);
    const courier = enabled.find((c) => c.id === courierId) ?? enabled[0] ?? null;
    let coupon: Coupon | null = null;
    let couponError = '';
    if (couponCode.trim()) {
      const r = evaluateCoupon(couponCode, subtotal, settings.coupons);
      if (r.ok) coupon = r.coupon;
      else couponError = r.error;
    }
    const optionCharges: Record<string, number | null> = {};
    for (const c of enabled) optionCharges[c.id] = optionCharge(settings, c, state, netKg);
    const charge = courier ? optionCharges[courier.id] : 0;
    return {
      totals: computeTotals(subtotal, settings, coupon, courier ? charge : 0),
      coupon,
      courier,
      couponError,
      netKg,
      weightKg: shipmentWeight(settings.shipping, netKg),
      optionCharges,
    };
  };

  /* ----- checkout ----- */
  const placeOrder = (ship: ShippingInfo, paymentId: string, courierId: string, couponCode: string): PlaceResult => {
    if (!session) return { ok: false, error: 'Please sign in to place an order.' };
    if (cartDetail.length === 0) return { ok: false, error: 'Your cart is empty.' };
    for (const d of cartDetail) {
      if (!isAvailable(d.product)) return { ok: false, error: `"${d.product.name}" is out of stock. Remove it from your cart.` };
      if (d.line.qty > d.product.stock) {
        return { ok: false, error: `Only ${d.product.stock} of "${d.product.name}" left in stock.` };
      }
    }
    const payment = settings.payments.find((p) => p.enabled && p.id === paymentId);
    if (!payment) return { ok: false, error: 'Choose a payment method.' };
    const q = quote(couponCode, courierId, ship.state);
    if (couponCode.trim() && q.couponError) return { ok: false, error: q.couponError };
    const hasCouriers = settings.couriers.some((c) => c.enabled);
    if (hasCouriers && !q.courier) return { ok: false, error: 'Choose a delivery option.' };
    if (q.totals.shippingPending) return { ok: false, error: 'Select your state so the courier charge can be calculated.' };

    const order: Order = {
      id: orderId(),
      createdAt: new Date().toISOString(),
      customerEmail: session.email,
      customerName: session.name,
      items: cartDetail.map((d) => ({
        productId: d.product.id,
        name: d.product.name,
        sku: d.product.sku,
        price: d.unitPrice,
        qty: d.line.qty,
        vendorId: d.product.vendorId,
        vendorName: d.product.vendorId ? vendors.find((v) => v.id === d.product.vendorId)?.shopName ?? 'Vendor' : 'Vel Groups',
        vendorPrice: d.product.vendorId ? unitPriceFor({ price: d.product.vendorPrice ?? d.product.price, priceTiers: products.find((x) => x.id === d.product.id)?.priceTiers }, d.line.qty) : undefined,
      })),
      weightKg: q.weightKg,
      subtotal: q.totals.subtotal,
      gst: q.totals.gst,
      shipping: q.totals.shipping,
      total: q.totals.total,
      status: 'Pending Owner Approval',
      history: [{ status: 'Pending Owner Approval', at: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
      shipMode: q.courier?.kind ?? 'courier',
      payment: payment.label,
      paymentKind: payment.kind,
      paymentStatus: 'Pending',
      ship,
      discount: q.totals.discount,
      coupon: q.coupon?.code,
      courier: q.courier?.name,
    };
    setProducts((prev) =>
      prev.map((p) => {
        const line = cart.find((l) => l.productId === p.id);
        return line ? { ...p, stock: Math.max(0, p.stock - line.qty) } : p;
      }),
    );
    setOrders((prev) => [order, ...prev]);
    setCart([]);
    return { ok: true, order };
  };

  /* ----- categories (owner only) ----- */
  const saveCategory = (c: Category): boolean => {
    if (!requireAdmin()) return false;
    const name = c.name.trim();
    if (name.length < 2) {
      notify('Enter a category name.');
      return false;
    }
    if (categories.some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) {
      notify('A category with this name already exists.');
      return false;
    }
    const old = categories.find((x) => x.id === c.id);
    setCategories((prev) => (old ? prev.map((x) => (x.id === c.id ? { ...c, name } : x)) : [...prev, { ...c, name }]));
    // renaming keeps products in the category
    if (old && old.name !== name) setProducts((prev) => prev.map((p) => (p.category === old.name ? { ...p, category: name } : p)));
    notify('Category saved');
    return true;
  };
  const deleteCategory = (id: string) => {
    if (!requireAdmin()) return;
    const old = categories.find((x) => x.id === id);
    if (!old) return;
    setCategories((prev) => prev.filter((x) => x.id !== id));
    // products are never lost: they move to "Uncategorised"
    setProducts((prev) => prev.map((p) => (p.category === old.name ? { ...p, category: 'Uncategorised' } : p)));
    notify('Category deleted');
  };

  /* ----- vendors ----- */
  const registerVendor = (f: VendorForm, docs: VendorDocs): string | null => {
    if (!session) return 'Please sign in first.';
    if (role === 'admin') return 'The owner account cannot also be a vendor.';
    const mine = vendors.find((v) => v.userEmail === session.email.toLowerCase());
    if (mine && mine.status !== 'Rejected') return mine.status === 'Approved' ? 'Your shop is already approved.' : 'Your application is already waiting for review.';
    if (f.name.trim().length < 2) return 'Enter your full name.';
    if (!isValidPhone(f.phone1)) return 'Enter a valid first phone number (at least 10 digits).';
    if (!isValidPhone(f.phone2)) return 'Enter a valid second phone number (at least 10 digits).';
    if (f.phone1.replace(/\D/g, '') === f.phone2.replace(/\D/g, '')) return 'The two phone numbers must be different.';
    if (!isValidEmail(f.email)) return 'Enter a valid email address.';
    if (f.shopName.trim().length < 2) return 'Enter the shop name.';
    if (!isValidPhone(f.shopPhone)) return 'Enter a valid shop phone number (at least 10 digits).';
    const ad = f.address;
    if (ad.line1.trim().length < 3) return 'Enter the shop address (house or building and street).';
    if (ad.city.trim().length < 2) return 'Enter the city or town.';
    if (ad.district.trim().length < 2) return 'Enter the district.';
    if (!(INDIAN_STATES as readonly string[]).includes(ad.state)) return 'Select the state.';
    if (!/^[1-9][0-9]{5}$/.test(ad.pincode.trim())) return 'Enter a valid 6-digit PIN code.';
    if (!docs.business1 || !docs.business2 || !docs.business3) return 'Upload all three business documents.';
    if (!docs.aadhaar) return 'Upload the Aadhaar card image.';
    if (!docs.pan) return 'Upload the PAN card image.';
    const id = mine?.id ?? uid('VND');
    const vendor: Vendor = {
      id,
      userEmail: session.email.toLowerCase(),
      name: f.name.trim(),
      phone1: f.phone1.trim(),
      phone2: f.phone2.trim(),
      email: f.email.trim().toLowerCase(),
      shopName: f.shopName.trim(),
      shopPhone: f.shopPhone.trim(),
      address: { line1: ad.line1.trim(), line2: ad.line2.trim(), city: ad.city.trim(), district: ad.district.trim(), state: ad.state, pincode: ad.pincode.trim() },
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    setVendors((prev) => [vendor, ...prev.filter((v) => v.id !== id)]);
    setVendorDocs((prev) => ({ ...prev, [id]: docs }));
    return null;
  };
  const decideVendor = (id: string, status: VendorStatus, note: string) => {
    if (!requireAdmin()) return;
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status, note: note.trim(), decidedAt: new Date().toISOString() } : v)));
    notify(`Vendor ${status.toLowerCase()}`);
  };
  const removeVendor = (id: string) => {
    if (!requireAdmin()) return;
    const ids = products.filter((p) => p.vendorId === id).map((p) => p.id);
    setVendors((prev) => prev.filter((v) => v.id !== id));
    setVendorDocs((prev) => {
      const { [id]: _gone, ...rest } = prev;
      return rest;
    });
    setProducts((prev) => prev.filter((p) => p.vendorId !== id));
    setCart((prev) => prev.filter((l) => !ids.includes(l.productId)));
    notify('Vendor and their products removed');
  };
  const getVendorDocs = (id: string): VendorDocs | null => (role === 'admin' ? vendorDocs[id] ?? null : null);

  /* ----- enquiries (open to every role) ----- */
  const submitEnquiry = (e: Omit<Enquiry, 'id' | 'createdAt' | 'status'>): Enquiry => {
    const enquiry: Enquiry = { ...e, id: uid('ENQ'), createdAt: new Date().toISOString(), status: 'New' };
    setEnquiries((prev) => [enquiry, ...prev]);
    return enquiry;
  };

  /* ----- admin-only mutations (each re-checks the role) ----- */
  /** Owner: any product. Approved vendor: only their own products (new ones are tied to their shop). */
  const canManage = (productId: string | null): boolean => {
    if (role === 'admin') return true;
    if (role === 'vendor' && myVendor) {
      if (productId === null) return true;
      return products.find((x) => x.id === productId)?.vendorId === myVendor.id;
    }
    return false;
  };
  const saveProduct = (input: Product): boolean => {
    const existing = products.find((x) => x.id === input.id);
    if (!canManage(existing ? existing.id : null)) {
      notify('You can only manage your own products.');
      return false;
    }
    const problem = tierProblem(input.priceTiers ?? []);
    if (problem) {
      notify(problem);
      return false;
    }
    const imgs = productImages(input);
    const p: Product = {
      ...input,
      images: imgs,
      image: imgs[0] ?? '',
      priceTiers: cleanTiers(input.priceTiers),
      // a vendor's products always belong to their shop; the owner keeps whatever the product already had
      vendorId: role === 'vendor' ? myVendor!.id : existing ? existing.vendorId : input.vendorId,
    };
    setProducts((prev) => (prev.some((x) => x.id === p.id) ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev]));
    notify('Product saved');
    return true;
  };
  const deleteProduct = (id: string) => {
    if (!canManage(id)) {
      notify('You can only manage your own products.');
      return;
    }
    setProducts((prev) => prev.filter((x) => x.id !== id));
    setCart((prev) => prev.filter((l) => l.productId !== id));
    notify('Product deleted');
  };
  const saveService = (s: Service): boolean => {
    if (!requireAdmin()) return false;
    setServices((prev) => (prev.some((x) => x.id === s.id) ? prev.map((x) => (x.id === s.id ? s : x)) : [...prev, s]));
    notify('Service saved');
    return true;
  };
  const deleteService = (id: string) => {
    if (!requireAdmin()) return;
    setServices((prev) => prev.filter((x) => x.id !== id));
    notify('Service deleted');
  };
  const saveCompany = (c: Company): boolean => {
    if (!requireAdmin()) return false;
    setCompany(c);
    notify('Company details updated');
    return true;
  };
  const saveSettings = (s: Settings): boolean => {
    if (!requireAdmin()) return false;
    setSettings(s);
    notify('Settings saved');
    return true;
  };
  const orderById = (id: string) => orders.find((o) => o.id === id);

  const assignOrder = (id: string, vendorId: string): string | null => {
    if (role !== 'admin') return 'Administrator access required.';
    const o = orderById(id);
    const v = vendors.find((x) => x.id === vendorId && x.status === 'Approved');
    if (!o) return 'Order not found.';
    if (!v) return 'Choose an approved vendor.';
    if (!isOpenOrder(o)) return 'This order is already finished.';
    if (o.vendorId === vendorId && normalizeStatus(o.status) !== 'Pending Owner Approval') return 'This order is already assigned to that vendor.';
    const now = new Date().toISOString();
    const reassigned = Boolean(o.vendorId);
    const note = reassigned ? `Reassigned from ${o.vendorName ?? 'previous vendor'} to ${v.shopName}` : `Assigned to ${v.shopName}`;
    setOrders((prev) =>
      prev.map((x) =>
        x.id === id
          ? {
              ...x,
              vendorId: v.id,
              vendorName: v.shopName,
              status: 'Placed',
              history: nextHistory(x, 'Placed', now, note),
              updatedAt: now,
              // shipment details belong to the previous vendor; the new one starts clean
              courier: x.courier && reassigned ? '' : x.courier,
              trackingNumber: '',
              trackingUrl: '',
              vehicleNo: '',
              driverName: '',
              driverPhone: '',
              expectedDelivery: '',
              trackingNote: '',
            }
          : x,
      ),
    );
    notify(reassigned ? `Order reassigned to ${v.shopName}` : `Order assigned to ${v.shopName}`);
    return null;
  };

  const cancelOrder = (id: string, reason: string): string | null => {
    if (role !== 'admin') return 'Administrator access required.';
    const o = orderById(id);
    if (!o) return 'Order not found.';
    if (!isOpenOrder(o)) return 'A delivered or cancelled order cannot be cancelled.';
    const now = new Date().toISOString();
    const why = reason.trim();
    setOrders((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: 'Cancelled', cancelReason: why, history: nextHistory(x, 'Cancelled', now, why || 'Cancelled by the owner'), updatedAt: now } : x)),
    );
    // the stock goes back on the shelf
    setProducts((prev) =>
      prev.map((p) => {
        const item = o.items.find((i) => i.productId === p.id);
        return item ? { ...p, stock: p.stock + item.qty } : p;
      }),
    );
    notify('Order cancelled');
    return null;
  };

  const updateOrder = (id: string, u: OrderUpdate): string | null => {
    if (role !== 'vendor' || !myVendor) return 'Only the assigned vendor can update this order.';
    const o = orderById(id);
    if (!o || o.vendorId !== myVendor.id) return 'This order is not assigned to your shop.';
    const cur = normalizeStatus(o.status);
    if (cur === 'Pending Owner Approval') return 'This order is waiting for the owner to approve it.';
    if (cur === 'Delivered' || cur === 'Cancelled') return `This order is ${cur.toLowerCase()} and cannot be changed.`;
    if (u.status !== cur && u.status !== nextStage(cur)) return `The next stage after "${cur}" is "${nextStage(cur)}". Stages cannot be skipped or reversed.`;
    if ((u.status === 'Couriered' || u.status === 'Out for delivery') && u.shipMode === 'courier') {
      if (u.courier.trim().length < 2) return 'Enter the courier company before marking this order as couriered.';
      if (u.trackingNumber.trim().length < 3) return 'Enter the courier tracking ID before marking this order as couriered.';
    }
    if (u.trackingUrl.trim() && !/^https?:\/\//i.test(u.trackingUrl.trim())) return 'The tracking link must start with http:// or https://';
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((x) =>
        x.id !== id
          ? x
          : {
              ...x,
              status: u.status,
              history: u.status !== cur ? nextHistory(x, u.status, now, `Updated by ${myVendor.shopName}`) : x.history,
              updatedAt: now,
              shipMode: u.shipMode,
              courier: u.courier,
              trackingNumber: u.trackingNumber,
              trackingUrl: u.trackingUrl,
              vehicleNo: u.vehicleNo,
              driverName: u.driverName,
              driverPhone: u.driverPhone,
              expectedDelivery: u.expectedDelivery,
              trackingNote: u.trackingNote,
            },
      ),
    );
    notify(u.status !== cur ? `Order ${id} is now ${u.status}` : 'Shipment details saved');
    return null;
  };

  const setOrderPayment = (id: string, patch: PaymentPatch) => {
    if (!requireAdmin()) return;
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              paymentStatus: patch.paymentStatus,
              paymentRef: patch.paymentRef,
              paymentNote: patch.paymentNote,
              paidAt: patch.paymentStatus === 'Paid' ? o.paidAt ?? now : o.paidAt,
              updatedAt: now,
            }
          : o,
      ),
    );
    notify('Payment updated');
  };

  const submitPaymentProof = (orderId: string, image: string): string | null => {
    if (!session) return 'Please sign in first.';
    const o = orders.find((x) => x.id === orderId);
    if (!o || o.customerEmail !== session.email) return 'Order not found.';
    if (normalizeStatus(o.status) === 'Cancelled') return 'This order was cancelled.';
    if (paymentStatusOf(o) === 'Paid') return 'This order is already marked as paid.';
    if (!image.startsWith('data:image/')) return 'Attach an image of your GPay payment screenshot.';
    const now = new Date().toISOString();
    setProofs((prev) => ({ ...prev, [orderId]: image }));
    setOrders((prev) =>
      prev.map((x) => (x.id === orderId ? { ...x, paymentStatus: 'Awaiting verification', paymentProofAt: now, paymentNote: '', updatedAt: now } : x)),
    );
    notify('Screenshot sent. We will verify your payment shortly.');
    return null;
  };
  const getPaymentProof = (orderId: string): string | null => {
    if (!session) return null;
    const o = orders.find((x) => x.id === orderId);
    if (!o) return null;
    return role === 'admin' || o.customerEmail === session.email ? proofs[orderId] ?? null : null;
  };

  const setEnquiryStatus = (id: string, status: EnquiryStatus) => {
    if (!requireAdmin()) return;
    setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };
  const resetAll = () => {
    if (!requireAdmin()) return;
    setProducts(SEED_PRODUCTS);
    setCategories(SEED_CATEGORIES);
    setServices(SEED_SERVICES);
    setCompany(SEED_COMPANY);
    setSettings(SEED_SETTINGS);
    setOrders([]);
    setVendors([]);
    setVendorDocs({});
    setProofs({});
    setEnquiries([]);
    setCart([]);
    notify('Sample data restored');
  };

  const value: AppCtx = {
    session,
    role,
    products,
    catalog,
    services,
    company,
    settings,
    orders,
    enquiries,
    cart,
    cartDetail,
    cartCount,
    totals,
    quote,
    prefill,
    setPrefill,
    toasts,
    notify,
    register,
    login,
    signOut,
    addToCart,
    setQty,
    removeFromCart,
    placeOrder,
    categories,
    saveCategory,
    deleteCategory,
    myVendor,
    myProducts,
    vendors,
    registerVendor,
    decideVendor,
    removeVendor,
    getVendorDocs,
    submitEnquiry,
    saveProduct,
    deleteProduct,
    saveService,
    deleteService,
    saveCompany,
    saveSettings,
    assignOrder,
    cancelOrder,
    updateOrder,
    setOrderPayment,
    submitPaymentProof,
    getPaymentProof,
    setEnquiryStatus,
    resetAll,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
