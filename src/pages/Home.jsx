import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ParticleText from '../components/ParticleText';
import RippleDistortion from '../components/RippleDistortion';
import VariableProximity from '../components/VariableProximity';
import SpecularButton from '../components/SpecularButton';
import MagicBento from '../components/MagicBento';
import Reveal from '../components/Reveal';
import { Link } from '../router';
import { CONSOLE_PATH } from '../routes';
import { api } from '../api';
import { useMediaQuery } from '../hooks';
import { scrollToElement } from '../smoothScroll';
import './Home.css';
import './HomeGlass.css';

const ArgoExplodedView = lazy(() => import('../components/ArgoExplodedView'));

/**
 * Home — first page.
 *
 * Hero stack (bottom → top):
 *   1. RippleDistortion over /hero-aurora.svg — your aurora image, rippling
 *      under the pointer. Drop your WhatsApp JPEG as
 *      public/hero-aurora.jpg and change `src` below to use it.
 *   2. Readability gradient.
 *   3. ParticleText "FLOATCHAT" — gathers on mount, re-scatters on hover,
 *      cursor repels particles.
 *
 * Below the hero, Capabilities + Fleet live in one MagicBento grid so every
 * line of copy shares the same spotlight / border-glow / click-wave language.
 */
export default function Home() {
  const isNarrow = useMediaQuery('(max-width: 860px)');
  const headlineRef = useRef(null);
  const sublineRef = useRef(null);

  return (
    <>
      <h1 className="u-visually-hidden">FLOATCHAT — ocean intelligence for the Argo fleet</h1>

      <section className="home-hero" id="home" aria-label="FLOATCHAT introduction">
        <div className="home-hero__bg" aria-hidden="true">
          <RippleDistortion
            src="/hero-aurora.svg"
            brushSize={isNarrow ? 130 : 220}
            strength={0.35}
            swirl={2}
            rings={5}
            spread={6}
            fade={2.5}
            spacing={14}
            dispersion={0.12}
            glint={0.35}
            tint="#2a6650"
            tintAmount={0.25}
            highlightColor="#c1ff00"
            grayscale={false}
            trigger="both"
            quality={isNarrow ? 'low' : 'medium'}
          />
          <div className="home-hero__shade" />
          <div className="home-hero__grain" />
        </div>

        <div className="container home-hero__inner">
          <Reveal variant="fade" persistKey="home-hero-eyebrow">
            <p className="eyebrow home-hero__eyebrow">Argo · Indian Ocean · Live</p>
          </Reveal>

          <Reveal variant="zoom" delay={80} persistKey="home-hero-wordmark">
            <div className="home-hero__particles">
              <ParticleText
                text="FLOATCHAT"
                particleSize={2.2}
                density={3}
                color="#ffffff"
                highlightColor="#c1ff00"
                scatter={220}
                gatherDuration={1800}
                stagger={500}
                pointerRepel={55}
                repelRadius={140}
                idleDrift={0.8}
                trigger="hover"
                fontSize={isNarrow ? 'clamp(3rem, 13.5vw, 5rem)' : 'clamp(4rem, 9vw, 7rem)'}
                fontWeight={800}
                glow
              />
            </div>
          </Reveal>

          <Reveal variant="up" delay={160} persistKey="home-hero-copy">
            <div className="home-hero__animated-copy">
              <h2 className="home-hero__headline" ref={headlineRef}>
                <VariableProximity
                  label="Ask the ocean a question."
                  className="home-hero__variable-text"
                  fromFontVariationSettings="'wght' 450, 'opsz' 18"
                  toFontVariationSettings="'wght' 950, 'opsz' 72"
                  containerRef={headlineRef}
                  radius={180}
                  falloff="gaussian"
                />
              </h2>
              <p className="home-hero__sub" ref={sublineRef}>
                <VariableProximity
                  label="Plain-language answers over live Argo float data, with citations on every claim."
                  className="home-hero__variable-text"
                  fromFontVariationSettings="'wght' 400, 'opsz' 14"
                  toFontVariationSettings="'wght' 750, 'opsz' 32"
                  containerRef={sublineRef}
                  radius={120}
                  falloff="linear"
                />
              </p>
            </div>
          </Reveal>

          <Reveal variant="up" delay={240} persistKey="home-hero-actions">
            <div className="home-hero__actions">
              <SpecularButton as={Link} to={CONSOLE_PATH} size="lg">
                Launch console <span aria-hidden="true">→</span>
              </SpecularButton>
              <SpecularButton as={Link} to="/data" size="lg">
                Explore live data
              </SpecularButton>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={320} persistKey="home-hero-hint">
            <p className="home-hero__hint">Hover the wordmark to scatter it · move anywhere to ripple the water</p>
          </Reveal>
        </div>

        <SpecularButton
          type="button"
          size="icon"
          className="home-hero__scroll"
          aria-label="Scroll to capabilities"
          onClick={() => scrollToElement(document.getElementById('capabilities'), { duration: 0.95 })}
        >
          <span aria-hidden="true" />
        </SpecularButton>
      </section>

      <DeferredArgoStory />

      <BentoShowcase />

    </>
  );
}

