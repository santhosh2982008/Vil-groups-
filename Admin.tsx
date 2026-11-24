import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import type { Company, Service } from '../types';
import { ENQUIRY_STATUSES } from '../config';
import { Badge, ConfirmDelete, Field, Icon, Modal, PageHeader } from '../components/ui';
import { AdminBranding, AdminCoupons, AdminPayments, AdminShipping } from './AdminSettings';
import { AdminOrders, AdminTransactions } from './AdminOrders';
import { ProductManager } from './ProductManager';
import { AdminCategories } from './Categories';
import { AdminVendors } from './Vendor';
import { fmtDate, inr, isAvailable, isValidEmail, isValidPhone, parseLines, parseSpecs, specsToText, uid } from '../utils';

type Tab = 'overview' | 'products' | 'categories' | 'vendors' | 'services' | 'company' | 'branding' | 'shipping' | 'payments' | 'transactions' | 'coupons' | 'orders' | 'enquiries';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'categories', label: 'Categories' },
  { id: 'vendors', label: 'Vendors & margin' },
  { id: 'services', label: 'Services' },
  { id: 'company', label: 'Company details' },
  { id: 'branding', label: 'Logo' },
  { id: 'shipping', label: 'Shipping & tax' },
  { id: 'payments', label: 'Payments' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'orders', label: 'Orders' },
  { id: 'enquiries', label: 'Enquiries' },
];

/* ---------------- Overview ---------------- */

