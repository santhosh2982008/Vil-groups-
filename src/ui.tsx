import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { resizeImage } from '../utils';
import { downloadPdf, invoicePdf, shippingLabelPdf } from '../pdf';
import type { Company, Order } from '../types';

const ICONS: Record<string, string> = {
  cart: 'M3 4h2.2l2.2 10.5a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.5 8H6 M9.5 19.5h.01 M16.5 19.5h.01',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  x: 'M6 6l12 12 M18 6L6 18',
  wrench: 'M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.3-.6-.6-2.3z',
  store: 'M4 9l1.5-5h13L20 9 M4 9v11h16V9 M9 20v-6h6v6 M4 9c0 1.7 1.3 3 2.7 3S9.3 10.7 9.3 9c0 1.7 1.3 3 2.7 3s2.7-1.3 2.7-3c0 1.7 1.3 3 2.7 3S20 10.7 20 9',
  factory: 'M3 20V10l6 4v-4l6 4V4h4v16z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  chevron: 'M9 6l6 6-6 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z',
  plus: 'M12 5v14 M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  box: 'M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8',
  minus: 'M5 12h14',
};

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name] ?? ICONS.box} />
    </svg>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[92vh] w-full overflow-y-auto bg-white shadow-2xl sm:rounded-sm ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-steel-200 bg-white px-5 py-3">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-sm p-1.5 text-ink-500 hover:bg-steel-100" aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-steel-500">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  'Pending Owner Approval': 'bg-amber-50 text-forge-dark',
  'Awaiting verification': 'bg-amber-50 text-forge-dark',
  Placed: 'bg-steel-100 text-ink-700',
  Packaged: 'bg-forge-tint text-forge-dark',
  Couriered: 'bg-blue-50 text-blue-800',
  Processing: 'bg-forge-tint text-forge-dark',
  Accepted: 'bg-forge-tint text-forge-dark',
  'Out for delivery': 'bg-blue-50 text-blue-800',
  Paid: 'bg-green-50 text-ok',
  Pending: 'bg-forge-tint text-forge-dark',
  Failed: 'bg-red-50 text-bad',
  Refunded: 'bg-steel-100 text-ink-700',
  Shipped: 'bg-blue-50 text-blue-800',
  Delivered: 'bg-green-50 text-ok',
  Cancelled: 'bg-red-50 text-bad',
  New: 'bg-forge-tint text-forge-dark',
  Contacted: 'bg-blue-50 text-blue-800',
  Scheduled: 'bg-steel-100 text-ink-700',
  Closed: 'bg-green-50 text-ok',
};

