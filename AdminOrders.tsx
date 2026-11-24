import { useState } from 'react';
import { useApp } from '../store';
import type { Order, OrderStatus, PaymentStatus } from '../types';
import { ORDER_STATUSES } from '../config';
import { Badge, Field, Modal, PdfButtons } from '../components/ui';
import { fmtDate, inr, isOpenOrder, normalizeStatus, paymentStatusOf, soldBy, trackingLink } from '../utils';

const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Awaiting verification', 'Paid', 'Failed', 'Refunded'];

/** What the owner can do with an order: approve it by assigning a vendor, move it to another vendor, or cancel it. */
function OwnerActions({ order }: { order: Order }) {
  const { vendors, assignOrder, cancelOrder } = useApp();
  const approved = vendors.filter((v) => v.status === 'Approved');
  const status = normalizeStatus(order.status);
  const pending = status === 'Pending Owner Approval';
  const suggested = order.items.map((i) => i.vendorId).find((v) => v && approved.some((a) => a.id === v)) ?? '';
  const [sel, setSel] = useState(order.vendorId && !pending ? '' : suggested);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const id = order.id;

  if (!isOpenOrder(order)) {
    return <p className="text-sm text-ink-500">{status === 'Delivered' ? 'This order is delivered. No further changes.' : 'This order was cancelled.'}</p>;
  }
  const sellers = Array.from(new Set(order.items.map(soldBy)));

  return (
    <div className="space-y-3">
      <p className="font-semibold text-ink">{pending ? 'Review this order' : `Assigned to ${order.vendorName ?? 'a vendor'}`}</p>
      <p className="text-xs text-ink-500">Products in this order are sold by: {sellers.join(', ')}.</p>
      {approved.length === 0 ? (
        <p className="bg-forge-tint px-3 py-2 text-sm font-medium" role="status">
          No approved vendor yet. Approve a vendor in Vendors &amp; margin first, then assign this order.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={pending ? 'Assign to vendor' : 'Reassign to another vendor'} htmlFor={`oa-vendor-${id}`}>
            <select id={`oa-vendor-${id}`} className="field min-w-[14rem]" value={sel} onChange={(e) => { setSel(e.target.value); setError(''); }}>
              <option value="">Choose a vendor</option>
              {approved
                .filter((v) => v.id !== order.vendorId || pending)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.shopName} ({v.address?.city ?? 'address not given'})
                  </option>
                ))}
            </select>
          </Field>
          <button
            type="button"
            className="btn-primary"
            id={`oa-assign-${id}`}
            onClick={() => {
              if (!sel) {
                setError('Choose a vendor first.');
                return;
              }
              const err = assignOrder(order.id, sel);
              setError(err ?? '');
            }}
          >
            {pending ? 'Approve and assign' : 'Reassign order'}
          </button>
        </div>
      )}
      {!pending ? <p className="text-xs text-ink-500">Reassigning sends the order back to “Placed” for the new vendor, and clears the old vendor&apos;s shipment details.</p> : null}
      {error ? <p className="text-sm font-medium text-bad" role="alert">{error}</p> : null}

      {cancelling ? (
        <div className="space-y-2 border border-bad/40 bg-red-50 p-3">
          <Field label="Reason for cancelling (shown to the customer)" htmlFor={`oa-reason-${id}`}>
            <input id={`oa-reason-${id}`} className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn-danger" id={`oa-cancel-yes-${id}`} onClick={() => { const err = cancelOrder(order.id, reason); if (err) setError(err); }}>
              Yes, cancel this order
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCancelling(false)}>
              Keep order
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="text-sm font-semibold text-bad hover:underline" id={`oa-cancel-${id}`} onClick={() => setCancelling(true)}>
          Cancel order
        </button>
      )}
    </div>
  );
}

