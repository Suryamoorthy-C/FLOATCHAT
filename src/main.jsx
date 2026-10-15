import { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Platform from './pages/Platform';
import Data from './pages/Data';
import Docs from './pages/Docs';
import PearlZones from './pages/PearlZones';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import SiteRippleBackground from './components/SiteRippleBackground';
import { navigate, useRoute, useSection } from './router';
import { scrollToElement, startSmoothScroll } from './smoothScroll';
import { getSession, signOut } from './auth';
import { api } from './api';
import './theme/tokens.css';
import './theme/base.css';
// The shell's own views use the shared page primitives, so make that guarantee
// explicit here rather than relying on another page importing them.
import './pages/Page.css';
import './theme/glass.css';

const ProfilePage = lazy(() => import('./pages/Profile'));

/**
 * Route anchors keep deep-links such as /data#anomalies working while each
 * primary page owns its content. Home owns the interactive console; Pearl Data
 * is intentionally not mounted on Home.
 */
const ROUTE_SECTION = {
  '/': 'home',
  '/platform': 'platform',
  '/data': 'data',
  '/pearl-zones': 'pearl-zones',
  '/docs': 'docs',
  '/pricing': 'pricing'
};

/** Skip link. It must not touch the hash, because the hash is the router. */
function skipToMain(event) {
  event.preventDefault();
  const main = document.getElementById('main');
  if (!main) return;
  main.focus();
  scrollToElement(main);
}

function ProfileFallback() {
  return (
    <div className="site-shell">
      <div className="container section">
        <p className="empty" aria-busy="true" aria-live="polite">
          Loading your profile and plans…
        </p>
      </div>
    </div>
  );
}

function AuthenticatedProfile() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    getSession().then((current) => {
      if (!current) navigate('/login');
      setSession(current || null);
    });
  }, []);

  if (session === undefined || !session) return <ProfileFallback />;

  const user = session.user || {};
  const metadata = user.user_metadata || {};
  const profile = {
    id: user.id,
    name: metadata.display_name || metadata.full_name || user.email?.split('@')[0] || 'FloatChat user',
    email: user.email || '',
    role: metadata.role || 'Ocean research operator',
  };

  return (
    <ProfilePage
      data={{ profile }}
      onProfileSave={(nextProfile) => api.updateUserProfile(nextProfile)}
      onLogout={async () => { await signOut(); navigate('/login'); }}
    />
  );
}

function App() {
  const path = useRoute();
  const section = useSection();

  useEffect(() => (path === '/profile' || path === '/console' ? undefined : startSmoothScroll()), [path]);

  useEffect(() => {
    if (path === '/console' || path === '/profile') return;
    const id = section || ROUTE_SECTION[path] || 'home';
    const target = document.getElementById(id);
    if (!target) return;
    scrollToElement(target, { duration: 0.95 });
  }, [path, section]);

  if (path === '/console') return <LegacyConsoleRedirect />;
  if (path === '/login') return <Login />;

  if (path === '/profile') {
    return (
      <Suspense fallback={<ProfileFallback />}>
        <AuthenticatedProfile />
      </Suspense>
    );
  }

  const page = path === '/pearl-zones' ? <PearlZones />
    : path === '/platform' ? <Platform />
      : path === '/data' ? <Data />
        : path === '/pricing' ? <Pricing />
        : path === '/docs' ? <Docs />
          : <Home />;

  return <SiteShell>{page}</SiteShell>;
}

function SiteShell({ children }) {
  return (
    <div className="site-shell">
      <SiteRippleBackground />
      <a className="u-skip-link" href="#main" onClick={skipToMain}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
    </div>
  );
}

function LegacyConsoleRedirect() {
  useEffect(() => { navigate('/'); }, []);
  return <div className="console-route"><p className="empty" aria-busy="true">Opening FloatChat Home…</p></div>;
}

// No StrictMode: it double-invokes effects in development, which would
// initialise the globe twice.
createRoot(document.getElementById('root')).render(<App />);
