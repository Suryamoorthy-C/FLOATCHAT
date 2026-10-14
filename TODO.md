# Pearl Zone Analytics — delivery checklist

## Scoring engine and API
- [x] Accept multi-sensor telemetry for temperature, pressure/depth, salinity, dissolved oxygen, pH, turbidity, and chlorophyll-a, with species, location, time, sensor QC flags, and recent history support.
- [x] Return a 0–100 Pearl Production Index screening score, suitability/risk class, weighted data coverage, per-metric scores, warnings, rejected/outlier metrics, units, profile/model version, and observation time.
- [x] Use separate species profiles and explain that thresholds are species-, life-stage-, location-, and calibration-dependent; mark low-evidence turbidity and chlorophyll bands provisional.
- [x] Reject physically impossible values; honor metric-alias QC flags; exclude robust outliers when sufficient history exists; enumerate missing/invalid values without imputing zero.
- [x] Expose `GET /api/pearl/thresholds` and `POST /api/pearl/index` in the existing FastAPI service.

## Dashboard
- [x] Add a discoverable Pearl Zones page with selectable illustrative suitability map, pins, layer toggles, zone cards, parameter details, and API-driven warning badges.
- [x] Replace the schematic map with a responsive 3D Earth globe in the same dashboard panel; allow drag-to-rotate and scroll-to-zoom, show the four illustrative demo sites as selectable markers, link marker selection to the existing zone details, retain the reset control and layer toggles, and label display positions as approximate/not for navigation.
- [x] Label map geometry and fallback telemetry as illustrative demo data; state that PPI is not a pearl-yield prediction.
- [x] Show profile-derived target bands, coverage semantics, threshold evidence, and source links; include responsive desktop/mobile layout and text labels alongside colors.
- [x] Fix oversized, blurry, stretched, inconsistent, or clipped text while preserving the dark oceanic theme, cyan accents, and glassmorphism; align each marker, stem, and protrusion to its existing sample location and keep it aligned through zoom, rotation, animation, and resize; keep sharp, readable tooltips anchored and unclipped without overlap; correct canvas resolution, sizing, responsive layout, and control overlap; preserve every existing interaction, data value, and analytic, and do not fabricate measurements or scores.

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
- [x] Rebased against the upstream shared React-Three globe, restored the Pearl Zones page styling, and visually verified the globe plus marker-to-zone selection in the browser; `npm run build` passed.
- [x] Chromium/Playwright verified title clearance, 1×/2× canvas backing at 1280×1100 and 390×844, crisp viewport-contained tooltips, drag/zoom marker movement, distinct pointer hit targets and mouse/keyboard selection for all four true-coordinate demo sites, zone chips, layer toggles, reset, 390px mobile document width, and zero page errors. Sample coordinates, readings, and scores were unchanged.
- [x] Profile/subscription route production build and all 18 backend tests passed; Draft 2020-12 JSON Schema validated its sample payload; Playwright verified desktop navigation, editing, plan/logout notices, mobile navigation, Escape-to-close, and zero overflow at 1440px, 390px, and 320px.
- [x] Final emulated-4G homepage (9 Mbps down, 1 Mbps up, 150 ms latency) returned HTTP 200 with a 706 ms load event and 490,527 resource-transfer bytes; the table rendered only 100 of 1,111 floats initially, with Profile/Globe3D/OrbitControls chunks still deferred. `/manus-routes.json` served valid JSON including `/profile`.
- [x] Deep-linking to Pearl Zones remained aligned after the 1,111-row API feed resolved; the globe rendered in-view with 100 initial table rows, all four zone pills remained unscored, and layer toggle, zone selection, and reset passed.

## Release
- [x] Push to `origin/main`; Vercel reported deployment success for feature commit `71920e3`.

## User profile and subscription management
- [x] Provide a responsive profile header with an avatar/profile-picture placeholder, user name, email, role, Edit Profile and Log Out actions; show the current active plan, vivid-green active badge, start/end dates, and a progress bar for remaining days in the billing cycle.
- [x] Show Starter Float (free/basic monitoring), highlighted current Pro Pearl Analyst, and Enterprise Fleet ($299/month with unlimited floats, 3D depth map, algae-bloom red alerts, and AI yield forecasting) in a responsive plan grid with feature lists and interactive plan-change callbacks.
- [x] Include a backend-ready JSON Schema and sample user/subscription/plan payload; keep edit, logout, and plan actions callback-driven and do not imply persistence or process payment when no backend callback is connected.

## Smooth scrolling and 4G performance
- [x] Lenis handles page-wheel and section navigation while preserving native touch scrolling and reduced-motion behavior; console/profile routes are excluded from the home-page section scroller, and the Pearl deep-link re-aligns after asynchronously loaded Live Data changes layout, unless the user takes control.
- [x] Defer the heavy Pearl globe and profile chunks, and progressively render Live Data in 100-row batches with an accessible Show More action so the entire API result remains available without creating a 1,100-row DOM at once.
