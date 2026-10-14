# Pearl Zone Analytics — design, implementation plan, and roadmap

## 1. Scientific scoring and data-processing engine

### What the score means

The Pearl Production Index (PPI) is an explainable **environmental site-suitability screen** on a 0–100 scale. It is not a forecast of pearl count, grade, revenue, or harvest date. Those outcomes also depend on oyster age and stock, grafting, stocking density, fouling, disease, current, food composition, storms, husbandry, and farm-specific growth history. Calibrate against measured shell growth, survival, nacre deposition, and harvest outcomes before presenting it as a yield predictor.

The initial default is tropical gold-lip pearl oyster, *Pinctada maxima*, for the Indo-Pacific. A reported Bali site-selection study used a 28–30 °C top temperature class, 10–20 m depth, salinity 32 PSU top class (32–35 PSU described as suitable), DO above 6 mg/L, and pH 7.8–8.6; it reports chlorophyll-a at 0.25–0.7 mg/m³ at the local study area. FAO's older pearl-oyster farming chapter puts depth near 15 m, describes short-duration salinity tolerance separately from growth optimum, and warns that silt/turbidity can interfere with filtration. These are **starting criteria, not universal species limits**; geography and life stage change the response. [1] [2]

| Parameter | Initial ideal band for the default P. maxima screening profile | Caution / action band | Confidence and implementation notes |
| --- | --- | --- | --- |
| Water temperature | 26–30 °C | 24–26 °C or 30–32 °C: watch; <20 °C or >32 °C: critical alert in code | A Bali culture-suitability study cites 26–30 °C as good and measured 28–31 °C; an independent field comparison found winter low temperature affected P. maxima. The code’s 20–34 °C outer scoring rails are engineering placeholders, not published safety limits. Tune by site and life stage. [2] [3] |
| Pressure / depth | 15–20 m depth | 10–15 m or 20–30 m: watch; outside 10–30 m: lower suitability | FAO describes about 15 m as optimum; a local spatial study uses 10–20 m as its top class and 21–30 m as a lower class. The code’s 5–35 m score rails are provisional. Convert **gauge** pressure to depth; reject negative pressure and remove atmospheric pressure first for absolute-pressure sensors. [1] [2] |
| Salinity | 32–35 PSU | 30–32 or 35–38 PSU: watch; sustained <24 or >50 PSU: urgent review | Local P. maxima criteria use 32–35 PSU. FAO's 24–50‰ tolerance is stated for only 2–3 days, not as a long-term growth optimum; it reports 14‰ and 55‰ as potentially lethal. The code uses 24–50 PSU only as a provisional score guard, not as a steady-state target. [1] [2] |
| Dissolved oxygen | ≥6 mg/L | 4–6 mg/L: warning; <4 mg/L: urgent hypoxia alert | The local suitability study gives >6 mg/L its top class and cites harm below 4 mg/L to aquatic biota; an acclimation protocol for adult P. fucata maintained DO >6.5 mg/L. Scoring is intentionally one-sided (100 at ≥6); no upper physiological optimum is asserted. Validate alert persistence against local diurnal lows. [2] [4] |
| pH | 7.8–8.6 | 7.5–7.8 or 8.6–9.0: watch; outside 7.5–9.0: critical alert in code | 7.8–8.6 is the range quoted by the local suitability study. The code’s 7.0–9.2 outer scoring rails are engineering placeholders, not validated safety limits. pH scales and calibration matter; log total-scale/seawater-scale metadata where possible. [2] |
| Turbidity | Prototype placeholder: 0–5 NTU | >5 NTU: trend warning; >15 NTU: review | No universal pearl-oyster NTU optimum is established here. The code’s 0–25 NTU guard is provisional; FAO warns about high silt and filtration, and another study reports suspended particulate matter in mg/L, not NTU. Calibrate against local suspended solids and Secchi depth. [1] [3] |
| Chlorophyll-a | Prototype screening band: 0.25–5 µg/L | <0.25 or >5 µg/L: food/bloom review; >25 µg/L critical in code | The local Bali study observed 0.25–0.7 mg/m³ (numerically equal to µg/L) and cites a phytoplankton cell-density class. The 0–25 µg/L score guard is an explicit engineering allowance, not a published universal optimum. Chl-a is only a food proxy; species composition and ingestible particle size matter. [2] [3] |

