import { Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Platform from './pages/Platform';
import Data from './pages/Data';
import Docs from './pages/Docs';
import PearlZones from './pages/PearlZones';
import { useRoute, useSection } from './router';

import './theme/tokens.css';
import './theme/base.css';
// The shell's own views use the shared page primitives, so make that guarantee
// explicit here rather than relying on another page importing them.
import './pages/Page.css';

/* globe.gl pulls in three.js — about 2 MB — so the console is loaded on demand
   instead of on first paint. Everything else is small enough to ship up front. */
const ConsolePage = lazy(() => import('./pages/Console'));

/**
 * Old route paths still resolve, but they scroll instead of redirecting: the
 * whole site is one page with the sections stacked (home → platform → live
 * data → docs). Footer deep-links like /data#anomalies land on the right
 * anchor the same way.
 */
const ROUTE_SECTION = {
  '/': 'home',
  '/platform': 'platform',
  '/data': 'data',
  '/pearl-zones': 'pearl-zones',
  '/docs': 'docs'
};

/** Skip link. It must not touch the hash, because the hash is the router. */
function skipToMain(event) {
  event.preventDefault();
  const main = document.getElementById('main');
  if (!main) return;
  main.focus();
  main.scrollIntoView({ block: 'start' });
}

function ConsoleFallback() {
  return (
    <div className="site-shell">
      <div className="container section">
        <p className="empty" aria-busy="true" aria-live="polite">
          Loading the operations console…
        </p>
      </div>
    </div>
  );
}

function App() {
  const path = useRoute();
  const section = useSection();

  useEffect(() => {
    if (path === '/console') return;
    const id = section || ROUTE_SECTION[path] || 'home';
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Live content above this section can expand after the first scroll starts.
    // Re-align the Pearl Zones route once layout settles, unless the visitor has
    // already taken control of scrolling.
    if (path !== '/pearl-zones' || section) return;
    let cancelled = false;
    const cancelCorrection = () => { cancelled = true; window.clearTimeout(timer); };
    const timer = window.setTimeout(() => {
      if (cancelled || !window.location.hash.startsWith('#/pearl-zones')) return;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - margin;
      window.scrollTo(0, Math.max(0, top));
    }, 1200);
    const userEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    userEvents.forEach((eventName) => window.addEventListener(eventName, cancelCorrection, { once: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      userEvents.forEach((eventName) => window.removeEventListener(eventName, cancelCorrection));
    };
  }, [path, section]);

  if (path === '/console') {
    return (
      <Suspense fallback={<ConsoleFallback />}>
        <ConsolePage />
      </Suspense>
    );
  }

  return (
    <div className="site-shell">
      <a className="u-skip-link" href="#main" onClick={skipToMain}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Home />
        <Platform />
        <Data />
        <PearlZones />
        <Docs />
      </main>
      <Footer />
    </div>
  );
}

// No StrictMode: it double-invokes effects in development, which would
// initialise the globe twice.
createRoot(document.getElementById('root')).render(<App />);
