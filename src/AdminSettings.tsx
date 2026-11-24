import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Coupon, CouponType, ShipMode } from '../types';
import { Badge, ConfirmDelete, Field, Icon, ImagePicker, Modal } from '../components/ui';
import { inr, isValidPhone, uid } from '../utils';
import { getOwnerKey, setOwnerKey, subscribeSync, syncState } from '../sync';

/* ---------------- Branding (logo) ---------------- */

export function AdminBranding() {
  const { settings, saveSettings, company } = useApp();
  const [logo, setLogo] = useState(settings.logo);
  const dirty = logo !== settings.logo;

  return (
    <section className="panel max-w-2xl space-y-5 p-5">
      <div>
        <h2 className="text-2xl font-semibold">Logo</h2>
        <p className="mt-1 text-sm text-ink-700">
          Shown in the site header and footer next to the name &ldquo;{company.name}&rdquo;. Change the name in Company details.
        </p>
      </div>
      <ImagePicker
        id="brand-logo"
        label="Logo image"
        value={logo}
        onChange={setLogo}
        maxDim={360}
        mime="image/png"
        previewClass="h-24 w-40"
        hint="PNG, JPG, WebP or SVG. A wide logo on a transparent or white background works best."
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" disabled={!dirty} onClick={() => saveSettings({ ...settings, logo })}>
          Save logo
        </button>
        {logo ? (
          <button type="button" className="btn-ghost" onClick={() => setLogo('')}>
            Use the default Vel mark
          </button>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------- Shipping, couriers and GST ---------------- */

interface CourierDraft {
  id: string;
  name: string;
  charge: string;
  eta: string;
  enabled: boolean;
  kind: ShipMode;
  trackingUrl: string;
}

export function AdminShipping() {
  const { settings, saveSettings } = useApp();
  const [gst, setGst] = useState(String(settings.gstRate));
  const [freeAbove, setFreeAbove] = useState(String(settings.freeShippingAbove));
  const [rows, setRows] = useState<CourierDraft[]>(
    settings.couriers.map((c) => ({ id: c.id, name: c.name, charge: String(c.charge), eta: c.eta, enabled: c.enabled, kind: c.kind, trackingUrl: c.trackingUrl })),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patch = (id: string, p: Partial<CourierDraft>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const gstN = Number(gst);
    const freeN = Number(freeAbove);
    if (!Number.isFinite(gstN) || gstN < 0 || gstN > 100) err.gst = 'Enter a GST rate between 0 and 100.';
    if (!Number.isFinite(freeN) || freeN < 0) err.free = 'Enter an amount, or 0 to turn free shipping off.';
    rows.forEach((r) => {
      if (r.name.trim().length < 2) err[`name-${r.id}`] = 'Enter a courier name.';
      const c = Number(r.charge);
      if (r.charge.trim() === '' || !Number.isFinite(c) || c < 0) err[`charge-${r.id}`] = 'Enter a charge, 0 or more.';
      if (r.kind === 'courier' && r.trackingUrl.trim() && !/^https?:\/\//i.test(r.trackingUrl.trim())) err[`url-${r.id}`] = 'Start the link with http:// or https://';
    });
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    saveSettings({
      ...settings,
      gstRate: gstN,
      freeShippingAbove: freeN,
      couriers: rows.map((r) => ({ ...(settings.couriers.find((c) => c.id === r.id) ?? {}), id: r.id, name: r.name.trim(), charge: Number(r.charge), eta: r.eta.trim(), enabled: r.enabled, kind: r.kind, trackingUrl: r.kind === 'courier' ? r.trackingUrl.trim() : '' })),
    });
  };

  return (
    <form className="space-y-6" onSubmit={save} noValidate>
      <section className="panel space-y-4 p-5">
        <h2 className="text-2xl font-semibold">Tax and free shipping</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GST rate (%)" htmlFor="sh-gst" error={errors.gst} hint="Added on top of product prices at checkout.">
            <input id="sh-gst" className="field" inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value)} />
          </Field>
          <Field label="Free shipping above (₹)" htmlFor="sh-free" error={errors.free} hint="Applies to the subtotal after coupon, before GST. Use 0 to switch off.">
            <input id="sh-free" className="field" inputMode="decimal" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Couriers and delivery charges</h2>
            <p className="text-sm text-ink-700">Customers choose one of the enabled options at checkout.</p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setRows((r) => [...r, { id: uid('c'), name: '', charge: '0', eta: '', enabled: true, kind: 'courier', trackingUrl: '' }])}
          >
            <Icon name="plus" className="h-4 w-4" /> Add courier
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-3 border border-steel-200 p-3">
             <div className="grid gap-3 md:grid-cols-[1.4fr_8rem_1fr_auto]">
              <Field label="Courier name" htmlFor={`cr-name-${r.id}`} error={errors[`name-${r.id}`]}>
                <input id={`cr-name-${r.id}`} className="field" value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} />
              </Field>
              <Field label="Flat charge (₹)" htmlFor={`cr-charge-${r.id}`} error={errors[`charge-${r.id}`]} hint={settings.shipping.enabled && settings.couriers.find((c) => c.id === r.id)?.weightBased ? 'Not used: charged by weight and state.' : undefined}>
                <input id={`cr-charge-${r.id}`} className="field" inputMode="decimal" value={r.charge} onChange={(e) => patch(r.id, { charge: e.target.value })} />
              </Field>
              <Field label="Delivery time" htmlFor={`cr-eta-${r.id}`}>
                <input id={`cr-eta-${r.id}`} className="field" placeholder="e.g. 2 to 3 days" value={r.eta} onChange={(e) => patch(r.id, { eta: e.target.value })} />
              </Field>
              <div className="flex items-end gap-4 pb-2">
                <label className="flex items-center gap-2 text-sm" htmlFor={`cr-on-${r.id}`}>
                  <input id={`cr-on-${r.id}`} type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />
                  Enabled
                </label>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-bad hover:underline" onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label={`Remove courier ${r.name || ''}`}>
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              </div>
             </div>
             <div className="grid gap-3 md:grid-cols-[14rem_1fr]">
              <Field label="Delivery type" htmlFor={`cr-kind-${r.id}`}>
                <select id={`cr-kind-${r.id}`} className="field" value={r.kind} onChange={(e) => patch(r.id, { kind: e.target.value as ShipMode })}>
                  <option value="courier">Third-party courier</option>
                  <option value="self">Self delivery (own team)</option>
                </select>
              </Field>
              {r.kind === 'courier' ? (
                <Field label="Tracking link template (optional)" htmlFor={`cr-url-${r.id}`} error={errors[`url-${r.id}`]} hint="Where customers follow the parcel. Put {id} where the tracking ID goes.">
                  <input id={`cr-url-${r.id}`} className="field" placeholder="https://courier.example/track?awb={id}" value={r.trackingUrl} onChange={(e) => patch(r.id, { trackingUrl: e.target.value })} />
                </Field>
              ) : (
                <p className="self-end pb-2 text-sm text-ink-500">Your own vehicle and driver. Vehicle and driver details are added on each order.</p>
              )}
             </div>
            </li>
          ))}
          {rows.length === 0 ? <li className="p-4 text-sm text-ink-500">No couriers. Orders will ship with no delivery charge.</li> : null}
        </ul>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Save shipping and tax
        </button>
      </div>
    </form>
  );
}