PSU and ‰ are numerically similar for seawater salinity reporting, but keep the unit supplied by the sensor and preserve it in provenance. For pressure, 1 dbar is approximately 1 m of seawater near the surface; this approximation is unsuitable if hydrostatic/gauge pressure has not been separated from atmospheric pressure.

### Score, weights, confidence, and anomaly behavior

Most parameters use a weighted trapezoid: 100 inside the ideal band, falling linearly toward 0 between the ideal and outer guard rails. Dissolved oxygen is one-sided: the prototype assigns 100 at ≥6 mg/L and declines linearly below 6, with no unsupported upper physiological optimum. Outer rails for temperature, depth, pH, turbidity, and chlorophyll-a are explicitly provisional software scoring boundaries, not biological safety limits. The initial P. maxima weights are temperature 0.19, depth 0.16, salinity 0.18, dissolved oxygen 0.18, pH 0.12, turbidity 0.08, and chlorophyll-a 0.09. These weights sum to 1.00 and are transparent product assumptions, not weights learned from production data.

For a sample, drop metrics that are missing, fail a sensor QC flag, are non-finite, exceed the physical sensor range, or are a robust outlier against a supplied recent history. Renormalize the remaining metric weights and calculate:

```text
PPI = Σ(valid_weight × metric_score) / Σ(valid_weight)
coverage = Σ(valid_weight) / Σ(all_profile_weights)
```

`coverage` is data completeness, **not** statistical model confidence. Below 50% coverage, return `insufficient-data` rather than a misleading zone grade. If a critical warning is present (for example DO <4 mg/L, salinity outside the stated short-term tolerance, or an extreme pH), keep the numeric PPI visible but classify the zone as `critical-risk` and show the specific warning.

For noisy streams, reject physically impossible readings before scoring, honor device QC flags, and compare each reading with a rolling median/MAD baseline when at least five recent readings are available. Flag a robust z-score above 3 as anomalous; exclude it from that score and report the reason. Keep both the raw sample and QC decision in storage. Add stale-sensor checks, duplicate message IDs, sequence gaps, clock skew, and device calibration status in the ingestion layer. Never silently clip an outlier into an ideal score.

Suggested presentation bands are `high suitability` 80–100, `promising` 65–79, `marginal` 45–64, and `low suitability` below 45. These are demonstration labels that require local validation. The API also returns per-parameter scores, units, warnings, excluded metrics, profile/version, observation time, and a coverage percentage so the user can see why a zone received its grade.

For *Pinctada fucata*, do not reuse the tropical P. maxima profile unchanged. One controlled response-surface study found a combined temperature/salinity optimum near 24.95 °C and 28.11‰ for the physiological responses measured; another acute-stress study used 35‰, 30 ±1 °C, pH 8.0 ±0.1, and DO >6.5 mg/L as acclimation conditions. These studies are not pearl-yield validations. The software exposes a separate provisional profile and labels it as a research-derived center until a farm-specific profile is calibrated. [4] [5]

## 2. Full-stack system architecture and implementation plan

### Data path

1. **Float firmware:** timestamp each sample in UTC; attach `device_id`, sequence/message ID, latitude/longitude, sensor model, calibration date, units, and QC flags. Sample oxygen and temperature more frequently around dawn, when low DO is often most consequential.
2. **Ingestion:** publish compact JSON over TLS MQTT to a broker. Use per-device credentials, topic ACLs, payload size limits, replay protection, and a dead-letter queue. A consumer validates schema and unit conversions before persistence.
3. **Quality control:** deduplicate on `(device_id, message_id)`, check timestamps/coordinates/ranges, preserve raw payload, calculate robust anomaly flags, and avoid treating missing data as zero.
4. **Persistence:** PostgreSQL with PostGIS for floats/farms/zones and TimescaleDB hypertables for telemetry is a practical production target. Partition by event time, index `(device_id, observed_at DESC)`, retain raw readings, and materialize zone summaries at fixed spatial/time buckets. The present repository has no configured database, so the delivered prototype remains stateless and does not pretend to persist readings.
5. **Analytics:** run the species profile against quality-controlled samples. Aggregate multiple depths into profiles; interpolate only within a documented spatial radius and never across land/barriers. Use bathymetry, protected-area/farm boundaries, current, and seasonal layers when generating polygon boundaries. Store model version, sources, data window, interpolation method, and uncertainty.
6. **Delivery:** FastAPI REST endpoints serve latest float state, telemetry history, thresholds, and PPI. A managed MQTT-to-WebSocket gateway or a small persistent FastAPI service broadcasts updates. Vercel Python functions can serve short REST requests, but are not a reliable home for a long-lived WebSocket process. The existing Vite UI can poll for a simple demo; production streaming should use a managed WebSocket/pub-sub service or a separately hosted persistent service.
7. **User interface:** show source, sample time, sensor health, coverage, profile and uncertainty alongside the score. Farmers can filter sites and act on alerts; researchers can inspect profiles, depth, time windows and provenance.

