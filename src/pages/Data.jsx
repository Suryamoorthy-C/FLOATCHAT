import { useEffect, useState } from 'react';
import { api, normaliseFloat } from '../api';
import { Link } from '../router';
import { CONSOLE_PATH } from '../routes';
import './Page.css';

const FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'warning', label: 'Warning' },
  { value: 'offline', label: 'Offline' },
];

const INITIAL = {
  phase: 'loading',
  floats: [],
  anomalies: [],
  stats: null,
  source: null,
  live: false,
  fetchedAt: null,
  windowDays: null,
};

const num = (value, digits) =>
  value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(digits);

const position = float =>
  `${Math.abs(float.lat).toFixed(1)}°${float.lat >= 0 ? 'N' : 'S'} ${Math.abs(float.lng).toFixed(1)}°${
    float.lng >= 0 ? 'E' : 'W'
  }`;

/**
 * Live data.
 *
 * Reads the same endpoints the console does, so this page is a real view of the
 * backend rather than a static mock. Every state is handled explicitly:
 * loading, error, empty and ready.
 */
export default function Data() {
  const [status, setStatus] = useState('all');
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    let cancelled = false;
    setState(prev => ({ ...prev, phase: 'loading' }));

    Promise.all([
      // Only force a backend refresh when the user explicitly asks for one.
      api.floats({
        ...(status === 'all' ? {} : { status }),
        ...(nonce ? { refresh: true } : {}),
      }),
      api.anomalies(),
      api.stats(),
    ])
      .then(([fleet, anomalyRes, stats]) => {
        if (cancelled) return;
        const ids = new Set((anomalyRes?.data || []).map(item => String(item.float_id)));
        const floats = (fleet?.data || []).map(row => normaliseFloat(row, ids));

        setState({
          phase: floats.length ? 'ready' : 'empty',
          floats,
          anomalies: anomalyRes?.data || [],
          stats: stats ?? null,
          source: fleet?.source ?? null,
          live: Boolean(fleet?.live),
          fetchedAt: fleet?.fetched_at ?? null,
          windowDays: fleet?.window_days ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setState(prev => ({ ...prev, phase: 'error' }));
      });

    return () => {
      cancelled = true;
    };
  }, [status, nonce]);

  const loading = state.phase === 'loading';

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Live data</p>
          <h1 className="page-head__title">The fleet, as the current window reports it.</h1>
          <p className="page-head__lede">
            Positions, temperatures and salinities are read straight from the Argo GDAC window.
            Filter by status, or open the console for the full globe view.
          </p>
          <p className="page-head__meta">
            <span>Source · {state.source ?? 'unknown'}</span>
            <span>Window · {state.windowDays == null ? '—' : `${state.windowDays} days`}</span>
            <span>Fetched · {state.fetchedAt ? String(state.fetchedAt).slice(0, 19) : '—'}Z</span>
            <span>Mode · {state.live ? 'live' : 'cached'}</span>
          </p>
        </header>
      </div>

      <section className="section" aria-labelledby="fleet-title">
        <div className="container">
          <p className="eyebrow">Fleet</p>
          <h2 className="section__title" id="fleet-title">
            Floats in the window.
          </h2>

          <div className="data-toolbar">
            <div className="filter-set" role="group" aria-label="Filter floats by status">
              {FILTERS.map(filter => (
                <button
                  key={filter.value}
                  type="button"
                  className="filter-chip"
                  aria-pressed={status === filter.value}
                  disabled={loading}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={loading ? 'btn btn--loading' : 'btn'}
              disabled={loading}
              onClick={() => setNonce(value => value + 1)}
            >
              {loading && <span className="btn__spinner" aria-hidden="true" />}
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          {loading && (
            <p className="empty" aria-busy="true" aria-live="polite">
              Loading live float telemetry…
            </p>
          )}

          {state.phase === 'error' && (
            <p className="notice notice--error" role="alert">
              Live telemetry is unavailable. The backend may be offline — the console will keep
              running against its cached fleet view.
            </p>
          )}

          {state.phase === 'empty' && (
            <p className="empty">
              No floats match this filter in the current window. Try a different status.
            </p>
          )}

          {state.phase === 'ready' && (
            <div className="table-wrap">
              <table className="data-table">
                <caption>
                  {state.floats.length} floats · {state.source ?? 'unknown source'}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Platform</th>
                    <th scope="col">Region</th>
                    <th scope="col">Status</th>
                    <th scope="col">Cycle</th>
                    <th scope="col">Temperature</th>
                    <th scope="col">Salinity</th>
                    <th scope="col">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {state.floats.map(float => (
                    <tr key={float.id}>
                      <th scope="row">
                        {float.id}
                        {float.anomaly && <span className="status status--warning">outlier</span>}
                      </th>
                      <td>{float.region}</td>
                      <td>
                        <span className={`status status--${float.status}`}>{float.status}</span>
                      </td>
                      <td>{float.cycle ?? '—'}</td>
                      <td>{num(float.temp, 2)} °C</td>
                      <td>{num(float.sal, 3)} PSU</td>
                      <td>{position(float)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="section section--tight" id="anomalies" aria-labelledby="anomalies-title">
        <div className="container">
          <p className="eyebrow">Anomalies</p>
          <h2 className="section__title" id="anomalies-title">
            Signals beyond two standard deviations.
          </h2>

          {loading && <p className="empty">Scanning the window…</p>}

          {!loading && state.anomalies.length === 0 && (
            <p className="empty">No outliers in the current window.</p>
          )}

          {!loading && state.anomalies.length > 0 && (
            <ul className="spec-list">
              {state.anomalies.map((anomaly, index) => (
                <li className="spec" key={`${anomaly.float_id}-${index}`}>
                  <p className="spec__index">{anomaly.severity ?? 'moderate'}</p>
                  <h3 className="spec__title">{anomaly.title ?? 'Untitled signal'}</h3>
                  <p className="spec__body">
                    Platform {anomaly.float_id} · value {num(anomaly.value, 2)}
                    {anomaly.region ? ` · ${anomaly.region}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="actions">
            <Link to={CONSOLE_PATH} className="btn btn--primary">
              Open the console
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
