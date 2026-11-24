import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Order, OrderUpdate, ShipMode, Vendor, VendorAddress, VendorDocs } from '../types';
import { INDIAN_STATES, VENDOR_STAGES } from '../config';
import { Badge, Field, Icon, ImagePicker, Modal, PageHeader, PdfButtons } from '../components/ui';
import { fmtDate, inr, isOpenOrder, nextStage, normalizeStatus, paymentStatusOf, soldBy, trackingLink } from '../utils';
import { ProductManager } from './ProductManager';

const EMPTY_ADDRESS: VendorAddress = { line1: '', line2: '', city: '', district: '', state: '', pincode: '' };
const EMPTY_DOCS: VendorDocs = { business1: '', business2: '', business3: '', aadhaar: '', pan: '' };

const DOC_FIELDS: { key: keyof VendorDocs; label: string }[] = [
  { key: 'business1', label: 'Business document 1 (for example GST certificate)' },
  { key: 'business2', label: 'Business document 2 (for example shop licence)' },
  { key: 'business3', label: 'Business document 3 (for example business registration)' },
  { key: 'aadhaar', label: 'Aadhaar card' },
  { key: 'pan', label: 'PAN card' },
];

const STATUS_TONE: Record<string, string> = {
  Pending: 'bg-amber-50 text-forge-dark',
  Approved: 'bg-green-50 text-ok',
  Rejected: 'bg-red-50 text-bad',
};