### API contract

The current backend is FastAPI (`server/main.py`) with the Vercel entrypoint `api/index.py`; the front end is React/Vite. The implementation adds the two stateless endpoints below and leaves persistent ingestion as a staged next milestone.

| Method / route | Purpose and key fields |
| --- | --- |
| `GET /api/pearl/thresholds?species=pinctada_maxima` | Return versioned thresholds, weights, units, ideal/guard bands, provisional flags, per-metric evidence quality/source IDs, and direct source URLs. |
| `POST /api/pearl/index` | Accept one telemetry object (`device_id`, `species`, `observed_at`, `lat`, `lon`, temperature, pressure or depth, salinity, DO, pH, turbidity, chlorophyll-a, QC flags, optional recent-history samples); return PPI, zone class, coverage, per-metric score, explicit missing and excluded metric lists, warnings with source/evidence notes, model version, and data-quality notes. This is the built prototype function. |
| `POST /api/telemetry/batch` | Future authenticated ingestion endpoint used by an MQTT consumer or gateway; validate batches and return accepted/rejected counts. It must not be open to anonymous floats. |
| `GET /api/pearl/zones?bbox=…&species=…&at=…` | Future query for scored polygons and metadata clipped to a map viewport. |
| `GET /api/pearl/floats/{id}/telemetry?from=…&to=…&depth_min=…&depth_max=…` | Future historical multi-sensor profile/time-series endpoint. |
| `GET /api/pearl/floats/{id}` | Future latest float status and sensor-health summary. |
| `WS /ws/telemetry?zone_id=…` | Future push stream for sample, PPI update, alert and heartbeat messages; authenticate before subscribing, cap message rate, and include sequence/time fields. |
| GraphQL (optional later) | A read-only aggregation facade for map viewport + multiple profile series. Do not ship a second API style during the hackathon unless the client actually needs it. |

### Storage model

Use four first-class relational entities and one spatial aggregate:

- `devices`: `id`, `farm_id`, `species_profile`, `status`, `location geography(Point,4326)`, `depth_m`, firmware/sensor inventory, `last_seen_at`.
- `telemetry`: `device_id`, `observed_at`, `message_id`, `sequence`, `metrics JSONB`, `units JSONB`, `qc_flags JSONB`, `calibration_refs JSONB`, `location geography(Point,4326)`, `ingested_at`; Timescale hypertable on `observed_at`, unique key `(device_id, message_id)`.
- `scores`: `device_id`, `observed_at`, `model_version`, `profile_id`, `ppi`, `coverage`, `zone_class`, `metric_scores JSONB`, `warnings JSONB`, `source_window`.
- `alerts`: `id`, `device_id` or `zone_id`, `kind`, `severity`, `opened_at`, `last_seen_at`, `acknowledged_at`, `resolved_at`, `evidence JSONB`.
- `zone_cells`: H3/grid-cell ID, time bucket, species profile, score percentile, coverage, geometry, model version, and uncertainty. Generate visible boundaries from contiguous suitable cells; do not draw farm-ready polygons from a single float.

### Developer roadmap

| Phase | Outcome |
| --- | --- |
| 0 — scientific contract | Choose target species/life stage and locale; validate units and sensor calibration; capture baseline farm growth/survival data; label each threshold by evidence quality. |
| 1 — hackathon MVP (implemented here) | Explainable stateless PPI function, REST endpoints, demo dashboard, parameter-level warnings, responsive map/zone visual, and a source-cited design document. |
| 2 — real device telemetry | Device identity and auth, MQTT ingestion, schema/versioning, duplicate handling, sensor health, raw time-series persistence and replay tooling. |
| 3 — spatial analytics | Bathymetry and protected/farm boundary layers, depth profiles, spatial interpolation with uncertainty, zone polygons and map filters. |
| 4 — validated decision support | Compare scores with farm outcomes; fit per-species/region response curves; backtest seasons; report calibration and confidence; add alert acknowledgement and audit trail. |

