import type { Category, Company, PriceTier, Product, RateCard, Service, Settings, ShippingRules } from './types';
import { INDIAN_STATES } from './config';

/** Sample courier rates. A zone factor scales one base table; the owner replaces them with real quotes. */
const BASE_SLABS: [number, number][] = [[0.5, 60], [1, 80], [2, 120], [5, 200], [10, 350], [25, 700], [50, 1200]];
const BASE_EXTRA_PER_KG = 20;
const round5 = (n: number) => Math.round(n / 5) * 5;

export function zoneRateCard(factor: number): RateCard {
  return { slabs: BASE_SLABS.map(([upToKg, c]) => ({ upToKg, charge: round5(c * factor) })), extraPerKg: round5(BASE_EXTRA_PER_KG * factor) };
}

const ZONES: [number, string[]][] = [
  [1, ['Tamil Nadu']],
  [1.2, ['Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Puducherry']],
  [1.5, ['Maharashtra', 'Goa', 'Gujarat', 'Madhya Pradesh', 'Chhattisgarh', 'Odisha', 'Dadra and Nagar Haveli and Daman and Diu']],
  [1.8, ['Delhi', 'Haryana', 'Punjab', 'Rajasthan', 'Uttar Pradesh', 'Uttarakhand', 'Chandigarh', 'Bihar', 'Jharkhand', 'West Bengal']],
  [2.5, ['Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura', 'Himachal Pradesh', 'Jammu and Kashmir', 'Ladakh', 'Andaman and Nicobar Islands', 'Lakshadweep']],
];

export function seedShipping(): ShippingRules {
  const states: Record<string, RateCard> = {};
  for (const [factor, names] of ZONES) for (const n of names) states[n] = zoneRateCard(factor);
  for (const n of INDIAN_STATES) if (!states[n]) states[n] = zoneRateCard(1.8);
  return { enabled: true, boxWeightKg: 1.5, defaultRate: zoneRateCard(1.8), states };
}

/** Starting owner settings. All of it is editable in the Management Dashboard. */
export const SEED_SETTINGS: Settings = {
  logo: '',
  gstRate: 18,
  freeShippingAbove: 25000,
  couriers: [
    { id: 'c-self', name: 'Vel own delivery (local)', charge: 400, eta: '1 to 2 working days', enabled: true, kind: 'self', trackingUrl: '', weightBased: false, multiplier: 1 },
    { id: 'c-std', name: 'Standard road courier', charge: 750, eta: '4 to 6 working days', enabled: true, kind: 'courier', trackingUrl: '', weightBased: true, multiplier: 1 },
    { id: 'c-exp', name: 'Express courier', charge: 1800, eta: '1 to 2 working days', enabled: true, kind: 'courier', trackingUrl: '', weightBased: true, multiplier: 1.8 },
    { id: 'c-frt', name: 'Freight transport (heavy items)', charge: 3200, eta: '5 to 8 working days', enabled: true, kind: 'courier', trackingUrl: '', weightBased: true, multiplier: 0.8 },
  ],
  payments: [
    { id: 'pm-gpay', label: 'Pay by GPay (manual payment)', instructions: 'Pay the total amount by GPay, then upload the screenshot in My Orders.', enabled: true, kind: 'gpay' },
    { id: 'pm-cod', label: 'Cash on delivery', instructions: 'Pay when the order arrives.', enabled: true, kind: 'offline' },
    { id: 'pm-upi', label: 'UPI on delivery', instructions: 'Pay by UPI when the order arrives.', enabled: true, kind: 'offline' },
    {
      id: 'pm-bank',
      label: 'Bank transfer (NEFT/RTGS)',
      instructions: 'A proforma invoice with bank details is sent after you place the order.',
      enabled: true,
      kind: 'offline',
    },
  ],
  gpayNumber: '+91 98765 43210',
  shipping: seedShipping(),
  vendorMarginPct: 10,
  coupons: [
    {
      id: 'cp-welcome',
      code: 'WELCOME10',
      description: '10% off orders above ₹5,000 (sample)',
      type: 'percent',
      value: 10,
      minOrder: 5000,
      maxDiscount: 3000,
      expiresAt: '',
      active: true,
    },
    {
      id: 'cp-flat',
      code: 'FLAT500',
      description: '₹500 off orders above ₹10,000 (sample)',
      type: 'flat',
      value: 500,
      minOrder: 10000,
      maxDiscount: 0,
      expiresAt: '',
      active: true,
    },
  ],
};

/** Sample content. Everything here can be edited from the Management Dashboard. */

