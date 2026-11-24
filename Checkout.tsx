import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Order, ShippingInfo } from '../types';
import { Field, Icon, PageHeader } from '../components/ui';
import { OrderSummary } from './Cart';
import { PaymentNote, PaymentPanel } from '../components/ManualPayment';
import { INDIAN_STATES } from '../config';
import { fmtDate, inr, isValidPhone, isWeightBased, soldBy } from '../utils';

const EMPTY: ShippingInfo = { name: '', phone: '', line1: '', city: '', state: '', pincode: '' };

const FIELD_IDS: Record<keyof ShippingInfo, string> = {
  name: 'co-name',
  phone: 'co-phone',
  line1: 'co-line1',
  city: 'co-city',
  state: 'co-state',
  pincode: 'co-pin',
};

export function Checkout() {
  const { cartDetail, session, placeOrder, settings, quote, orders } = useApp();
  const [ship, setShip] = useState<ShippingInfo>({ ...EMPTY, name: session?.name ?? '' });
  const couriers = settings.couriers.filter((c) => c.enabled);
  const payments = settings.payments.filter((p) => p.enabled);
  const [courierId, setCourierId] = useState<string>(couriers[0]?.id ?? '');
  const [paymentId, setPaymentId] = useState<string>(payments[0]?.id ?? '');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingInfo, string>>>({});
  const [formError, setFormError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const selectedPayment = payments.find((m) => m.id === paymentId) ?? payments[0];

  const set = (k: keyof ShippingInfo, v: string) => setShip((s) => ({ ...s, [k]: v }));

  // Re-validated on every render so a coupon that stops qualifying (e.g. cart changed) is dropped.
  const q = quote(appliedCode, courierId, ship.state);
  const activeCode = q.coupon ? q.coupon.code : '';

  const applyCoupon = () => {
    const probe = quote(couponInput, courierId, ship.state);
    if (!couponInput.trim()) {
      setCouponMsg({ ok: false, text: 'Enter a coupon code.' });
      return;
    }
    if (probe.couponError || !probe.coupon) {
      setAppliedCode('');
      setCouponMsg({ ok: false, text: probe.couponError || 'This coupon code is not valid.' });
      return;
    }
    setAppliedCode(probe.coupon.code);
    setCouponInput('');
    setCouponMsg({ ok: true, text: `${probe.coupon.code} applied. You save ${inr(probe.totals.discount)}.` });
  };

  const removeCoupon = () => {
    setAppliedCode('');
    setCouponMsg(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<keyof ShippingInfo, string>> = {};
    if (ship.name.trim().length < 2) next.name = 'Enter the recipient name.';
    if (!isValidPhone(ship.phone)) next.phone = 'Enter a phone number with at least 10 digits.';
    if (ship.line1.trim().length < 5) next.line1 = 'Enter the delivery address.';
    if (ship.city.trim().length < 2) next.city = 'Enter the city.';
    if (!(INDIAN_STATES as readonly string[]).includes(ship.state)) next.state = 'Select the state.';
    if (!/^\d{6}$/.test(ship.pincode.trim())) next.pincode = 'Enter a 6-digit PIN code.';
    setErrors(next);
    const missing = Object.keys(next) as (keyof ShippingInfo)[];
    if (missing.length > 0) {
      setFormError('Please complete the highlighted delivery details above, then place your order again.');
      // bring the first invalid field into view so the click never looks like it did nothing
      const first = document.getElementById(FIELD_IDS[missing[0]]);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first?.focus({ preventScroll: true });
      return;
    }

    const result = placeOrder(
      {
        name: ship.name.trim(),
        phone: ship.phone.trim(),
        line1: ship.line1.trim(),
        city: ship.city.trim(),
        state: ship.state.trim(),
        pincode: ship.pincode.trim(),
      },
      paymentId,
      courierId,
      activeCode,
    );
    if (result.ok) {
      setFormError('');
      setOrder(result.order);
      window.scrollTo({ top: 0 });
    } else {
      setFormError(result.error);
    }
  };

  if (order) {
    const live = orders.find((o) => o.id === order.id) ?? order;
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Order placed" />
        <div className="wrap mt-10 max-w-3xl">
          <div className="panel p-6 sm:p-8">
            <Icon name="check" className="h-10 w-10 text-ok" />
            <h2 className="mt-3 text-3xl font-semibold">Thank you, {order.customerName}.</h2>
            <p className="mt-1 text-ink-700">
              Order <strong className="font-mono">{order.id}</strong> was placed on {fmtDate(order.createdAt)}. Payment: {order.payment}.
              {order.courier ? ` Delivery: ${order.courier}.` : ''}
            </p>
            <p className="mt-2 text-sm text-ink-700">Your order is now waiting for the owner&apos;s approval. You can follow it in My Orders; every change appears there automatically.</p>
            <div className="mt-4">
              <PaymentPanel order={live} />
            </div>

            <div className="mt-5 overflow-x-auto border border-steel-200">
              <table className="w-full text-sm">
                <thead className="bg-steel-100 text-left">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((i) => (
                    <tr key={i.productId} className="border-t border-steel-200">
                      <td className="px-3 py-2">
                        {i.name}
                        <span className="block font-mono text-xs text-steel-500">{i.sku}</span>
                        <span className="block text-xs text-ink-500">Sold by {soldBy(i)}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{i.qty}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{inr(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-steel-200">
                  {order.discount ? (
                    <tr className="text-ok">
                      <td className="px-3 py-2" colSpan={2}>
                        Coupon {order.coupon}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">−{inr(order.discount)}</td>
                    </tr>
                  ) : null}
                  <tr className="font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total incl. GST and shipping
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{inr(order.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <p className="mt-4 text-sm text-ink-700">
              Delivering to {order.ship.name}, {order.ship.line1}, {order.ship.city}, {order.ship.state} {order.ship.pincode}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#orders" className="btn-primary">
                Track this order
              </a>
              <a href="#store" className="btn-dark">
                Continue shopping
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (cartDetail.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Checkout" title="Nothing to check out" />
        <div className="wrap mt-10">
          <div className="panel p-8 text-center">
            <p className="text-xl font-semibold">Your cart is empty.</p>
            <a href="#store" className="btn-primary mt-4">
              Browse the store
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Checkout" title="Delivery and payment" />
      <form className="wrap mt-8 grid gap-8 lg:grid-cols-[1fr_360px]" onSubmit={submit} noValidate>
        <div className="min-w-0 space-y-6">
          <section className="panel space-y-5 p-6" aria-labelledby="ship-h">
            <h2 id="ship-h" className="text-2xl font-semibold">
              Delivery address
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Recipient name" htmlFor="co-name" error={errors.name}>
                <input id="co-name" className="field" autoComplete="name" value={ship.name} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="Phone" htmlFor="co-phone" error={errors.phone}>
                <input id="co-phone" className="field" inputMode="tel" autoComplete="tel" value={ship.phone} onChange={(e) => set('phone', e.target.value)} />
              </Field>
            </div>
            <Field label="Address" htmlFor="co-line1" error={errors.line1}>
              <input id="co-line1" className="field" autoComplete="street-address" placeholder="Plant, street, area" value={ship.line1} onChange={(e) => set('line1', e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="City" htmlFor="co-city" error={errors.city}>
                <input id="co-city" className="field" autoComplete="address-level2" value={ship.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="State" htmlFor="co-state" error={errors.state}>
                <select id="co-state" className="field" autoComplete="address-level1" value={ship.state} onChange={(e) => set('state', e.target.value)}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="PIN code" htmlFor="co-pin" error={errors.pincode}>
                <input id="co-pin" className="field" inputMode="numeric" maxLength={6} autoComplete="postal-code" value={ship.pincode} onChange={(e) => set('pincode', e.target.value)} />
              </Field>
            </div>
          </section>

          {couriers.length > 0 ? (
            <fieldset className="panel p-6">
              <legend className="px-1 text-2xl font-semibold">Delivery option</legend>
              <div className="mt-2 space-y-2">
                {couriers.map((c) => {
                  const free = q.totals.shipping === 0 && !q.totals.shippingPending && settings.freeShippingAbove > 0 && q.totals.subtotal - q.totals.discount >= settings.freeShippingAbove;
                  return (
                    <label key={c.id} htmlFor={`co-courier-${c.id}`} className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${courierId === c.id || (!courierId && c === couriers[0]) ? 'border-ink bg-steel-50' : 'border-steel-200'}`}>
                      <input
                        id={`co-courier-${c.id}`}
                        type="radio"
                        name="courier"
                        className="mt-0.5 accent-[#B45309]"
                        checked={(courierId || couriers[0].id) === c.id}
                        onChange={() => setCourierId(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{c.name}</span>
                        <span className="block font-mono text-xs text-ink-500">
                          {c.eta}
                          {isWeightBased(settings, c) && ship.state ? ` · ${q.weightKg.toFixed(1)} kg to ${ship.state}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-mono tabular-nums">
                        {free ? 'Free' : q.optionCharges[c.id] === null ? <span className="text-xs text-ink-500">Select state</span> : inr(q.optionCharges[c.id] as number)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <fieldset className="panel p-6">
            <legend className="px-1 text-2xl font-semibold">Payment method</legend>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm font-medium text-bad">No payment method is available right now. Please call us to place this order.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {payments.map((m) => (
                  <label key={m.id} htmlFor={`co-pay-${m.id}`} className={`flex cursor-pointer items-start gap-3 border p-3 text-sm ${paymentId === m.id ? 'border-ink bg-steel-50' : 'border-steel-200'}`}>
                    <input id={`co-pay-${m.id}`} type="radio" name="payment" className="mt-0.5 accent-[#B45309]" checked={paymentId === m.id} onChange={() => setPaymentId(m.id)} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{m.label}</span>
                      {m.instructions ? <span className="block text-xs text-ink-500">{m.instructions}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedPayment?.kind === 'gpay' ? (
              <div className="mt-3">
                <PaymentNote amount={q.totals.total} />
              </div>
            ) : null}
            <p className="mt-3 text-xs text-ink-500">No card details are collected on this site.</p>
          </fieldset>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
          <div className="panel p-5">
            <h2 className="mb-3 text-2xl font-semibold">Order summary</h2>
            <ul className="mb-4 space-y-2 border-b border-steel-200 pb-4 text-sm">
              {cartDetail.map(({ line, product, unitPrice, lineTotal }) => (
                <li key={product.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {product.name} <span className="font-mono text-steel-500">× {line.qty} @ {inr(unitPrice)}</span>
                    <span className="block text-xs text-ink-500">Sold by {product.vendorName ?? 'Vel Groups'}</span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{inr(lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="mb-4 border-b border-steel-200 pb-4">
              <label htmlFor="co-coupon" className="label">
                Coupon code
              </label>
              {activeCode ? (
                <div className="flex items-center justify-between gap-2 bg-green-50 px-3 py-2 text-sm text-ok">
                  <span className="font-mono font-semibold">{activeCode}</span>
                  <button type="button" className="font-semibold underline" onClick={removeCoupon}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="co-coupon"
                    className="field font-mono uppercase"
                    placeholder="Enter code"
                    autoComplete="off"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                  />
                  <button type="button" className="btn-ghost shrink-0" onClick={applyCoupon}>
                    Apply
                  </button>
                </div>
              )}
              {couponMsg ? (
                <p className={`mt-1 text-xs font-medium ${couponMsg.ok ? 'text-ok' : 'text-bad'}`} role={couponMsg.ok ? 'status' : 'alert'}>
                  {couponMsg.text}
                </p>
              ) : null}
              {!activeCode && appliedCode && q.couponError ? (
                <p className="mt-1 text-xs font-medium text-bad" role="alert">
                  {q.couponError}
                </p>
              ) : null}
            </div>

            {settings.shipping.enabled ? (
              <p className="mb-3 font-mono text-xs text-ink-500">
                Shipment weight {q.weightKg.toFixed(1)} kg ({q.netKg.toFixed(1)} kg products + {settings.shipping.boxWeightKg} kg box)
              </p>
            ) : null}
            <OrderSummary t={q.totals} couponCode={activeCode} />
            {formError ? (
              <p className="mt-3 text-sm font-medium text-bad" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className="btn-primary mt-4 w-full" disabled={payments.length === 0}>
              Place order
            </button>
            <a href="#cart" className="btn-ghost mt-2 w-full">
              Back to cart
            </a>
          </div>
        </aside>
      </form>
    </>
  );
}
