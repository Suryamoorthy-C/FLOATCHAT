# FLOATCHAT project plan

## Product
FLOATCHAT is an ocean-intelligence dashboard that helps operators explore ocean-float observations, understand anomalies, and make evidence-aware operational decisions. Pearl Zone Analytics adds an explainable environmental suitability screen for pearl-oyster cultivation areas. The Pearl Production Index is a screening score, not a pearl-yield guarantee.

## Current architecture
- Front end: React + Vite static site, hash-based navigation, and a lazy-loaded operations console. Static output is deployed to Vercel.
- API: FastAPI in `server/main.py`, exposed by the Python function entrypoint `api/index.py`; live data acquisition is a lightweight Ifremer ERDDAP adapter in `server/live_data.py`.
- Data: the current UI combines demo/fallback data and live ARGO fetches. No production database, authenticated sensor-ingestion path, or persistent WebSocket service is configured in this repository.
- Build: `npm run build`; local API runs with Uvicorn. Verify access to the linked Vercel project before claiming deployment success.

## Pearl analytics implementation
- `server/pearl_index.py` contains versioned species profiles, unit normalization, robust anomaly screening, weighted scoring, coverage, and warning generation.
- `server/main.py` exposes `GET /api/pearl/thresholds` and `POST /api/pearl/index`.
- `src/pages/PearlZones.jsx` and `src/pages/PearlZones.css` provide an illustrative demo dashboard with a selectable suitability-map surface, layer controls, float pins, score cards, parameter warnings, and responsive telemetry detail.
- `src/api.js`, `src/routes.js`, `src/main.jsx`, and `public/manus-routes.json` are the front-end API, navigation, page registry, and route-declaration sources of truth.
- `docs/PEARL_ZONE_ANALYTICS.md` contains the source-cited thresholds, scoring assumptions, architecture, storage model, UX framework, and feature roadmap.

## Project structure
- `src/`: React pages, components, styles, route/navigation declarations, and the API client.
- `server/`: FastAPI application, live-data adapters, and domain scoring modules.
- `api/`: Vercel Python entry point.
- `docs/`: product, deployment, provenance, and feature documentation.
- `tests/`: standard-library tests for deterministic backend scoring behavior.

## Design direction
Reuse FLOATCHAT's dark ocean operations-console style rather than introducing another visual identity. Use a near-black navy canvas, thin blue borders, high-contrast telemetry text, and cyan/seafoam accents. Teal, amber, and red distinguish suitability, caution, and urgent warnings, with text labels so color is never the sole signal. Make the map dominant and keep zone details responsive. Mark sample boundaries as illustrative until bathymetry and measured sensor data are connected.

## Data and validation constraints
Thresholds depend on species, life stage, geography, and sensor calibration. Distinguish published culture criteria from provisional sensor bands and show evidence quality. Measure completeness separately from model accuracy; exclude QC failures and robust outliers rather than silently clipping them. Preserve raw samples and model versions when persistence is added. Do not call PPI a yield estimate until calibrated and back-tested against farm outcomes.

## Delivery priorities
1. Deliver the tested scoring API with explainable outputs.
2. Deliver a responsive feature dashboard that makes demo versus live data unmistakable.
3. Keep thresholds, citations, assumptions, and roadmap in the feature specification.
4. Add authenticated ingestion, time-series/spatial storage, and live transport after the sensor contract and hosting path are selected.
5. Calibrate site/species models with farm outcomes before making yield or harvest predictions.