/** Fills in fields added after a browser already saved older settings. */
export function normalizeSettings(s: Settings): Settings {
  let payments = (s.payments ?? SEED_SETTINGS.payments).map((p) => ({ ...p, kind: p.kind ?? 'offline' }));
  // the online gateway was removed: payments are manual now
  payments = payments.filter((p) => (p.kind as string) !== 'razorpay');
  if (!payments.some((p) => p.kind === 'gpay')) payments.unshift(SEED_SETTINGS.payments[0]);
  return {
    ...SEED_SETTINGS,
    ...s,
    couriers: (s.couriers ?? SEED_SETTINGS.couriers).map((c) => ({
      ...c,
      kind: c.kind ?? 'courier',
      trackingUrl: c.trackingUrl ?? '',
      weightBased: c.weightBased ?? SEED_SETTINGS.couriers.find((x) => x.id === c.id)?.weightBased ?? false,
      multiplier: c.multiplier ?? SEED_SETTINGS.couriers.find((x) => x.id === c.id)?.multiplier ?? 1,
    })),
    shipping: {
      ...SEED_SETTINGS.shipping,
      ...(s.shipping ?? {}),
      states: { ...SEED_SETTINGS.shipping.states, ...(s.shipping?.states ?? {}) },
    },
    vendorMarginPct: typeof s.vendorMarginPct === 'number' ? s.vendorMarginPct : SEED_SETTINGS.vendorMarginPct,
    payments,
    gpayNumber: typeof s.gpayNumber === 'string' ? s.gpayNumber : SEED_SETTINGS.gpayNumber,
  };
}

