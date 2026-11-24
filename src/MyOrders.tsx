import { useState } from 'react';
import { useApp } from '../store';
import type { Order } from '../types';
import { Badge, Icon, PageHeader, PdfButtons } from '../components/ui';
import { PaymentPanel } from '../components/ManualPayment';
import { fmtDate, fmtDay, inr, normalizeStatus, orderTimeline, paymentStatusOf, soldBy, statusSummary, trackingLink } from '../utils';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="text-xs font-semibold text-forge-dark hover:underline"
      aria-label={label}
      onClick={() => {
        const finish = () => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(finish, () => undefined);
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function ShipmentDetails({ order }: { order: Order }) {
  const { settings } = useApp();
  const status = normalizeStatus(order.status);
  if (status === 'Placed' || status === 'Cancelled') {
    return order.trackingNote ? <p className="text-sm text-ink-700">{order.trackingNote}</p> : null;
  }
  const link = trackingLink(order, settings.couriers);
  const self = order.shipMode === 'self';
  const hasAny = self ? order.vehicleNo || order.driverName || order.driverPhone : order.courier || order.trackingNumber;
  if (!hasAny && !order.expectedDelivery && !order.trackingNote) return null;

  return (
    <div className="border border-steel-200 bg-steel-50 p-4 text-sm">
      <p className="font-semibold">{self ? 'Delivered by the Vel delivery team' : 'Third-party courier'}</p>
      <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {self ? (
          <>
            {order.driverName ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Driver</dt>
                <dd>{order.driverName}</dd>
              </div>
            ) : null}
            {order.driverPhone ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Driver phone</dt>
                <dd className="font-mono">{order.driverPhone}</dd>
              </div>
            ) : null}
            {order.vehicleNo ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Vehicle</dt>
                <dd className="font-mono">{order.vehicleNo}</dd>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {order.courier ? (
              <div className="flex gap-2">
                <dt className="text-ink-500">Courier</dt>
                <dd>{order.courier}</dd>
              </div>
            ) : null}
            {order.trackingNumber ? (
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-ink-500">Tracking ID</dt>
                <dd className="font-mono">{order.trackingNumber}</dd>
                <CopyButton text={order.trackingNumber} label="Copy tracking ID" />
              </div>
            ) : null}
          </>
        )}
        {order.expectedDelivery ? (
          <div className="flex gap-2">
            <dt className="text-ink-500">Expected delivery</dt>
            <dd className="font-semibold">{fmtDay(order.expectedDelivery)}</dd>
          </div>
        ) : null}
      </dl>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" className="btn-ghost mt-3 !py-1.5">
          Track on the courier&apos;s website
        </a>
      ) : null}
      {order.trackingNote ? <p className="mt-3 text-ink-700">{order.trackingNote}</p> : null}
    </div>
  );
}

