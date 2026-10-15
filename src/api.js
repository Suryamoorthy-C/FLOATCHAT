/**
 * FLOATCHAT API client
 * ------------------------------------------------------------------
 * Single place that knows about every backend endpoint exposed by
 * `server/main.py`. Components import `api` / `streamChat` and never
 * build URLs themselves.
 *
 * Endpoints covered:
 *   GET  /api/health
 *   GET  /api/floats                     (?status, ?region, ?live, ?refresh)
 *   GET  /api/floats/{float_id}/trajectory
 *   GET  /api/profiles                   (?float_id, ?cycle, ?param)
 *   GET  /api/anomalies
 *   GET  /api/stats/overview
 *   POST /api/chat                       (Server-Sent Events stream)
 *   GET  /api/users/{id}/profile          (profile image metadata)
 *   POST /api/users/{id}/avatar           (multipart JPEG/PNG upload)
 *   GET  /api/users/{id}/avatar           (stored profile image)
 *   DELETE /api/users/{id}/avatar         (remove profile image)
 */

/* In dev, Vite proxies /api -> http://127.0.0.1:8000 (see vite.config.js).
   In production, set VITE_API_BASE_URL to the deployed FastAPI origin. */
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || ''
export const API_BASE = RAW_BASE.replace(/\/+$/, '')
export const isLiveConfigured = Boolean(API_BASE) || import.meta.env.DEV

import { getAccessToken } from './auth';