## 3. Frontend UI/UX design framework

### Dashboard wireframe

```text
┌ Floatchat / Pearl zones ── species ▾ ─ date range ▾ ─ DEMO / LIVE ┐
├ PPI overview ─ High-suitability area ─ Floats online ─ Active alerts ┤
├ Layer controls ─ temperature / depth / salinity / DO / pH / food ───┤
│                                                                       │
│     Interactive marine map (largest canvas)       │ Selected zone    │
│     float pins + status rings                     │ PPI ring / class │
│     suitability polygons + confidence hatch      │ key drivers      │
│     depth/bathymetry layer + legend               │ warnings         │
│                                                    │ next action      │
├ Selected float: live telemetry sparklines + depth profile + QC ─────┤
└ alert timeline / source and model provenance ────────────────────────┘
```

The map should be the dominant surface, with a selected-zone drawer that stays legible on narrow screens. Float pins encode freshness and sensor health; do not make a pin’s color imply a verified farm boundary. Toggle suitability, depth/bathymetry, live floats, and individual sensor layers. Add a visible legend, time control, species selector, and an “illustrative / observed / modeled” label for every layer. Boundary generation belongs to the spatial analytics phase; the current feature page marks sample zones as illustrative demo geometry.

### Visual system and interactions

Reuse the repository’s dark operations-console language: near-black navy canvas, thin cool-blue borders, monospace telemetry labels, and luminous cyan/seafoam highlights. Use teal for suitable, amber for caution, and red for urgent alerts; always pair color with a text label/icon and never rely on color alone. Keep light text contrast high and motion restrained. Animate new samples with a brief pin pulse, not a continuous glow. Respect reduced-motion preferences.

Telemetry cards show value, unit, target band, timestamp/age, mini trend, and sensor status. The decision card should say “PPI 82 — high suitability screen” rather than “82% yield.” Explain the top two positive drivers and top warnings in plain language. Alert badges include severity, first-seen time, persistence, float ID, and acknowledgement state. Researchers can expand a card to see raw reading, QC status, calibration, threshold provenance, model version, and profile/depth plot; farm operators see a short recommended check with a clear “not a harvest guarantee” note.

## 4. Hackathon-winning features and innovation add-ons

1. **Seasonal yield-risk outlook:** blend historical water conditions with seasonal climate forecasts and a validated farm response curve; show ranges and uncertainty instead of a single deterministic yield promise.
2. **Low-oxygen early warning:** detect persistent and rapidly falling DO, compare against depth and recent dawn minima, identify affected nearby floats, and send an alert before the area-wide threshold breach. Deduplicate and support acknowledgement/escalation.
3. **Historical depth profiling:** show temperature, salinity, DO, pH, and chlorophyll by depth and over time; compare mixed-layer changes and identify safer deployment depths.
4. **Harvest/inspection window advisor:** use validated shell-growth/nacre and husbandry records plus upcoming conditions to suggest inspection timing. Keep the farmer in control and show the evidence and uncertainty interval.
5. **Explainable zone confidence and provenance:** expose data coverage, freshness, calibration state, source sensors, model version, environmental layer dates, and whether a boundary is measured, interpolated, or illustrative. This earns trust and prevents a polished heatmap from pretending to be ground truth.

## References

[1]: https://www.fao.org/4/ab726e/AB726E06.htm "FAO Pearl Oyster Farming, Chapter VI"
[2]: https://cyberleninka.ru/article/n/suitability-area-analysis-for-the-development-of-pearl-oysters-pinctada-maxima-culture-using-geospatial-approaches "Suitability Area Analysis for the Development of Pearl Oysters (Pinctada maxima) Culture Using Geospatial Approaches"
[3]: https://hero.epa.gov/reference/7879934/ "The pearl oysters, Pinctada maxima and P. margaritifera, respond in different ways to culture in dissimilar environments"
[4]: https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.792179/full "Physical Responses of Pinctada fucata to Salinity Stress"
[5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC9751112/ "Combined Effects of Temperature and Salinity on the Digestion and Respiration Metabolism of Pinctada fucata"
[6]: https://www.nature.org/content/dam/tnc/nature/en/documents/Pearl_Case_Study_TNC_web.pdf "Marine Pearl Farming: Nature Conservancy Case Study"