export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const cls = tone ?? BADGE_TONES[String(children)] ?? 'bg-steel-100 text-ink-700';
  return <span className={`inline-block rounded-sm px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

/** Product photo when the owner uploaded one, otherwise a blueprint-style placeholder. */
export function ProductArt({ seed, className = '', image }: { seed: string; className?: string; image?: string }) {
  if (image) {
    return (
      <div className={`relative overflow-hidden bg-white ${className}`}>
        <img src={image} alt="" className="h-full w-full object-contain" />
      </div>
    );
  }
  const sid = seed.replace(/[^A-Za-z0-9_-]/g, '_');
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 997;
  const teeth = 14 + (h % 10);
  const circumference = 2 * Math.PI * 34;
  const dash = circumference / (teeth * 2);
  const rotate = h % 45;
  return (
    <div className={`relative overflow-hidden bg-steel-100 ${className}`}>
      <svg viewBox="0 0 200 140" className="h-full w-full text-ink-500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id={`grid-${sid}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#B3BFCD" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="200" height="140" fill={`url(#grid-${sid})`} />
        <g transform={`translate(100 70) rotate(${rotate})`} fill="none" stroke="currentColor">
          <circle r="34" strokeWidth="12" strokeDasharray={`${dash} ${dash}`} />
          <circle r="27" strokeWidth="1.5" />
          <circle r="12" strokeWidth="1.5" />
          <path d="M-46 0H46 M0 -46V46" strokeWidth="0.8" strokeDasharray="4 3" />
        </g>
      </svg>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children?: ReactNode;
}) {
  return (
    <section className="blueprint bg-ink text-white">
      <div className="wrap py-12 md:py-16">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-[#F2B26B]">{eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-5xl font-semibold leading-[0.95] md:text-6xl">{title}</h1>
        {lead ? <p className="mt-4 max-w-2xl text-lg text-steel-200">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function ConfirmDelete({ onConfirm, name }: { onConfirm: () => void; name: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-bad hover:underline" onClick={() => setAsking(true)} aria-label={`Delete ${name}`}>
        <Icon name="trash" className="h-4 w-4" /> Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn-danger !px-2.5 !py-1" onClick={onConfirm}>
        Confirm delete
      </button>
      <button type="button" className="text-sm font-semibold hover:underline" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

/** Upload, preview and remove an image. Files are resized in the browser before saving. */
export function ImagePicker({
  id,
  label,
  value,
  onChange,
  maxDim,
  mime,
  hint,
  previewClass = 'h-28 w-28',
  maxChars,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  maxDim: number;
  mime: 'image/jpeg' | 'image/png';
  hint?: string;
  previewClass?: string;
  /** upper size of the saved image in characters (smaller = fits more in browser storage) */
  maxChars?: number;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pick = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setAdded(false);
    try {
      onChange(await resizeImage(file, maxDim, mime, 0.82, maxChars));
      setAdded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try a different image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center border border-dashed bg-steel-50 ${dragging ? 'border-forge bg-forge-tint' : 'border-steel-300'} ${previewClass}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void pick(e.dataTransfer.files?.[0]);
          }}
        >
          {value ? <img src={value} alt="" className="max-h-full max-w-full object-contain" /> : <Icon name="box" className="h-8 w-8 text-steel-300" />}
        </div>
        <div className="space-y-2">
          {/* The real file input is visually hidden but focusable; the label is the visible button. */}
          <input
            id={id}
            type="file"
            accept="image/*"
            className="peer sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void pick(file);
            }}
          />
          <label
            htmlFor={id}
            className="btn-dark cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-forge"
          >
            <Icon name="plus" className="h-4 w-4" /> {value ? 'Change image' : 'Upload image'}
          </label>
          {value ? (
            <button type="button" className="ml-3 text-sm font-semibold text-bad hover:underline" onClick={() => { onChange(''); setAdded(false); }}>
              Remove image
            </button>
          ) : null}
          <p className="text-xs text-ink-500">Or drop an image onto the box.</p>
          {busy ? <p className="text-xs font-semibold text-ink-700" role="status">Processing image…</p> : null}
          {added && !busy && !error ? <p className="text-xs font-semibold text-ok" role="status">Image added. Save to keep it.</p> : null}
        </div>
      </div>
      {hint && !error ? <p className="mt-1 text-xs text-steel-500">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Several product photos: add many at once, remove, and move one to the front (the first is the cover). */
export function MultiImagePicker({
  id,
  label,
  value,
  onChange,
  max = 6,
  maxDim = 900,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  maxDim?: number;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const addFiles = async (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setBusy(true);
    setError('');
    const room = max - value.length;
    const added: string[] = [];
    const problems: string[] = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      try {
        added.push(await resizeImage(f, maxDim, 'image/jpeg', 0.82, 220_000));
      } catch (e) {
        problems.push(`${f.name}: ${e instanceof Error ? e.message : 'could not be added'}`);
      }
    }
    if (list.length > room) problems.push(`Only ${max} photos are allowed per product.`);
    if (added.length > 0) onChange([...value, ...added]);
    setError(problems.join(' '));
    setBusy(false);
  };

  const move = (i: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <ul className="flex flex-wrap gap-3">
        {value.map((src, i) => (
          <li key={i} className="w-28 border border-steel-200 bg-white p-1.5">
            <div className="flex h-20 items-center justify-center bg-steel-50">
              <img src={src} alt={`Photo ${i + 1}`} className="max-h-full max-w-full object-contain" />
            </div>
            <p className="mt-1 text-center text-[11px] font-semibold text-ink-500">{i === 0 ? 'Cover photo' : `Photo ${i + 1}`}</p>
            <div className="mt-1 flex items-center justify-between text-xs font-semibold">
              <button type="button" className="px-1 hover:underline disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move photo ${i + 1} earlier`}>
                ◀
              </button>
              <button type="button" className="text-bad hover:underline" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>
                Remove
              </button>
              <button type="button" className="px-1 hover:underline disabled:opacity-30" disabled={i === value.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move photo ${i + 1} later`}>
                ▶
              </button>
            </div>
          </li>
        ))}
        {value.length < max ? (
          <li className="w-28">
            <input
              id={id}
              type="file"
              accept="image/*"
              multiple
              className="peer sr-only"
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = '';
                void addFiles(files);
              }}
            />
            <label
              htmlFor={id}
              className="flex h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-steel-300 bg-steel-50 text-center text-sm font-semibold hover:border-forge hover:bg-forge-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-forge"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles(e.dataTransfer.files);
              }}
            >
              <Icon name="plus" className="h-5 w-5" />
              Add photos
            </label>
          </li>
        ) : null}
      </ul>
      <p className="mt-1 text-xs text-steel-500">Up to {max} photos. The first one is the cover shown in the store. Select several files at once if you like.</p>
      {busy ? <p className="mt-1 text-xs font-semibold text-ink-700" role="status">Processing photos…</p> : null}
      {error ? <p className="mt-1 text-xs font-medium text-bad" role="alert">{error}</p> : null}
    </div>
  );
}

export function Stepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center border border-steel-300 bg-white" role="group" aria-label={label}>
      <button
        type="button"
        className="px-2.5 py-2 text-ink hover:bg-steel-100 disabled:opacity-40"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Icon name="minus" className="h-4 w-4" />
      </button>
      <span className="min-w-[2.5rem] text-center font-mono text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="px-2.5 py-2 text-ink hover:bg-steel-100 disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Icon name="plus" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Order summary export. The label has only From and To addresses; the invoice lists everything. */
export function PdfButtons({ order, company, gstRate, label = true }: { order: Order; company: Company; gstRate: number; label?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
      <button type="button" className="text-sm font-semibold hover:underline" onClick={() => downloadPdf(invoicePdf(order, company, gstRate), `invoice-${order.id}.pdf`)}>
        Download invoice (PDF)
      </button>
      {label ? (
        <button type="button" className="text-sm font-semibold hover:underline" onClick={() => downloadPdf(shippingLabelPdf(order, company), `label-${order.id}.pdf`)}>
          Download shipping label (PDF)
        </button>
      ) : null}
    </span>
  );
}
