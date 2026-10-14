import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

let lenis = null;

export function startSmoothScroll() {
  if (typeof window === 'undefined' || lenis) return () => {};

  lenis = new Lenis({
    autoRaf: true,
    anchors: false,
    smoothWheel: true,
    syncTouch: false,
    respectReducedMotion: true
  });

  const instance = lenis;
  return () => {
    if (lenis !== instance) return;
    instance.destroy();
    lenis = null;
  };
}

export function scrollToElement(element, options = {}) {
  if (!element) return;

  if (lenis) {
    lenis.scrollTo(element, options);
    return;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start'
  });
}

export function scrollToPosition(top, options = {}) {
  if (lenis) {
    lenis.scrollTo(top, options);
    return;
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({
    top,
    behavior: prefersReducedMotion ? 'auto' : 'smooth'
  });
}