const BASE_PRODUCTS: Product[] = [
  {
    id: 'p-hgp40',
    sku: 'VH-HGP-40',
    name: 'Hydraulic Gear Pump HGP-40',
    category: 'Hydraulics',
    brand: 'Vel Hydro',
    price: 18500,
    mrp: 21000,
    stock: 24,
    unit: 'piece',
    description:
      'Cast-iron external gear pump for mobile and stationary power packs. Supplied tested, with mounting flange and coupling key.',
    specs: [
      { label: 'Displacement', value: '40 cc/rev' },
      { label: 'Max. pressure', value: '250 bar' },
      { label: 'Speed range', value: '600 to 3000 rpm' },
      { label: 'Port size', value: '3/4" BSP' },
      { label: 'Weight', value: '6.8 kg' },
    ],
    featured: true,
  },
  {
    id: 'p-motor75',
    sku: 'VM-IM-75-4P',
    name: 'Three-Phase Induction Motor 7.5 kW',
    category: 'Motors & Drives',
    brand: 'Vel Electric',
    price: 29500,
    mrp: 33000,
    stock: 12,
    unit: 'piece',
    description: 'Foot-mounted IE3 efficiency motor for pumps, compressors and conveyors. Dynamically balanced rotor.',
    specs: [
      { label: 'Power', value: '7.5 kW / 10 HP' },
      { label: 'Voltage', value: '415 V, 50 Hz, 3-phase' },
      { label: 'Speed', value: '1440 rpm (4-pole)' },
      { label: 'Protection', value: 'IP55, Class F insulation' },
      { label: 'Frame', value: '132M, B3 mounting' },
    ],
    featured: true,
  },
  {
    id: 'p-vfd11',
    sku: 'VE-VFD-11K',
    name: 'Variable Frequency Drive 11 kW',
    category: 'Motors & Drives',
    brand: 'Vel Electric',
    price: 38900,
    mrp: 42500,
    stock: 9,
    unit: 'piece',
    description: 'Sensorless vector drive with built-in EMC filter and Modbus RTU. Suited to fans, pumps and conveyors.',
    specs: [
      { label: 'Rated power', value: '11 kW' },
      { label: 'Input', value: '380 to 480 V, 3-phase' },
      { label: 'Overload', value: '150% for 60 s' },
      { label: 'Enclosure', value: 'IP20' },
      { label: 'Communication', value: 'Modbus RTU (RS-485)' },
    ],
    featured: true,
  },
  {
    id: 'p-bearing',
    sku: 'VB-6310-2RS-10',
    name: 'Deep Groove Ball Bearing 6310-2RS (Pack of 10)',
    category: 'Bearings',
    brand: 'Vel Precision',
    price: 7400,
    mrp: 8200,
    stock: 120,
    unit: 'pack',
    description: 'Sealed, pre-lubricated bearings for electric motors, gearboxes and fans.',
    specs: [
      { label: 'Bore / OD / Width', value: '50 / 110 / 27 mm' },
      { label: 'Seal', value: 'Double rubber, 2RS' },
      { label: 'Dynamic load', value: '61.8 kN' },
      { label: 'Pack size', value: '10 pieces' },
    ],
    featured: false,
  },
  {
    id: 'p-cyl63',
    sku: 'VP-ISO-63x200',
    name: 'Pneumatic Cylinder ISO 15552, 63 x 200',
    category: 'Pneumatics',
    brand: 'Vel Air',
    price: 6200,
    mrp: 6900,
    stock: 40,
    unit: 'piece',
    description: 'Double-acting profile-barrel cylinder with adjustable end cushioning and magnetic piston.',
    specs: [
      { label: 'Bore / Stroke', value: '63 mm / 200 mm' },
      { label: 'Operating pressure', value: '1 to 10 bar' },
      { label: 'Action', value: 'Double acting, cushioned' },
      { label: 'Port', value: 'G 3/8' },
    ],
    featured: false,
  },
  {
    id: 'p-valve2',
    sku: 'VV-GV-SS-2',
    name: 'Stainless Steel Gate Valve 2" PN16',
    category: 'Valves',
    brand: 'Vel Flow',
    price: 4800,
    mrp: 5400,
    stock: 55,
    unit: 'piece',
    description: 'CF8M body, flanged ends to ASME B16.5 class 150. For water, steam condensate and mild chemicals.',
    specs: [
      { label: 'Size', value: '2" (DN50)' },
      { label: 'Rating', value: 'PN16' },
      { label: 'Body material', value: 'CF8M stainless steel' },
      { label: 'End connection', value: 'Flanged' },
    ],
    featured: false,
  },
  {
    id: 'p-weld400',
    sku: 'VW-INV-400A',
    name: 'Inverter Arc Welding Machine 400 A',
    category: 'Welding',
    brand: 'Vel Weld',
    price: 42500,
    mrp: 47000,
    stock: 7,
    unit: 'piece',
    description: 'IGBT inverter MMA/TIG machine with hot start and arc-force control. Supplied with cables and holder.',
    specs: [
      { label: 'Output current', value: '20 to 400 A' },
      { label: 'Duty cycle', value: '60% at 400 A' },
      { label: 'Input', value: '415 V, 3-phase' },
      { label: 'Modes', value: 'MMA, lift-arc TIG' },
    ],
    featured: true,
  },
  {
    id: 'p-insert',
    sku: 'VT-DNMG150608-10',
    name: 'Carbide Turning Insert DNMG 150608 (Box of 10)',
    category: 'Tooling',
    brand: 'Vel Tooling',
    price: 3600,
    mrp: 4100,
    stock: 200,
    unit: 'box',
    description: 'Coated carbide inserts for medium-roughing of steel and stainless steel on CNC lathes.',
    specs: [
      { label: 'Geometry', value: 'DNMG 150608' },
      { label: 'Grade', value: 'Coated carbide, P25' },
      { label: 'Nose radius', value: '0.8 mm' },
      { label: 'Box quantity', value: '10 inserts' },
    ],
    featured: false,
  },
  {
    id: 'p-chain',
    sku: 'VT-RC-12B1-KIT',
    name: 'Roller Chain Drive Kit 12B-1',
    category: 'Power Transmission',
    brand: 'Vel Drive',
    price: 5400,
    mrp: 6000,
    stock: 3,
    unit: 'kit',
    description: 'Simplex roller chain with driver and driven sprockets, sold as a matched set.',
    specs: [
      { label: 'Chain', value: '12B-1, 19.05 mm pitch' },
      { label: 'Sprockets', value: '17T driver / 34T driven' },
      { label: 'Chain length', value: '2.5 m' },
      { label: 'Ratio', value: '2 : 1' },
    ],
    featured: false,
  },
  {
    id: 'p-torque',
    sku: 'VT-TW-40-200',
    name: 'Digital Torque Wrench 40 to 200 Nm',
    category: 'Hand Tools',
    brand: 'Vel Tools',
    price: 11800,
    mrp: 13200,
    stock: 15,
    unit: 'piece',
    description: 'Digital torque wrench with peak hold, buzzer and LED alert. Supplied with calibration certificate.',
    specs: [
      { label: 'Range', value: '40 to 200 Nm' },
      { label: 'Accuracy', value: '±2%' },
      { label: 'Drive', value: '1/2" square' },
      { label: 'Units', value: 'Nm, kgf·m, lbf·ft' },
    ],
    featured: false,
  },
];

const tiers = (...t: [number, number][]): PriceTier[] => t.map(([minQty, price]) => ({ minQty, price }));