/* ---------------- Payment methods ---------------- */

interface PaymentDraft {
  id: string;
  label: string;
  instructions: string;
  enabled: boolean;
  kind: 'offline' | 'gpay';
}

function SyncPanel() {
  const [st, setSt] = useState(syncState());
  const [key, setKey] = useState(getOwnerKey());
  const [saved, setSaved] = useState(false);
  useEffect(() => subscribeSync(() => setSt(syncState())), []);
  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">Data sync</h2>
        <Badge tone={st === 'online' ? 'bg-green-50 text-ok' : 'bg-amber-50 text-forge-dark'}>{st === 'online' ? 'Connected: shared data' : st === 'connecting' ? 'Connecting…' : st === 'readonly' ? 'Connected, but this account cannot save shared changes' : 'Offline: showing this device only'}</Badge>
      </div>
      <p className="text-sm text-ink-700">
        Everything you change here is saved to the Vel Groups server, and every phone, browser and installed app picks it up within a few seconds. If this says Offline, the server is not running or not reachable, so changes stay on this device only.
      </p>
      <Field label="Owner key (to see vendor documents and payment screenshots on this device)" htmlFor="owner-key" hint="The same value as OWNER_KEY when the server was started. It is kept only in this browser.">
        <div className="flex gap-2">
          <input id="owner-key" type="password" autoComplete="off" className="field max-w-xs font-mono" value={key} onChange={(e) => { setKey(e.target.value); setSaved(false); }} />
          <button type="button" className="btn-ghost" onClick={() => { setOwnerKey(key); setSaved(true); }}>Save key</button>
        </div>
      </Field>
      {saved ? <p className="text-sm text-ok" role="status">Key saved.</p> : null}
    </section>
  );
}

