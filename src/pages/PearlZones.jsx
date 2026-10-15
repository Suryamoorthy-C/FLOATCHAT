import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api, normaliseFloat } from '../api';
import { WORLDWIDE_ARGO_FALLBACK } from '../data/argoFallback';
import './PearlZones.css';

const Globe3D = lazy(() => import('../components/Globe3D'));

const DEMO_SAMPLES = {
  z1: {
    device_id: 'AF-07', species: 'pinctada_maxima', observed_at: new Date().toISOString(),
    lat: -8.05, lon: 115.34, water_temp_c: 31.2, depth_m: 17.4, salinity_psu: 34.1,
    dissolved_oxygen_mg_l: 4.9, ph: 8.12, turbidity_ntu: 3.8, chlorophyll_a_ug_l: 1.1,
  },
  z2: {
    device_id: 'AF-12', species: 'pinctada_maxima', observed_at: new Date().toISOString(),
    lat: -8.08, lon: 115.41, water_temp_c: 29.0, depth_m: 18.0, salinity_psu: 33.5,
    dissolved_oxygen_mg_l: 5.2, ph: 7.9, turbidity_ntu: 8.0, chlorophyll_a_ug_l: 0.2,
  },
  z3: {
    device_id: 'AF-19', species: 'pinctada_maxima', observed_at: new Date().toISOString(),
    lat: -8.12, lon: 115.29, water_temp_c: 25.0, depth_m: 28.0, salinity_psu: 30.0,
    dissolved_oxygen_mg_l: 4.6, ph: 7.6, turbidity_ntu: 14.0, chlorophyll_a_ug_l: 0.1,
  },
  z4: {
    device_id: 'AF-03', species: 'pinctada_maxima', observed_at: new Date().toISOString(),
    lat: -8.03, lon: 115.21, water_temp_c: 28.2, depth_m: 16.0, salinity_psu: 34.2,
    dissolved_oxygen_mg_l: 7.0, ph: 8.2, turbidity_ntu: 2.8, chlorophyll_a_ug_l: 1.4,
  },
};

const ZONES = [
  { id: 'z1', name: 'North shelf' },
  { id: 'z2', name: 'East channel' },
  { id: 'z3', name: 'South pocket' },
  { id: 'z4', name: 'West ridge' },
];

const INITIAL_METRICS = [
  { key: 'water_temp_c', name: 'Temperature', value: '31.2', unit: '°C', target: '26–30', tone: 'amber', bars: 'M0 20 L18 18 L36 16 L54 18 L72 10 L90 12 L108 7' },
  { key: 'salinity_psu', name: 'Salinity', value: '34.1', unit: 'PSU', target: '32–35', tone: 'aqua', bars: 'M0 15 L18 14 L36 16 L54 12 L72 12 L90 10 L108 11' },
  { key: 'dissolved_oxygen_mg_l', name: 'Dissolved oxygen', value: '4.9', unit: 'mg/L', target: '≥ 6.0', tone: 'red', bars: 'M0 7 L18 8 L36 10 L54 13 L72 12 L90 17 L108 19' },
  { key: 'ph', name: 'pH', value: '8.12', unit: 'pH', target: '7.8–8.6', tone: 'aqua', bars: 'M0 13 L18 12 L36 14 L54 10 L72 12 L90 9 L108 11' },
  { key: 'turbidity_ntu', name: 'Turbidity', value: '3.8', unit: 'NTU', target: '≤ 5*', tone: 'aqua', bars: 'M0 12 L18 14 L36 10 L54 13 L72 11 L90 12 L108 9' },
  { key: 'chlorophyll_a_ug_l', name: 'Chlorophyll-a', value: '1.1', unit: 'µg/L', target: '0.25–5*', tone: 'aqua', bars: 'M0 17 L18 13 L36 14 L54 11 L72 10 L90 13 L108 8' },
];

const LAYERS = [
  { key: 'suitability', label: 'Suitability' },
  { key: 'depth', label: 'Graticule' },
  { key: 'floats', label: 'Worldwide Argo floats' },
];