/** Sample net weights (kg per unit) and quantity price brackets. */
const SAMPLE: Record<string, { weightKg: number; priceTiers?: PriceTier[] }> = {
  'p-hgp40': { weightKg: 6.8 },
  'p-motor75': { weightKg: 52 },
  'p-vfd11': { weightKg: 9.5 },
  'p-bearing': { weightKg: 8.2, priceTiers: tiers([1, 7400], [5, 7000], [20, 6600]) },
  'p-cyl63': { weightKg: 3.1, priceTiers: tiers([1, 6200], [10, 5800], [50, 5400]) },
  'p-valve2': { weightKg: 4.4, priceTiers: tiers([1, 4800], [10, 4500]) },
  'p-weld400': { weightKg: 28 },
  'p-insert': { weightKg: 0.3, priceTiers: tiers([1, 3600], [10, 3300], [50, 3000]) },
  'p-chain': { weightKg: 7.5 },
  'p-torque': { weightKg: 2.4 },
};

export const SEED_PRODUCTS: Product[] = BASE_PRODUCTS.map((p) => ({ ...p, ...(SAMPLE[p.id] ?? {}) }));

export const SEED_CATEGORIES: Category[] = Array.from(new Set(SEED_PRODUCTS.map((p) => p.category)))
  .sort()
  .map((name) => ({ id: 'cat-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, image: '' }));

export const SEED_SERVICES: Service[] = [
  {
    id: 's-pm',
    name: 'Preventive Maintenance Contract',
    description:
      'Scheduled inspections, lubrication, alignment and vibration checks with a written condition report after every visit.',
    priceFrom: 12000,
    turnaround: 'Monthly or quarterly visits',
    coverage: ['Motors', 'Pumps', 'Compressors', 'Gearboxes'],
  },
  {
    id: 's-hyd',
    name: 'Hydraulic System Overhaul',
    description:
      'Pump, valve and cylinder rebuild with flushing, seal replacement and a pressure test before hand-over.',
    priceFrom: 18000,
    turnaround: '5 to 7 working days',
    coverage: ['Power packs', 'Presses', 'Mobile hydraulics'],
  },
  {
    id: 's-rewind',
    name: 'Motor Rewinding and Testing',
    description: 'Rewinding to the original data, varnish impregnation, balancing and a full no-load and insulation test.',
    priceFrom: 6500,
    turnaround: '3 to 5 working days',
    coverage: ['1 to 250 kW', 'LT and HT', 'Pump motors'],
  },
  {
    id: 's-cnc',
    name: 'CNC and Machine Tool Calibration',
    description: 'Geometric alignment, ballbar test and backlash compensation to restore positioning accuracy.',
    priceFrom: 22000,
    turnaround: '2 to 3 working days',
    coverage: ['Lathes', 'Machining centres', 'Grinders'],
  },
  {
    id: 's-breakdown',
    name: 'On-site Breakdown Support',
    description: 'A service engineer at your plant with a stocked van for diagnosis and first-line repair.',
    priceFrom: 4500,
    turnaround: 'Same day within service area',
    coverage: ['Electrical', 'Mechanical', 'Hydraulic'],
  },
  {
    id: 's-weld',
    name: 'Welding and Fabrication Repair',
    description: 'Structural and pressure-part repair welding with dye-penetrant checks on request.',
    priceFrom: 3500,
    turnaround: '1 to 3 working days',
    coverage: ['Frames', 'Tanks', 'Shafts and housings'],
  },
];

export const SEED_COMPANY: Company = {
  name: 'Vel Groups',
  tagline: 'Engineering, manufacturing and service for Indian industry.',
  phone: '+91 98765 43210',
  altPhone: '+91 98765 43211',
  email: 'contact@velgroups.example',
  address: '12, Industrial Estate Road, Coimbatore, Tamil Nadu 641 021',
  hours: 'Mon to Sat, 9:00 AM to 6:00 PM IST',
  about:
    'Vel Groups brings together a service center, an industrial store and a manufacturing unit, so a plant can repair, replace or build from one supplier.',
  manufacturing: {
    intro:
      'Vel Manufacturing Company builds hydraulic power packs, fabricated frames and machined components to customer drawings, in batches from one piece to several hundred.',
    capabilities: [
      'CNC turning and milling',
      'Sheet-metal fabrication and welding',
      'Hydraulic power pack assembly',
      'Heat treatment through approved partners',
      'Surface finishing and painting',
      'Reverse engineering from worn samples',
    ],
    certifications: ['ISO 9001 quality management system', 'Material test certificates with every batch', 'Calibrated inspection tools'],
    stats: [
      { label: 'Years in industry', value: '25+' },
      { label: 'Machines on the floor', value: '40' },
      { label: 'Active customers', value: '300+' },
      { label: 'On-time dispatch', value: '96%' },
    ],
  },
};
