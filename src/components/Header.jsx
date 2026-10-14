import { useEffect, useId, useRef, useState } from 'react';
import { Link, useRoute } from '../router';
import { CONSOLE_PATH, GITHUB_URL, NAV_ITEMS } from '../routes';
import './Header.css';

/**
 * Site header.
 *
 * Intent: primary wayfinding for the marketing site, plus the persistent route
 * into the operations console.
 *
 * Anatomy: container > brand (mark + wordmark) · primary nav (list of links) ·
 * actions (console CTA + mobile disclosure toggle) · mobile panel.
 *
 * Behaviour: the active route is announced with aria-current="page". Below the
 * desktop breakpoint the nav collapses into a disclosure that Escape closes and
 * focus returns to the toggle afterwards.
 */
export default function Header() {
  const path = useRoute();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef(null);

  // A navigation always dismisses the mobile panel.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const renderNavList = (variant) =>
    NAV_ITEMS.map(item => {
      const current = path === item.to;
      return (
        <li key={item.to} className={`site-header__item site-header__item--${variant}`}>
          <Link
            to={item.to}
            className="site-header__link"
            aria-current={current ? 'page' : undefined}
          >
            {item.label}
          </Link>
        </li>
      );
    });

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="FLOATCHAT, back to home">
          <span className="site-header__mark" aria-hidden="true" />
          <span className="site-header__wordmark">FLOATCHAT</span>
        </Link>

        <nav className="site-header__nav" aria-label="Primary">
          <ul className="site-header__list">{renderNavList('bar')}</ul>
        </nav>

        <div className="site-header__actions">
          <a
            className="site-header__source"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Source
          </a>
          <Link to={CONSOLE_PATH} className="btn btn--primary site-header__cta">
            Launch console
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="site-header__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setOpen(value => !value)}
          >
            <span className="site-header__bars" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div className="site-header__panel" id={panelId}>
          <div className="container">
            <nav aria-label="Primary, mobile">
              <ul className="site-header__list site-header__list--panel">{renderNavList('panel')}</ul>
            </nav>
            <Link to={CONSOLE_PATH} className="btn btn--primary site-header__panel-cta">
              Launch console
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
