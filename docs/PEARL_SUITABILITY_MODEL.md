# Pearl oyster suitability screening model

The backend now exposes a five-sensor, explainable screening score called the **Pearl Production Potential Index (PPPI)**. It reports environmental suitability and hazards. It does **not** estimate oyster survival probability, nacre growth rate, pearl quality, or commercial yield. Those endpoints need local farm observations and independent validation.

## Evidence and configured bands

The numbers below are software screening defaults, not universal biological cutoffs. An “ideal” band earns 100 for that metric; readings move linearly toward 0 at the guard-band endpoints. Exceeding a guard endpoint produces 0 for the metric. These score bands should be versioned and re-fit against the target farm, species, life stage, season and sensor calibration before operational use.

| Metric | *P. maxima* ideal | *P. maxima* guard | *P. fucata martensii* ideal | *P. fucata martensii* guard | Interpretation |
|---|---:|---:|---:|---:|---|
| Temperature (°C) | 23–29 | 18–32 | 20–26 | 13–30 | *P. maxima* is a provisional tropical screening band informed by regional temperature context, not a universal optimum. For Japanese temperate pearl oysters, FAO describes 20–25°C growth, hibernation below 13°C, mortality below 6°C, and exhaustion above 28°C. Apply those values only with their regional/species context. |
| Cultivation depth (m) | 10–20 | 1–40 | 10–20 | 1–40 | The ideal is an operational cage-depth preference centered on FAO's approximate 15 m recommendation, not an oyster physiological tolerance. A *P. maxima* survey observed oysters at 28–76 m, mostly shallower than 40 m; wild distribution does not establish farm optimum. |
| Chlorophyll-a (µg/L) | 0.2–5 | 0–20 | 0.2–5 | 0–20 | Low-confidence food-availability proxy. These numeric bands are provisional heuristics, not a universal food range or HAB threshold. |
| Salinity (PSU) | 28–34 | 20–40 | 27–33 | 20–40 | *P. maxima* growth references report an optimum near 30 PSU; 20 and 40 PSU were used as acute stress treatments. The configured guard endpoints are not mortality cutoffs. |
| Dissolved oxygen (mg/L) | ≥5 | 2–5 | ≥5 | 2–5 | 5 mg/L is a conservative operational alert, not a species-specific lethal threshold. General aquatic hypoxia is commonly described below about 2–3 mg/L. In one experiment, *P. f. martensii* held at 2 mg/L for 25 days had 61% mortality; duration and species matter. |

The code contains full evidence notes beside each band in `server/pearl_suitability.py`. In particular, the model does not infer a *P. maxima* lethal temperature, and it does not claim that 30 PSU is a universal salinity optimum for all *Pinctada* species.

## Score and data completeness

For each valid metric, the model computes a 0–100 score with a piecewise linear function: 100 inside the ideal band, then linearly declining to 0 at the relevant guard bound. For one-sided oxygen scoring, valid oxygen at or above 5 mg/L scores 100; values between 2 and 5 decline linearly. There is no unsupported penalty for oxygen above the floor.

The PPPI is the weighted mean across available, QC-valid inputs. Current weights are temperature 0.25, depth 0.15, chlorophyll-a 0.10, salinity 0.25, and dissolved oxygen 0.25. Missing or rejected inputs are not imputed as zero. The response reports `coverage_percent`, the percentage of total configured metric weight that was valid. Coverage is completeness, not accuracy or confidence in a predicted outcome. The `nacre_environment_screen.score` is a weighted environmental proxy based on temperature, food proxy, salinity and oxygen. It is not a nacre deposition rate.

## Hazard pattern handling

The system returns a critical low-oxygen hazard below 2 mg/L and a conservative low-oxygen warning below 5 mg/L. The thresholds remain operational flags rather than mortality predictions.

A red screening alert named `unsafe_bloom_like_pattern` requires all of the following: temperature at or above the species' ideal upper band; chlorophyll-a at least 10 µg/L and at least 50% above the median of two or more historical observations; and dissolved oxygen at or below 5 mg/L, at least 0.5 mg/L below its historical median. An isolated chlorophyll-a value at or above 20 µg/L produces a provisional high-chlorophyll warning only.

