import { useApp } from '../store';
import { go } from '../router';
import { Icon, PageHeader, ProductArt, Stepper } from '../components/ui';
import type { Totals } from '../types';
import { inr, isAvailable } from '../utils';

export function OrderSummary({ t, couponCode }: { t: Totals; couponCode?: string }) {
  const { settings } = useApp();
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="font-mono tabular-nums">{inr(t.subtotal)}</dd>
      </div>
      {t.discount > 0 ? (
        <div className="flex justify-between text-ok">
          <dt>Coupon{couponCode ? ` (${couponCode})` : ''}</dt>
          <dd className="font-mono tabular-nums">−{inr(t.discount)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between">
        <dt>GST ({settings.gstRate}%)</dt>
        <dd className="font-mono tabular-nums">{inr(t.gst)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Shipping</dt>
        <dd className="font-mono tabular-nums">
          {t.shippingPending ? 'Calculated at checkout' : t.shipping === 0 ? 'Free' : inr(t.shipping)}
        </dd>
      </div>
      <div className="flex justify-between border-t border-steel-200 pt-3 text-lg font-bold">
        <dt>{t.shippingPending ? 'Total before shipping' : 'Total'}</dt>
        <dd className="font-mono tabular-nums">{inr(t.total)}</dd>
      </div>
    </dl>
  );
}

export function Cart() {
  const { cartDetail, totals, setQty, removeFromCart, role, settings } = useApp();

  return (
    <>
      <PageHeader eyebrow="Vel Store" title="Your cart" />
      <div className="wrap mt-8">
        {cartDetail.length === 0 ? (
          <div className="panel p-10 text-center">
            <Icon name="cart" className="mx-auto h-10 w-10 text-steel-500" />
            <h2 className="mt-3 text-3xl font-semibold">Your cart is empty</h2>
            <p className="mt-1 text-ink-500">Add products from the store to see them here.</p>
            <a href="#store" className="btn-primary mt-5">
              Browse the store
            </a>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
            <ul className="panel min-w-0 divide-y divide-steel-200">
              {cartDetail.map(({ line, product, unitPrice, lineTotal }) => (
                <li key={product.id} className="grid grid-cols-[88px_1fr] gap-4 p-4 sm:grid-cols-[104px_1fr_auto]">
                  <ProductArt seed={product.id} image={product.image} className="h-20 sm:h-24" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-steel-500">{product.sku}</p>
                    <h2 className="text-xl font-semibold leading-tight">{product.name}</h2>
                    <p className="text-xs text-ink-500">Sold by {product.vendorName ?? 'Vel Groups'}</p>
                    <p className="mt-1 text-sm tabular-nums text-ink-700">
                      {inr(unitPrice)} per {product.unit}
                      {unitPrice < product.price ? <span className="ml-2 font-semibold text-ok">bulk price applied</span> : null}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Stepper value={line.qty} max={product.stock} onChange={(n) => setQty(product.id, n)} label={`Quantity for ${product.name}`} />
                      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-bad hover:underline" onClick={() => removeFromCart(product.id)}>
                        <Icon name="trash" className="h-4 w-4" /> Remove
                      </button>
                    </div>
                    {!isAvailable(product) ? (
                      <p className="mt-2 text-xs font-semibold text-bad">Out of stock. Remove it to continue to checkout.</p>
                    ) : line.qty >= product.stock ? (
                      <p className="mt-2 text-xs text-forge-dark">Maximum available quantity selected.</p>
                    ) : null}
                  </div>
                  <p className="col-span-2 text-right text-lg font-bold tabular-nums sm:col-span-1">{inr(lineTotal)}</p>
                </li>
              ))}
            </ul>

            <aside className="min-w-0 lg:sticky lg:top-32 lg:self-start">
              <div className="panel p-5">
                <h2 className="mb-3 text-2xl font-semibold">Order summary</h2>
                <OrderSummary t={totals} />
                {settings.freeShippingAbove > 0 && totals.subtotal < settings.freeShippingAbove ? (
                  <p className="mt-3 text-xs text-ink-500">
                    Add {inr(settings.freeShippingAbove - totals.subtotal)} more for free shipping. Coupons and delivery options are applied at checkout.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-ink-500">Coupons and delivery options are applied at checkout.</p>
                )}
                <button type="button" className="btn-primary mt-4 w-full" onClick={() => go('checkout')}>
                  {role === 'guest' ? 'Sign in to checkout' : 'Proceed to checkout'}
                </button>
                <a href="#store" className="btn-ghost mt-2 w-full">
                  Continue shopping
                </a>
              </div>
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