function AdminOverview() {
  const { products, orders, enquiries, services, resetAll } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const revenue = orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
  const lowStock = products.filter((p) => p.stock <= 5 || !isAvailable(p)).sort((a, b) => a.stock - b.stock);
  const newEnquiries = enquiries.filter((e) => e.status === 'New').length;

  const tiles = [
    { label: 'Revenue (excl. cancelled)', value: inr(revenue) },
    { label: 'Orders', value: String(orders.length) },
    { label: 'Awaiting your approval', value: String(orders.filter((o) => o.status === 'Pending Owner Approval').length) },
    { label: 'Payments to verify', value: String(orders.filter((o) => o.paymentStatus === 'Awaiting verification').length) },
    { label: 'New enquiries', value: String(newEnquiries) },
    { label: 'Products / services', value: `${products.length} / ${services.length}` },
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-4">
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-500">{t.label}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="panel">
        <h2 className="border-b border-steel-200 px-5 py-3 text-2xl font-semibold">Low or out of stock</h2>
        {lowStock.length === 0 ? (
          <p className="p-5 text-sm text-ink-500">Every product is in stock with more than 5 units.</p>
        ) : (
          <ul className="divide-y divide-steel-200">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className={`shrink-0 font-mono font-semibold ${!isAvailable(p) ? 'text-bad' : 'text-forge-dark'}`}>{!isAvailable(p) ? 'Out of stock' : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-5">
        <h2 className="text-2xl font-semibold">Data</h2>
        <p className="mt-1 text-sm text-ink-700">
          All changes are saved in this browser (local storage). Restoring sample data replaces products, services, company details, orders and
          enquiries.
        </p>
        {confirmReset ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-danger" onClick={() => { resetAll(); setConfirmReset(false); }}>
              Yes, restore sample data
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn-ghost mt-3" onClick={() => setConfirmReset(true)}>
            Restore sample data
          </button>
        )}
      </section>
    </div>
  );
}

/* ---------------- Services ---------------- */

interface ServiceDraft {
  id: string;
  name: string;
  description: string;
  priceFrom: string;
  turnaround: string;
  coverage: string;
}

function ServiceForm({ initial, isNew, onClose }: { initial: ServiceDraft; isNew: boolean; onClose: () => void }) {
  const { saveService } = useApp();
  const [d, setD] = useState<ServiceDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof ServiceDraft, v: string) => setD((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const price = Number(d.priceFrom);
    if (d.name.trim().length < 3) err.name = 'Enter a service name.';
    if (d.description.trim().length < 10) err.description = 'Add a short description.';
    if (!Number.isFinite(price) || price < 0) err.priceFrom = 'Enter a starting price, 0 or more.';
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    const service: Service = {
      id: d.id,
      name: d.name.trim(),
      description: d.description.trim(),
      priceFrom: price,
      turnaround: d.turnaround.trim(),
      coverage: d.coverage.split(',').map((c) => c.trim()).filter(Boolean),
    };
    if (saveService(service)) onClose();
  };

  return (
    <Modal title={isNew ? 'Add service' : 'Edit service'} onClose={onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Service name" htmlFor="sf-name" error={errors.name}>
          <input id="sf-name" className="field" value={d.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="sf-desc" error={errors.description}>
          <textarea id="sf-desc" rows={3} className="field" value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starting price (₹)" htmlFor="sf-price" error={errors.priceFrom}>
            <input id="sf-price" className="field" inputMode="decimal" value={d.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} />
          </Field>
          <Field label="Turnaround" htmlFor="sf-turn">
            <input id="sf-turn" className="field" value={d.turnaround} onChange={(e) => set('turnaround', e.target.value)} />
          </Field>
        </div>
        <Field label="Coverage" htmlFor="sf-cov" hint="Comma separated, e.g. Motors, Pumps, Gearboxes">
          <input id="sf-cov" className="field" value={d.coverage} onChange={(e) => set('coverage', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-steel-200 pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Save service
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdminServices() {
  const { services, deleteService } = useApp();
  const [editing, setEditing] = useState<{ draft: ServiceDraft; isNew: boolean } | null>(null);

  const blank = (): ServiceDraft => ({ id: uid('s'), name: '', description: '', priceFrom: '', turnaround: '', coverage: '' });
  const fromService = (s: Service): ServiceDraft => ({
    id: s.id,
    name: s.name,
    description: s.description,
    priceFrom: String(s.priceFrom),
    turnaround: s.turnaround,
    coverage: s.coverage.join(', '),
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" className="btn-primary" onClick={() => setEditing({ draft: blank(), isNew: true })}>
          <Icon name="plus" className="h-4 w-4" /> Add service
        </button>
      </div>
      <ul className="panel divide-y divide-steel-200">
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="font-mono text-xs text-ink-500">
                from {inr(s.priceFrom)} · {s.turnaround || 'no turnaround set'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold hover:underline" onClick={() => setEditing({ draft: fromService(s), isNew: false })} aria-label={`Edit ${s.name}`}>
                <Icon name="edit" className="h-4 w-4" /> Edit
              </button>
              <ConfirmDelete name={s.name} onConfirm={() => deleteService(s.id)} />
            </div>
          </li>
        ))}
        {services.length === 0 ? <li className="p-6 text-center text-ink-500">No services yet. Add the first one.</li> : null}
      </ul>
      {editing ? <ServiceForm initial={editing.draft} isNew={editing.isNew} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

/* ---------------- Company details ---------------- */

function AdminCompany() {
  const { company, saveCompany } = useApp();
  const [c, setC] = useState({
    name: company.name,
    tagline: company.tagline,
    phone: company.phone,
    altPhone: company.altPhone,
    email: company.email,
    address: company.address,
    hours: company.hours,
    about: company.about,
    mIntro: company.manufacturing.intro,
    capabilities: company.manufacturing.capabilities.join('\n'),
    certifications: company.manufacturing.certifications.join('\n'),
    stats: specsToText(company.manufacturing.stats),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof c, v: string) => setC((x) => ({ ...x, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (c.name.trim().length < 2) err.name = 'Enter the company name.';
    if (!isValidPhone(c.phone)) err.phone = 'Enter a phone number with at least 10 digits.';
    if (c.altPhone.trim() && !isValidPhone(c.altPhone)) err.altPhone = 'Enter a valid number or leave blank.';
    if (!isValidEmail(c.email)) err.email = 'Enter a valid email address.';
    setErrors(err);
    if (Object.keys(err).length > 0) return;

    const next: Company = {
      name: c.name.trim(),
      tagline: c.tagline.trim(),
      phone: c.phone.trim(),
      altPhone: c.altPhone.trim(),
      email: c.email.trim(),
      address: c.address.trim(),
      hours: c.hours.trim(),
      about: c.about.trim(),
      manufacturing: {
        intro: c.mIntro.trim(),
        capabilities: parseLines(c.capabilities),
        certifications: parseLines(c.certifications),
        stats: parseSpecs(c.stats),
      },
    };
    saveCompany(next);
  };

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <section className="panel space-y-4 p-5">
        <h2 className="text-2xl font-semibold">Contact and identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor="co-f-name" error={errors.name}>
            <input id="co-f-name" className="field" value={c.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Tagline" htmlFor="co-f-tag">
            <input id="co-f-tag" className="field" value={c.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </Field>
          <Field label="Primary phone" htmlFor="co-f-phone" error={errors.phone}>
            <input id="co-f-phone" className="field font-mono" inputMode="tel" value={c.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Alternate phone" htmlFor="co-f-alt" error={errors.altPhone}>
            <input id="co-f-alt" className="field font-mono" inputMode="tel" value={c.altPhone} onChange={(e) => set('altPhone', e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="co-f-email" error={errors.email}>
            <input id="co-f-email" className="field" value={c.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Working hours" htmlFor="co-f-hours">
            <input id="co-f-hours" className="field" value={c.hours} onChange={(e) => set('hours', e.target.value)} />
          </Field>
        </div>
        <Field label="Address" htmlFor="co-f-addr">
          <input id="co-f-addr" className="field" value={c.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <Field label="About the group" htmlFor="co-f-about">
          <textarea id="co-f-about" rows={3} className="field" value={c.about} onChange={(e) => set('about', e.target.value)} />
        </Field>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-2xl font-semibold">Vel Manufacturing Company</h2>
        <Field label="Introduction" htmlFor="co-f-mintro">
          <textarea id="co-f-mintro" rows={3} className="field" value={c.mIntro} onChange={(e) => set('mIntro', e.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Capabilities" htmlFor="co-f-caps" hint="One per line.">
            <textarea id="co-f-caps" rows={6} className="field" value={c.capabilities} onChange={(e) => set('capabilities', e.target.value)} />
          </Field>
          <Field label="Quality and certifications" htmlFor="co-f-certs" hint="One per line.">
            <textarea id="co-f-certs" rows={6} className="field" value={c.certifications} onChange={(e) => set('certifications', e.target.value)} />
          </Field>
          <Field label="Headline figures" htmlFor="co-f-stats" hint='One per line, as "Label: value".'>
            <textarea id="co-f-stats" rows={6} className="field font-mono" value={c.stats} onChange={(e) => set('stats', e.target.value)} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          Save company details
        </button>
      </div>
    </form>
  );
}

/* ---------------- Enquiries ---------------- */

function AdminEnquiries() {
  const { enquiries, setEnquiryStatus } = useApp();
  if (enquiries.length === 0) {
    return <p className="panel p-8 text-center text-ink-500">No enquiries yet. Submissions from the Service Enquiry page appear here.</p>;
  }
  return (
    <ul className="space-y-4">
      {enquiries.map((e) => (
        <li key={e.id} className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xl font-semibold">{e.topic}</p>
              <p className="font-mono text-xs text-ink-500">
                {e.id} · {fmtDate(e.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{e.status}</Badge>
              <label htmlFor={`enq-${e.id}`} className="sr-only">
                Status for {e.id}
              </label>
              <select id={`enq-${e.id}`} className="field !w-auto !py-1.5" value={e.status} onChange={(ev) => setEnquiryStatus(e.id, ev.target.value as typeof e.status)}>
                {ENQUIRY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-ink-700">{e.message}</p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-ink-500">Name</dt><dd>{e.name}</dd></div>
            <div className="flex gap-2"><dt className="text-ink-500">Phone</dt><dd className="font-mono">{e.phone}</dd></div>
            <div className="flex min-w-0 gap-2"><dt className="text-ink-500">Email</dt><dd className="break-all">{e.email}</dd></div>
            {e.equipment ? <div className="flex gap-2"><dt className="text-ink-500">Equipment</dt><dd>{e.equipment}</dd></div> : null}
            {e.preferredDate ? <div className="flex gap-2"><dt className="text-ink-500">Preferred date</dt><dd className="font-mono">{e.preferredDate}</dd></div> : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Dashboard shell ---------------- */

export function Admin() {
  const { session, orders, enquiries } = useApp();
  const [tab, setTab] = useState<Tab>('overview');
  const newEnq = enquiries.filter((e) => e.status === 'New').length;
  const openOrders = orders.filter((o) => o.status === 'Pending Owner Approval').length;
  const toVerify = orders.filter((o) => o.paymentStatus === 'Awaiting verification').length;

  return (
    <>
      <PageHeader eyebrow="Management Dashboard" title="Run the group" lead={`Signed in as ${session?.email ?? ''}. Changes save instantly and appear on the public pages.`} />
      <div className="wrap mt-6">
        <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 overflow-x-auto border-b border-steel-200">
          {TABS.map((t) => {
            const count = t.id === 'enquiries' ? newEnq : t.id === 'orders' ? openOrders : t.id === 'transactions' ? toVerify : 0;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="admin-panel"
                onClick={() => setTab(t.id)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold ${
                  tab === t.id ? 'border-forge text-forge-dark' : 'border-transparent text-ink-700 hover:text-ink'
                }`}
              >
                {t.label}
                {count > 0 ? <span className="ml-1.5 rounded-full bg-forge px-1.5 font-mono text-[11px] text-white">{count}</span> : null}
              </button>
            );
          })}
        </div>
        <div id="admin-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-6">
          {tab === 'overview' ? <AdminOverview /> : null}
          {tab === 'products' ? <ProductManager vendorMode={false} /> : null}
          {tab === 'categories' ? <AdminCategories /> : null}
          {tab === 'vendors' ? <AdminVendors /> : null}
          {tab === 'services' ? <AdminServices /> : null}
          {tab === 'company' ? <AdminCompany /> : null}
          {tab === 'branding' ? <AdminBranding /> : null}
          {tab === 'shipping' ? <AdminShipping /> : null}
          {tab === 'payments' ? <AdminPayments /> : null}
          {tab === 'transactions' ? <AdminTransactions /> : null}
          {tab === 'coupons' ? <AdminCoupons /> : null}
          {tab === 'orders' ? <AdminOrders /> : null}
          {tab === 'enquiries' ? <AdminEnquiries /> : null}
        </div>
      </div>
    </>
  );
}
