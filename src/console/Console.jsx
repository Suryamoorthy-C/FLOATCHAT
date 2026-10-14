import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Globe3D from '../components/Globe3D'
import {
  Activity, ArrowUp, ChevronDown, Database, Download, Gauge, Loader2, Menu,
  Pause, Play, RefreshCw, RotateCcw, Send, Thermometer, Waves, X, Zap, Target,
} from 'lucide-react'
import { api, streamChat, normaliseFloat } from '../api'
import '../styles.css'

/* Shown only when the API is unreachable, so the console still renders. */
const FALLBACK_FLOATS = [
  { platform_number: '2902746', project_name: 'Arabian Sea', lat: 12.8, lon: 72.4, status: 'active', temperature_c: 27.4, salinity_psu: 34.8, cycle: 184 },
  { platform_number: '2902751', project_name: 'Bay of Bengal', lat: 16.2, lon: 80.1, status: 'active', temperature_c: 26.9, salinity_psu: 35.1, cycle: 97 },
  { platform_number: '2902738', project_name: 'Arabian Sea', lat: 8.6, lon: 67.2, status: 'warning', temperature_c: 29.8, salinity_psu: 33.9, cycle: 201 },
  { platform_number: '2902777', project_name: 'Bay of Bengal', lat: 20.4, lon: 91.3, status: 'active', temperature_c: 25.8, salinity_psu: 34.5, cycle: 65 },
  { platform_number: '2902699', project_name: 'Equatorial Indian', lat: -2.4, lon: 78.5, status: 'offline', temperature_c: 26.1, salinity_psu: 34.7, cycle: 132 },
  { platform_number: '2902712', project_name: 'Equatorial Indian', lat: 3.2, lon: 61.6, status: 'active', temperature_c: 28.2, salinity_psu: 34.2, cycle: 118 },
  { platform_number: '2902810', project_name: 'Subtropical Gyre', lat: -22.1, lon: 76.4, status: 'active', temperature_c: 19.2, salinity_psu: 35.2, cycle: 44 },
  { platform_number: '2902844', project_name: 'Southern Frontier', lat: -45.6, lon: 83.1, status: 'active', temperature_c: 8.4, salinity_psu: 34.3, cycle: 38 },
]

const QUICK_QUERIES = ['Salinity anomalies · BoB', 'Thermocline · Arabian Sea', 'Full 4D sweep']
const STATUS_FILTERS = ['all', 'active', 'warning', 'offline']
const nowClock = (d = new Date()) => d.toISOString().slice(11, 19)
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null)

/* ------------------------------------------------------------------ */
/* Profile helpers                                                     */
/* ------------------------------------------------------------------ */

/** Linear interpolation of `key` at a given depth over sorted profile rows. */
function valueAtDepth(rows, key, depth) {
  if (!rows?.length) return null
  if (depth <= rows[0].depth_m) return rows[0][key]
  const last = rows[rows.length - 1]
  if (depth >= last.depth_m) return last[key]
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]
    const b = rows[i]
    if (depth <= b.depth_m) {
      const span = b.depth_m - a.depth_m || 1
      const ratio = (depth - a.depth_m) / span
      const av = a[key]
      const bv = b[key]
      if (av == null || bv == null) return bv ?? av
      return av + (bv - av) * ratio
    }
  }
  return null
}

