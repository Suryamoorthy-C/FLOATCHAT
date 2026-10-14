import { useState } from 'react';

const visualGlyphs = {
  analytics: '◌',
  dashboard: '⌁',
  automation: '◇',
  security: '✦',
  collaboration: '⊙',
  integration: '↗'
};

export default function MagicBento({
  items = [],
  columns = 4,
  rowHeight = 250,
  gap = 12,
  radius = 20,
  glowColor = '#1A2FFB',
  enableSpotlight = true,
  clickEffect = true,
  textAutoHide = false
}) {
  const [active, setActive] = useState(null);
  return (
    <div
      className="magic-bento"
      style={{
        '--magic-columns': columns,
        '--magic-row-height': `${rowHeight}px`,
        '--magic-gap': `${gap}px`,
        '--magic-radius': `${radius}px`,
        '--magic-glow': glowColor
      }}
    >
      {items.map((item, index) => {
        const isActive = active === index;
        const content = (
          <>
            <span className="magic-bento__visual" aria-hidden="true">
              {visualGlyphs[item.visual] || '·'}
            </span>
            <span className="magic-bento__label">{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </>
        );
        const props = {
          className: `magic-bento__card${isActive ? ' is-active' : ''}`,
          style: { gridColumn: `span ${Math.min(item.colSpan || 1, columns)}` },
          onClick: clickEffect ? () => setActive(isActive ? null : index) : undefined,
          onMouseMove: enableSpotlight
            ? event => {
                const rect = event.currentTarget.getBoundingClientRect();
                event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
                event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
              }
            : undefined
        };
        return item.href ? (
          <a {...props} href={item.href} key={`${item.label}-${index}`}>
            {content}
          </a>
        ) : (
          <article {...props} key={`${item.label}-${index}`}>
            {content}
          </article>
        );
      })}
      <style>{`
        .magic-bento { display:grid; grid-template-columns:repeat(${columns}, minmax(0,1fr)); gap:${gap}px; }
        .magic-bento__card { position:relative; min-height:${rowHeight}px; display:flex; flex-direction:column; justify-content:flex-end; overflow:hidden; padding:28px; border:1px solid rgba(26,47,251,.16); border-radius:${radius}px; color:inherit; text-decoration:none; background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(239,244,255,.72)); box-shadow:0 18px 45px rgba(20,36,74,.08); transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .magic-bento__card::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.55; background:radial-gradient(260px circle at var(--spot-x,50%) var(--spot-y,20%), ${glowColor}22, transparent 70%); }
        .magic-bento__card:hover, .magic-bento__card.is-active { transform:translateY(-3px); border-color:${glowColor}66; box-shadow:0 22px 55px ${glowColor}20; }
        .magic-bento__visual { position:absolute; top:22px; right:26px; color:${glowColor}; font:42px/1 'Space Grotesk',sans-serif; opacity:.24; }
        .magic-bento__label { position:relative; z-index:1; color:${glowColor}; font:10px 'JetBrains Mono',monospace; letter-spacing:.12em; text-transform:uppercase; }
        .magic-bento__card h3 { position:relative; z-index:1; margin:10px 0 8px; font-size:clamp(1.15rem,2vw,1.65rem); }
        .magic-bento__card p { position:relative; z-index:1; max-width:42ch; margin:0; color:#53627a; line-height:1.55; font-size:.92rem; }
        @media (max-width: 760px) { .magic-bento { grid-template-columns:1fr; } .magic-bento__card { grid-column:span 1 !important; min-height:210px; padding:22px; } }
        ${textAutoHide ? '.magic-bento__card p{max-height:4.7em;overflow:hidden;}' : ''}
      `}</style>
    </div>
  );
}