These patterns do **not** diagnose a harmful or toxic algal bloom. HAB species and toxins vary by region; NOAA's forecast systems combine imagery, field observations, models, reports and buoy data. Confirmation should use phytoplankton taxonomy/cell counts, toxin testing, or an authoritative local alert. The API returns `confirmation_needed` with the pattern hazard.

## Noise, missing data and unit handling

`preprocess_sensor_data` canonicalizes supported field aliases and accepts depth directly or converts gauge pressure using approximately 1 dbar = 0.994 m. `absolute_pressure_dbar` has an approximate atmospheric pressure subtraction; `pressure_kpa` is converted to dbar before depth conversion. Units should be verified against the sensor's calibration and pressure convention.

Non-numeric/non-finite values and broad physically implausible readings are flagged and excluded. Optional `qc_pass` or per-metric `qc_flags` can reject readings. With at least five historic values, a Hampel-style median/MAD screen flags a current isolated spike beyond three scaled MADs (with metric-specific minimum tolerances). The raw reading remains in `raw_values`; rejected data are not silently smoothed or rewritten. Genuine abrupt environmental events can resemble sensor faults, so review flags against sensor diagnostics and neighboring instruments.

## API

`POST /api/pearl/suitability` accepts a JSON object such as:

```json
{
  "species": "pinctada_maxima",
  "device_id": "AF-001",
  "observed_at": "2026-10-15T05:00:00Z",
  "lat": -8.1,
  "lon": 115.2,
  "temperature_c": 27.0,
  "pressure_dbar": 15.1,
  "chlorophyll_a_ug_l": 2.0,
  "salinity_psu": 30.0,
  "dissolved_oxygen_mg_l": 6.5,
  "history": {
    "chlorophyll_a_ug_l": [4.0, 5.0, 5.0],
    "dissolved_oxygen_mg_l": [7.0, 6.8, 6.5]
  }
}
```

Supported species keys: `pinctada_maxima` and `pinctada_fucata_martensii`. The response includes index, classification, per-metric values/scores/evidence notes, coverage, quality flags, health-risk screen, nacre-environment proxy, hazards, coordinates and limitations. Invalid species is HTTP 422.

## Validation

Run `python -m unittest discover -s tests -v`. Synthetic tests cover optimal conditions, a cold-shock profile, low oxygen, a correlated bloom-like pattern, chlorophyll-only non-diagnosis, missing data, impossible/nonfinite values, isolated noise, pressure conversion, species-specific scoring and unknown species. These demonstrate implementation behavior, not predictive model accuracy.

## References

1. FAO, *Pearl Oyster Farming, Chapter VI*. The guide reports regional and historical farming values; it cautions that site conditions and species context matter. <https://www.fao.org/4/ab726e/AB726E06.htm>
2. McDougall et al. (2021), *Distribution of the Pearl Oyster Pinctada maxima off Eighty Mile Beach, Western Australia*. *Frontiers in Marine Science*. DOI: 10.3389/fmars.2021.679749. <https://doi.org/10.3389/fmars.2021.679749>
3. Wei et al. (2022), *Transcriptomic Signatures of Pearl Oyster Pinctada maxima in Response to Acute Salinity Stress*. *Frontiers in Marine Science*. <https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2022.902595/full>
4. Chen et al. (2022), *Effects of hypoxic stress on the digestion, energy metabolism, oxidative stress regulation, and immune function of the pearl oyster (Pinctada fucata martensii)*. *Aquaculture Reports*. <https://www.sciencedirect.com/science/article/pii/S2352513422002423>
5. NOAA, *Harmful Algal Blooms*. <https://www.noaa.gov/introduction-to-harmful-algal-blooms>
6. Trainer et al. (2015), *Integrative Monitoring of Marine and Freshwater Harmful Algae*. <https://pmc.ncbi.nlm.nih.gov/articles/PMC4417964/>
