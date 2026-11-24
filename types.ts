export type Role = 'guest' | 'customer' | 'vendor' | 'admin';

export interface Session {
  email: string;
  name: string;
  /** epoch ms; the session is ignored after this time */
  expiresAt: number;
}

export interface UserRecord {
  email: string;
  name: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: string;
  /** consecutive wrong passwords */
  failed: number;
  /** epoch ms until which sign-in is blocked */
  lockedUntil: number;
}

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: number; // ex-GST, INR
  mrp: number;
  stock: number;
  unit: string;
  description: string;
  specs: Spec[];
  featured: boolean;
  /** Uploaded product photo (compressed data URL). Empty/undefined shows a placeholder. */
  image?: string;
  /** Owner switch. false = shown as "Out of stock" even if quantity > 0. Undefined counts as true. */
  available?: boolean;
  /** Owner switch. true = hidden from the public store, home page and cart. */
  hidden?: boolean;
  /** All product photos (compressed data URLs). `image` always mirrors images[0]. */
  images?: string[];
  /** Net weight of ONE unit in kg, used for courier charges. */
  weightKg?: number;
  /** Quantity price brackets. The last bracket has no upper limit. Empty = flat `price`. */
  priceTiers?: PriceTier[];
  /** Set for products sold by a vendor. `price` is then the VENDOR's price; customers pay it plus the owner's margin. */
  vendorId?: string;
  /** Filled in for the storefront only: the vendor's own price before margin. */
  vendorPrice?: number;
  /** Filled in for the storefront only: name of the shop that sells this product. */
  vendorName?: string;
}

/** From `minQty` pieces upward the unit price is `price`. A bracket runs until the next one starts; the last runs forever. */
export interface PriceTier {
  minQty: number;
  price: number;
}

export interface RateSlab {
  /** applies while the shipment weight is at most this many kg */
  upToKg: number;
  charge: number;
}

/** Courier rates for one destination state. Above the last slab, `extraPerKg` is added for every further kg (rounded up). */
export interface RateCard {
  slabs: RateSlab[];
  extraPerKg: number;
}

export interface ShippingRules {
  /** false = every courier option uses its flat charge */
  enabled: boolean;
  /** weight of the packing box added to the products' net weight, kg */
  boxWeightKg: number;
  /** used for states with no card of their own */
  defaultRate: RateCard;
  states: Record<string, RateCard>;
}

/** 'self' = delivered by your own team and vehicles, 'courier' = a third-party courier company. */
export type ShipMode = 'self' | 'courier';

export interface Courier {
  id: string;
  name: string;
  charge: number; // INR
  eta: string;
  enabled: boolean;
  kind: ShipMode;
  /** Tracking page of a third-party courier. Use {id} where the tracking ID goes. */
  trackingUrl: string;
  /** true = charge comes from the state / weight rate card instead of the flat `charge` */
  weightBased?: boolean;
  /** multiplies the rate card charge (1 = as listed, 1.8 = express) */
  multiplier?: number;
}

export type PaymentKind = 'offline' | 'gpay';

export interface PaymentMethod {
  id: string;
  label: string;
  instructions: string;
  enabled: boolean;
  /** 'gpay' = the customer pays by hand via GPay and uploads a screenshot */
  kind: PaymentKind;
}


export type CouponType = 'percent' | 'flat';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number; // percent (0-100) or INR
  minOrder: number; // INR, ex-GST subtotal; 0 = none
  maxDiscount: number; // INR cap for percent coupons; 0 = no cap
  expiresAt: string; // YYYY-MM-DD, '' = never
  active: boolean;
}

export interface Settings {
  logo: string; // data URL, '' = default Vel mark
  gstRate: number; // percent
  freeShippingAbove: number; // INR, 0 = never free
  couriers: Courier[];
  payments: PaymentMethod[];
  coupons: Coupon[];
  /** GPay number customers pay to (payments are made by hand, outside the site) */
  gpayNumber: string;
  shipping: ShippingRules;
  /** Margin (%) the owner adds on top of every vendor's price */
  vendorMarginPct: number;
}

export interface Totals {
  subtotal: number;
  discount: number;
  gst: number;
  shipping: number;
  total: number;
  /** true while no courier has been chosen yet (cart page) */
  shippingPending: boolean;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  priceFrom: number;
  turnaround: string;
  coverage: string[];
}

