import { forwardRef, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import './VariableProximity.css';

const VariableProximity = forwardRef(function VariableProximity(props, ref) {
  const {
    label = '',
    fromFontVariationSettings = "'wght' 400, 'opsz' 9",
    toFontVariationSettings = "'wght' 800, 'opsz' 40",
    containerRef,
    radius = 50,
    falloff = 'linear',
    className = '',
    onClick,
    style,
    ...restProps
  } = props;

  const letterRefs = useRef([]);

  const parsedSettings = useMemo(() => {
    const parseSettings = settingsString => new Map(
      settingsString
        .split(',')
        .map(part => part.trim())
        .map(part => {
          const [axis, value] = part.split(/\s+/);
          return [axis.replace(/['"]/g, ''), Number.parseFloat(value)];
        })
    );
    const fromSettings = parseSettings(fromFontVariationSettings);
    const toSettings = parseSettings(toFontVariationSettings);
    return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
      axis,
      fromValue,
      toValue: toSettings.get(axis) ?? fromValue,
    }));
  }, [fromFontVariationSettings, toFontVariationSettings]);

  const calculateFalloff = (distance, influenceRadius) => {
    const norm = Math.min(Math.max(1 - distance / influenceRadius, 0), 1);
    if (falloff === 'exponential') return norm ** 2;
    if (falloff === 'gaussian') return Math.exp(-((distance / (influenceRadius / 2)) ** 2) / 2);
    return norm;
  };

  const handlePointerMove = event => {
    if (event.pointerType === 'touch') return;
    const container = containerRef?.current ?? event.currentTarget;
    const containerRect = container.getBoundingClientRect();
    const x = event.clientX - containerRect.left;
    const y = event.clientY - containerRect.top;
    const influenceRadius = Math.max(1, Number(radius) || 50);
    letterRefs.current.forEach(letterRef => {
      if (!letterRef) return;
      const rect = letterRef.getBoundingClientRect();
      const letterCenterX = rect.left + rect.width / 2 - containerRect.left;
      const letterCenterY = rect.top + rect.height / 2 - containerRect.top;
      const distance = Math.hypot(x - letterCenterX, y - letterCenterY);
      if (distance >= influenceRadius) {
        letterRef.style.fontVariationSettings = fromFontVariationSettings;
        return;
      }

      const falloffValue = calculateFalloff(distance, influenceRadius);
      const settings = parsedSettings
        .map(({ axis, fromValue, toValue }) => {
          const value = fromValue + (toValue - fromValue) * falloffValue;
          return `'${axis}' ${value}`;
        })
        .join(', ');
      letterRef.style.fontVariationSettings = settings;
    });
  };

  const resetVariation = () => {
    letterRefs.current.forEach(letterRef => {
      if (letterRef) letterRef.style.fontVariationSettings = fromFontVariationSettings;
    });
  };

  const words = label.split(' ');
  let letterIndex = 0;

  return (
    <span
      ref={ref}
      className={`${className} variable-proximity`.trim()}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetVariation}
      style={{ display: 'inline', ...style }}
      {...restProps}
    >
      {words.map((word, wordIndex) => (
        <span key={`${wordIndex}-${word}`} className="variable-proximity__word">
          {word.split('').map(letter => {
            const currentLetterIndex = letterIndex++;
            return (
              <motion.span
                key={currentLetterIndex}
                ref={element => { letterRefs.current[currentLetterIndex] = element; }}
                style={{
                  display: 'inline-block',
                  fontVariationSettings: fromFontVariationSettings,
                }}
                aria-hidden="true"
              >
                {letter}
              </motion.span>
            );
          })}
          {wordIndex < words.length - 1 && <span aria-hidden="true">&nbsp;</span>}
        </span>
      ))}
      <span className="variable-proximity__sr-only">{label}</span>
    </span>
  );
});

VariableProximity.displayName = 'VariableProximity';
export default VariableProximity;