function Timeline({ order }: { order: Order }) {
  const steps = orderTimeline(order);
  const cancelled = normalizeStatus(order.status) === 'Cancelled';
  const waiting = normalizeStatus(order.status) === 'Pending Owner Approval';
  return (
    <div>
    {waiting ? (
      <p className="mb-3 bg-amber-50 px-3 py-2 text-sm font-semibold text-forge-dark">Pending Owner Approval: the owner is reviewing your order and will assign it to a seller.</p>
    ) : null}
    <ol className="space-y-0" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s.step} className="relative flex gap-4 pb-5 last:pb-0">
          {i < steps.length - 1 ? (
            <span className={`absolute left-[11px] top-6 h-full w-0.5 ${steps[i + 1].done && !cancelled ? 'bg-ok' : 'bg-steel-200'}`} aria-hidden="true" />
          ) : null}
          <span
            className={`relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              s.done ? (cancelled ? 'border-steel-500 bg-steel-500 text-white' : 'border-ok bg-ok text-white') : 'border-steel-300 bg-white'
            } ${s.current ? 'ring-4 ring-green-100' : ''}`}
            aria-hidden="true"
          >
            {s.done ? <Icon name="check" className="h-3.5 w-3.5" /> : null}
          </span>
          <div className="min-w-0">
            <p className={`font-semibold ${s.done ? 'text-ink' : 'text-steel-500'}`}>
              {s.label}
              {s.current ? <span className="ml-2 align-middle"><Badge tone="bg-green-50 text-ok">Current</Badge></span> : null}
            </p>
            <p className="font-mono text-xs text-ink-500">{s.date ? fmtDate(s.date) : s.done ? 'Date not recorded' : 'Pending'}</p>
          </div>
        </li>
      ))}
      {cancelled ? (
        <li className="flex gap-4 pt-5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-bad bg-bad text-white" aria-hidden="true">
            <Icon name="x" className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="font-semibold text-bad">Cancelled</p>
            <p className="font-mono text-xs text-ink-500">{(order.history ?? []).find((e) => e.status === 'Cancelled') ? fmtDate((order.history ?? []).find((e) => e.status === 'Cancelled')!.at) : ''}</p>
          </div>
        </li>
      ) : null}
    </ol>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { settings, company } = useApp();
  const [open, setOpen] = useState(true);
  const status = normalizeStatus(order.status);
  const pay = paymentStatusOf(order);

  return (
    <article className="panel" aria-label={`Order ${order.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-steel-200 px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold">{order.id}</p>
          <p className="text-xs text-ink-500">
            Placed {fmtDate(order.createdAt)}
            {order.updatedAt ? ` · Last update ${fmtDate(order.updatedAt)}` : ''}
          </p>
          <p className="mt-1">
            <PdfButtons order={order} company={company} gstRate={settings.gstRate} label={false} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status}</Badge>
          <Badge>{pay === 'Paid' ? 'Paid' : pay === 'Pending' ? 'Payment pending' : pay === 'Awaiting verification' ? 'Verifying payment' : pay}</Badge>
          <span className="font-mono text-lg font-semibold tabular-nums">{inr(order.total)}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <p className="bg-forge-tint px-4 py-3 text-sm font-medium text-ink" role="status">
          {statusSummary(order)}
        </p>

        <PaymentPanel order={order} />

        <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
          <Timeline order={order} />
          <div className="min-w-0 space-y-4">
            <ShipmentDetails order={order} />
            <div className="text-sm text-ink-700">
              <p className="font-semibold text-ink">Delivering to</p>
              <p>{order.ship.name}</p>
              <p>
                {order.ship.line1}, {order.ship.city}, {order.ship.state} {order.ship.pincode}
              </p>
              <p className="mt-2 text-xs">Payment: {order.payment}</p>
            </div>
          </div>
        </div>

        <div>
          <button type="button" className="text-sm font-semibold text-forge-dark hover:underline" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide items' : `Show items (${order.items.length})`}
          </button>
          {open ? (
            <ul className="mt-2 divide-y divide-steel-200 border border-steel-200 text-sm">
              {order.items.map((i) => (
                <li key={i.productId} className="flex justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    {i.name} <span className="font-mono text-steel-500">× {i.qty}</span>
                    <span className="block text-xs text-ink-500">Sold by {soldBy(i)}</span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{inr(i.price * i.qty)}</span>
                </li>
              ))}
              {order.discount ? (
                <li className="flex justify-between px-3 py-2 text-ok">
                  <span>Coupon {order.coupon}</span>
                  <span className="font-mono tabular-nums">−{inr(order.discount)}</span>
                </li>
              ) : null}
              <li className="flex justify-between bg-steel-50 px-3 py-2 font-semibold">
                <span>Total incl. GST and shipping</span>
                <span className="font-mono tabular-nums">{inr(order.total)}</span>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function MyOrders() {
  const { orders, session } = useApp();
  const mine = orders.filter((o) => session && o.customerEmail === session.email);

  return (
    <>
      <PageHeader eyebrow="My Orders" title="Track your orders" lead="See where each order is, the date it reached each stage, and how it is being delivered. This page updates by itself when the status changes." />
      <div className="wrap mt-8 space-y-6">
        {mine.length === 0 ? (
          <div className="panel p-10 text-center">
            <Icon name="box" className="mx-auto h-10 w-10 text-steel-500" />
            <h2 className="mt-3 text-3xl font-semibold">No orders yet</h2>
            <p className="mt-1 text-ink-500">Orders you place from the store will appear here with live tracking.</p>
            <a href="#store" className="btn-primary mt-5">
              Browse the store
            </a>
          </div>
        ) : (
          mine.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </>
  );
}