export interface Company {
  name: string;
  tagline: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
  hours: string;
  about: string;
  manufacturing: {
    intro: string;
    capabilities: string[];
    certifications: string[];
    stats: Spec[];
  };
}

/** A store category the owner manages. Products refer to it by name. */
export interface Category {
  id: string;
  name: string;
  /** thumbnail (compressed data URL), '' = placeholder */
  image: string;
}

export type VendorStatus = 'Pending' | 'Approved' | 'Rejected';

export interface VendorDocs {
  business1: string;
  business2: string;
  business3: string;
  aadhaar: string;
  pan: string;
}

/** A shop that sells through Vel Groups. Documents are kept apart (key 'vendorDocs') so lists stay light. */
export interface VendorAddress {
  line1: string;
  line2: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface Vendor {
  id: string;
  /** the signed-in account that applied, and later manages the shop */
  userEmail: string;
  name: string;
  phone1: string;
  phone2: string;
  email: string;
  shopName: string;
  shopPhone: string;
  address: VendorAddress;
  status: VendorStatus;
  createdAt: string;
  decidedAt?: string;
  note?: string;
}

export interface CartLine {
  productId: string;
  qty: number;
}

export interface ShippingInfo {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number; // unit price the customer paid
  qty: number;
  vendorId?: string;
  /** shop that sells this item ('Vel Groups' for the owner's own products) */
  vendorName?: string;
  /** vendor's own price per unit (before the owner's margin) */
  vendorPrice?: number;
}

/** New orders wait for the owner ('Pending Owner Approval'). After the owner assigns a vendor, only that vendor moves it through
 *  Placed -> Packaged -> Couriered -> Out for delivery -> Delivered. The owner can also cancel it. */
export type OrderStatus = 'Pending Owner Approval' | 'Placed' | 'Packaged' | 'Couriered' | 'Out for delivery' | 'Delivered' | 'Cancelled';

/** One dated status change, recorded when the owner updates an order. */
export interface OrderEvent {
  status: OrderStatus;
  at: string; // ISO timestamp
  /** what happened, for example "Assigned to Kovai Tools" */
  note?: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customerEmail: string;
  customerName: string;
  items: OrderItem[];
  subtotal: number;
  gst: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  payment: string;
  ship: ShippingInfo;
  discount?: number;
  coupon?: string;
  courier?: string;
  /** total shipment weight (products + box), kg */
  weightKg?: number;
  /** vendor responsible for this order (set by the owner) */
  vendorId?: string;
  vendorName?: string;
  /** ISO time of the latest change, shown as "updated" on dashboards */
  updatedAt?: string;
  cancelReason?: string;
  /** when the customer uploaded a payment screenshot (the image itself is stored apart from the order) */
  paymentProofAt?: string;
  /** dated status changes; older orders may not have it */
  history?: OrderEvent[];
  /** self = own delivery team, courier = third-party company */
  shipMode?: ShipMode;
  /** third-party courier tracking ID */
  trackingNumber?: string;
  trackingUrl?: string;
  /** own-delivery details */
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  expectedDelivery?: string; // YYYY-MM-DD
  trackingNote?: string;
  paymentKind?: PaymentKind;
  paymentStatus?: PaymentStatus;
  /** GPay transaction ID noted by the owner when verifying */
  paymentRef?: string;
  paidAt?: string;
  paymentNote?: string;
}

/** 'Awaiting verification' = the customer uploaded a payment screenshot and the owner has not checked it yet. */
export type PaymentStatus = 'Pending' | 'Awaiting verification' | 'Paid' | 'Failed' | 'Refunded';

/** Everything the owner can change on an order from the dashboard. */
export interface OrderUpdate {
  status: OrderStatus;
  shipMode: ShipMode;
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  vehicleNo: string;
  driverName: string;
  driverPhone: string;
  expectedDelivery: string;
  trackingNote: string;
}

export interface PaymentPatch {
  paymentStatus: PaymentStatus;
  paymentRef: string;
  paymentNote: string;
}

export type EnquiryStatus = 'New' | 'Contacted' | 'Scheduled' | 'Closed';

export interface Enquiry {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  topic: string;
  equipment: string;
  preferredDate: string;
  message: string;
  status: EnquiryStatus;
}

export type PlaceResult = { ok: true; order: Order } | { ok: false; error: string };