/** Vendor registration. Needs a signed-in account; the owner reviews it before anything goes on sale. */
export function VendorSignup() {
  const { myVendor, registerVendor, session, settings } = useApp();
  const [f, setF] = useState({ name: session?.name ?? '', phone1: '', phone2: '', email: session?.email ?? '', shopName: '', shopPhone: '', address: EMPTY_ADDRESS });
  const [docs, setDocs] = useState<VendorDocs>(EMPTY_DOCS);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k: 'name' | 'phone1' | 'phone2' | 'email' | 'shopName' | 'shopPhone', v: string) => setF((x) => ({ ...x, [k]: v }));
  const setAd = (k: keyof VendorAddress, v: string) => setF((x) => ({ ...x, address: { ...x.address, [k]: v } }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = registerVendor(f, docs);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setSent(true);
    window.scrollTo({ top: 0 });
  };

  if (myVendor && myVendor.status !== 'Rejected') {
    return (
      <>
        <PageHeader eyebrow="Sell with us" title="Vendor application" />
        <div className="wrap mt-8 max-w-2xl">
          <div className="panel p-6">
            <p className="flex items-center gap-2">
              <span className="font-semibold">{myVendor.shopName}</span> <Badge tone={STATUS_TONE[myVendor.status]}>{myVendor.status}</Badge>
            </p>
            {myVendor.status === 'Pending' ? (
              <p className="mt-2 text-ink-700" role="status">
                {sent ? 'Thank you. ' : ''}Your application was received on {fmtDate(myVendor.createdAt)} and is waiting for the owner's review. Once approved, a “My Shop” page appears here where you can add your products.
              </p>
            ) : (
              <>
                <p className="mt-2 text-ink-700">Your shop is approved.</p>
                <a href="#vendor" className="btn-primary mt-4">
                  Open My Shop
                </a>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Sell with us" title="Vendor registration" lead={`Sell your products through Vel Store. Vel Groups adds a ${settings.vendorMarginPct}% margin to your prices.`} />
      <form className="wrap mt-8 max-w-3xl space-y-6" onSubmit={submit} noValidate>
        {myVendor?.status === 'Rejected' ? (
          <p className="bg-red-50 px-4 py-3 text-sm font-medium text-bad" role="alert">
            Your earlier application was not approved{myVendor.note ? `: ${myVendor.note}` : '.'} You can apply again below.
          </p>
        ) : null}
        <section className="panel space-y-5 p-6">
          <h2 className="text-2xl font-semibold">Owner and shop details</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" htmlFor="vn-name">
              <input id="vn-name" className="field" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="vn-email">
              <input id="vn-email" type="email" className="field" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Phone number 1" htmlFor="vn-phone1">
              <input id="vn-phone1" className="field" inputMode="tel" value={f.phone1} onChange={(e) => set('phone1', e.target.value)} />
            </Field>
            <Field label="Phone number 2" htmlFor="vn-phone2">
              <input id="vn-phone2" className="field" inputMode="tel" value={f.phone2} onChange={(e) => set('phone2', e.target.value)} />
            </Field>
            <Field label="Shop name" htmlFor="vn-shop">
              <input id="vn-shop" className="field" value={f.shopName} onChange={(e) => set('shopName', e.target.value)} />
            </Field>
            <Field label="Shop phone number" htmlFor="vn-shopphone">
              <input id="vn-shopphone" className="field" inputMode="tel" value={f.shopPhone} onChange={(e) => set('shopPhone', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="panel space-y-5 p-6">
          <h2 className="text-2xl font-semibold">Shop address</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Address line 1 (building, street)" htmlFor="vn-line1">
                <input id="vn-line1" className="field" autoComplete="address-line1" value={f.address.line1} onChange={(e) => setAd('line1', e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Address line 2 (area, landmark, optional)" htmlFor="vn-line2">
                <input id="vn-line2" className="field" autoComplete="address-line2" value={f.address.line2} onChange={(e) => setAd('line2', e.target.value)} />
              </Field>
            </div>
            <Field label="City or town" htmlFor="vn-city">
              <input id="vn-city" className="field" autoComplete="address-level2" value={f.address.city} onChange={(e) => setAd('city', e.target.value)} />
            </Field>
            <Field label="District" htmlFor="vn-district">
              <input id="vn-district" className="field" value={f.address.district} onChange={(e) => setAd('district', e.target.value)} />
            </Field>
            <Field label="State" htmlFor="vn-state">
              <select id="vn-state" className="field" autoComplete="address-level1" value={f.address.state} onChange={(e) => setAd('state', e.target.value)}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="PIN code" htmlFor="vn-pin">
              <input id="vn-pin" className="field font-mono" inputMode="numeric" autoComplete="postal-code" value={f.address.pincode} onChange={(e) => setAd('pincode', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="panel space-y-5 p-6">
          <h2 className="text-2xl font-semibold">Documents (images)</h2>
          <p className="bg-forge-tint px-3 py-2 text-xs text-ink">
            These are sensitive identity documents. They are used only for the owner's verification and are visible only to the owner account. Upload clear photos; each is shrunk automatically.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {DOC_FIELDS.map((d) => (
              <ImagePicker
                key={d.key}
                id={`vn-doc-${d.key}`}
                label={d.label}
                value={docs[d.key]}
                onChange={(v) => setDocs((x) => ({ ...x, [d.key]: v }))}
                maxDim={1000}
                mime="image/jpeg"
                maxChars={140_000}
                previewClass="h-24 w-32"
              />
            ))}
          </div>
        </section>

        {error ? (
          <p className="text-sm font-medium text-bad" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary">
          Submit application
        </button>
      </form>
    </>
  );
}

const draftOf = (o: Order): OrderUpdate => ({
  status: normalizeStatus(o.status),
  shipMode: o.shipMode ?? 'courier',
  courier: o.courier ?? '',
  trackingNumber: o.trackingNumber ?? '',
  trackingUrl: o.trackingUrl ?? '',
  vehicleNo: o.vehicleNo ?? '',
  driverName: o.driverName ?? '',
  driverPhone: o.driverPhone ?? '',
  expectedDelivery: o.expectedDelivery ?? '',
  trackingNote: o.trackingNote ?? '',
});

/** One assigned order. Only this vendor can move it through the five stages, one step at a time. */
function VendorOrderCard({ order }: { order: Order }) {
  const { updateOrder, settings, company } = useApp();
  const [d, setD] = useState<OrderUpdate>(() => draftOf(order));
  const [error, setError] = useState('');
  const status = normalizeStatus(order.status);
  const next = nextStage(status);
  const id = order.id;
  const open = isOpenOrder(order);
  const courierNames = settings.couriers.filter((c) => c.kind === 'courier').map((c) => c.name);
  const link = trackingLink({ ...order, ...d }, settings.couriers);
  const set = <K extends keyof OrderUpdate>(k: K, val: OrderUpdate[K]) => {
    setD((x) => ({ ...x, [k]: val }));
    setError('');
  };
  const clean = (status2: OrderUpdate['status']): OrderUpdate => ({
    ...d,
    status: status2,
    courier: d.courier.trim(),
    trackingNumber: d.trackingNumber.trim(),
    trackingUrl: d.trackingUrl.trim(),
    vehicleNo: d.vehicleNo.trim(),
    driverName: d.driverName.trim(),
    driverPhone: d.driverPhone.trim(),
    trackingNote: d.trackingNote.trim(),
  });
  const run = (target: OrderUpdate['status']) => setError(updateOrder(order.id, clean(target)) ?? '');
  const reached = VENDOR_STAGES.indexOf(status as (typeof VENDOR_STAGES)[number]);

  return (
    <li className="panel text-sm" aria-label={`Order ${order.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-steel-200 px-5 py-3">
        <div className="min-w-0">
          <p className="font-mono font-semibold">{order.id}</p>
          <p className="text-xs text-ink-500">
            {fmtDate(order.createdAt)}
            {order.updatedAt ? ` · Updated ${fmtDate(order.updatedAt)}` : ''}
          </p>
          <p className="mt-1">
            <PdfButtons order={order} company={company} gstRate={settings.gstRate} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status}</Badge>
          <Badge>{paymentStatusOf(order)}</Badge>
        </div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0 space-y-4">
          <ol className="flex flex-wrap gap-2" aria-label="Order stages">
            {VENDOR_STAGES.map((s, i) => (
              <li key={s} className={`px-2 py-1 text-xs font-semibold ${status === 'Cancelled' ? 'bg-steel-100 text-steel-500' : i < reached ? 'bg-green-50 text-ok' : i === reached ? 'bg-ink text-white' : 'bg-steel-100 text-ink-500'}`}>
                {i + 1}. {s}
              </li>
            ))}
          </ol>
          <ul className="divide-y divide-steel-200 border border-steel-200">
            {order.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0">
                  {i.name} <span className="font-mono text-steel-500">× {i.qty}</span>
                  <span className="block text-xs text-ink-500">Sold by {soldBy(i)}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">{inr(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="text-ink-700">
            <p className="font-semibold text-ink">Deliver to</p>
            <p>{order.ship.name}</p>
            <p>
              {order.ship.line1}, {order.ship.city}, {order.ship.state} {order.ship.pincode}
            </p>
            <p className="font-mono">{order.ship.phone}</p>
          </div>
        </div>

        {open ? (
          <form className="min-w-0 space-y-4 border border-steel-200 bg-steel-50 p-4" onSubmit={(e) => e.preventDefault()} noValidate aria-label={`Update ${order.id}`}>
            <p className="font-semibold text-ink">Shipment details</p>
            <Field label="Delivery type" htmlFor={`vo-mode-${id}`}>
              <select id={`vo-mode-${id}`} className="field" value={d.shipMode} onChange={(e) => set('shipMode', e.target.value as ShipMode)}>
                <option value="courier">Third-party courier</option>
                <option value="self">Self delivery (own team)</option>
              </select>
            </Field>
            {d.shipMode === 'courier' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Courier company" htmlFor={`vo-courier-${id}`}>
                  <input id={`vo-courier-${id}`} className="field" list={`vo-couriers-${id}`} value={d.courier} onChange={(e) => set('courier', e.target.value)} placeholder="e.g. Delhivery" />
                  <datalist id={`vo-couriers-${id}`}>
                    {courierNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Tracking ID" htmlFor={`vo-track-${id}`}>
                  <input id={`vo-track-${id}`} className="field font-mono" value={d.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Tracking link (optional)" htmlFor={`vo-url-${id}`} hint="Use {id} where the tracking ID goes.">
                    <input id={`vo-url-${id}`} className="field" value={d.trackingUrl} onChange={(e) => set('trackingUrl', e.target.value)} />
                  </Field>
                  {link ? <p className="mt-1 break-all text-xs">Customer link: {link}</p> : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Vehicle number" htmlFor={`vo-veh-${id}`}>
                  <input id={`vo-veh-${id}`} className="field font-mono" value={d.vehicleNo} onChange={(e) => set('vehicleNo', e.target.value)} />
                </Field>
                <Field label="Driver name" htmlFor={`vo-drv-${id}`}>
                  <input id={`vo-drv-${id}`} className="field" value={d.driverName} onChange={(e) => set('driverName', e.target.value)} />
                </Field>
                <Field label="Driver phone" htmlFor={`vo-drvph-${id}`}>
                  <input id={`vo-drvph-${id}`} className="field font-mono" inputMode="tel" value={d.driverPhone} onChange={(e) => set('driverPhone', e.target.value)} />
                </Field>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expected delivery date" htmlFor={`vo-eta-${id}`}>
                <input id={`vo-eta-${id}`} type="date" className="field" value={d.expectedDelivery} onChange={(e) => set('expectedDelivery', e.target.value)} />
              </Field>
              <Field label="Note to the customer" htmlFor={`vo-note-${id}`}>
                <input id={`vo-note-${id}`} className="field" value={d.trackingNote} onChange={(e) => set('trackingNote', e.target.value)} />
              </Field>
            </div>
            {error ? (
              <p className="text-sm font-medium text-bad" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              {next ? (
                <button type="button" className="btn-primary" id={`vo-next-${id}`} onClick={() => run(next)}>
                  Mark as {next}
                </button>
              ) : null}
              <button type="button" className="btn-ghost" id={`vo-save-${id}`} onClick={() => run(status)}>
                Save details only
              </button>
            </div>
            <p className="text-xs text-ink-500">Stages go in order and cannot be skipped. Each change is dated and shows on the customer&apos;s and the owner&apos;s screens straight away.</p>
          </form>
        ) : (
          <p className="self-start text-ink-500">{status === 'Delivered' ? 'Delivered. Nothing more to do.' : 'This order was cancelled by the owner.'}</p>
        )}
      </div>
    </li>
  );
}

/** The vendor's own page: their products and the orders the owner assigned to them. */
export function VendorDashboard() {
  const { myVendor, orders, settings } = useApp();
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  if (!myVendor) return null;
  const assigned = orders.filter((o) => o.vendorId === myVendor.id);
  const todo = assigned.filter(isOpenOrder);
  const sales = orders
    .filter((o) => normalizeStatus(o.status) !== 'Cancelled')
    .reduce((s, o) => s + o.items.filter((i) => i.vendorId === myVendor.id).reduce((t, i) => t + (i.vendorPrice ?? i.price) * i.qty, 0), 0);

  return (
    <>
      <PageHeader eyebrow="My Shop" title={myVendor.shopName} lead={`Your prices are shown to customers with a ${settings.vendorMarginPct}% platform margin added.`} />
      <div className="wrap mt-6">
        <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Orders to fulfil</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{todo.length}</dd>
          </div>
          <div className="panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">Your product sales (excl. GST)</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{inr(sales)}</dd>
          </div>
        </dl>
        <div role="tablist" aria-label="Shop sections" className="flex gap-1 border-b border-steel-200">
          {(['products', 'orders'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold ${tab === t ? 'border-b-2 border-forge text-forge-dark' : 'text-ink-700 hover:text-ink'}`}>
              {t === 'products' ? 'My products' : `Assigned orders (${assigned.length})`}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === 'products' ? (
            <ProductManager vendorMode />
          ) : assigned.length === 0 ? (
            <p className="panel p-8 text-center text-ink-500">No orders have been assigned to you yet. The owner approves new orders and assigns them to a vendor.</p>
          ) : (
            <ul className="space-y-4">
              {assigned.map((o) => (
                <VendorOrderCard key={o.id} order={o} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function DocsModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const { getVendorDocs } = useApp();
  const docs = getVendorDocs(vendor.id);
  return (
    <Modal title={`Documents: ${vendor.shopName}`} onClose={onClose} wide>
      {!docs ? (
        <p className="text-sm text-ink-500">No documents are stored for this vendor in this browser.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {DOC_FIELDS.map((d) => (
            <figure key={d.key} className="border border-steel-200 p-2">
              <img src={docs[d.key]} alt={d.label} className="max-h-72 w-full object-contain" />
              <figcaption className="mt-1 text-xs font-semibold text-ink-700">{d.label}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Owner: vendor margin, applications, documents and approval. */
export function AdminVendors() {
  const { vendors, settings, saveSettings, decideVendor, removeVendor, orders, products } = useApp();
  const [margin, setMargin] = useState(String(settings.vendorMarginPct));
  const [marginErr, setMarginErr] = useState('');
  const [docsFor, setDocsFor] = useState<Vendor | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const saveMargin = (e: FormEvent) => {
    e.preventDefault();
    const m = Number(margin);
    if (margin.trim() === '' || !Number.isFinite(m) || m < 0 || m > 500) {
      setMarginErr('Enter a percentage from 0 to 500.');
      return;
    }
    setMarginErr('');
    saveSettings({ ...settings, vendorMarginPct: m });
  };

  const earned = orders
    .filter((o) => o.status !== 'Cancelled')
    .reduce((s, o) => s + o.items.reduce((t, i) => t + (i.vendorId ? (i.price - (i.vendorPrice ?? i.price)) * i.qty : 0), 0), 0);

  return (
    <div className="space-y-6">
      <form className="panel space-y-3 p-5" onSubmit={saveMargin} noValidate>
        <h2 className="text-2xl font-semibold">Vendor margin</h2>
        <p className="text-sm text-ink-700">This percentage is added to every vendor product price (and every quantity bracket) across the whole site. Your own products are not affected.</p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Margin (%)" htmlFor="vm-margin" error={marginErr}>
            <input id="vm-margin" className="field w-32" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
          </Field>
          <button type="submit" className="btn-primary">
            Save margin
          </button>
        </div>
        <p className="font-mono text-xs text-ink-500">Margin earned on orders so far (excl. GST): {inr(earned)}. Example: a ₹1,000 vendor product sells for {inr(1000 * (1 + (Number(margin) || 0) / 100))}.</p>
      </form>

      <section>
        <h2 className="mb-3 text-2xl font-semibold">Vendors ({vendors.length})</h2>
        {vendors.length === 0 ? (
          <p className="panel p-8 text-center text-ink-500">No vendor applications yet. Applications made in this browser appear here.</p>
        ) : (
          <ul className="space-y-4">
            {vendors.map((v) => (
              <li key={v.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-semibold">
                    {v.shopName} <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                  </p>
                  <span className="font-mono text-xs text-ink-500">Applied {fmtDate(v.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-ink-700">
                  <span className="text-ink-500">Address: </span>
                  {v.address ? `${v.address.line1}${v.address.line2 ? ', ' + v.address.line2 : ''}, ${v.address.city}, ${v.address.district}, ${v.address.state} ${v.address.pincode}` : 'Not given (registered before addresses were collected)'}
                </p>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="inline text-ink-500">Name: </dt><dd className="inline">{v.name}</dd></div>
                  <div><dt className="inline text-ink-500">Email: </dt><dd className="inline">{v.email}</dd></div>
                  <div><dt className="inline text-ink-500">Phones: </dt><dd className="inline font-mono">{v.phone1}, {v.phone2}</dd></div>
                  <div><dt className="inline text-ink-500">Shop phone: </dt><dd className="inline font-mono">{v.shopPhone}</dd></div>
                  <div><dt className="inline text-ink-500">Account: </dt><dd className="inline">{v.userEmail}</dd></div>
                  <div><dt className="inline text-ink-500">Products: </dt><dd className="inline">{products.filter((p) => p.vendorId === v.id).length}</dd></div>
                </dl>
                {v.note ? <p className="mt-2 text-sm text-ink-700">Note: {v.note}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-ghost" onClick={() => setDocsFor(v)}>
                    <Icon name="search" className="h-4 w-4" /> View documents
                  </button>
                  <input className="field max-w-xs" placeholder="Note to keep (optional)" aria-label={`Note for ${v.shopName}`} value={notes[v.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))} />
                  {v.status !== 'Approved' ? (
                    <button type="button" className="btn-primary" onClick={() => decideVendor(v.id, 'Approved', notes[v.id] ?? '')}>
                      Approve
                    </button>
                  ) : null}
                  {v.status !== 'Rejected' ? (
                    <button type="button" className="btn-danger" onClick={() => decideVendor(v.id, 'Rejected', notes[v.id] ?? '')}>
                      {v.status === 'Approved' ? 'Suspend' : 'Reject'}
                    </button>
                  ) : null}
                  <button type="button" className="text-sm font-semibold text-bad hover:underline" onClick={() => removeVendor(v.id)}>
                    Remove vendor and products
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {docsFor ? <DocsModal vendor={docsFor} onClose={() => setDocsFor(null)} /> : null}
    </div>
  );
}
