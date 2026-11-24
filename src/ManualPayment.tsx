import { useState } from 'react';
import { useApp } from '../store';
import type { Order } from '../types';
import { ImagePicker } from './ui';
import { fmtDate, inr, paymentStatusOf } from '../utils';

/** Tells the customer how to pay: by hand, via GPay. Nothing is paid inside the app or over WhatsApp. */
export function PaymentNote({ amount }: { amount: number }) {
  const { settings } = useApp();
  return (
    <div className="border border-forge bg-forge-tint p-4 text-sm text-ink" role="note">
      <p className="font-semibold">Online payment information</p>
      <p className="mt-1">
        Payments are <strong>not processed directly in this app or through WhatsApp</strong>. Please pay the total amount of <strong className="font-mono">{inr(amount)}</strong> by{' '}
        <strong>GPay</strong> to <strong className="font-mono">{settings.gpayNumber || 'the number shown by the owner'}</strong>.
      </p>
      <p className="mt-1">After paying, open <strong>My Orders</strong>, upload the screenshot of your GPay payment on this order and submit it. We will verify it and confirm your payment.</p>
    </div>
  );
}

/** Instructions plus the screenshot upload for one order. Used in My Orders and right after checkout. */
export function PaymentPanel({ order }: { order: Order }) {
  const { submitPaymentProof, getPaymentProof } = useApp();
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const pay = paymentStatusOf(order);
  const cancelled = order.status === 'Cancelled';
  if (order.paymentKind !== 'gpay' || cancelled) return null;
  const proof = getPaymentProof(order.id);

  if (pay === 'Paid') {
    return (
      <p className="bg-green-50 px-4 py-3 text-sm font-semibold text-ok" role="status">
        Payment verified{order.paidAt ? ` on ${fmtDate(order.paidAt)}` : ''}. Thank you.
      </p>
    );
  }
  if (pay === 'Refunded') return null;

  const submit = () => {
    const err = submitPaymentProof(order.id, image);
    if (err) setError(err);
    else {
      setError('');
      setImage('');
    }
  };

  return (
    <section className="space-y-3 border border-steel-200 p-4" aria-label={`Payment for ${order.id}`}>
      <PaymentNote amount={order.total} />
      {pay === 'Awaiting verification' ? (
        <div className="flex flex-wrap items-center gap-4 bg-steel-50 p-3 text-sm" role="status">
          {proof ? <img src={proof} alt="Your payment screenshot" className="h-24 w-auto border border-steel-200 object-contain" /> : null}
          <p className="min-w-0 flex-1">
            <strong>Screenshot received{order.paymentProofAt ? ` on ${fmtDate(order.paymentProofAt)}` : ''}.</strong> The owner is verifying your payment. You can replace the screenshot below if needed.
          </p>
        </div>
      ) : null}
      {pay === 'Failed' ? (
        <p className="bg-red-50 px-3 py-2 text-sm font-medium text-bad" role="alert">
          Your payment could not be verified{order.paymentNote ? `: ${order.paymentNote}` : '.'} Please upload a clear screenshot of the completed GPay payment.
        </p>
      ) : null}
      <ImagePicker
        id={`pay-proof-${order.id}`}
        label={pay === 'Awaiting verification' ? 'Replace payment screenshot' : 'GPay payment screenshot'}
        value={image}
        onChange={(v) => {
          setImage(v);
          setError('');
        }}
        maxDim={1100}
        mime="image/jpeg"
        maxChars={220_000}
        previewClass="h-28 w-20"
        hint="Upload the screenshot, then press Submit screenshot."
      />
      {error ? (
        <p className="text-sm font-medium text-bad" role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" className="btn-primary" disabled={!image} onClick={submit} id={`pay-submit-${order.id}`}>
        Submit screenshot
      </button>
    </section>
  );
}
