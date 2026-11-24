import { useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { ADMIN_ONLY_ROUTES, ROUTE_ACCESS, go, useRoute } from './router';
import type { RouteId } from './router';
import { Footer, Header, SyncBanner, Toasts } from './components/Layout';
import { Home } from './pages/Home';
import { ServiceCenter } from './pages/ServiceCenter';
import { Store } from './pages/Store';
import { Manufacturing } from './pages/Manufacturing';
import { ServiceEnquiry } from './pages/ServiceEnquiry';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { MyOrders } from './pages/MyOrders';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';
import { CourierCharges } from './pages/CourierCharges';
import { VendorSignup, VendorDashboard } from './pages/Vendor';

function Page({ route }: { route: RouteId }) {
  const { role } = useApp();

  // The Management Dashboard is invisible to everyone except the owner's admin account:
  // other visitors are sent to the homepage with no hint that the page exists.
  if (ADMIN_ONLY_ROUTES.includes(route) && role !== 'admin') return <Home />;
  // The vendor dashboard is only for approved vendors; everyone else is sent home.
  if (route === 'vendor' && role !== 'vendor') return role === 'guest' || role === 'customer' ? <VendorSignup /> : <Home />;

  // Role-based access control for the remaining routes (e.g. checkout needs a signed-in user).
  if (!ROUTE_ACCESS[route].includes(role)) {
    return (
      <Login
        reason={
          route === 'orders'
            ? 'Sign in to see your orders and track their delivery.'
            : route === 'vendor-signup'
              ? 'Sign in or create an account to apply as a vendor.'
              : 'Sign in to complete your purchase.'
        }
        inPlace
      />
    );
  }

  switch (route) {
    case 'home':
      return <Home />;
    case 'service-center':
      return <ServiceCenter />;
    case 'store':
      return <Store />;
    case 'manufacturing':
      return <Manufacturing />;
    case 'service-enquiry':
      return <ServiceEnquiry />;
    case 'cart':
      return <Cart />;
    case 'checkout':
      return <Checkout />;
    case 'orders':
      return <MyOrders />;
    case 'login':
      return <Login inPlace={false} />;
    case 'admin':
      return <Admin />;
    case 'courier-charges':
      return <CourierCharges />;
    case 'vendor-signup':
      return <VendorSignup />;
    case 'vendor':
      return <VendorDashboard />;
    default:
      return <Home />;
  }
}

function Shell() {
  const route = useRoute();
  const { company, role } = useApp();

  useEffect(() => {
    document.title = company.name;
  }, [company.name]);

  // Non-admins who open #admin are redirected home, including when the hash changes later.
  useEffect(() => {
    const guard = () => {
      const h = window.location.hash.replace('#', '');
      if ((ADMIN_ONLY_ROUTES as string[]).includes(h) && role !== 'admin') go('home');
      if (h === 'vendor' && role !== 'vendor') go(role === 'guest' ? 'home' : 'vendor-signup');
    };
    guard();
    window.addEventListener('hashchange', guard);
    return () => window.removeEventListener('hashchange', guard);
  }, [role]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header route={route} />
      <SyncBanner />
      <main className="flex-1">
        <Page route={route} />
      </main>
      <Footer />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
