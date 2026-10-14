import { useEffect, useState } from 'react';
import GooeyNav from './GooeyNav';
import { Link } from '../router';
import { CONSOLE_PATH, GITHUB_URL } from '../routes';
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
    document
      .getElementById(SECTIONS[index].id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <nav className="site-header__gooey" aria-label="Primary">
          <GooeyNav
            items={SECTIONS.map(section => ({ label: section.label }))}
            activeIndex={active}
            onChange={go}
            theme="light"
            size="md"
            particleCount={12}
            spread={48}
          />
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
            Launch console <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
