import { useEffect, useState } from 'react';
import { api } from '../api';
import { Link } from '../router';
import './MiroFishScenario.css';

export default function MiroFishScenario() {
  const [status, setStatus] = useState({ loading: true });
  const [requirement, setRequirement] = useState('Explore how changing ocean conditions could affect fishing activity in the selected Argo region.');
  const [region, setRegion] = useState('');
  const [state, setState] = useState({ busy: false, error: '', result: null });

  useEffect(() => {
    let active = true;
    api.mirofishStatus()
      .then((next) => active && setStatus(next))
      .catch(() => active && setStatus({ configured: false, available: false, message: 'MiroFish status is unavailable.' }));
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setState({ busy: true, error: '', result: null });
    try {
      const result = await api.mirofishSeed({ requirement, region: region || undefined });
      setState({ busy: false, error: '', result });
    } catch (error) {
      setState({ busy: false, error: error.message || 'MiroFish could not be reached.', result: null });
    }
  };

  return (
    <section className="mirofish-scenario section" aria-labelledby="mirofish-title">
      <div className="container">
        <div className="mirofish-scenario__shell">
          <div className="mirofish-scenario__intro">
            <p className="eyebrow">MiroFish · Argo scenario lab</p>
            <h2 id="mirofish-title">Rehearse a possible ocean future.</h2>
            <p>
              Seed a MiroFish multi-agent simulation with FloatChat&apos;s attributed Argo snapshot.
              Simulation output is exploratory and never replaces observations, forecasts, or official safety warnings.
            </p>
            <div className={`mirofish-scenario__status ${status.available ? 'is-ready' : ''}`} role="status">
              <span aria-hidden="true" />
              {status.loading ? 'Checking MiroFish bridge…' : status.message}
            </div>
            {!status.configured && (
              <p className="mirofish-scenario__hint">
                The bridge is optional. Browse the <a href="https://github.com/666ghj/MiroFish" target="_blank" rel="noreferrer noopener">MiroFish source ↗</a> or configure its API service to enable seeding.
              </p>
            )}
          </div>
          <form className="mirofish-scenario__form" onSubmit={submit}>
            <label htmlFor="mirofish-requirement">Scenario requirement</label>
            <textarea id="mirofish-requirement" value={requirement} onChange={(event) => setRequirement(event.target.value)} maxLength={1200} rows={5} />
            <label htmlFor="mirofish-region">Argo region <span>(optional)</span></label>
            <input id="mirofish-region" value={region} onChange={(event) => setRegion(event.target.value)} placeholder="e.g. Arabian Sea" maxLength={80} />
            <button type="submit" disabled={status.loading || !status.available || state.busy || !requirement.trim()}>
              {state.busy ? 'Seeding MiroFish…' : 'Seed Argo scenario'} <span aria-hidden="true">→</span>
            </button>
            {state.error && <p className="mirofish-scenario__error" role="alert">{state.error}</p>}
            {state.result && (
              <p className="mirofish-scenario__success" role="status">
                Scenario seeded successfully. {state.result.project_url ? <a href={state.result.project_url} target="_blank" rel="noreferrer noopener">Open MiroFish project ↗</a> : 'Continue in the configured MiroFish workspace.'}
              </p>
            )}
          </form>
        </div>
        <p className="mirofish-scenario__provenance">Evidence source: <Link to="/docs#provenance">FloatChat provenance notes</Link> · engine: MiroFish / AGPL-3.0</p>
      </div>
    </section>
  );
}
