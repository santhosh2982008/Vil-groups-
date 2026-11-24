import { useApp } from '../store';
import { go } from '../router';
import type { RouteId } from '../router';
import { Icon, ProductArt } from '../components/ui';
import { discountPct, inr, isAvailable } from '../utils';

export function Home() {
  const { company, catalog, services, addToCart } = useApp();
  const featured = catalog.filter((p) => p.featured && isAvailable(p)).slice(0, 4);

  const divisions: { to: RouteId; icon: string; title: string; text: string; meta: string }[] = [
    {
      to: 'service-center',
      icon: 'wrench',
      title: 'Vel Service Center',
      text: 'Maintenance contracts, overhauls and on-site breakdown support.',
      meta: `${services.length} service lines`,
    },
    {
      to: 'store',
      icon: 'store',
      title: 'Vel Store',
      text: 'Pumps, motors, drives, bearings and tooling with GST invoices.',
      meta: `${catalog.length} products listed`,
    },
    {
      to: 'manufacturing',
      icon: 'factory',
      title: 'Vel Manufacturing Company',
      text: 'Power packs, fabrications and machined parts built to your drawing.',
      meta: company.manufacturing.certifications[0] ?? 'Custom builds',
    },
    {
      to: 'service-enquiry',
      icon: 'mail',
      title: 'Service Enquiry',
      text: 'Describe the fault or the part. We call back the same working day.',
      meta: company.phone,
    },
  ];

  return (
    <>
      <section className="blueprint bg-ink text-white">
        <div className="wrap grid gap-10 py-14 md:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="min-w-0">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-[#F2B26B]">Industrial conglomerate</p>
            <h1 className="mt-3 text-6xl font-semibold uppercase leading-[0.9] md:text-8xl">
              {company.name}
            </h1>
            <p className="mt-5 max-w-xl text-xl text-steel-200">{company.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#store" className="btn-primary">
                Shop the store
              </a>
              <a href="#service-enquiry" className="btn border border-white/40 text-white hover:bg-white/10">
                Request service
              </a>
            </div>
          </div>

          <div className="min-w-0 border border-white/20 bg-ink-700/60">
            <p className="border-b border-white/20 px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-steel-300">
              Division index
            </p>
            <ul>
              {divisions.map((d, i) => (
                <li key={d.to} className={i > 0 ? 'border-t border-white/10' : ''}>
                  <a href={'#' + d.to} className="group flex items-center gap-4 px-5 py-4 hover:bg-white/5">
                    <Icon name={d.icon} className="h-6 w-6 shrink-0 text-[#F2B26B]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-xl font-semibold uppercase tracking-wide">{d.title}</span>
                      <span className="block truncate font-mono text-xs text-steel-300">{d.meta}</span>
                    </span>
                    <Icon name="chevron" className="h-5 w-5 shrink-0 text-steel-300 transition-transform group-hover:translate-x-1" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-steel-200 bg-white">
        <dl className="wrap grid grid-cols-2 gap-y-6 py-8 md:grid-cols-4">
          {company.manufacturing.stats.map((s) => (
            <div key={s.label} className="min-w-0 border-l-2 border-forge pl-4">
              <dd className="font-display text-4xl font-semibold tabular-nums">{s.value}</dd>
              <dt className="text-sm text-ink-500">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap mt-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">From the store</p>
            <h2 className="mt-1 text-4xl font-semibold md:text-5xl">Featured products</h2>
          </div>
          <a href="#store" className="btn-ghost">
            View all products
          </a>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <article key={p.id} className="panel flex min-w-0 flex-col">
              <ProductArt seed={p.id} image={p.image} className="h-36" />
              <div className="flex flex-1 flex-col p-4">
                <p className="font-mono text-xs uppercase tracking-wider text-ink-500">{p.category}</p>
                <h3 className="mt-1 text-xl font-semibold leading-tight">{p.name}</h3>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold tabular-nums">{inr(p.price)}</span>
                  {p.mrp > p.price ? (
                    <>
                      <span className="text-sm tabular-nums text-steel-500 line-through">{inr(p.mrp)}</span>
                      <span className="text-xs font-semibold text-ok">{discountPct(p.price, p.mrp)}% off</span>
                    </>
                  ) : null}
                </p>
                <div className="mt-auto flex gap-2 pt-4">
                  <button type="button" className="btn-ghost flex-1" onClick={() => addToCart(p.id)}>
                    Add to cart
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    onClick={() => {
                      addToCart(p.id);
                      go('checkout');
                    }}
                  >
                    Shop now
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="wrap mt-16 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="min-w-0">
          <p className="eyebrow">Vel Service Center</p>
          <h2 className="mt-1 text-4xl font-semibold md:text-5xl">Keep the line running</h2>
          <p className="mt-3 max-w-md text-ink-500">{company.about}</p>
          <a href="#service-center" className="btn-dark mt-5">
            See all services
          </a>
        </div>
        <ul className="panel divide-y divide-steel-200">
          {services.slice(0, 4).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold">{s.name}</p>
                <p className="font-mono text-xs text-ink-500">{s.turnaround}</p>
              </div>
              <p className="shrink-0 text-right text-sm">
                <span className="block text-xs text-steel-500">from</span>
                <span className="font-bold tabular-nums">{inr(s.priceFrom)}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap mt-16">
        <div className="flex flex-col items-start justify-between gap-4 bg-forge-tint p-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-semibold md:text-4xl">Need help choosing a part or a service?</h2>
            <p className="mt-1 text-ink-700">
              Call <span className="font-mono font-medium">{company.phone}</span>, {company.hours}.
            </p>
          </div>
          <a href="#service-enquiry" className="btn-primary shrink-0">
            Send an enquiry
          </a>
        </div>
      </section>
    </>
  );
}