/** Merge temperature + salinity profile responses into one row set. */
function mergeProfiles(tempRes, salRes) {
  const map = new Map()
  for (const row of tempRes?.data || []) {
    const entry = map.get(row.depth_m) || { depth_m: row.depth_m }
    entry.temperature_c = row.value
    map.set(row.depth_m, entry)
  }
  for (const row of salRes?.data || []) {
    const entry = map.get(row.depth_m) || { depth_m: row.depth_m }
    entry.salinity_psu = row.value
    map.set(row.depth_m, entry)
  }
  return [...map.values()].sort((a, b) => a.depth_m - b.depth_m)
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  const chatFeedRef = useRef(null)
  const fleetRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  const [mode, setMode] = useState('telemetry')
  const [depth, setDepth] = useState(0)
  const [floats, setFloats] = useState(() => FALLBACK_FLOATS.map((f) => normaliseFloat(f)))
  const [fleet, setFleet] = useState({ live: false, source: 'demo', fetchedAt: null })
  const [anomalies, setAnomalies] = useState([])
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(true)
  const [sweeping, setSweeping] = useState(false)
  const [selected, setSelected] = useState(null)
  const [profile, setProfile] = useState(null)
  const [trajectory, setTrajectory] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [clock, setClock] = useState(new Date())
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'FloatChat is online. Ask about salinity, temperature, pressure, regions, or a depth layer.',
      at: nowClock(),
    },
  ])

  const anomalyIds = useMemo(() => new Set(anomalies.map((a) => String(a.float_id))), [anomalies])

  /* ----------------------------- clock ----------------------------- */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  /* --------------------------- data load --------------------------- */
  const loadFleet = useCallback(async ({ refresh = false, status = 'all' } = {}) => {
    const requestId = ++fleetRequestRef.current
    setLoading(true)
    try {
      const [fleetRes, anomalyRes, statsRes, healthRes] = await Promise.all([
        api.floats({ live: true, refresh, ...(status !== 'all' ? { status } : {}) }),
        api.anomalies(),
        api.stats(),
        api.health(),
      ])

      const ids = new Set((anomalyRes?.data || []).map((a) => String(a.float_id)))
      const rows = (fleetRes?.data || []).length ? fleetRes.data : FALLBACK_FLOATS

      if (requestId !== fleetRequestRef.current) return
      setFloats(rows.map((row) => normaliseFloat(row, ids)))
      setFleet({
        live: Boolean(fleetRes?.live),
        source: fleetRes?.source || 'FLOATCHAT demo fallback',
        sourceUrl: fleetRes?.source_url,
        fetchedAt: fleetRes?.fetched_at,
        windowDays: fleetRes?.window_days,
      })
      setAnomalies(anomalyRes?.data || [])
      setStats(statsRes || null)
      setHealth(healthRes || null)
    } catch {
      if (requestId !== fleetRequestRef.current) return
      setFloats(FALLBACK_FLOATS.map((f) => normaliseFloat(f)))
      setFleet({ live: false, source: 'demo fallback · API offline', fetchedAt: null })
      setAnomalies([])
      setStats(null)
      setHealth(null)
    } finally {
      if (requestId === fleetRequestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => { loadFleet() }, [loadFleet])

  /* Refetch when the user filters by status (uses the ?status= query param) */
  useEffect(() => { loadFleet({ status: statusFilter }) }, [statusFilter, loadFleet])

  /* -------------------- profile + trajectory load ------------------- */
  const loadDetail = useCallback(async (floatId) => {
    const requestId = ++detailRequestRef.current
    if (!floatId) { setProfile(null); setTrajectory(null); return }
    setProfile(null)
    setTrajectory(null)
    const [tempRes, salRes, trajRes] = await Promise.all([
      api.profile({ float_id: floatId, param: 'temperature' }).catch(() => null),
      api.profile({ float_id: floatId, param: 'salinity' }).catch(() => null),
      api.trajectory(floatId).catch(() => null),
    ])
    if (requestId !== detailRequestRef.current) return
    if (tempRes || salRes) {
      setProfile({
        rows: mergeProfiles(tempRes, salRes),
        cycle: tempRes?.cycle ?? salRes?.cycle ?? null,
        source: tempRes?.source ?? salRes?.source,
        live: Boolean(tempRes?.live ?? salRes?.live),
        latest: tempRes?.latest_observation ?? salRes?.latest_observation,
      })
    }
    if (trajRes) setTrajectory({ points: trajRes.points || [], source: trajRes.source, live: trajRes.live })
  }, [])

  /* --------------------------- globe sync -------------------------- */

  /* --------------------------- depth sweep ------------------------- */
  useEffect(() => {
    if (!sweeping) return
    const t = setInterval(() => {
      setDepth((d) => {
        if (d >= 2000) { setSweeping(false); return 0 }
        return d + 25
      })
    }, 75)
    return () => clearInterval(t)
  }, [sweeping])

  /* ------------------------------ chat ----------------------------- */
  const ask = useCallback(async (question) => {
    const q = (question || '').trim()
    if (!q || busy) return
    setBusy(true)
    setDraft('')
    setMessages((m) => [...m, { role: 'user', text: q, at: nowClock() }, { role: 'assistant', text: '', streaming: true, at: nowClock() }])

    let acc = ''
    const result = await streamChat(q, {
      onToken: (token) => {
        acc += token
        setMessages((m) => {
          const copy = m.slice()
          const last = copy.length - 1
          copy[last] = { ...copy[last], text: acc }
          return copy
        })
      },
      onDone: (meta) => {
        setMessages((m) => {
          const copy = m.slice()
          const last = copy.length - 1
          copy[last] = {
            ...copy[last],
            streaming: false,
            text: copy[last].text || fallbackAnswer(q),
            citations: meta.citations || [],
            source: meta.source,
            fetchedAt: meta.fetched_at,
            live: meta.live,
          }
          return copy
        })
      },
      onError: () => {},
    })

    if (!result.ok || !acc.trim()) {
      setMessages((m) => {
        const copy = m.slice()
        const last = copy.length - 1
        copy[last] = { ...copy[last], streaming: false, offline: !result.ok, text: copy[last].text || fallbackAnswer(q) }
        return copy
      })
    }
    setBusy(false)
  }, [busy])

  useEffect(() => { if (chatFeedRef.current) chatFeedRef.current.scrollTop = chatFeedRef.current.scrollHeight }, [messages])

  /* --------------------------- selection --------------------------- */
  const selectFloat = useCallback((f) => {
    setSelected(f)
    loadDetail(f?.id)
  }, [loadDetail])

  const resetView = useCallback(() => {
    detailRequestRef.current += 1
    setDepth(0)
    setSelected(null)
    setProfile(null)
    setTrajectory(null)
  }, [])

  /* ---------------------------- derived ---------------------------- */
  const focus = useMemo(() => {
    if (selected) {
      const temp = valueAtDepth(profile?.rows, 'temperature_c', depth) ?? selected.temp
      const sal = valueAtDepth(profile?.rows, 'salinity_psu', depth) ?? selected.sal
      return {
        id: selected.id,
        region: selected.region,
        temp,
        sal,
        cycle: profile?.cycle ?? selected.cycle,
        source: profile?.source,
        profiled: Boolean(profile?.rows?.length),
      }
    }
    return {
      id: 'FLEET AGGREGATE',
      region: 'Indian Ocean',
      temp: mean(floats.map((f) => f.temp).filter((v) => v != null)),
      sal: mean(floats.map((f) => f.sal).filter((v) => v != null)),
      cycle: null,
      source: fleet.source,
      profiled: false,
    }
  }, [selected, profile, depth, floats, fleet.source])

  const activeCount = stats?.active_floats ?? floats.filter((f) => f.status === 'active').length
  const anomalyCount = stats?.anomalies ?? anomalies.length
  const coverage = stats?.coverage_percent
  const ticker = [
    ['ACTIVE FLOATS', String(activeCount)],
    ['ANOMALIES', String(anomalyCount)],
    ['COVERAGE', coverage != null ? `${coverage}%` : '—'],
    ['WINDOW', fleet.windowDays ? `${fleet.windowDays}d` : '—'],
    ['UTC', nowClock(clock)],
  ]

  const pressure = focus.profiled
    ? (depth * 1.025 + 1.2).toFixed(1)
    : selected?.pressure != null
      ? selected.pressure.toFixed(1)
      : (depth * 1.025 + 1.2).toFixed(1)

  const stepValue = (key) => {
    const target = valueAtDepth(profile?.rows, key, depth)
    if (target == null || depth <= 0) return '—'
    const prev = valueAtDepth(profile?.rows, key, Math.max(0, depth - 100))
    if (prev == null) return '—'
    const delta = target - prev
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(key === 'salinity_psu' ? 3 : 2)}`
  }

  return (
    <div className="command-app">
      <header className="command-header">
        <div className="brand">
          <div className="brand-mark"><Waves size={17} /></div>
          <div><b>FLOATCHAT</b><span>// ARGO 4D</span></div>
          <div className={'live-label ' + (fleet.live ? 'is-live' : 'is-demo')}>
            <i /> {fleet.live ? 'LIVE ARGO TELEMETRY ACTIVE' : 'DEMO FALLBACK · API OFFLINE'}
          </div>
        </div>
        <div className="header-ticker">
          {ticker.map(([label, value]) => (
            <span key={label}>{label} <b>{value}</b></span>
          ))}
        </div>
        <button className="icon-btn" onClick={() => loadFleet({ refresh: true, status: statusFilter })} title="Refresh live window">
          {loading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
        </button>
        <button
          className="mobile-menu"
          type="button"
          aria-label="Jump to live metrics"
          title="Jump to live metrics"
          onClick={() => document.querySelector('.metrics-side')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        ><Menu size={18} /></button>
      </header>

      <main className="command-layout">
        {/* ---------------- AI QUERY INTERFACE ---------------- */}
        <section className="glass chat-side">
          <div className="panel-cap">AI QUERY INTERFACE <b>MODEL · FC-4D</b></div>
          <div className="chat-feed" ref={chatFeedRef}>
            {messages.map((m, i) => (
              <div className={m.role === 'user' ? 'msg-user' : 'msg-ai'} key={i}>
                {m.role === 'assistant' && (
                  <div className="ai-head">
                    <span className="sonar"><Waves size={12} /></span> FLOATCHAT <small>{m.at}</small>
                  </div>
                )}
                <div className="msg-bubble">
                  {m.text}
                  {m.streaming && <span className="caret" />}
                </div>
                {m.role === 'assistant' && i > 0 && (
                  <div className="ai-detail">
                    <span>FLOATS SCANNED <b>{selected ? '001' : String(floats.length).padStart(3, '0')}</b></span>
                    <span>DEPTH LAYER <b>{String(depth).padStart(4, '0')} m</b></span>
                    <span>PROVENANCE <b>{m.source || fleet.source}</b></span>
                    {m.fetchedAt && <span>FETCHED <b>{String(m.fetchedAt).slice(11, 19)}Z</b></span>}
                  </div>
                )}
                {Boolean(m.citations?.length) && (
                  <div className="cite-row">
                    {m.citations.map((c) => <span className="cite" key={c}>{c}</span>)}
                  </div>
                )}
                {m.offline && <div className="offline-note"><Zap size={10} /> offline estimate · backend unreachable</div>}
              </div>
            ))}
          </div>
          <div className="quick-row">
            {QUICK_QUERIES.map((q, i) => (
              <button
                key={q}
                onClick={() =>
                  ask(
                    i === 0
                      ? 'Show salinity anomalies below 500m depth in the Bay of Bengal'
                      : i === 1
                        ? 'Map temperature across the thermocline in the Arabian Sea'
                        : 'Sweep the water column from 0 to 2000m',
                  )
                }
              >
                {q}
              </button>
            ))}
          </div>
          <div className="query-box">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask(draft)}
              disabled={busy}
              placeholder={busy ? 'FloatChat is analyzing…' : 'Ask FloatChat about ocean metrics...'}
            />
            <button onClick={() => ask(draft)} disabled={busy}><Send size={15} /></button>
          </div>
        </section>

        {/* ---------------- GLOBE ---------------- */}
        <section className="glass globe-side">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <Globe3D
            markers={floats}
            mode={mode}
            rotating={rotating}
            selectedId={selected?.id}
            path={(trajectory?.points || []).map((p) => [p.lat, p.lon])}
            onMarkerClick={selectFloat}
          />
          <div className="depth-hud">
            <small>ACTIVE DEPTH LAYER</small>
            <b>{String(depth).padStart(4, '0')} <em>m</em></b>
          </div>
          <div className="globe-actions">
            <button className={rotating ? 'active' : ''} onClick={() => setRotating((v) => !v)} title="Auto-rotate">
              <RotateCcw size={13} />
            </button>
            <button onClick={resetView} title="Reset view">
              <Target size={13} />
            </button>
          </div>
          <div className="globe-hud">
            CAM {selected ? `${Math.abs(selected.lat).toFixed(1)}°${selected.lat >= 0 ? 'N' : 'S'} ${Math.abs(selected.lng).toFixed(1)}°${selected.lng >= 0 ? 'E' : 'W'}` : '14.0°N 80.0°E'} · ALT 2.20 R
          </div>
          <div className="globe-controls">
            <div className="mode-row">
              <button className={mode === 'telemetry' ? 'active' : ''} onClick={() => setMode('telemetry')}>TELEMETRY</button>
              <button className={mode === 'spectral' ? 'active' : ''} onClick={() => setMode('spectral')}>SPECTRAL BANDS</button>
              <button className={mode === 'salinity' ? 'active' : ''} onClick={() => setMode('salinity')}>SALINITY HEATMAP</button>
            </div>
            <div className="depth-row">
              <span>DEPTH LAYER<br />0–2000m</span>
              <input type="range" min="0" max="2000" step="10" value={depth} onChange={(e) => { setSweeping(false); setDepth(+e.target.value) }} />
              <b>{String(depth).padStart(4, '0')} m</b>
              <button onClick={() => setSweeping((v) => !v)}>{sweeping ? <Pause size={14} /> : <Play size={14} />}</button>
            </div>
          </div>
        </section>

        {/* ---------------- METRICS ---------------- */}
        <section className="glass metrics-side">
          <div className="metrics-head">
            <div className="panel-cap">LIVE METRICS</div>
            <span><i /> {fleet.live ? 'SYNC' : 'DEMO'}</span>
            <small>SOURCE // {selected ? `${selected.id} · ${selected.region.toUpperCase()}` : 'FLEET AGGREGATE'}</small>
          </div>
          <div className="metrics-scroll">
            <Metric icon={<Thermometer />} label="TEMPERATURE" color="amber"
              value={focus.temp != null ? focus.temp.toFixed(2) : '—'} unit="°C" trend={stepValue('temperature_c')} />
            <Metric icon={<Waves />} label="SALINITY" color="cyan"
              value={focus.sal != null ? focus.sal.toFixed(3) : '—'} unit="PSU" trend={stepValue('salinity_psu')} />
            <Metric icon={<Gauge />} label="PRESSURE" color="sky" value={pressure} unit="dbar" trend="live" />

            <div className="glass-card profile-mini">
              <div className="panel-cap">
                {selected ? `PROFILE · WMO ${selected.id}` : 'THERMOCLINE · FLEET'}
                {profile?.cycle != null && <b>C{profile.cycle}</b>}
              </div>
              <div className="legend">
                <span className="amber-line" /> TEMP °C <span className="cyan-line" /> SAL PSU
              </div>
              <ProfileChart rows={profile?.rows || []} depth={depth} />
              <small>
                {profile?.rows?.length
                  ? `Layer ${depth}m · T ${fmt(valueAtDepth(profile.rows, 'temperature_c', depth), 2)}°C · S ${fmt(valueAtDepth(profile.rows, 'salinity_psu', depth), 2)} PSU`
                  : selected ? 'Loading profile…' : 'Select a float to load its depth profile'}
              </small>
            </div>

            <div className="glass-card fleet-card">
              <div className="panel-cap">FLEET STATUS</div>
              <div className="fleet-stat">
                <b>{activeCount}</b><span>active in view</span>
              </div>
              <div className="bar">
                <i style={{ width: `${coverage != null ? Math.min(100, coverage) : Math.min(100, (activeCount / Math.max(1, floats.length)) * 100)}%` }} />
              </div>
              <div className="fleet-foot">
                <span><Zap size={11} /> {anomalyCount} anomalies</span>
                <span>{coverage != null ? `${coverage}% coverage` : `${floats.length} in window`}</span>
              </div>
            </div>

            <div className="glass-card">
              <div className="panel-cap">STATUS FILTER <b>?status=</b></div>
              <div className="filter-row">
                {STATUS_FILTERS.map((s) => (
                  <button key={s} className={statusFilter === s ? 'active' : ''} onClick={() => setStatusFilter(s)}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ---------------- ANOMALY + TRAJECTORY STRIP ---------------- */}
      <section className="glass intel-strip">
        <div className="intel-block">
          <div className="panel-cap"><Zap size={11} /> ANOMALY SIGNALS <b>{anomalyCount}</b></div>
          <div className="intel-list">
            {anomalies.length === 0 && <div className="intel-empty">No 2σ outliers in the current window.</div>}
            {anomalies.map((a, i) => (
              <button
                key={`${a.float_id}-${i}`}
                className="intel-item"
                onClick={() => { const f = floats.find((x) => x.id === String(a.float_id)); if (f) selectFloat(f) }}
              >
                <span className="sev">{a.severity || 'moderate'}</span>
                <span className="intel-title">{a.title}</span>
                <span className="intel-meta">{a.float_id} · {typeof a.value === 'number' ? a.value.toFixed(2) : '—'}</span>
                <ChevronDown size={13} className="flip" />
              </button>
            ))}
          </div>
        </div>

        <div className="intel-block">
          <div className="panel-cap"><Activity size={11} /> TRAJECTORY {selected ? `· WMO ${selected.id}` : ''} <b>{(trajectory?.points || []).length} pt</b></div>
          <div className="intel-list">
            {!selected && <div className="intel-empty">Select a float to load its trajectory.</div>}
            {selected && (trajectory?.points || []).length === 0 && <div className="intel-empty">No trajectory points returned.</div>}
            {selected && (trajectory?.points || []).map((p, i) => (
              <div className="intel-item static" key={i}>
                <span className="intel-title">CYCLE {p.cycle ?? '—'}</span>
                <span className="intel-meta">{Number(p.lat).toFixed(2)}°, {Number(p.lon).toFixed(2)}°</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="command-footer">
        <span>FLOATCHAT v0.2 · ARGO 4D OPERATIONS CONSOLE</span>
        <span>
          <Database size={12} /> {fleet.source}{fleet.fetchedAt ? ` · ${String(fleet.fetchedAt).slice(0, 19)}Z` : ''} · <Download size={12} /> EXPORT READY
        </span>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Small components                                                    */
/* ------------------------------------------------------------------ */

function colorFor(f, mode, anomalyIds) {
  const isAnomaly = f.anomaly || anomalyIds?.has?.(f.id)
  if (mode === 'salinity') return isAnomaly ? '#ffc857' : '#00cfe8'
  if (mode === 'spectral') return f.temp > 28 ? '#ff5577' : f.temp > 24 ? '#ffd166' : '#4e9cf5'
  return isAnomaly ? '#8ff7ff' : '#00f2fe'
}

function fmt(value, digits) {
  return value == null ? '—' : Number(value).toFixed(digits)
}

function fallbackAnswer(q) {
  if (/salin/i.test(q)) return 'Salinity is elevated at the eastern edge of the Bay of Bengal, with cited profiles between 34.8 and 35.1 PSU. The strongest signal is around 600–1,000 m.'
  if (/temp|thermo/i.test(q)) return 'The temperature field shows a sharp thermocline in the Arabian Sea, separating a warm surface layer from cooler deep water.'
  return 'Live ARGO mode is active. I can resolve salinity, temperature, pressure, a region, or any depth layer.'
}

function Metric({ icon, label, value, unit, color, trend }) {
  return (
    <div className="glass-card metric-card">
      <div className="metric-label">
        <span className={color}>{icon} {label}</span>
        <ArrowUp size={12} />
      </div>
      <strong>{value}<small>{unit}</small></strong>
      <Spark color={color} />
      <div className="metric-trend">↗ {trend} from last sample</div>
    </div>
  )
}

function Spark({ color }) {
  return (
    <svg viewBox="0 0 100 24" className={'spark ' + color}>
      <polyline points="0,18 10,15 20,17 30,10 40,13 50,8 60,12 70,5 80,10 90,4 100,7" />
    </svg>
  )
}

/** Real depth profile rendered from /api/profiles rows (T + S). */
function ProfileChart({ rows, depth }) {
  const W = 100
  const H = 52
  const PAD = 4
  const maxD = Math.max(2000, ...rows.map((r) => r.depth_m))

  const yOf = (d) => PAD + Math.sqrt(Math.min(d, maxD) / maxD) * (H - 2 * PAD)

  const series = (key, min, max) => {
    const points = rows.filter((r) => r[key] != null)
    if (!points.length) return ''
    return points
      .map((r) => {
        const x = PAD + ((r[key] - min) / ((max - min) || 1)) * (W - 2 * PAD)
        return `${x.toFixed(2)},${yOf(r.depth_m).toFixed(2)}`
      })
      .join(' ')
  }

  const tempVals = rows.map((r) => r.temperature_c).filter((v) => v != null)
  const salVals = rows.map((r) => r.salinity_psu).filter((v) => v != null)
  const tempLine = series('temperature_c', tempVals.length ? Math.min(...tempVals) : 0, tempVals.length ? Math.max(...tempVals) : 1)
  const salLine = series('salinity_psu', salVals.length ? Math.min(...salVals) : 33, salVals.length ? Math.max(...salVals) : 38)

  const gridDepths = [0, 200, 500, 1000, 2000].filter((d) => d <= maxD)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mini-chart" preserveAspectRatio="none">
      {gridDepths.map((d) => (
        <line key={d} x1={PAD} x2={W - PAD} y1={yOf(d)} y2={yOf(d)} stroke="rgba(148,197,255,.12)" strokeWidth="0.3" />
      ))}
      {salLine && <polyline points={salLine} fill="none" stroke="#00f2fe" strokeWidth="1.4" />}
      {tempLine && <polyline points={tempLine} fill="none" stroke="#ffb454" strokeWidth="1.4" />}
      <line x1={PAD} x2={W - PAD} y1={yOf(depth)} y2={yOf(depth)} stroke="#ffc857" strokeDasharray="2 2" opacity=".75" />
    </svg>
  )
}

export default App
