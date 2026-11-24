import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Product } from '../types';
import { Badge, ConfirmDelete, Field, Icon, Modal, MultiImagePicker, ProductArt } from '../components/ui';
import { cleanTiers, inr, isAvailable, parseSpecs, productImages, rangeLabel, specsToText, tierProblem, tierRanges, uid } from '../utils';

interface TierDraft {
  minQty: string;
  price: string;
}

interface ProductDraft {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  price: string;
  mrp: string;
  stock: string;
  unit: string;
  weight: string;
  tiers: TierDraft[];
  description: string;
  specs: string;
  featured: boolean;
  images: string[];
  inStock: boolean;
  hidden: boolean;
  vendorId?: string;
}

const blankProduct = (): ProductDraft => ({
  id: uid('p'),
  sku: '',
  name: '',
  category: '',
  brand: 'Vel',
  price: '',
  mrp: '',
  stock: '0',
  unit: 'piece',
  weight: '',
  tiers: [],
  description: '',
  specs: '',
  featured: false,
  images: [],
  inStock: true,
  hidden: false,
});

const draftFromProduct = (p: Product): ProductDraft => ({
  id: p.id,
  sku: p.sku,
  name: p.name,
  category: p.category,
  brand: p.brand,
  price: String(p.price),
  mrp: String(p.mrp),
  stock: String(p.stock),
  unit: p.unit,
  weight: p.weightKg ? String(p.weightKg) : '',
  tiers: cleanTiers(p.priceTiers).map((t) => ({ minQty: String(t.minQty), price: String(t.price) })),
  description: p.description,
  specs: specsToText(p.specs),
  featured: p.featured,
  images: productImages(p),
  inStock: p.available !== false,
  hidden: Boolean(p.hidden),
  vendorId: p.vendorId,
});