function OrderManageCard({ order }: { order: Order }) {
  const { settings, company, vendors } = useApp();
  const status = normalizeStatus(order.status);
  const pay = paymentStatusOf(order);
  const vendor = vendors.find((v) => v.id === order.vendorId);
  const link = trackingLink(order, settings.couriers);
  const self = order.shipMode === 'self';
  const fulfil = self ? [order.driverName, order.vehicleNo, order.driverPhone].filter(Boolean).join(' · ') : [order.courier, order.trackingNumber].filter(Boolean).join(' · ');

  return (
    <li className={`panel ${status === 'Pending Owner Approval' ? 'ring-2 ring-forge' : ''}`} aria-label={`Order ${order.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-steel-200 px-5 py-3">
        <div className="min-w-0">
          <p className="font-mono font-semibold">{order.id}</p>
          <p className="text-xs text-ink-500">
            {fmtDate(order.createdAt)} · {order.customerName} ({order.customerEmail})
            {order.updatedAt ? ` · Updated ${fmtDate(order.updatedAt)}` : ''}
          </p>
          <p className="mt-1">
            <PdfButtons order={order} company={company} gstRate={settings.gstRate} />
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{status}</Badge>
          <Badge>{pay}</Badge>
          <span className="font-mono font-semibold tabular-nums">{inr(order.total)}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 text-sm lg:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0 space-y-4">
          <ul className="space-y-1">
            {order.items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {i.name} <span className="font-mono text-steel-500">× {i.qty}</span>
                  <span className="block text-xs text-ink-500">Sold by {soldBy(i)}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums">{inr(i.price * i.qty)}</span>
              </li>
            ))}
            {order.discount ? (
              <li className="flex justify-between text-ok">
                <span>Coupon {order.coupon}</span>
                <span className="font-mono tabular-nums">−{inr(order.discount)}</span>
              </li>
            ) : null}
            <li className="flex justify-between border-t border-steel-200 pt-2 font-semibold">
              <span>Total incl. GST and shipping</span>
              <span className="font-mono tabular-nums">{inr(order.total)}</span>
            </li>
          </ul>

          <div className="text-ink-700">
            <p className="font-semibold text-ink">Ship to</p>
            <p>{order.ship.name}</p>
            <p>
              {order.ship.line1}, {order.ship.city}, {order.ship.state} {order.ship.pincode}
            </p>
            <p className="font-mono">{order.ship.phone}</p>
            <p className="mt-2 text-xs">Payment: {order.payment}</p>
            {order.courier ? (
              <p className="text-xs">
                Delivery option chosen: {order.courier} ({order.shipping === 0 ? 'free' : inr(order.shipping)})
                {order.weightKg ? ` · ${order.weightKg} kg` : ''}
              </p>
            ) : null}
          </div>

          {vendor ? (
            <div className="text-ink-700">
              <p className="font-semibold text-ink">Fulfilled by {vendor.shopName}</p>
              <p className="text-xs">
                {vendor.address ? `${vendor.address.line1}${vendor.address.line2 ? ', ' + vendor.address.line2 : ''}, ${vendor.address.city}, ${vendor.address.district}, ${vendor.address.state} ${vendor.address.pincode}` : ''}
              </p>
              <p className="font-mono text-xs">{vendor.shopPhone}</p>
              {fulfil ? (
                <p className="mt-1 text-xs">
                  {self ? 'Own delivery: ' : 'Courier: '}
                  {fulfil}
                  {link ? (
                    <>
                      {' · '}
                      <a href={link} target="_blank" rel="noopener noreferrer" className="font-semibold text-forge-dark underline">
                        Track
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          {order.history && order.history.length > 0 ? (
            <div>
              <p className="font-semibold text-ink">Status history</p>
              <ul className="mt-1 space-y-0.5 font-mono text-xs text-ink-700">
                {order.history.map((e, i) => (
                  <li key={e.status + i}>
                    {e.status}: {fmtDate(e.at)}
                    {e.note ? ` (${e.note})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 border border-steel-200 bg-steel-50 p-4">
          <OwnerActions order={order} />
          {status !== 'Pending Owner Approval' && isOpenOrder(order) ? (
            <p className="mt-3 border-t border-steel-200 pt-3 text-xs text-ink-500">Only the assigned vendor moves this order through Placed, Packaged, Couriered, Out for delivery and Delivered. Changes appear here and for the customer automatically.</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AdminOrders() {
  const { orders } = useApp();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const shown = orders.filter((o) => filter === 'all' || normalizeStatus(o.status) === filter);
  const waiting = orders.filter((o) => normalizeStatus(o.status) === 'Pending Owner Approval').length;

  if (orders.length === 0) {
    return <p className="panel p-8 text-center text-ink-500">No orders yet. Orders placed at checkout appear here for your approval.</p>;
  }
  return (
    <div>
      {waiting > 0 ? (
        <p className="mb-4 bg-forge-tint px-4 py-3 text-sm font-semibold text-ink" role="status">
          {waiting} order{waiting === 1 ? ' is' : 's are'} waiting for your approval.{' '}
          <button type="button" className="underline" onClick={() => setFilter('Pending Owner Approval')}>
            Show them
          </button>
        </p>
      ) : null}
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="ord-filter" className="label !mb-0">
          Show
        </label>
        <select id="ord-filter" className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | OrderStatus)}>
          <option value="all">All orders ({orders.length})</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} ({orders.filter((o) => normalizeStatus(o.status) === s).length})
            </option>
          ))}
        </select>
      </div>
      <ul className="space-y-4">
        {shown.map((o) => (
          <OrderManageCard key={o.id} order={o} />
        ))}
        {shown.length === 0 ? <li className="panel p-8 text-center text-ink-500">No orders with this status.</li> : null}
      </ul>
    </div>
  );
}

