import { useEffect, useState } from 'react';
import GooeyNav from './GooeyNav';
import SpecularButton from './SpecularButton';
import { Link, navigate, useRoute, useSection } from '../router';
import { GITHUB_URL, PROFILE_PATH } from '../routes';
import './Header.css';

/**
 * Site header — GooeyNav pill nav shared by the console and dedicated pages.
 *
 * Each primary item is a route so direct URLs and browser history work from
 * every page. Launch console returns to the integrated console on Home.
 */
const SECTIONS = [
  { label: 'Home', route: '/' },
  { label: 'Platform', route: '/platform' },
  { label: 'Pricing', route: '/pricing' },
  { label: 'Live data', route: '/data' },
  { label: 'Launch console', route: '/#console' },
  { label: 'Pearl data', route: '/pearl-zones' },
  { label: 'Docs', route: '/docs' }
];

export default function Header() {
  const [active, setActive] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = useRoute();
  const section = useSection();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const index = path === '/' && section === 'console'
      ? SECTIONS.findIndex(item => item.route === '/#console')
      : SECTIONS.findIndex(item => item.route === path);
    if (index >= 0) setActive(index);
  }, [path, section]);

  const go = index => {
    setActive(index);
    setMobileOpen(false);
    navigate(SECTIONS[index].route);
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
          <SpecularButton as={Link} to="/#console" size="md" className="site-header__cta">
            Launch console <span aria-hidden="true">→</span>
          </SpecularButton>
          <a
            className="site-header__source"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Source
          </a>
        </div>
      </div>

      {mobileOpen && (
        <div className="site-header__panel" id="mobile-navigation">
          <div className="container">
            <nav aria-label="Mobile primary">
              <ul className="site-header__list site-header__list--panel">
                {SECTIONS.map((section, index) => (
                  <li className="site-header__item--panel" key={section.route}>
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
            <SpecularButton as={Link} to="/#console" size="md" className="site-header__panel-cta" onClick={() => setMobileOpen(false)}>
              Launch console <span aria-hidden="true">→</span>
            </SpecularButton>
          </div>
        </div>
      )}
    </header>
  );
}
