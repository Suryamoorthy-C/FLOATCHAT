import { useEffect, useState } from 'react';
import PixelSwap from '../components/PixelSwap';
import { Link } from '../router';
import { CONSOLE_PATH } from '../routes';
import { api } from '../api';
import { useMediaQuery } from '../hooks';
import './Home.css';

const CAPABILITIES = [
  {
    title: 'Ask in plain language',
    body: 'Type a question the way you would ask a colleague. FloatChat resolves it onto salinity, temperature, pressure, region and depth.',
  },
  {
    title: 'Live float telemetry',
    body: 'Every point on the globe is a real Argo float position, served from the Argo GDAC window rather than a fixture.',
  },
  {
    title: 'Profiles and anomalies',
    body: 'Pull a full 0–2,000 m temperature and salinity profile for any float, and surface the outliers automatically.',
  },
  {
    title: 'Answers you can check',
    body: 'Each response carries its citations, its source and the time it was fetched, so a number is never a dead end.',
  },
];

/**
 * Home — the first page.
 *
 * The hero is a React Bits PixelSwap: a pixel grid closes over the wordmark and
 * reveals the proposition. It is driven with trigger="click", which gives the
 * whole stage one large pointer and keyboard target. Its content is therefore
 * display-only: the component puts role="button" on its wrapper, and the design
 * system forbids nesting interactive elements inside a button.
 */
export default function Home() {
  // The stage is wide and short on desktop, tall on a phone, so the revealed
  // copy never gets clipped.
  const isNarrow = useMediaQuery('(max-width: 860px)');
  const [revealed, setRevealed] = useState(false);

  return (
    <>
      {/* The real document heading. The hero type is presentational, so it must
          not be the only h1, and it must not be hidden behind the reveal. */}
      <h1 className="u-visually-hidden">
        FLOATCHAT — ocean intelligence for the Argo fleet
      </h1>

      <section className="home-hero" aria-labelledby="home-hero-hint">
        <div className="container home-hero__inner">
          <PixelSwap
            className="home-hero__swap"
            aspectRatio={isNarrow ? '4 / 5' : '16 / 9'}
            pixelSize={64}
            gap={0}
            pixelRadius={0}
            pixelSpin={0}
            pixelScale={0.35}
            duration={1400}
            pixelDuration={450}
            pattern="diagonal"
            randomness={0.35}
            fade
            trigger="click"
            onActiveChange={setRevealed}
            firstContent={
              <div className="swap-state swap-state--cover">
                <p className="eyebrow swap-state__eyebrow">Argo · Indian Ocean</p>
                <p className="swap-state__wordmark">FLOATCHAT</p>
                <p className="swap-state__hint" id="home-hero-hint">
                  {revealed ? 'Click to bring the wordmark back' : 'Click to reveal the fleet'}
                </p>
              </div>
            }
            secondContent={
              <div className="swap-state swap-state--reveal">
                <p className="eyebrow swap-state__eyebrow">Live Argo telemetry</p>
                <p className="swap-state__headline">Ask the ocean a question.</p>
                <p className="swap-state__sub">
                  Plain-language answers over live float data, with citations on every claim.
                </p>
              </div>
            }
          />

          {/* Kept outside the swap stage: interactive controls must never sit
              inside the pixel grid's button role. */}
          <div className="home-hero__actions">
            <Link to={CONSOLE_PATH} className="btn btn--primary">
              Launch console
            </Link>
            <Link to="/data" className="btn">
              Explore live data
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="capabilities-title">
        <div className="container">
          <p className="eyebrow">Capabilities</p>
          <h2 className="section__title" id="capabilities-title">
            Everything the console does, without the console.
          </h2>
          <ul className="capability-grid">
            {CAPABILITIES.map(item => (
              <li className="card capability" key={item.title}>
                <h3 className="card__title">{item.title}</h3>
                <p className="card__body">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LiveStats />

      <section className="section section--dark home-provenance" aria-labelledby="provenance-title">
        <div className="container home-provenance__inner">
          <div>
            <p className="eyebrow home-provenance__eyebrow">Provenance</p>
            <h2 className="section__title" id="provenance-title">
              Every number traces back to its source.
            </h2>
          </div>
          <p className="home-provenance__body">
            Positions, temperatures and salinities come from the Argo GDAC via Ifremer ERDDAP.
            The interface reports the source and the fetch time alongside each answer, so an
            offline estimate can never be mistaken for a live reading.
          </p>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function LiveStats() {
  const [state, setState] = useState({ status: 'loading', stats: null, health: null });

  useEffect(() => {
    let cancelled = false;

    // Functional updates: the two requests race, and either may land first.
    api
      .stats()
      .then(stats => (cancelled ? null : setState(prev => ({ ...prev, status: 'ready', stats }))))
      .catch(() => (cancelled ? null : setState(prev => ({ ...prev, status: 'error' }))));

    api
      .health()
      .then(health => (cancelled ? null : setState(prev => ({ ...prev, health }))))
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const { status, stats } = state;

  const cells = [
    { label: 'Active floats', value: stats?.active_floats },
    { label: 'Anomalies in window', value: stats?.anomalies },
    {
      label: 'Coverage',
      value: stats?.coverage_percent == null ? null : `${stats.coverage_percent}%`,
    },
    { label: 'Window', value: stats?.window_days == null ? null : `${stats.window_days} days` },
  ];

  return (
    <section className="section section--tight" aria-labelledby="fleet-title">
      <div className="container">
        <p className="eyebrow">Fleet right now</p>
        <h2 className="section__title" id="fleet-title">
          Read from the live window.
        </h2>

        {status === 'loading' && (
          <div className="stat-grid" aria-busy="true" aria-live="polite">
            {cells.map(cell => (
              <div className="stat stat--loading" key={cell.label}>
                <p className="stat__label">{cell.label}</p>
                <p className="stat__value">—</p>
              </div>
            ))}
            <p className="u-visually-hidden">Loading live fleet statistics…</p>
          </div>
        )}

        {status === 'error' && (
          <p className="notice notice--error" role="status">
            Live statistics are unavailable right now. The console still runs against its cached
            fleet view.
          </p>
        )}

        {status === 'ready' && (
          <div className="stat-grid">
            {cells.map(cell => (
              <div className="stat" key={cell.label}>
                <p className="stat__label">{cell.label}</p>
                <p className="stat__value">{cell.value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
