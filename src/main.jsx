import { Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Platform from './pages/Platform';
import Data from './pages/Data';
import Docs from './pages/Docs';
import PearlZones from './pages/PearlZones';
import { Link, useRoute, useSection } from './router';

import './theme/tokens.css';
import './theme/base.css';
// The shell's own 404 uses the shared page primitives, so make that guarantee
// explicit here rather than relying on another page importing them.
import './pages/Page.css';

/* globe.gl pulls in three.js — about 2 MB — so the console is loaded on demand
   instead of on first paint. Everything else is small enough to ship up front. */
const ConsolePage = lazy(() => import('./pages/Console'));

const PAGES = {
  '/': Home,
  '/platform': Platform,
  '/data': Data,
  '/pearl-zones': PearlZones,
  '/docs': Docs,
};

/** Skip link. It must not touch the hash, because the hash is the router. */
function skipToMain(event) {
  event.preventDefault();
  const main = document.getElementById('main');
  if (!main) return;
  main.focus();
  main.scrollIntoView({ block: 'start' });
}

function NotFound() {
  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Not found</p>
          <h1 className="page-head__title">That page does not exist.</h1>
          <p className="page-head__lede">
            The link may be out of date. Use the navigation above, or start again from the home
            page.
          </p>
          <div className="actions">
            <Link to="/" className="btn btn--primary">
              Back to home
            </Link>
          </div>
        </header>
      </div>
    </div>
  );
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

  // Each navigation starts at the top of the new page, unless the route names an
  // anchor (for example #/docs#api), in which case that is scrolled into view.
  useEffect(() => {
    if (section) {
      const target = document.getElementById(section);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [path, section]);

  if (path === '/console') {
    return (
      <Suspense fallback={<ConsoleFallback />}>
        <ConsolePage />
      </Suspense>
    );
  }

  const Page = PAGES[path] ?? NotFound;

  return (
    <div className="site-shell">
      <a className="u-skip-link" href="#main" onClick={skipToMain}>
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Page />
      </main>
      <Footer />
    </div>
  );
}

// No StrictMode: it double-invokes effects in development, which would
// initialise the globe twice.
createRoot(document.getElementById('root')).render(<App />);
