/**
 * Minimal, section-aware hash router.
 *
 * Hash routing is deliberate: the site is a static Vite build deployed to
 * Vercel, and real paths like /platform would 404 on a deep link unless the
 * host were configured with SPA rewrites. Hash routes work on every static
 * host, need zero server config, and keep working from the file system too.
 *
 * Because the hash is already doing routing duty, an in-page anchor cannot use
 * a second native hash. So the target is folded into the same hash:
 *
 *   #/docs#api   ->   route "/docs", anchor "api"
 */

import { useEffect, useState } from 'react';

/** "docs" | "/docs/" | "/docs" -> "/docs"; "" -> "/" */
function toPath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/** Split any hash / route string into its route and optional anchor. */
export function parse(raw) {
  const value = String(raw || '').replace(/^#/, '').trim();
  if (!value) return { path: '/', section: '' };

  const [pathPart, ...rest] = value.split('#');
  return { path: toPath(pathPart), section: rest.join('#').trim() };
}

export function getRoute() {
  if (typeof window === 'undefined') return { path: '/', section: '' };
  return parse(window.location.hash);
}

export function navigate(to) {
  const next = String(to || '/').replace(/^#/, '');
  const current = String(window.location.hash || '').replace(/^#/, '');
  if (current === next) return;
  window.location.hash = next;
}

function useHash() {
  const [value, setValue] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));

  useEffect(() => {
    const onChange = () => setValue(window.location.hash);
    window.addEventListener('hashchange', onChange);
    // Someone may deep-link before React mounts, so sync once on mount too.
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return value;
}

/** Current route path, e.g. "/docs". */
export function useRoute() {
  return parse(useHash()).path;
}

/** Current in-page anchor, e.g. "api". Empty string when there is none. */
export function useSection() {
  return parse(useHash()).section;
}

/**
 * Anchor to a route. Renders a real <a href> so middle-click, "open in new
tab" and "copy link address" all behave normally.
 */
export function Link({ to, children, ...rest }) {
  const href = `#${String(to || '/').replace(/^#/, '')}`;
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
