import { useEffect, useState } from 'react';
import ParticleText from '../components/ParticleText';
import RippleDistortion from '../components/RippleDistortion';
import MagicBento from '../components/MagicBento';
import Reveal from '../components/Reveal';
import { Link } from '../router';
import { CONSOLE_PATH } from '../routes';
import { api } from '../api';
import { useMediaQuery } from '../hooks';
import './Home.css';

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
          <Reveal variant="fade">
            <p className="eyebrow home-hero__eyebrow">Argo · Indian Ocean · Live</p>
          </Reveal>

          <Reveal variant="zoom" delay={80}>
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
                fontSize={isNarrow ? 'clamp(2.6rem, 15vw, 4.5rem)' : 'clamp(3.5rem, 12vw, 8.5rem)'}
                fontWeight={800}
                glow
              />
            </div>
          </Reveal>

          <Reveal variant="up" delay={160}>
            <p className="home-hero__headline">Ask the ocean a question.</p>
            <p className="home-hero__sub">
              Plain-language answers over live Argo float data, with citations on every claim.
              Move your cursor — the water ripples, the letters breathe.
            </p>
          </Reveal>

          <Reveal variant="up" delay={240}>
            <div className="home-hero__actions">
              <Link to={CONSOLE_PATH} className="btn btn--primary btn--lg">
                Launch console <span aria-hidden="true">→</span>
              </Link>
              <Link to="/data" className="btn btn--ghost-light">
                Explore live data
              </Link>
            </div>
          </Reveal>

          <Reveal variant="fade" delay={320}>
            <p className="home-hero__hint">Hover the wordmark to scatter it · move anywhere to ripple the water</p>
          </Reveal>
        </div>

        <button
          type="button"
          className="home-hero__scroll"
          aria-label="Scroll to capabilities"
          onClick={() => document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span aria-hidden="true" />
        </button>
      </section>

      <BentoShowcase />

      <section className="section section--dark home-provenance" aria-labelledby="provenance-title">
        <div className="container home-provenance__inner">
          <Reveal variant="right">
            <div>
              <p className="eyebrow home-provenance__eyebrow">Provenance</p>
              <h2 className="section__title" id="provenance-title">
                Every number traces back to its source.
              </h2>
            </div>
          </Reveal>
          <Reveal variant="left" delay={120}>
            <p className="home-provenance__body">
              Positions, temperatures and salinities come from the Argo GDAC via Ifremer ERDDAP.
              The interface reports the source and the fetch time alongside each answer, so an
              offline estimate can never be mistaken for a live reading.
            </p>
          </Reveal>
        </div>
      </section>
    </>
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
      visual: 'automation',
      colSpan: 2
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
      visual: 'collaboration',
      colSpan: 2
    },
    {
      label: 'Console',
      title: 'Open the console',
      description: 'Full globe, depth sweep, trajectories and the anomaly strip.',
      visual: 'integration',
      href: CONSOLE_PATH
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
            columns={4}
            rowHeight={250}
            gap={12}
            radius={20}
            theme="light"
            glowColor="#1A2FFB"
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
