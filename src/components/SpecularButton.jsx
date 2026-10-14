import './SpecularButton.css';

/**
 * A glassy, pointer-reactive control that can render as a button, anchor, or
 * router link. The caller may supply the same visual knobs as the React Bits
 * SpecularButton example while retaining the existing app's navigation.
 */
export default function SpecularButton({
  as: Element = 'button',
  size = 'md',
  radius = 18,
  tint = '#ffffff',
  tintOpacity = 0.04,
  textColor = '#f5f5f5',
  lineColor = '#ffffff',
  baseColor = '#525252',
  intensity = 1,
  idleIntensity = 0.35,
  shineSize = 10,
  shineFade = 34,
  thickness = 1.2,
  glow = 1,
  followMouse = true,
  proximity = 250,
  className = '',
  style,
  disabled = false,
  type,
  onPointerMove,
  onPointerLeave,
  children,
  ...restProps
}) {
  const glowOpacity = Math.min(0.28, Math.max(0, Number(glow) * 0.16));
  const initialStyle = {
    '--spec-radius': `${radius}px`,
    '--spec-tint': tint,
    '--spec-tint-opacity': `${Math.min(1, Math.max(0, Number(tintOpacity))) * 100}%`,
    '--spec-text': textColor,
    '--spec-line': lineColor,
    '--spec-base': baseColor,
    '--spec-intensity': Number(intensity),
    '--spec-hot': Number(idleIntensity),
    '--spec-shine-size': `${shineSize}px`,
    '--spec-shine-fade': `${shineFade}%`,
    '--spec-thickness': `${thickness}px`,
    '--spec-glow-opacity': `${glowOpacity * 100}%`,
    '--spec-x': '50%',
    '--spec-y': '50%',
    ...style,
  };

  function handlePointerMove(event) {
    const node = event.currentTarget;
    if (followMouse && node && event.pointerType !== 'touch') {
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dx = x - rect.width / 2;
      const dy = y - rect.height / 2;
      const radiusPx = Math.max(1, Number(proximity) || 250);
      const proximityPower = Math.max(0, 1 - Math.hypot(dx, dy) / radiusPx);
      node.style.setProperty('--spec-x', `${(x / rect.width) * 100}%`);
      node.style.setProperty('--spec-y', `${(y / rect.height) * 100}%`);
      node.style.setProperty(
        '--spec-hot',
        String(Math.min(1, Number(idleIntensity) + Number(intensity) * proximityPower * 0.55))
      );
    }
    onPointerMove?.(event);
  }

  function handlePointerLeave(event) {
    event.currentTarget.style.setProperty('--spec-hot', String(idleIntensity));
    onPointerLeave?.(event);
  }

  return (
    <Element
      {...restProps}
      className={`specular-button specular-button--${size}${className ? ` ${className}` : ''}`}
      style={initialStyle}
      type={Element === 'button' ? type || 'button' : type}
      disabled={Element === 'button' ? disabled : undefined}
      aria-disabled={Element !== 'button' && disabled ? true : restProps['aria-disabled']}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <span className="specular-button__content">{children}</span>
    </Element>
  );
}
