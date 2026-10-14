import { useRef } from 'react';
import VariableProximity from './VariableProximity';

export default function AnimatedText({
  label,
  className = '',
  fromFontVariationSettings = "'wght' 400, 'opsz' 9",
  toFontVariationSettings = "'wght' 800, 'opsz' 40",
  radius = 75,
  falloff = 'linear',
}) {
  const containerRef = useRef(null);

  return (
    <span className={`animated-text${className ? ` ${className}` : ''}`} ref={containerRef}>
      <VariableProximity
        label={String(label ?? '')}
        fromFontVariationSettings={fromFontVariationSettings}
        toFontVariationSettings={toFontVariationSettings}
        containerRef={containerRef}
        radius={radius}
        falloff={falloff}
      />
    </span>
  );
}
