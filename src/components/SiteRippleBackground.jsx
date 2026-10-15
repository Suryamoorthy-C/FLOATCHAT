import RippleDistortion from './RippleDistortion';
import './SiteRippleBackground.css';

/** Ambient background layer. It never captures pointers or overlays page UI. */
export default function SiteRippleBackground({ className = '' }) {
  return (
    <div className={`site-ripple-background ${className}`.trim()} aria-hidden="true">
      <RippleDistortion
        src="/hero-aurora.svg"
        brushSize={140}
        strength={0.16}
        swirl={0.65}
        rings={3}
        spread={5}
        fade={3.2}
        spacing={18}
        dispersion={0.04}
        glint={0.12}
        tint="#147e8a"
        tintAmount={0.1}
        highlightColor="#a4f3ec"
        grayscale={false}
        trigger="hover"
        clickStrength={1.2}
        quality="low"
      />
    </div>
  );
}
