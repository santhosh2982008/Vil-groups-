import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import type { Product } from '../types';
import { Icon, Modal, PageHeader, ProductArt, Stepper } from '../components/ui';
import { discountPct, inr, isAvailable, productImages, rangeLabel, tierRanges, unitPriceFor } from '../utils';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

function StockLabel({ p }: { p: Product }) {
  if (!isAvailable(p)) return <span className="text-sm font-semibold text-bad">Out of stock</span>;
  if (p.stock <= 5) return <span className="text-sm font-semibold text-forge-dark">Only {p.stock} left</span>;
  return (
    <span className="text-sm font-semibold text-ok">
      In stock <span className="font-mono font-normal text-ink-500">({p.stock} {p.unit}s)</span>
    </span>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addToCart, settings } = useApp();
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const out = !isAvailable(product);
  const photos = productImages(product);
  const ranges = tierRanges(product);
  const unit = unitPriceFor(product, qty);

  return (
    <Modal title={product.name} onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div className="min-w-0">
          <ProductArt seed={product.id} image={photos[imgIdx] ?? photos[0]} className="h-56 border border-steel-200" />
          {photos.length > 1 ? (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Product photos">
              {photos.map((src, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setImgIdx(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === imgIdx}
                    className={`h-14 w-14 border bg-white p-0.5 ${i === imgIdx ? 'border-forge' : 'border-steel-200 hover:border-steel-300'}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-contain" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 font-mono text-xs text-ink-500">SKU {product.sku}</p>
          <p className="text-xs text-ink-500">Sold by {product.vendorName ?? 'Vel Groups'}</p>
          <p className="font-mono text-xs text-ink-500">
            {product.brand} · {product.category}
          </p>
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{inr(unit)}</span>
            {product.mrp > unit ? (
              <>
                <span className="tabular-nums text-steel-500 line-through">{inr(product.mrp)}</span>
                <span className="text-sm font-semibold text-ok">{discountPct(unit, product.mrp)}% off</span>
              </>
            ) : null}
          </p>
          <p className="text-xs text-ink-500">per {product.unit}, excluding {settings.gstRate}% GST{qty > 1 ? ` · ${inr(unit * qty)} for ${qty}` : ''}</p>
          {ranges.length > 0 ? (
            <table className="mt-3 w-full max-w-xs border border-steel-200 text-sm" aria-label="Quantity prices">
              <caption className="bg-steel-50 px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink-500">Buy more, pay less</caption>
              <tbody>
                {ranges.map((r) => (
                  <tr key={r.from} className={qty >= r.from && (r.to === null || qty <= r.to) ? 'bg-forge-tint font-semibold' : ''}>
                    <td className="px-2 py-1 font-mono">{rangeLabel(r)} {product.unit}s</td>
                    <td className="px-2 py-1 text-right tabular-nums">{inr(r.price)} each</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {product.weightKg ? <p className="mt-2 font-mono text-xs text-ink-500">Net weight {product.weightKg} kg per {product.unit}</p> : null}
          <p className="mt-2">
            <StockLabel p={product} />
          </p>
          <p className="mt-4 text-ink-700">{product.description}</p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Stepper value={qty} max={Math.max(product.stock, 1)} onChange={setQty} label="Quantity" />
            <button
              type="button"
              className="btn-ghost"
              disabled={out}
              onClick={() => {
                addToCart(product.id, qty);
                onClose();
              }}
            >
              Add to cart
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={out}
              onClick={() => {
                addToCart(product.id, qty);
                onClose();
                go('checkout');
              }}
            >
              Shop now
            </button>
          </div>
        </div>
      </div>

      <h3 className="mt-6 text-xl font-semibold">Specifications</h3>
      <div className="mt-2 overflow-x-auto border border-steel-200">
        <table className="w-full text-sm">
          <tbody>
            {product.specs.map((s, i) => (
              <tr key={s.label + i} className={i % 2 ? 'bg-steel-50' : 'bg-white'}>
                <th scope="row" className="w-2/5 px-3 py-2 text-left font-semibold text-ink-700">
                  {s.label}
                </th>
                <td className="px-3 py-2 font-mono">{s.value}</td>
              </tr>
            ))}
            <tr className={product.specs.length % 2 ? 'bg-steel-50' : 'bg-white'}>
              <th scope="row" className="px-3 py-2 text-left font-semibold text-ink-700">
                Pack / unit
              </th>
              <td className="px-3 py-2 font-mono">1 {product.unit}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function Store() {
  const { catalog: products, addToCart, settings, categories: managed } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<SortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  // Managed categories first (owner's order), then any category a product uses that is not managed. Counts are public products only.
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products]);
  const catTiles = useMemo(() => {
    const list = managed.map((c) => ({ name: c.name, image: c.image }));
    for (const n of counts.keys()) if (!list.some((c) => c.name === n)) list.push({ name: n, image: '' });
    return list;
  }, [managed, counts]);
  const categories = useMemo(() => ['All', ...catTiles.map((c) => c.name)], [catTiles]);
  const pickCategory = (c: string) => {
    setCategory(c);
    window.setTimeout(() => document.getElementById('store-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category !== 'All' && p.category !== category) return false;
      if (inStockOnly && !isAvailable(p)) return false;
      if (!q) return true;
      return [p.name, p.sku, p.brand, p.category].some((v) => v.toLowerCase().includes(q));
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'featured') list = [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
    return list;
  }, [products, query, category, sort, inStockOnly]);

  const open = products.find((p) => p.id === openId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Vel Store"
        title="Industrial components, shipped to site"
        lead={`Prices are per unit and exclude ${settings.gstRate}% GST.${settings.freeShippingAbove > 0 ? ` Orders above ${inr(settings.freeShippingAbove)} ship free.` : ''}`}
      />

      <section className="wrap mt-8" aria-labelledby="cat-h">
        <h2 id="cat-h" className="mb-3 text-2xl font-semibold">Shop by category</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <li>
            <button
              type="button"
              onClick={() => pickCategory('All')}
              aria-pressed={category === 'All'}
              className={`panel flex h-full w-full flex-col items-center justify-center p-3 text-center ${category === 'All' ? 'ring-2 ring-forge' : 'hover:border-steel-300'}`}
            >
              <span className="font-display text-3xl font-semibold tabular-nums">{products.length}</span>
              <span className="text-sm font-semibold">All products</span>
            </button>
          </li>
          {catTiles.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => pickCategory(c.name)}
                aria-pressed={category === c.name}
                aria-label={`${c.name}, ${counts.get(c.name) ?? 0} products`}
                className={`panel block h-full w-full overflow-hidden text-left ${category === c.name ? 'ring-2 ring-forge' : 'hover:border-steel-300'}`}
              >
                <ProductArt seed={c.name} image={c.image} className="h-24 w-full" />
                <span className="block px-3 py-2">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="block font-mono text-xs text-ink-500">
                    {counts.get(c.name) ?? 0} product{(counts.get(c.name) ?? 0) === 1 ? '' : 's'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div id="store-results" className="wrap mt-8 grid scroll-mt-32 gap-8 lg:grid-cols-[250px_1fr]">
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-32 lg:self-start" aria-label="Filters">
          <div>
            <label htmlFor="store-search" className="label">
              Search
            </label>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-steel-500" />
              <input
                id="store-search"
                className="field !pl-9"
                placeholder="Name, SKU or brand"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="label">Category</p>
            <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`px-3 py-1.5 text-left text-sm lg:border-l-2 ${
                    category === c
                      ? 'bg-ink font-semibold text-white lg:border-forge lg:bg-transparent lg:text-forge-dark'
                      : 'bg-white text-ink hover:bg-steel-100 lg:border-steel-200 lg:bg-transparent'
                  }`}
                >
                  {c} <span className="font-mono text-xs opacity-70">({c === 'All' ? products.length : counts.get(c) ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="store-sort" className="label">
              Sort by
            </label>
            <select id="store-sort" className="field" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="featured">Featured first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              id="store-instock"
              type="checkbox"
              className="h-4 w-4 accent-[#B45309]"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            In stock only
          </label>
        </aside>

        <section className="min-w-0" aria-label="Products">
          <p className="mb-3 font-mono text-xs text-ink-500" aria-live="polite">
            {visible.length} of {products.length} products
          </p>

          {visible.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-xl font-semibold">No products match these filters.</p>
              <button
                type="button"
                className="btn-ghost mt-4"
                onClick={() => {
                  setQuery('');
                  setCategory('All');
                  setInStockOnly(false);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((p) => (
                <article key={p.id} className="panel flex min-w-0 flex-col">
                  <button type="button" className="block text-left" onClick={() => setOpenId(p.id)} aria-label={`View details for ${p.name}`}>
                    <ProductArt seed={p.id} image={p.image} className="h-40" />
                    {productImages(p).length > 1 ? <span className="sr-only">{productImages(p).length} photos</span> : null}
                  </button>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-mono text-xs uppercase tracking-wider text-ink-500">{p.category}</p>
                    <h2 className="mt-1 text-xl font-semibold leading-tight">
                      <button type="button" className="text-left hover:text-forge-dark" onClick={() => setOpenId(p.id)}>
                        {p.name}
                      </button>
                    </h2>
                    <p className="mt-1 font-mono text-xs text-steel-500">{p.sku}</p>
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-2xl font-bold tabular-nums">{inr(p.price)}</span>
                      {p.mrp > p.price ? (
                        <>
                          <span className="text-sm tabular-nums text-steel-500 line-through">{inr(p.mrp)}</span>
                          <span className="text-xs font-semibold text-ok">{discountPct(p.price, p.mrp)}% off</span>
                        </>
                      ) : null}
                    </p>
                    {tierRanges(p).length > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-ok">
                        Bulk price from {inr(Math.min(p.price, ...tierRanges(p).map((r) => r.price)))} each
                      </p>
                    ) : null}
                    <p className="mt-1">
                      <StockLabel p={p} />
                    </p>
                    <ul className="mt-3 space-y-0.5 font-mono text-xs text-ink-700">
                      {p.specs.slice(0, 2).map((s) => (
                        <li key={s.label} className="truncate">
                          {s.label}: {s.value}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <button type="button" className="btn-ghost" disabled={!isAvailable(p)} onClick={() => addToCart(p.id)}>
                        Add to cart
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!isAvailable(p)}
                        onClick={() => {
                          addToCart(p.id);
                          go('checkout');
                        }}
                      >
                        Shop now
                      </button>
                    </div>
                    <button type="button" className="mt-2 text-left text-sm font-semibold text-forge-dark hover:underline" onClick={() => setOpenId(p.id)}>
                      Specifications and details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {open ? <ProductDetail product={open} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}
