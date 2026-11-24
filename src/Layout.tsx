import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { RouteId } from '../router';
import { go } from '../router';
import { Icon } from './ui';
import { subscribeSync, syncState } from '../sync';

/** Tells everyone, plainly, when this device is not connected to the shared data store. */
export function SyncBanner() {
  const [st, setSt] = useState(syncState());
  useEffect(() => subscribeSync(() => setSt(syncState())), []);
  if (st !== 'offline' && st !== 'readonly') return null;
  return (
    <p role="alert" className="bg-red-50 px-4 py-2 text-center text-sm font-semibold text-bad">
      {st === 'readonly'
        ? 'You can view shared data but your account cannot save changes to it.'
        : 'Not connected to the shared server. Changes made on this device will NOT reach other devices until it reconnects.'}
    </p>
  );
}

const NAV: { to: RouteId; label: string }[] = [
  { to: 'home', label: 'Home' },
  { to: 'service-center', label: 'Vel Service Center' },
  { to: 'store', label: 'Vel Store' },
  { to: 'manufacturing', label: 'Vel Manufacturing' },
  { to: 'service-enquiry', label: 'Service Enquiry' },
];

export function Logo({ light = false }: { light?: boolean }) {
  const { settings, company } = useApp();
  const words = company.name.trim().split(/\s+/);
  const first = words[0] ?? '';
  const rest = words.slice(1).join(' ');
  return (
    <span className="inline-flex items-center gap-2.5">
      {settings.logo ? (
        <img
          src={settings.logo}
          alt=""
          className={`h-9 w-auto max-w-[140px] object-contain ${light ? 'bg-white p-1' : ''}`}
        />
      ) : (
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
          <rect width="32" height="32" fill={light ? '#FFFFFF' : '#12233A'} />
          <path d="M6 7h5l5 13 5-13h5L18.5 26h-5z" fill="#B45309" />
        </svg>
      )}
      <span className={`font-display text-2xl font-semibold uppercase tracking-wide ${light ? 'text-white' : 'text-ink'}`}>
        {first} {rest ? <span className="text-forge">{rest}</span> : null}
      </span>
    </span>
  );
}

export function Header({ route }: { route: RouteId }) {
  const { company, cartCount, session, role, signOut } = useApp();
  const [open, setOpen] = useState(false);

  const linkCls = (active: boolean) =>
    `block px-3 py-2 text-sm font-semibold transition-colors ${
      active ? 'text-forge-dark lg:border-b-2 lg:border-forge' : 'text-ink hover:text-forge-dark'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-steel-200 bg-white">
      <div className="bg-ink text-xs text-steel-200">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5" /> {company.hours}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <Icon name="phone" className="h-3.5 w-3.5" /> {company.phone}
          </span>
        </div>
      </div>

      <div className="wrap flex items-center justify-between py-3">
        <a href="#home" aria-label="Vel Groups home" onClick={() => setOpen(false)}>
          <Logo />
        </a>

        <nav className="hidden items-center lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <a key={n.to} href={'#' + n.to} className={linkCls(route === n.to)} aria-current={route === n.to ? 'page' : undefined}>
              {n.label}
            </a>
          ))}
          {session ? (
            <a href="#orders" className={linkCls(route === 'orders')} aria-current={route === 'orders' ? 'page' : undefined}>
              My Orders
            </a>
          ) : null}
          {role === 'admin' ? (
            <>
              <a href="#admin" className={linkCls(route === 'admin')}>
                <span className="inline-flex items-center gap-1">
                  <Icon name="shield" className="h-4 w-4" /> Management
                </span>
              </a>
              <a href="#courier-charges" className={linkCls(route === 'courier-charges')}>
                Courier Charges
              </a>
            </>
          ) : null}
          {role === 'vendor' ? (
            <a href="#vendor" className={linkCls(route === 'vendor')}>
              My Shop
            </a>
          ) : role !== 'admin' ? (
            <a href="#vendor-signup" className={linkCls(route === 'vendor-signup')}>
              Sell with us
            </a>
          ) : null}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#cart" className="btn-ghost relative !px-3" aria-label={`Cart, ${cartCount} items`}>
            <Icon name="cart" />
            {cartCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-[1.25rem] rounded-full bg-forge px-1 text-center font-mono text-[11px] font-semibold leading-5 text-white">
                {cartCount}
              </span>
            ) : null}
          </a>
          {session ? (
            <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={() => { signOut(); go('home'); }}>
              <Icon name="user" className="h-4 w-4" /> Sign out
            </button>
          ) : (
            <a href="#login" className="btn-dark hidden sm:inline-flex">
              Sign in
            </a>
          )}
          <button
            type="button"
            className="btn-ghost !px-3 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'x' : 'menu'} />
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-steel-200 bg-white lg:hidden" aria-label="Mobile">
          <div className="wrap py-2">
            {NAV.map((n) => (
              <a key={n.to} href={'#' + n.to} className={linkCls(route === n.to)} onClick={() => setOpen(false)}>
                {n.label}
              </a>
            ))}
            {session ? (
              <a href="#orders" className={linkCls(route === 'orders')} onClick={() => setOpen(false)}>
                My Orders
              </a>
            ) : null}
            {role === 'admin' ? (
              <>
                <a href="#admin" className={linkCls(route === 'admin')} onClick={() => setOpen(false)}>
                  Management Dashboard
                </a>
                <a href="#courier-charges" className={linkCls(route === 'courier-charges')} onClick={() => setOpen(false)}>
                  Courier Charges
                </a>
              </>
            ) : null}
            {role === 'vendor' ? (
              <a href="#vendor" className={linkCls(route === 'vendor')} onClick={() => setOpen(false)}>
                My Shop
              </a>
            ) : role !== 'admin' ? (
              <a href="#vendor-signup" className={linkCls(route === 'vendor-signup')} onClick={() => setOpen(false)}>
                Sell with us
              </a>
            ) : null}
            {session ? (
              <button type="button" className={linkCls(false) + ' w-full text-left'} onClick={() => { signOut(); setOpen(false); go('home'); }}>
                Sign out ({session.email})
              </button>
            ) : (
              <a href="#login" className={linkCls(false)} onClick={() => setOpen(false)}>
                Sign in
              </a>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

export function Footer() {
  const { company } = useApp();
  return (
    <footer className="mt-20 bg-ink text-steel-200">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="min-w-0">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm">{company.about}</p>
        </div>
        <div className="min-w-0">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#F2B26B]">Divisions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV.slice(1).map((n) => (
              <li key={n.to}>
                <a href={'#' + n.to} className="hover:text-white">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#F2B26B]">Contact</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex gap-2"><Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0" /> <span className="font-mono">{company.phone}</span></li>
            {company.altPhone ? <li className="flex gap-2"><Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0" /> <span className="font-mono">{company.altPhone}</span></li> : null}
            <li className="flex gap-2"><Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0" /> <span className="break-all">{company.email}</span></li>
            <li className="flex gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" /> <span>{company.address}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-steel-300">
        © {new Date().getFullYear()} {company.name}. All rights reserved.
      </div>
    </footer>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-sm bg-ink px-4 py-3 text-sm text-white shadow-lg">
          <Icon name="check" className="h-4 w-4 shrink-0 text-[#F2B26B]" /> {t.message}
        </div>
      ))}
    </div>
  );
}
