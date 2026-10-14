# FLOATCHAT live ARGO data

FLOATCHAT now queries the official Argo data ecosystem through the official Ifremer ERDDAP CSV service directly.

## What is live

- `GET /api/floats?live=true` queries a recent 3-day global window (`55–95°E`, `5°S–25°N`, `0–50 dbar`) and returns the latest observation for each WMO float.
- `GET /api/profiles?float_id=<WMO>` fetches the selected float's latest full profile on demand.
- `GET /api/anomalies` runs a simple 2-sigma screening check over the live window.
- `GET /api/health` reports the source, fetch time, and whether live mode is active.
- Responses are cached for 10 minutes by default (`ARGO_CACHE_SECONDS`).

The dashboard remains usable if the public service is temporarily unavailable. In that case the API reports `live: false` and uses a small demo fallback rather than presenting fallback values as live observations.

## Run locally

```bash
pip install -r requirements.txt
uvicorn server.main:app --host 0.0.0.0 --port 8000
```

Set `FLOATCHAT_DATA_MODE=demo` only when a deterministic demo is required. Otherwise live mode is the default.

## Deployment

The Vite frontend and FastAPI service should be deployed separately. Set this Vercel environment variable to the public FastAPI URL:

```text
VITE_API_BASE_URL=https://your-api-host.example.com
```

The backend must allow the Vercel origin in production instead of using `*` for long-term operation. The public ARGO endpoint does not require an API key, but they are rate-limited public infrastructure, which is why the server cache is enabled.

## Data interpretation

ARGO profile values include pressure, temperature, salinity, timestamps, WMO platform numbers, cycles, and quality-control metadata in the upstream dataset. The dashboard is an operational view. Before scientific publication, filter by the upstream QC flags and prefer adjusted/delayed-mode values where available.

## Sources

- [Ifremer ERDDAP ARGO source](https://erddap.ifremer.fr/erddap/)
- [Argo profile files and QC guidance](https://argo.ucsd.edu/data/how-to-use-argo-files/)
