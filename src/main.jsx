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
import { scrollToElement, scrollToPosition, startSmoothScroll } from './smoothScroll';
import './theme/tokens.css';
import './theme/base.css';
// The shell's own views use the shared page primitives, so make that guarantee
// explicit here rather than relying on another page importing them.
import './pages/Page.css';
import './theme/glass.css';

/* globe.gl pulls in three.js — about 2 MB — so the console is loaded on demand
   instead of on first paint. Everything else is small enough to ship up front. */
const ConsolePage = lazy(() => import('./pages/Console'));
const ProfilePage = lazy(() => import('./pages/Profile'));

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
  scrollToElement(main);
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

function App() {
  const path = useRoute();
  const section = useSection();

  useEffect(() => {
    if (path === '/console') return undefined;
    return startSmoothScroll();
  }, [path]);

  useEffect(() => {
    if (path === '/console' || path === '/profile') return;
    const id = section || ROUTE_SECTION[path] || 'home';
    const target = document.getElementById(id);
    if (!target) return;
    scrollToElement(target, { duration: 0.95 });

    // The Live Data table can arrive asynchronously and expand substantially
    // above Pearl Zones. Keep its deep-link aligned while that layout settles,
    // unless the visitor has already taken control of scrolling.
    if (path !== '/pearl-zones' || section) return;
    let cancelled = false;
    let correctionTimer;
    let stopTimer;
    const alignTarget = () => {
      if (cancelled || !window.location.hash.startsWith('#/pearl-zones')) return;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - margin;
      scrollToPosition(Math.max(0, top), { duration: 0.35 });
    };
    const scheduleAlignment = () => {
      window.clearTimeout(correctionTimer);
      correctionTimer = window.setTimeout(alignTarget, 300);
    };
    const main = document.getElementById('main');
    const resizeObserver = typeof ResizeObserver !== 'undefined' && main
      ? new ResizeObserver(scheduleAlignment)
      : null;
    resizeObserver?.observe(main);
    correctionTimer = window.setTimeout(alignTarget, 1200);
    stopTimer = window.setTimeout(() => {
      resizeObserver?.disconnect();
      alignTarget();
    }, 15000);
    const userEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const cancelCorrection = () => {
      cancelled = true;
      window.clearTimeout(correctionTimer);
      window.clearTimeout(stopTimer);
      resizeObserver?.disconnect();
    };
    userEvents.forEach((eventName) => window.addEventListener(eventName, cancelCorrection, { once: true, passive: true }));
    return () => {
      window.clearTimeout(correctionTimer);
      window.clearTimeout(stopTimer);
      resizeObserver?.disconnect();
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

  if (path === '/profile') {
    return (
      <Suspense fallback={<ProfileFallback />}>
        <ProfilePage />
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