/* ---------------- Payments ledger ---------------- */

function ProofModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { getPaymentProof, setOrderPayment } = useApp();
  const proof = getPaymentProof(order.id);
  const [note, setNote] = useState('');
  const [ref, setRef] = useState(order.paymentRef ?? '');
  const decide = (paymentStatus: PaymentStatus) => {
    setOrderPayment(order.id, { paymentStatus, paymentRef: ref.trim(), paymentNote: paymentStatus === 'Failed' ? note.trim() || 'Screenshot did not match the amount' : '' });
    onClose();
  };
  return (
    <Modal title={`Payment check: ${order.id}`} onClose={onClose} wide>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div>
          {proof ? <img src={proof} alt={`GPay screenshot for ${order.id}`} className="max-h-[60vh] w-full border border-steel-200 object-contain" /> : <p className="text-sm text-ink-500">No screenshot has been uploaded for this order.</p>}
          {order.paymentProofAt ? <p className="mt-1 font-mono text-xs text-ink-500">Uploaded {fmtDate(order.paymentProofAt)}</p> : null}
        </div>
        <div className="space-y-3 text-sm">
          <p>
            Customer: <strong>{order.customerName}</strong>
            <span className="block break-all text-xs text-ink-500">{order.customerEmail}</span>
          </p>
          <p>
            Amount to match: <strong className="font-mono text-lg">{inr(order.total)}</strong>
          </p>
          <Field label="GPay transaction ID (optional)" htmlFor={`pv-ref-${order.id}`}>
            <input id={`pv-ref-${order.id}`} className="field font-mono" value={ref} onChange={(e) => setRef(e.target.value)} />
          </Field>
          <Field label="If rejecting: reason shown to the customer" htmlFor={`pv-note-${order.id}`}>
            <input id={`pv-note-${order.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" id={`pv-ok-${order.id}`} onClick={() => decide('Paid')}>
              Mark as paid
            </button>
            <button type="button" className="btn-danger" id={`pv-no-${order.id}`} onClick={() => decide('Failed')}>
              Reject screenshot
            </button>
          </div>
          <p className="text-xs text-ink-500">Check the amount, date and receiver number in your own GPay or bank app before confirming.</p>
        </div>
      </div>
    </Modal>
  );
}

function LedgerRow({ order }: { order: Order }) {
  const { setOrderPayment } = useApp();
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>(paymentStatusOf(order));
  const [ref, setRef] = useState(order.paymentRef ?? '');
  const [note, setNote] = useState(order.paymentNote ?? '');
  const pay = paymentStatusOf(order);
  const id = order.id;

  return (
    <>
      <tr className={`border-t border-steel-200 align-top ${pay === 'Awaiting verification' ? 'bg-forge-tint' : ''}`}>
        <td className="px-4 py-3">
          <span className="font-mono font-semibold">{order.id}</span>
          <span className="block text-xs text-ink-500">{fmtDate(order.createdAt)}</span>
        </td>
        <td className="px-4 py-3">
          {order.customerName}
          <span className="block break-all text-xs text-ink-500">{order.customerEmail}</span>
        </td>
        <td className="px-4 py-3">{order.payment}</td>
        <td className="px-4 py-3">
          <Badge>{pay}</Badge>
          {order.paymentNote ? <span className="mt-1 block max-w-[16rem] text-xs text-ink-500">{order.paymentNote}</span> : null}
        </td>
        <td className="px-4 py-3 font-mono text-xs">{order.paymentRef ? <span className="break-all">{order.paymentRef}</span> : '—'}</td>
        <td className="px-4 py-3 text-right font-mono tabular-nums">{inr(order.total)}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
            {order.paymentProofAt ? (
              <button type="button" className="text-sm font-semibold text-forge-dark hover:underline" id={`pv-open-${order.id}`} onClick={() => setChecking(true)}>
                {pay === 'Awaiting verification' ? 'Verify screenshot' : 'View screenshot'}
              </button>
            ) : null}
            <button type="button" className="text-sm font-semibold hover:underline" onClick={() => setEditing((v) => !v)} aria-expanded={editing} aria-label={`Update payment for ${order.id}`}>
              {editing ? 'Close' : 'Update'}
            </button>
          </div>
        </td>
      </tr>
      {editing ? (
        <tr className="bg-steel-50">
          <td colSpan={7} className="px-4 py-4">
            <form
              className="grid gap-4 md:grid-cols-[12rem_1fr_1.4fr_auto] md:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                setOrderPayment(order.id, { paymentStatus: status, paymentRef: ref.trim(), paymentNote: note.trim() });
                setEditing(false);
              }}
            >
              <Field label="Payment status" htmlFor={`tx-status-${id}`}>
                <select id={`tx-status-${id}`} className="field" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference (GPay transaction ID)" htmlFor={`tx-ref-${id}`}>
                <input id={`tx-ref-${id}`} className="field font-mono" value={ref} onChange={(e) => setRef(e.target.value)} />
              </Field>
              <Field label="Note" htmlFor={`tx-note-${id}`}>
                <input id={`tx-note-${id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <button type="submit" className="btn-primary">
                Save payment
              </button>
            </form>
          </td>
        </tr>
      ) : null}
      {checking ? <ProofModal order={order} onClose={() => setChecking(false)} /> : null}
    </>
  );
}

