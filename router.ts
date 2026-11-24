import { useEffect, useState } from 'react';
import type { Role } from './types';

export type RouteId =
  | 'home'
  | 'service-center'
  | 'store'
  | 'manufacturing'
  | 'service-enquiry'
  | 'cart'
  | 'checkout'
  | 'orders'
  | 'login'
  | 'admin'
  | 'courier-charges'
  | 'vendor-signup'
  | 'vendor';

const ROUTE_IDS: RouteId[] = [
  'home',
  'service-center',
  'store',
  'manufacturing',
  'service-enquiry',
  'cart',
  'checkout',
  'orders',
  'login',
  'admin',
  'courier-charges',
  'vendor-signup',
  'vendor',
];

/** Pages that do not exist for anyone but the owner: other visitors are sent home silently. */
export const ADMIN_ONLY_ROUTES: RouteId[] = ['admin', 'courier-charges'];

/**
 * Role-based access table. This is the single source of truth for who can
 * open which page. Standard users get browsing, cart, checkout and enquiries;
 * only the admin role reaches the Management Dashboard.
 */
export const ROUTE_ACCESS: Record<RouteId, Role[]> = {
  home: ['guest', 'customer', 'vendor', 'admin'],
  'service-center': ['guest', 'customer', 'vendor', 'admin'],
  store: ['guest', 'customer', 'vendor', 'admin'],
  manufacturing: ['guest', 'customer', 'vendor', 'admin'],
  'service-enquiry': ['guest', 'customer', 'vendor', 'admin'],
  cart: ['guest', 'customer', 'vendor', 'admin'],
  checkout: ['customer', 'vendor', 'admin'],
  orders: ['customer', 'vendor', 'admin'],
  login: ['guest', 'customer', 'vendor', 'admin'],
  admin: ['admin'],
  'courier-charges': ['admin'],
  'vendor-signup': ['customer', 'vendor'],
  vendor: ['vendor'],
};

function readRoute(): RouteId {
  const h = window.location.hash.replace('#', '');
  return (ROUTE_IDS as string[]).includes(h) ? (h as RouteId) : 'home';
}

export function go(route: RouteId): void {
  if (window.location.hash === '#' + route) {
    window.scrollTo(0, 0);
    return;
  }
  window.location.hash = route;
}

export function useRoute(): RouteId {
  const [route, setRoute] = useState<RouteId>(readRoute());
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
