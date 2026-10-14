# Pearl Zone Analytics — delivery checklist

## Scoring engine and API
- [x] Accept multi-sensor telemetry for temperature, pressure/depth, salinity, dissolved oxygen, pH, turbidity, and chlorophyll-a, with species, location, time, sensor QC flags, and recent history support.
- [x] Return a 0–100 Pearl Production Index screening score, suitability/risk class, weighted data coverage, per-metric scores, warnings, rejected/outlier metrics, units, profile/model version, and observation time.
- [x] Use separate species profiles and explain that thresholds are species-, life-stage-, location-, and calibration-dependent; mark low-evidence turbidity and chlorophyll bands provisional.
- [x] Reject physically impossible values; honor metric-alias QC flags; exclude robust outliers when sufficient history exists; enumerate missing/invalid values without imputing zero.
- [x] Expose `GET /api/pearl/thresholds` and `POST /api/pearl/index` in the existing FastAPI service.

## Dashboard
- [x] Add a discoverable Pearl Zones page with selectable illustrative suitability map, pins, layer toggles, zone cards, parameter details, and API-driven warning badges.
- [x] Label map geometry and fallback telemetry as illustrative demo data; state that PPI is not a pearl-yield prediction.
- [x] Show profile-derived target bands, coverage semantics, threshold evidence, and source links; include responsive desktop/mobile layout and text labels alongside colors.

## Science, system design, and roadmap
- [x] Document initial parameter bands, citations, evidence confidence, provisional scoring rails, and short-term-vs-long-term tolerance distinctions.
- [x] Document the PPI equation, weights, one-sided oxygen minimum, normalization, QC/outlier behavior, classifications, and limitations.
- [x] Document API contracts, MQTT ingestion, WebSocket delivery, PostgreSQL/PostGIS/Timescale storage design, development phases, dashboard framework, and five innovation add-ons.
- [x] Cite research sources and retain local calibration against farm outcomes as a prerequisite to predictive-yield claims.

## Validation
- [x] `npm run build` passed (Vite reported a non-blocking large operations-console chunk warning).
- [x] 11 unit tests passed; Python source compilation passed.
- [x] API function contracts, strict JSON serialization, source provenance, one-sided DO scoring, missing-metric reporting, QC-alias handling, and negative-pressure rejection passed.
- [x] `git diff --check` and route-manifest JSON validation passed.

## Release
- [ ] Commit and push to `origin/main`; verify whether the repository’s linked Vercel deployment runs successfully.