const GLOBAL_MARKER_LIMIT = 1600;

function formatAge(timestamp) {
  const age = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  return age < 1 ? 'just now' : `${age} min ago`;
}

export default function PearlZones() {
  const globeHostRef = useRef(null);
  const [species, setSpecies] = useState('pinctada_maxima');
  const [selectedZone, setSelectedZone] = useState(ZONES[0]);
  const [layers, setLayers] = useState({ suitability: true, depth: true, floats: true });
  const [globeKey, setGlobeKey] = useState(0);
  const [globeReady, setGlobeReady] = useState(false);
  const [result, setResult] = useState(null);
  const [thresholds, setThresholds] = useState(null);
  const [dataMode, setDataMode] = useState('DEMO');
  const [busy, setBusy] = useState(true);
  const [argoFloats, setArgoFloats] = useState(() => WORLDWIDE_ARGO_FALLBACK.map((row) => normaliseFloat(row)));
  const [argoFeed, setArgoFeed] = useState({ live: false, source: 'Worldwide Argo fallback', fetchedAt: null });

  useEffect(() => {
    const host = globeHostRef.current;
    if (!host || globeReady) return undefined;
    if (!('IntersectionObserver' in window)) {
      setGlobeReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setGlobeReady(true);
      observer.disconnect();
    }, { rootMargin: '400px 0px' });
    observer.observe(host);
    return () => observer.disconnect();
  }, [globeReady]);

  const selectedSample = { ...DEMO_SAMPLES[selectedZone.id], species };
  const activeResult = result?.device_id === selectedSample.device_id && result?.species_profile === species ? result : null;
  const argoMarkers = useMemo(() => argoFloats.slice(0, GLOBAL_MARKER_LIMIT), [argoFloats]);
  const pearlMarkers = useMemo(() => ZONES.map((zone) => {
    const sample = DEMO_SAMPLES[zone.id];
    return {
      id: sample.device_id,
      zoneId: zone.id,
      lat: sample.lat,
      lng: sample.lon,
    status: 'insufficient-data',
    region: `${zone.name} · illustrative record`,
      temp: sample.water_temp_c,
      sal: sample.salinity_psu,
      anomaly: sample.dissolved_oxygen_mg_l < 5 || sample.turbidity_ntu > 10,
    };
  }), []);

  useEffect(() => {
    let active = true;
    api.floats({ live: true }, { timeout: 15000 })
      .then((response) => {
        if (!active) return;
        const rows = response?.data?.length ? response.data : WORLDWIDE_ARGO_FALLBACK;
        setArgoFloats(rows.map((row) => normaliseFloat(row)));
        setArgoFeed({
          live: Boolean(response?.live && response?.data?.length),
          source: response?.source || 'Worldwide Argo fallback',
          fetchedAt: response?.fetched_at || null,
        });
      })
      .catch(() => {
        if (!active) return;
        setArgoFloats(WORLDWIDE_ARGO_FALLBACK.map((row) => normaliseFloat(row)));
        setArgoFeed({ live: false, source: 'Worldwide Argo fallback', fetchedAt: null });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setThresholds(null);
    api.pearlThresholds(species, { timeout: 5000 })
      .then((profile) => active && setThresholds(profile))
      .catch(() => active && setThresholds(null));
    return () => { active = false; };
  }, [species]);

  useEffect(() => {
    let active = true;
    setBusy(true);
    const sample = { ...DEMO_SAMPLES[selectedZone.id], species };
    api.pearlIndex(sample, { timeout: 5000 })
      .then((score) => {
        if (!active) return;
        setResult(score);
        setDataMode('API DEMO SAMPLE');
      })
      .catch(() => {
        if (!active) return;
        setResult(null);
        setDataMode('LOCAL DEMO');
      })
      .finally(() => active && setBusy(false));
    return () => { active = false; };
  }, [species, selectedZone.id]);

  const displayScore = activeResult?.index ?? null;
  const displayClass = activeResult?.zone_class ?? 'insufficient-data';
  const metrics = INITIAL_METRICS.map((metric) => {
    const scored = activeResult?.parameter_scores?.[metric.key];
    const raw = selectedSample[metric.key];
    const profileMetric = thresholds?.metrics?.[metric.key];
    const band = profileMetric?.ideal;
    const fallbackTarget = species === 'pinctada_fucata' && metric.key === 'water_temp_c' ? '24–26' : species === 'pinctada_fucata' && metric.key === 'salinity_psu' ? '27–29' : metric.target;
    const target = band ? (band[1] == null ? `≥ ${band[0]}` : `${band[0]}–${band[1]}`) : fallbackTarget;
    return {
      ...metric, target, provisional: profileMetric?.provisional ?? metric.target.includes('*'),
      value: scored ? Number(scored.value).toFixed(metric.key === 'ph' ? 2 : 1) : String(raw),
      unit: scored?.unit || metric.unit,
      tone: scored?.state === 'ideal' ? 'aqua' : metric.tone,
    };
  });
  const alerts = activeResult ? activeResult.warnings.filter((warning) => warning.severity === 'critical' || warning.severity === 'warning') : [];

  function toggleLayer(key) {
    setLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="page pearl-page" id="pearl-zones">
      <div className="pearl-shell">
        <header className="pearl-topline">
          <div>
            <p className="pearl-eyebrow">ARGO / OCEAN INTELLIGENCE</p>
            <h1>Pearl zone analytics</h1>
            <p className="pearl-subtitle">A sensor-led suitability screen for pearl-oyster cultivation areas.</p>
          </div>
          <div className="pearl-top-actions">
            <label className="pearl-select-label" htmlFor="species-select">Species profile</label>
            <select id="species-select" value={species} onChange={(event) => setSpecies(event.target.value)}>
              <option value="pinctada_maxima">Pinctada maxima</option>
              <option value="pinctada_fucata">Pinctada fucata · controlled study</option>
            </select>
            <span className="pearl-demo-pill"><i />{argoFeed.live ? 'LIVE WORLDWIDE ARGO' : dataMode}</span>
          </div>
        </header>

        <div className="pearl-notice" role="note">
          <span className="pearl-notice-mark">i</span>
          <span><strong>Data boundary:</strong> worldwide Argo markers use the latest available global fleet window; the four local zone records remain illustrative samples, not live farm observations or navigation data. PPI is an environmental screen, not measured suitability or predicted pearl yield.</span>
        </div>

        <section className="pearl-kpis" aria-label="Area overview">
          <article className="pearl-kpi pearl-kpi--index">
            <span className="pearl-kpi-label">SELECTED ZONE PPI</span>
            <strong>{busy ? '···' : displayScore == null ? '—' : Math.round(displayScore)}</strong>
            <span className="pearl-kpi-foot"><i className={`zone-dot ${displayClass}`} />{displayClass.replaceAll('-', ' ')}</span>
          </article>
          <article className="pearl-kpi"><span className="pearl-kpi-label">CULTURE DEPTH GUIDE</span><strong>≈15 <small>m</small></strong><span className="pearl-kpi-foot">FAO starting point · local bathymetry required</span></article>
          <article className="pearl-kpi"><span className="pearl-kpi-label">REGIONAL HABITAT SIGNAL</span><strong>&lt;40 <small>m</small></strong><span className="pearl-kpi-foot">91.8% of observations in one WA study</span></article>
          <article className="pearl-kpi pearl-kpi--alert"><span className="pearl-kpi-label">SCREENING FLAGS</span><strong>{alerts.length.toString().padStart(2, '0')}</strong><span className="pearl-kpi-foot">Illustrative sample · not field alerts</span></article>
        </section>

        <section className="pearl-workspace">
          <div className="pearl-map-panel">
            <div className="pearl-panel-head">
              <div><span className="pearl-panel-kicker">3D GLOBE / WORLDWIDE ARGO + LOCAL SCREEN</span><h2>Environmental suitability</h2></div>
              <button className="pearl-map-reset" type="button" onClick={() => { setSelectedZone(ZONES[0]); setGlobeKey((key) => key + 1); }}>Reset view</button>
            </div>
            <div className="pearl-map pearl-globe-stage" ref={globeHostRef}>
              {globeReady ? (
                <Suspense fallback={<div className="globe-loading">INITIALIZING PEARL GLOBE…</div>}>
                  <Globe3D
                    key={globeKey}
                    markers={layers.floats ? [...argoMarkers, ...pearlMarkers] : []}
                    mode={layers.suitability ? 'suitability' : 'telemetry'}
                    rotating
                    rotationSpeed={0.00012}
                    showGraticules={layers.depth}
                    centerLongitude={117}
                    screenSpaceLabels
                    pixelRatio={2}
                    selectedId={selectedSample.device_id}
                    onMarkerClick={(marker) => {
                      const zone = ZONES.find((item) => item.id === marker.zoneId);
                      if (zone) setSelectedZone(zone);
                    }}
                  />
                </Suspense>
              ) : (
                <div className="globe-loading" aria-busy="true">INITIALIZING PEARL GLOBE…</div>
              )}
              <div className="pearl-globe-caption">DRAG TO ROTATE · SCROLL TO ZOOM · {argoFeed.live ? 'LIVE WORLDWIDE ARGO' : 'WORLDWIDE FALLBACK'} · NOT FOR NAVIGATION</div>
            </div>
            <div className="pearl-layer-row" aria-label="Map layers">
              {LAYERS.map((layer) => <button key={layer.key} type="button" className={layers[layer.key] ? 'active' : ''} aria-pressed={layers[layer.key]} onClick={() => toggleLayer(layer.key)}><i className={`layer-icon layer-icon--${layer.key}`} />{layer.label}</button>)}
              <div className="pearl-map-time">{argoFeed.live ? `ARGO updated ${formatAge(argoFeed.fetchedAt)}` : 'ARGO fallback markers'} · {argoMarkers.length} floats</div>
            </div>
            <div className="pearl-zone-pills" aria-label="Select a zone">
              {ZONES.map((zone) => <button key={zone.id} className={selectedZone.id === zone.id ? 'selected' : ''} type="button" onClick={() => setSelectedZone(zone)}><span className="zone-dot" />{zone.name}<b>—</b></button>)}
            </div>
          </div>

          <aside className="pearl-side-panel" aria-label="Selected zone details">
            <div className="pearl-panel-head pearl-side-head"><div><span className="pearl-panel-kicker">ZONE {selectedZone.id.toUpperCase()} / SELECTED</span><h2>{selectedZone.name}</h2></div><span className="pearl-health-tag"><i />DEMO</span></div>
            <div className="pearl-score-card">
              <div className="pearl-score-ring" style={{ '--score': `${displayScore ?? 0}%` }}><div><strong>{displayScore == null ? '—' : Math.round(displayScore)}</strong><span>PPI</span></div></div>
              <div><span className={`pearl-class-label ${displayClass}`}>{displayClass.replaceAll('-', ' ')}</span><p>Environmental suitability screen</p><small>Data coverage {activeResult?.coverage_percent ?? 'demo'} · not model accuracy</small></div>
            </div>
            <div className="pearl-section-label">SENSOR SNAPSHOT <span>{dataMode}</span></div>
            <div className="pearl-metric-list">
              {metrics.map((metric) => <article className="pearl-metric" key={metric.key}>
                <div className="pearl-metric-top"><span>{metric.name}</span><span className="pearl-target">IDEAL {metric.target}{metric.provisional ? ' · PROVISIONAL' : ''}</span></div>
                <div className="pearl-metric-bottom"><strong className={`metric-${metric.tone}`}>{metric.value}<small> {metric.unit}</small></strong><svg viewBox="0 0 108 25" aria-hidden="true"><path d={metric.bars} /></svg></div>
              </article>)}
            </div>
            <div className="pearl-confidence-note">* Turbidity and chlorophyll bands are provisional. Calibrate with local water clarity, suspended solids, and food-species data.</div>
          </aside>
        </section>

        <section className="pearl-bottom-grid">
          <div className="pearl-lower-card">
            <div className="pearl-panel-head"><div><span className="pearl-panel-kicker">DECISION SUPPORT</span><h2>What is shaping this screen</h2></div><span className="pearl-count-pill">{alerts.length} flags</span></div>
            <div className="pearl-alert-list">
              {alerts.slice(0, 3).map((alert, index) => <article className={`pearl-alert pearl-alert--${alert.severity}`} key={alert.code || `${alert.metric}-${index}`}><span className="pearl-alert-symbol">{alert.severity === 'critical' ? '!' : '↗'}</span><div><strong>{alert.metric === 'dissolved_oxygen_mg_l' ? 'Oxygen watch' : alert.metric === 'water_temp_c' ? 'Temperature outside target' : alert.metric || 'Parameter warning'}</strong><p>{alert.message}</p></div><span className="pearl-alert-state">{alert.severity}</span></article>)}
            </div>
          </div>
          <div className="pearl-lower-card pearl-method-card">
            <div className="pearl-panel-head"><div><span className="pearl-panel-kicker">MODEL PROVENANCE</span><h2>How this is screened</h2></div><span className="pearl-version">PPI 0.1.0</span></div>
            <p>Weighted, per-parameter screening bands with QC/outlier exclusion. Missing metrics reduce coverage; they are never filled with zero.</p>
            <p>{thresholds?.profile_note || (species === 'pinctada_fucata' ? 'Controlled-study response-surface center; not a field suitability map or yield model.' : 'Indo-Pacific tropical screening defaults informed by FAO guidance and a Western Australia habitat study; not a locally validated yield model.')}</p>
            <div className="pearl-research-context">
              <strong>Research context</strong>
              <p>FAO guidance describes sheltered sites, clear water, sufficient current exchange, and about 15 m as a starting culture depth—not a universal optimum. [1]</p>
              <p>An AIMS-linked Western Australia survey found <i>P. maxima</i> from 28–76 m, with 91.8% of observations shallower than 40 m and strong association with flat habitat. [2]</p>
              <p>Core Argo measures temperature, salinity, and pressure to about 2,000 m; oxygen, pH, and chlorophyll require BGC sensors, so nearshore farm decisions still need local monitoring. [3]</p>
              <span><a href="https://www.fao.org/4/ab726e/AB726E06.htm" target="_blank" rel="noreferrer">[1] FAO farm guidance</a><a href="https://doi.org/10.3389/fmars.2021.679749" target="_blank" rel="noreferrer">[2] AIMS-linked habitat study</a><a href="https://www.aoml.noaa.gov/argo/" target="_blank" rel="noreferrer">[3] NOAA Argo scope</a></span>
            </div>
            <div className="pearl-method-footer"><span>PROFILE <b>{species.replaceAll('_', ' ')}</b></span><span>MODEL <b>{activeResult?.model_version || 'ppi-0.1.0'}</b></span></div>
            <details className="pearl-evidence-details">
              <summary>Threshold evidence and source links</summary>
              {thresholds ? Object.entries(thresholds.metrics).map(([key, item]) => <div className="pearl-evidence-item" key={key}>
                <strong>{item.label} · {item.evidence_quality} evidence</strong>
                <p>{item.rationale}{item.provisional ? ' Provisional band; local calibration required.' : ''}</p>
                <span>{(item.source_refs || []).map((ref) => {
                  const source = thresholds.sources?.find((entry) => entry.id === ref);
                  return source ? <a key={ref} href={source.url} target="_blank" rel="noreferrer">[{ref}] {source.title}</a> : null;
                })}</span>
              </div>) : <p>Source-linked threshold details appear when the threshold endpoint is reachable.</p>}
            </details>
            <p className="pearl-method-disclaimer">Research-derived starter thresholds. Validate against local farm survival, growth, and nacre outcomes before operational decisions.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
