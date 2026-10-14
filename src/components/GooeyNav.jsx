import { useEffect, useRef } from 'react';
import './GooeyNav.css';

export default function GooeyNav({
  items = [],
  activeIndex = 0,
  onChange,
  theme = 'light',
  size = 'md',
  className = ''
}) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeIndex]);

  return (
    <div
      className={`gooey-nav gooey-nav--${size} gooey-nav--${theme} ${className}`.trim()}
      style={{
        '--gn-muted': theme === 'light' ? 'rgba(32, 48, 68, .66)' : 'rgba(255,255,255,.66)',
        '--gn-ink': theme === 'light' ? '#15233b' : '#fff',
        '--gn-active-ink': theme === 'light' ? '#15233b' : '#fff',
        '--gn-pill': theme === 'light' ? 'rgba(193,255,0,.32)' : 'rgba(0,242,254,.18)',
        '--gn-frame': theme === 'light' ? 'rgba(255,255,255,.5)' : 'rgba(5,16,29,.7)',
        '--gn-frame-shadow': '0 8px 24px rgba(10,24,42,.08)',
        '--gn-frame-edge': 'rgba(32,48,68,.14)',
        '--gn-frame-highlight': 'rgba(255,255,255,.72)'
      }}
    >
      <div className="gooey-nav__stage">
        <ul className="gooey-nav__list" role="list">
          {items.map((item, index) => (
            <li
              className="gooey-nav__item"
              data-active={index === activeIndex ? '' : undefined}
              key={`${item.label}-${index}`}
              ref={index === activeIndex ? activeRef : null}
            >
              <button
                type="button"
                className="gooey-nav__link"
                aria-current={index === activeIndex ? 'page' : undefined}
                onClick={() => onChange?.(index)}
              >
                {item.icon ? <span className="gooey-nav__icon">{item.icon}</span> : null}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