function authHeaders(headers = {}) {
  const token = getAccessToken()
  return { ...headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

/** Build a fully-qualified request URL, appending only defined params. */
function buildUrl(path, params) {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

/** GET + JSON with a hard timeout so a dead API never hangs the console. */
async function getJSON(path, params, { timeout = 12000, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(buildUrl(path, params), {
      signal: controller.signal,
      headers: authHeaders({ accept: 'application/json' }),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** POST JSON and return a normalized response with timeout handling. */
async function postJSON(path, payload, { timeout = 12000, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      signal: controller.signal,
      headers: authHeaders({ accept: 'application/json', 'content-type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** PUT JSON and return the saved resource. */
async function putJSON(path, payload, { timeout = 12000, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(buildUrl(path), {
      method: 'PUT',
      signal: controller.signal,
      headers: authHeaders({ accept: 'application/json', 'content-type': 'application/json' }),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `${res.status} ${res.statusText}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Upload a file as multipart/form-data without setting its boundary manually. */
async function postFile(path, file, { timeout = 30000, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  const form = new FormData()
  form.append('file', file, file.name || 'profile-photo')
  try {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      signal: controller.signal,
      headers: authHeaders({ accept: 'application/json' }),
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `${res.status} ${res.statusText}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

async function deleteJSON(path, { timeout = 12000, signal } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(buildUrl(path), {
      method: 'DELETE',
      signal: controller.signal,
      headers: authHeaders({ accept: 'application/json' }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `${res.status} ${res.statusText}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function resolveApiResource(resource) {
  if (!resource || /^(?:[a-z]+:)?\/\//i.test(resource)) return resource
  return `${API_BASE}${resource}`
}

export const api = {
  /** {status, service, data_source, live, fetched_at} */
  health: (opts) => getJSON('/api/health', null, opts),

  /** {count, data:[float], source, source_url, fetched_at, live, window_days} */
  floats: ({ status, region, live = true, refresh = false } = {}, opts) =>
    getJSON('/api/floats', { status, region, live, refresh }, opts),

  /** {float_id, points:[{lat,lon,cycle}], source, live} */
  trajectory: (floatId, opts) =>
    getJSON(`/api/floats/${encodeURIComponent(floatId)}/trajectory`, null, opts),

  /** {float_id, cycle, parameter, data:[{depth_m,value}], source, live, ...} */
  profile: ({ float_id, cycle, param = 'temperature' } = {}, opts) =>
    getJSON('/api/profiles', { float_id, cycle, param }, opts),

  /** {count, data:[{title,region,severity,float_id,value}], source, live} */
  anomalies: (opts) => getJSON('/api/anomalies', null, opts),

  /** {active_floats, profiles_week, anomalies, coverage_percent, synced_at, source, live} */
  stats: (opts) => getJSON('/api/stats/overview', null, opts),
  /** Versioned species bands and evidence notes. */
  pearlThresholds: (species = 'pinctada_maxima', opts) =>
    getJSON('/api/pearl/thresholds', { species }, opts),
  /** Score one multi-sensor telemetry sample. */
  pearlIndex: (telemetry, opts) => postJSON('/api/pearl/index', telemetry, opts),
  /** User-specific custom alert bounds. */
  userThresholds: (userId, opts) => getJSON(`/api/users/${encodeURIComponent(userId)}/thresholds`, null, opts),
  saveUserThresholds: (userId, profile, opts) => putJSON(`/api/users/${encodeURIComponent(userId)}/thresholds`, profile, opts),
  userProfile: async (userId, opts) => {
    const profile = await getJSON(`/api/users/${encodeURIComponent(userId)}/profile`, null, opts)
    return { ...profile, avatarUrl: resolveApiResource(profile.avatarUrl) }
  },
  updateUserProfile: (profile, opts) => putJSON('/api/me/profile', profile, opts),
  uploadUserAvatar: async (userId, file, opts) => {
    const profile = await postFile(`/api/users/${encodeURIComponent(userId)}/avatar`, file, opts)
    return { ...profile, avatarUrl: resolveApiResource(profile.avatarUrl) }
  },
  deleteUserAvatar: async (userId, opts) => {
    const profile = await deleteJSON(`/api/users/${encodeURIComponent(userId)}/avatar`, opts)
    return { ...profile, avatarUrl: null }
  },
}

/**
 * Normalise a raw `/api/floats` row into the shape the UI renders.
 * Backend field names (platform_number, temperature_c, …) stay close to
 * the source of truth so the mapping lives in exactly one place.
 */
export function normaliseFloat(row, anomalies = new Set()) {
  const id = String(row.platform_number ?? row.id ?? '')
  return {
    id,
    lat: Number(row.lat),
    lng: Number(row.lon ?? row.lng),
    region: row.project_name || row.region || 'Indian Ocean',
    pi: row.pi_name || 'ARGO',
    temp: row.temperature_c ?? null,
    sal: row.salinity_psu ?? null,
    pressure: row.pressure_dbar ?? null,
    cycle: row.cycle ?? null,
    status: row.status || 'active',
    lastSeen: row.last_seen ?? null,
    anomaly: anomalies.has(id),
  }
}

/**
 * Stream `POST /api/chat`.
 *
 * The backend emits Server-Sent Events:
 *   data: {"token": "word "}
 *   ...
 *   data: {"done": true, "citations": [...], "source": "...", "fetched_at": "...", "live": true}
 *
 * Callbacks fire incrementally so the UI can type the answer out word by
 * word and then attach provenance once the terminal event arrives.
 */
export async function streamChat(message, { history = [], context = {}, onToken, onDone, onError, signal } = {}) {
  try {
    const res = await fetch(buildUrl('/api/chat'), {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json', accept: 'text/event-stream' }),
      body: JSON.stringify({ message, history: history.slice(-12), context }),
      signal,
    })
    if (!res.ok) throw new Error(`chat ${res.status} ${res.statusText}`)

    // Non-streaming / mocked JSON response — accept it as a fallback.
    const ctype = res.headers.get('content-type') || ''
    if (ctype.includes('application/json')) {
      const payload = await res.json()
      const text = payload.answer || payload.text || payload.message || ''
      if (text) onToken?.(text)
      onDone?.({ ...payload, citations: payload.citations || [], source: payload.source, fetched_at: payload.fetched_at, live: payload.live })
      return { ok: true }
    }
    if (!res.body) throw new Error('no response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // SSE frames are separated by a blank line.
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sep
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawFrame = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        // A frame may contain several fields; we only need `data:`.
        const dataLine = rawFrame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('')
        if (!dataLine) continue
        let evt
        try {
          evt = JSON.parse(dataLine)
        } catch {
          // Not JSON (e.g. a bare ":heartbeat" comment) — ignore safely.
          continue
        }
        if (typeof evt.token === 'string') onToken?.(evt.token)
        if (evt.done) onDone?.(evt)
      }
    }
    return { ok: true }
  } catch (err) {
    onError?.(err)
    return { ok: false, error: err }
  }
}