export function AdminTransactions() {
  const { orders, settings } = useApp();
  const live = orders.filter((o) => normalizeStatus(o.status) !== 'Cancelled');
  const sum = (list: Order[]) => list.reduce((s, o) => s + o.total, 0);
  const collected = live.filter((o) => paymentStatusOf(o) === 'Paid');
  const verifying = live.filter((o) => paymentStatusOf(o) === 'Awaiting verification');
  const awaiting = live.filter((o) => paymentStatusOf(o) === 'Pending' || paymentStatusOf(o) === 'Failed');
  const refunded = orders.filter((o) => paymentStatusOf(o) === 'Refunded');
  const tiles = [
    { label: 'Collected', value: inr(sum(collected)), note: `${collected.length} orders` },
    { label: 'To verify', value: String(verifying.length), note: `${inr(sum(verifying))} with screenshots` },
    { label: 'Awaiting payment', value: inr(sum(awaiting)), note: `${awaiting.length} orders` },
    { label: 'Refunded', value: inr(sum(refunded)), note: `${refunded.length} orders` },
  ];

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-700">
        Customers pay by GPay to <strong className="font-mono">{settings.gpayNumber || 'no number set yet'}</strong> and upload a screenshot in My Orders. Open each screenshot below, compare it with your own GPay or bank statement, then mark it paid or reject it. Refunds are made by you directly; record them here afterwards.
      </p>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">{t.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</dd>
            <dd className="text-xs text-ink-500">{t.note}</dd>
          </div>
        ))}
      </dl>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-steel-100 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Method</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <LedgerRow key={o.id} order={o} />
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-500">
                  No transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
