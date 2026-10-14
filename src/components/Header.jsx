import { useEffect, useState } from 'react';
import GooeyNav from './GooeyNav';
import SpecularButton from './SpecularButton';
import { Link } from '../router';
import { CONSOLE_PATH, GITHUB_URL, PROFILE_PATH } from '../routes';
import { scrollToElement } from '../smoothScroll';
import './Header.css';

/**
 * Site header — GooeyNav pill nav over a single scrolling page.
 *
 * There are no route redirects between sections: every nav item is a button
 * that smooth-scrolls to its section (home → platform → live data → docs),
 * and a scroll-spy keeps the gooey pill on whichever section is in view.
 * The operations console stays a real route behind the CTA.
 */
const SECTIONS = [
  { label: 'Home', id: 'home' },
  { label: 'Platform', id: 'platform' },
  { label: 'Live data', id: 'data' },
  { label: 'Pearl zones', id: 'pearl-zones' },
  { label: 'Docs', id: 'docs' }
];

export default function Header() {
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy: the section crossing the middle of the viewport owns the pill.
  useEffect(() => {
    const ids = SECTIONS.map(section => section.id);
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const index = ids.indexOf(entry.target.id);
          if (index >= 0) setActive(index);
        });
      },
      { rootMargin: '-38% 0px -55% 0px' }
    );
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const go = index => {
    setActive(index);
    setMobileOpen(false);
    scrollToElement(document.getElementById(SECTIONS[index].id), { duration: 0.95 });
  };

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <nav className="site-header__gooey" aria-label="Primary">
          <GooeyNav
            items={SECTIONS.map(section => ({ label: section.label }))}
            activeIndex={active}
            onChange={go}
            theme="dark"
            frame={false}
            size="md"
            particleCount={12}
            spread={48}
          />
        </nav>

        <SpecularButton
          type="button"
          size="icon"
          className="site-header__toggle"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => setMobileOpen(open => !open)}
        >
          <span className="site-header__bars" aria-hidden="true" />
        </SpecularButton>

        <div className="site-header__actions">
          <SpecularButton as={Link} to={PROFILE_PATH} size="md" className="site-header__account">
            Account
          </SpecularButton>
          <a
            className="site-header__source"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Source
          </a>
          <SpecularButton as={Link} to={CONSOLE_PATH} size="md" className="site-header__cta">
            Launch console <span aria-hidden="true">→</span>
          </SpecularButton>
        </div>
      </div>

      {mobileOpen && (
        <div className="site-header__panel" id="mobile-navigation">
          <div className="container">
            <nav aria-label="Mobile primary">
              <ul className="site-header__list site-header__list--panel">
                {SECTIONS.map((section, index) => (
                  <li className="site-header__item--panel" key={section.id}>
                    <SpecularButton
                      type="button"
                      size="md"
                      className="site-header__link site-header__link--panel"
                      aria-current={active === index ? 'page' : undefined}
                      onClick={() => go(index)}
                    >
                      {section.label}
                    </SpecularButton>
                  </li>
                ))}
              </ul>
            </nav>
            <SpecularButton as={Link} to={PROFILE_PATH} size="md" className="site-header__panel-cta site-header__panel-account" onClick={() => setMobileOpen(false)}>
              Profile &amp; plans <span aria-hidden="true">→</span>
            </SpecularButton>
            <SpecularButton as={Link} to={CONSOLE_PATH} size="md" className="site-header__panel-cta" onClick={() => setMobileOpen(false)}>
              Launch console <span aria-hidden="true">→</span>
            </SpecularButton>
          </div>
        </div>
      )}
    </header>
  );
}