/** Edits the quantity brackets. Each bracket runs until the next one starts; the last one has no limit. */
function TierEditor({ tiers, onChange, basePrice, unit }: { tiers: TierDraft[]; onChange: (t: TierDraft[]) => void; basePrice: string; unit: string }) {
  const parsed = tiers.map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }));
  const problem = tierProblem(parsed);
  const sorted = tiers
    .map((t, i) => ({ i, q: Number(t.minQty) }))
    .sort((a, b) => a.q - b.q);
  // the "up to" cell of each row = one below the next bracket's start; the last (highest) row is unlimited
  const upTo = (idx: number): string => {
    const pos = sorted.findIndex((x) => x.i === idx);
    if (pos === sorted.length - 1) return 'No limit';
    const nxt = sorted[pos + 1].q;
    return Number.isFinite(nxt) ? String(nxt - 1) : '';
  };
  const set = (i: number, k: keyof TierDraft, v: string) => onChange(tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)));
  const add = () => {
    const last = Math.max(0, ...parsed.map((t) => (Number.isFinite(t.minQty) ? t.minQty : 0)));
    onChange([...tiers, tiers.length === 0 ? { minQty: '1', price: basePrice } : { minQty: String(last + 10), price: '' }]);
  };
  const preview = problem ? [] : tierRanges({ price: Number(basePrice) || 0, priceTiers: cleanTiers(parsed) });

  return (
    <fieldset className="border border-steel-200 p-4">
      <legend className="px-1 text-sm font-semibold">Quantity price brackets (optional)</legend>
      <p className="text-xs text-ink-500">Give a lower price per {unit || 'unit'} for bigger orders. The last bracket automatically covers every higher quantity (no limit).</p>
      {tiers.length > 0 ? (
        <div className="mt-3 space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500 sm:grid">
            <span>From quantity</span>
            <span>Up to</span>
            <span>Price each (₹)</span>
            <span className="w-16" />
          </div>
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className="field" inputMode="numeric" aria-label={`Bracket ${i + 1} from quantity`} value={t.minQty} onChange={(e) => set(i, 'minQty', e.target.value)} />
              <span className="px-2 font-mono text-sm text-ink-700" aria-label={`Bracket ${i + 1} up to`}>
                {upTo(i)}
              </span>
              <input className="field" inputMode="decimal" aria-label={`Bracket ${i + 1} price`} value={t.price} onChange={(e) => set(i, 'price', e.target.value)} />
              <button type="button" className="w-16 text-sm font-semibold text-bad hover:underline" onClick={() => onChange(tiers.filter((_, j) => j !== i))} aria-label={`Remove bracket ${i + 1}`}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {problem ? <p className="mt-2 text-xs font-medium text-bad" role="alert">{problem}</p> : null}
      {preview.length > 0 ? (
        <p className="mt-2 font-mono text-xs text-ink-700">
          {preview.map((r) => `${rangeLabel(r)}: ${inr(r.price)}`).join('  ·  ')}
        </p>
      ) : null}
      <button type="button" className="btn-ghost mt-3" onClick={add}>
        <Icon name="plus" className="h-4 w-4" /> {tiers.length === 0 ? 'Add price brackets' : 'Add bracket'}
      </button>
    </fieldset>
  );
}

export function ProductForm({ initial, isNew, onClose, vendorMode }: { initial: ProductDraft; isNew: boolean; onClose: () => void; vendorMode: boolean }) {
  const { products, saveProduct, settings, categories: managed } = useApp();
  const [d, setD] = useState<ProductDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categories = Array.from(new Set([...managed.map((c) => c.name), ...(d.category ? [d.category] : [])]));
  const isVendorProduct = vendorMode || Boolean(d.vendorId);
  const set = (k: keyof ProductDraft, v: string | boolean | string[] | TierDraft[]) => setD((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const price = Number(d.price);
    const mrp = d.mrp.trim() === '' ? price : Number(d.mrp);
    const stock = Number(d.stock);
    const weight = d.weight.trim() === '' ? 0 : Number(d.weight);
    if (d.name.trim().length < 3) err.name = 'Enter a product name.';
    if (d.sku.trim().length < 2) err.sku = 'Enter a SKU.';
    else if (products.some((p) => p.id !== d.id && p.sku.toLowerCase() === d.sku.trim().toLowerCase())) err.sku = 'This SKU already exists.';
    if (!d.category.trim()) err.category = 'Select a category.';
    if (!Number.isFinite(price) || price <= 0) err.price = 'Enter a price above 0.';
    if (!Number.isFinite(mrp) || mrp < price) err.mrp = 'MRP must be at least the selling price.';
    if (!Number.isInteger(stock) || stock < 0) err.stock = 'Enter a whole number, 0 or more.';
    if (!Number.isFinite(weight) || weight < 0) err.weight = 'Enter the weight in kg (0 or more).';
    const tiers = d.tiers.map((t) => ({ minQty: Number(t.minQty), price: Number(t.price) }));
    const tp = tierProblem(tiers);
    if (tp) err.tiers = tp;
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const product: Product = {
      id: d.id,
      sku: d.sku.trim(),
      name: d.name.trim(),
      category: d.category.trim(),
      brand: d.brand.trim() || (vendorMode ? 'Vendor' : 'Vel'),
      price,
      mrp,
      stock,
      unit: d.unit.trim() || 'piece',
      weightKg: weight,
      priceTiers: cleanTiers(tiers),
      description: d.description.trim(),
      specs: parseSpecs(d.specs),
      featured: vendorMode ? false : d.featured,
      images: d.images,
      image: d.images[0] ?? '',
      available: d.inStock,
      hidden: d.hidden,
      vendorId: d.vendorId,
    };
    if (saveProduct(product)) onClose();
  };

  const customerPrice = Math.round((Number(d.price) || 0) * (1 + settings.vendorMarginPct / 100));

  return (
    <Modal title={isNew ? 'Add product' : 'Edit product'} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="pf-name" error={errors.name}>
            <input id="pf-name" className="field" value={d.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="SKU" htmlFor="pf-sku" error={errors.sku}>
            <input id="pf-sku" className="field font-mono" value={d.sku} onChange={(e) => set('sku', e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="pf-cat" error={errors.category}>
            <select id="pf-cat" className="field" value={d.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Brand" htmlFor="pf-brand">
            <input id="pf-brand" className="field" value={d.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
          <Field
            label={isVendorProduct ? 'Your price (₹, excl. GST)' : 'Price (₹, excl. GST)'}
            htmlFor="pf-price"
            error={errors.price}
            hint={isVendorProduct ? `Customers see this plus the platform margin of ${settings.vendorMarginPct}%${Number(d.price) > 0 ? ` (about ${inr(customerPrice)})` : ''}.` : undefined}
          >
            <input id="pf-price" className="field" inputMode="decimal" value={d.price} onChange={(e) => set('price', e.target.value)} />
          </Field>
          <Field label="MRP (₹)" htmlFor="pf-mrp" error={errors.mrp} hint="Leave blank to match the price.">
            <input id="pf-mrp" className="field" inputMode="decimal" value={d.mrp} onChange={(e) => set('mrp', e.target.value)} />
          </Field>
          <Field label="Quantity in stock" htmlFor="pf-stock" error={errors.stock}>
            <input id="pf-stock" className="field" inputMode="numeric" value={d.stock} onChange={(e) => set('stock', e.target.value)} />
          </Field>
          <Field label="Unit" htmlFor="pf-unit">
            <input id="pf-unit" className="field" value={d.unit} onChange={(e) => set('unit', e.target.value)} />
          </Field>
          <Field label={`Net weight per ${d.unit || 'unit'} (kg)`} htmlFor="pf-weight" error={errors.weight} hint="Used for courier charges. The packing box weight is added automatically.">
            <input id="pf-weight" className="field" inputMode="decimal" value={d.weight} onChange={(e) => set('weight', e.target.value)} />
          </Field>
          <Field label="Stock status" htmlFor="pf-status" hint="Out of stock disables buying even if a quantity is set.">
            <select id="pf-status" className="field" value={d.inStock ? 'in' : 'out'} onChange={(e) => set('inStock', e.target.value === 'in')}>
              <option value="in">In stock</option>
              <option value="out">Out of stock</option>
            </select>
          </Field>
        </div>
        <TierEditor tiers={d.tiers} onChange={(t) => set('tiers', t)} basePrice={d.price} unit={d.unit} />
        {errors.tiers ? <p className="text-xs font-medium text-bad" role="alert">{errors.tiers}</p> : null}
        <MultiImagePicker id="pf-images" label="Product photos" value={d.images} onChange={(v) => set('images', v)} />
        <Field label="Description" htmlFor="pf-desc">
          <textarea id="pf-desc" rows={3} className="field" value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Specifications" htmlFor="pf-specs" hint='One per line, written as "Label: value".'>
          <textarea id="pf-specs" rows={5} className="field font-mono" value={d.specs} onChange={(e) => set('specs', e.target.value)} />
        </Field>
        <div className="space-y-2">
          {vendorMode ? null : (
            <label className="flex items-center gap-2 text-sm" htmlFor="pf-featured">
              <input id="pf-featured" type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={d.featured} onChange={(e) => set('featured', e.target.checked)} />
              Show on the homepage as a featured product
            </label>
          )}
          <label className="flex items-center gap-2 text-sm" htmlFor="pf-hidden">
            <input id="pf-hidden" type="checkbox" className="h-4 w-4 accent-[#B45309]" checked={d.hidden} onChange={(e) => set('hidden', e.target.checked)} />
            Hide this product from the public store
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-steel-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save product
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Product table with add, edit, stock toggle, hide and delete. The owner sees every product; a vendor only their own. */
export function ProductManager({ vendorMode }: { vendorMode: boolean }) {
  const { products, myProducts, vendors, deleteProduct, saveProduct, settings } = useApp();
  const [editing, setEditing] = useState<{ draft: ProductDraft; isNew: boolean } | null>(null);
  const [filter, setFilter] = useState('');
  const source = vendorMode ? myProducts : products;
  const shown = source.filter((p) => (p.name + p.sku + p.category).toLowerCase().includes(filter.trim().toLowerCase()));
  const vendorName = (id?: string) => (id ? vendors.find((v) => v.id === id)?.shopName ?? 'Removed vendor' : 'Vel Groups');
  const noWeight = source.filter((p) => !p.weightKg).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input id="adm-prod-filter" className="field max-w-xs" placeholder="Filter products" aria-label="Filter products" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button type="button" className="btn-primary" onClick={() => setEditing({ draft: blankProduct(), isNew: true })}>
          <Icon name="plus" className="h-4 w-4" /> Add product
        </button>
      </div>
      {noWeight > 0 && settings.shipping.enabled ? (
        <p className="mb-3 bg-forge-tint px-4 py-2 text-sm font-medium text-ink" role="status">
          {noWeight} product{noWeight === 1 ? ' has' : 's have'} no net weight, so courier charges will count only the box weight for {noWeight === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-steel-100 text-left text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Category</th>
              {vendorMode ? null : <th className="px-4 py-2">Sold by</th>}
              <th className="px-4 py-2 text-right">{vendorMode ? 'Your price' : 'Price'}</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Visibility</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={`border-t border-steel-200 ${p.hidden ? 'bg-steel-50 text-ink-500' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ProductArt seed={p.id} image={productImages(p)[0]} className="h-12 w-16 shrink-0 border border-steel-200" />
                    <div className="min-w-0">
                      <span className="font-semibold">{p.name}</span>
                      {p.featured ? <span className="ml-2"><Badge tone="bg-forge-tint text-forge-dark">Featured</Badge></span> : null}
                      <span className="block font-mono text-xs text-steel-500">
                        {p.sku} · {productImages(p).length} photo{productImages(p).length === 1 ? '' : 's'}
                        {p.weightKg ? ` · ${p.weightKg} kg` : ''}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{p.category}</td>
                {vendorMode ? null : <td className="px-4 py-3">{vendorName(p.vendorId)}</td>}
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {inr(p.price)}
                  {p.vendorId ? <span className="block text-xs text-ink-500">Customers: {inr(Math.round(p.price * (1 + settings.vendorMarginPct / 100)))}</span> : null}
                  {(p.priceTiers?.length ?? 0) > 0 ? <span className="block text-xs text-ok">{p.priceTiers!.length} brackets</span> : null}
                </td>
                <td className="px-4 py-3">
                  {isAvailable(p) ? <Badge tone="bg-green-50 text-ok">In stock</Badge> : <Badge tone="bg-red-50 text-bad">Out of stock</Badge>}
                  <span className={`mt-1 block font-mono text-xs ${p.stock <= 5 ? 'font-semibold text-forge-dark' : 'text-ink-500'}`}>Qty {p.stock}</span>
                </td>
                <td className="px-4 py-3">{p.hidden ? <Badge>Hidden</Badge> : <Badge tone="bg-blue-50 text-blue-800">Visible</Badge>}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
                    <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" onClick={() => setEditing({ draft: draftFromProduct(p), isNew: false })} aria-label={`Edit ${p.name}`}>
                      <Icon name="edit" className="h-4 w-4" /> Edit
                    </button>
                    <button type="button" className="text-sm font-semibold hover:underline" onClick={() => saveProduct({ ...p, available: p.available === false })} aria-label={`${p.available === false ? 'Mark in stock' : 'Mark out of stock'}: ${p.name}`}>
                      {p.available === false ? 'Mark in stock' : 'Mark out of stock'}
                    </button>
                    <button type="button" className="text-sm font-semibold hover:underline" onClick={() => saveProduct({ ...p, hidden: !p.hidden })} aria-label={`${p.hidden ? 'Show' : 'Hide'} ${p.name}`}>
                      {p.hidden ? 'Show' : 'Hide'}
                    </button>
                    <ConfirmDelete name={p.name} onConfirm={() => deleteProduct(p.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-500">
                  No products found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? <ProductForm initial={editing.draft} isNew={editing.isNew} vendorMode={vendorMode} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