export function AdminPayments() {
  const { settings, saveSettings } = useApp();
  const [rows, setRows] = useState<PaymentDraft[]>(settings.payments.map((p) => ({ ...p })));
  const [gpay, setGpay] = useState(settings.gpayNumber);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState('');

  const patch = (id: string, p: Partial<PaymentDraft>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.label.trim().length < 2) err[r.id] = 'Enter a name for this payment method.';
    });
    if (rows.some((r) => r.kind === 'gpay' && r.enabled) && !isValidPhone(gpay)) {
      err.gpay = 'Enter the GPay phone number customers should pay (at least 10 digits).';
    }
    setErrors(err);
    if (Object.keys(err).length > 0) {
      setTopError('');
      return;
    }
    if (!rows.some((r) => r.enabled)) {
      setTopError('Keep at least one payment method enabled, or customers cannot place orders.');
      return;
    }
    setTopError('');
    saveSettings({
      ...settings,
      payments: rows.map((r) => ({ id: r.id, label: r.label.trim(), instructions: r.instructions.trim(), enabled: r.enabled, kind: r.kind })),
      gpayNumber: gpay.trim(),
    });
  };

  return (
    <form className="space-y-6" onSubmit={save} noValidate>
     <SyncPanel />
     <section className="panel space-y-4 p-5">
      <h2 className="text-2xl font-semibold">GPay manual payment</h2>
      <p className="text-sm text-ink-700">
        Payments are made by hand, outside this site. Customers are told that payments are not processed in the app or through WhatsApp, and are asked to pay the total to this GPay number. They then upload a screenshot in My Orders, and you verify it in the Transactions tab.
      </p>
      <Field label="GPay number customers pay to" htmlFor="gpay-number" error={errors.gpay} hint="Shown at checkout, in My Orders and in the order confirmation. Double-check it is your own number.">
        <input id="gpay-number" className="field max-w-xs font-mono" inputMode="tel" value={gpay} onChange={(e) => setGpay(e.target.value)} />
      </Field>
     </section>

     <section className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Payment methods</h2>
          <p className="text-sm text-ink-700">Enabled methods appear at checkout. No card data is collected by this site.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setRows((r) => [...r, { id: uid('pm'), label: '', instructions: '', enabled: true, kind: 'offline' }])}>
          <Icon name="plus" className="h-4 w-4" /> Add method
        </button>
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-3 border border-steel-200 p-3 md:grid-cols-[1fr_1.6fr_auto]">
            <Field label="Method name" htmlFor={`pay-label-${r.id}`} error={errors[r.id]}>
              <input id={`pay-label-${r.id}`} className="field" value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} />
            </Field>
            <Field label="Instructions shown to the customer" htmlFor={`pay-ins-${r.id}`}>
              <input id={`pay-ins-${r.id}`} className="field" value={r.instructions} onChange={(e) => patch(r.id, { instructions: e.target.value })} />
            </Field>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-sm" htmlFor={`pay-on-${r.id}`}>
                <input id={`pay-on-${r.id}`} type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={r.enabled} onChange={(e) => patch(r.id, { enabled: e.target.checked })} />
                Enabled
              </label>
              {r.kind === 'gpay' ? (
                <span className="text-xs font-semibold text-ink-500">Manual GPay</span>
              ) : (
                <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-bad hover:underline" onClick={() => setRows((x) => x.filter((y) => y.id !== r.id))} aria-label={`Remove ${r.label || 'payment method'}`}>
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {topError ? (
        <p className="text-sm font-medium text-bad" role="alert">
          {topError}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Save payment methods
        </button>
      </div>
     </section>
    </form>
  );
}

/* ---------------- Coupons ---------------- */

interface CouponDraft {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minOrder: string;
  maxDiscount: string;
  expiresAt: string;
  active: boolean;
}

const blankCoupon = (): CouponDraft => ({
  id: uid('cp'),
  code: '',
  description: '',
  type: 'percent',
  value: '',
  minOrder: '0',
  maxDiscount: '0',
  expiresAt: '',
  active: true,
});

const draftFromCoupon = (c: Coupon): CouponDraft => ({
  id: c.id,
  code: c.code,
  description: c.description,
  type: c.type,
  value: String(c.value),
  minOrder: String(c.minOrder),
  maxDiscount: String(c.maxDiscount),
  expiresAt: c.expiresAt,
  active: c.active,
});

function CouponForm({ initial, isNew, onClose }: { initial: CouponDraft; isNew: boolean; onClose: () => void }) {
  const { settings, saveSettings } = useApp();
  const [d, setD] = useState<CouponDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof CouponDraft, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const code = d.code.trim().toUpperCase().replace(/\s+/g, '');
    const value = Number(d.value);
    const minOrder = Number(d.minOrder || 0);
    const maxDiscount = Number(d.maxDiscount || 0);
    if (code.length < 3) err.code = 'Use a code of at least 3 characters, e.g. SAVE10.';
    else if (settings.coupons.some((c) => c.id !== d.id && c.code.toUpperCase() === code)) err.code = 'This code already exists.';
    if (!Number.isFinite(value) || value <= 0) err.value = 'Enter a discount above 0.';
    else if (d.type === 'percent' && value > 100) err.value = 'A percentage cannot be above 100.';
    if (!Number.isFinite(minOrder) || minOrder < 0) err.minOrder = 'Enter 0 or more.';
    if (!Number.isFinite(maxDiscount) || maxDiscount < 0) err.maxDiscount = 'Enter 0 or more.';
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const coupon: Coupon = {
      id: d.id,
      code,
      description: d.description.trim(),
      type: d.type,
      value,
      minOrder,
      maxDiscount: d.type === 'percent' ? maxDiscount : 0,
      expiresAt: d.expiresAt,
      active: d.active,
    };
    const exists = settings.coupons.some((c) => c.id === coupon.id);
    const coupons = exists ? settings.coupons.map((c) => (c.id === coupon.id ? coupon : c)) : [coupon, ...settings.coupons];
    if (saveSettings({ ...settings, coupons })) onClose();
  };

  return (
    <Modal title={isNew ? 'Add coupon' : 'Edit coupon'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coupon code" htmlFor="cp-code" error={errors.code}>
            <input id="cp-code" className="field font-mono uppercase" value={d.code} onChange={(e) => set('code', e.target.value)} />
          </Field>
          <Field label="Discount type" htmlFor="cp-type">
            <select id="cp-type" className="field" value={d.type} onChange={(e) => set('type', e.target.value)}>
              <option value="percent">Percentage off</option>
              <option value="flat">Flat amount off (₹)</option>
            </select>
          </Field>
          <Field label={d.type === 'percent' ? 'Percent off (%)' : 'Amount off (₹)'} htmlFor="cp-value" error={errors.value}>
            <input id="cp-value" className="field" inputMode="decimal" value={d.value} onChange={(e) => set('value', e.target.value)} />
          </Field>
          <Field label="Minimum order (₹)" htmlFor="cp-min" error={errors.minOrder} hint="Subtotal before GST. 0 = no minimum.">
            <input id="cp-min" className="field" inputMode="decimal" value={d.minOrder} onChange={(e) => set('minOrder', e.target.value)} />
          </Field>
          {d.type === 'percent' ? (
            <Field label="Maximum discount (₹)" htmlFor="cp-max" error={errors.maxDiscount} hint="0 = no cap.">
              <input id="cp-max" className="field" inputMode="decimal" value={d.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} />
            </Field>
          ) : null}
          <Field label="Expires on (optional)" htmlFor="cp-exp">
            <input id="cp-exp" type="date" className="field" value={d.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
          </Field>
        </div>
        <Field label="Description (for your reference)" htmlFor="cp-desc">
          <input id="cp-desc" className="field" value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm" htmlFor="cp-active">
          <input id="cp-active" type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={d.active} onChange={(e) => set('active', e.target.checked)} />
          Active (customers can use it)
        </label>
        <div className="flex justify-end gap-2 border-t border-steel-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save coupon
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminCoupons() {
  const { settings, saveSettings } = useApp();
  const [editing, setEditing] = useState<{ draft: CouponDraft; isNew: boolean } | null>(null);

  const update = (coupons: Coupon[]) => saveSettings({ ...settings, coupons });
  const expired = (c: Coupon) => Boolean(c.expiresAt) && new Date(c.expiresAt + 'T23:59:59').getTime() < Date.now();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setEditing({ draft: blankCoupon(), isNew: true })}>
          <Icon name="plus" className="h-4 w-4" /> Add coupon
        </button>
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-steel-100 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Rules</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.coupons.map((c) => (
              <tr key={c.id} className="border-t border-steel-200">
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold">{c.code}</span>
                  {c.description ? <span className="block text-xs text-ink-500">{c.description}</span> : null}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">{c.type === 'percent' ? `${c.value}%` : inr(c.value)}</td>
                <td className="px-4 py-3 text-xs text-ink-700">
                  <span className="block">{c.minOrder > 0 ? `Min. order ${inr(c.minOrder)}` : 'No minimum'}</span>
                  {c.type === 'percent' && c.maxDiscount > 0 ? <span className="block">Capped at {inr(c.maxDiscount)}</span> : null}
                  {c.expiresAt ? <span className="block">Expires {c.expiresAt}</span> : null}
                </td>
                <td className="px-4 py-3">
                  {expired(c) ? <Badge tone="bg-red-50 text-bad">Expired</Badge> : c.active ? <Badge tone="bg-green-50 text-ok">Active</Badge> : <Badge>Paused</Badge>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-4">
                    <button type="button" className="text-sm font-semibold hover:underline" onClick={() => update(settings.coupons.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)))}>
                      {c.active ? 'Pause' : 'Activate'}
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" onClick={() => setEditing({ draft: draftFromCoupon(c), isNew: false })} aria-label={`Edit coupon ${c.code}`}>
                      <Icon name="edit" className="h-4 w-4" /> Edit
                    </button>
                    <ConfirmDelete name={`coupon ${c.code}`} onConfirm={() => update(settings.coupons.filter((x) => x.id !== c.id))} />
                  </div>
                </td>
              </tr>
            ))}
            {settings.coupons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-500">
                  No coupons yet. Add one to offer a discount code at checkout.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? <CouponForm initial={editing.draft} isNew={editing.isNew} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
