import { useEffect, useRef } from 'react';
import './SpotlightCard.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export default function SpotlightCard({
  theme = 'dark',
  spotlightColor = '#ffffff',
  intensity = 0.15,
  spotlightSize = 240,
  softness = 0.7,
  shape = 'circle',
  borderGlow = 0.6,
  proximity = 80,
  smoothing = 0.3,
  grain = 0,
  ambient = false,
  flare = false,
  radius = 22,
  className = '',
  style,
  children,
  ...restProps
}) {
  const cardRef = useRef(null);
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  const safeShape = shape === 'ellipse' ? 'ellipse' : 'circle';
  const safeIntensity = clamp(intensity, 0, 1);
  const safeBorderGlow = clamp(borderGlow, 0, 1);
  const safeSmoothing = clamp(smoothing, 0, 1);
  const safeAmbient = ambient ? '0.12' : '0';

  useEffect(() => {
    const handlePointerMove = event => {
      if (event.pointerType === 'touch') return;
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const distanceX = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const distanceY = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(distanceX, distanceY);
      const range = Math.max(0, Number(proximity) || 0);
      const hot = range === 0 ? (distance === 0 ? 1 : 0) : clamp(1 - distance / range, 0, 1);
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      card.style.setProperty('--spotlight-x', `${x}px`);
      card.style.setProperty('--spotlight-y', `${y}px`);
      card.style.setProperty('--spotlight-hot', String(hot));
      card.style.setProperty('--spotlight-opacity', String(Math.max(ambient ? 0.12 : 0, hot)));
      card.style.setProperty('--spotlight-border-mix', `${(hot * safeBorderGlow * 58).toFixed(1)}%`);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [ambient, proximity, safeBorderGlow]);

  const initialStyle = {
    '--spotlight-radius': `${Math.max(0, Number(radius) || 22)}px`,
    '--spotlight-color': spotlightColor,
    '--spotlight-intensity': `${safeIntensity * 100}%`,
    '--spotlight-size': `${Math.max(1, Number(spotlightSize) || 240)}px`,
    '--spotlight-softness': `${Math.min(1, Math.max(0.05, Number(softness) || 0.7)) * 100}%`,
    '--spotlight-border-glow': String(safeBorderGlow),
    '--spotlight-proximity': `${Math.max(0, Number(proximity) || 0)}px`,
    '--spotlight-smoothing': `${safeSmoothing * 500}ms`,
    '--spotlight-grain': `${clamp(grain, 0, 1) * 0.12}`,
    '--spotlight-x': '50%',
    '--spotlight-y': '50%',
    '--spotlight-hot': safeAmbient,
    '--spotlight-opacity': safeAmbient,
    '--spotlight-border-mix': `${ambient ? safeBorderGlow * 8 : 0}%`,
    ...style,
  };

  return (
    <article
      {...restProps}
      ref={cardRef}
      className={`spotlight-card spotlight-card--${safeTheme} spotlight-card--${safeShape}${flare ? ' spotlight-card--flare' : ''}${className ? ` ${className}` : ''}`}
      style={initialStyle}
    >
      <span className="spotlight-card__spotlight" aria-hidden="true" />
      {flare && <span className="spotlight-card__flare" aria-hidden="true" />}
      {Number(grain) > 0 && <span className="spotlight-card__grain" aria-hidden="true" />}
      <div className="spotlight-card__content">{children}</div>
    </article>
  );
}