function DeferredArgoStory() {
  const sectionRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        setShouldLoad(true);
        observer.disconnect();
      },
      { rootMargin: '-12% 0px -12% 0px' }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="argo-story-slot" ref={sectionRef}>
      {shouldLoad ? (
        <Suspense fallback={<ArgoStoryLoading />}>
          <ArgoExplodedView />
        </Suspense>
      ) : (
        <ArgoStoryLoading />
      )}
    </div>
  );
}

function ArgoStoryLoading() {
  return (
    <div className="argo-story__loading" role="status">
      Preparing the ARGO system study…
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Capabilities + Fleet in one MagicBento grid                         */
/* ------------------------------------------------------------------ */

function useFleetStats() {
  const [state, setState] = useState({ status: 'loading', stats: null });

  useEffect(() => {
    let cancelled = false;

    api
      .stats()
      .then(stats => (cancelled ? null : setState({ status: 'ready', stats })))
      .catch(() => (cancelled ? null : setState({ status: 'error', stats: null })));

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function BentoShowcase() {
  const { status, stats } = useFleetStats();

  const fleetDescription =
    status === 'ready' && stats
      ? `Read from the live window. ${stats.active_floats ?? '—'} active floats · ` +
        `${stats.anomalies ?? '—'} anomalies · ` +
        `${stats.coverage_percent == null ? '—' : `${stats.coverage_percent}%`} coverage · ` +
        `${stats.window_days == null ? '—' : `${stats.window_days} days`}.`
      : status === 'error'
        ? 'Read from the live window. Live statistics are unavailable right now. ' +
          'The console still runs against its cached fleet view.'
        : 'Read from the live window. Loading live fleet statistics…';

  const items = [
    {
      label: 'Capabilities',
      title: 'Ask in plain language',
      description:
        'Type a question the way you would ask a colleague. FloatChat resolves it onto salinity, temperature, pressure, region and depth.',
      visual: 'analytics'
    },
    {
      label: 'Live',
      title: 'Live float telemetry',
      description:
        'Every point on the globe is a real Argo float position, served from the Argo GDAC window rather than a fixture.',
      visual: 'dashboard'
    },
    {
      label: 'Profiles',
      title: 'Profiles and anomalies',
      description:
        'Pull a full 0–2,000 m temperature and salinity profile for any float, and surface the outliers automatically.',
      visual: 'profiles',
    },
    {
      label: 'Citations',
      title: 'Answers you can check',
      description:
        'Each response carries its citations, its source and the time it was fetched, so a number is never a dead end.',
      visual: 'security'
    },
    {
      label: 'Fleet right now',
      title: status === 'error' ? 'Live window unreachable' : 'Fleet right now',
      description: fleetDescription,
      visual: 'collaboration'
    },
    {
      label: 'Console',
      title: 'Open the console',
      description: 'Full globe, depth sweep, trajectories and the anomaly strip.',
      visual: 'integration',
      href: CONSOLE_PATH
    },
    {
      label: 'Provenance',
      colSpan: 2,
      content: (
        <div className="home-provenance-card">
          <div className="magic-bento__header">
            <span className="magic-bento__label">Provenance</span>
          </div>
          <h3>Every number traces back to its source.</h3>
          <p>
            Core Argo floats profile temperature and salinity from the surface to about 2,000 m.
            FloatChat reports the source, fetch time and live-versus-cached mode beside the data,
            so a fallback value cannot be mistaken for a live reading.
          </p>
          <div className="home-provenance-card__links">
            <a href="https://www.aoml.noaa.gov/argo/" target="_blank" rel="noreferrer noopener">
              NOAA Argo programme <span aria-hidden="true">↗</span>
            </a>
            <a href="https://globalocean.noaa.gov/research/argo-program/" target="_blank" rel="noreferrer noopener">
              NOAA Global Ocean Monitoring and Observing programme <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      )
    }
  ];

  return (
    <section className="section home-bento" id="capabilities" aria-labelledby="capabilities-title">
      <div className="container">
        <Reveal>
          <p className="eyebrow">Capabilities · Fleet right now</p>
          <h2 className="section__title" id="capabilities-title">
            Everything the console does, without the console.
          </h2>
        </Reveal>
        <Reveal variant="up" delay={120}>
          <MagicBento
            items={items}
            className="discover"
            columns={4}
            rowHeight={264}
            gap={16}
            radius={20}
            theme="dark"
            glowColor="#c1ff00"
            enableBorderGlow
            enableSpotlight
            spotlightRadius={300}
            enableStars
            particleCount={20}
            clickEffect
            textAutoHide={false}
          />
        </Reveal>
      </div>
    </section>
  );
}
