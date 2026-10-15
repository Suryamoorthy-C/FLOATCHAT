"""Explainable pearl-oyster environmental screening and hazard-pattern model.

This is a screening model, not a calibrated biological/yield predictor. Values
in OPERATIONAL_BANDS are provisional defaults unless explicitly labeled
literature-backed. A chlorophyll or multi-sensor anomaly is NOT proof of a
harmful/toxic algal bloom; confirmation requires phytoplankton identification,
toxin assays, or an authoritative local HAB alert.
"""
from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any

import numpy as np
import pandas as pd

MODEL_VERSION = "pearl-suitability-screen-1.0.0"

# Temperature guidance for P. maxima is provisional. Published thresholds for
# temperate Japanese pearl oysters are retained as a separate regional/species
# evidence note, not silently applied as P. maxima lethal thresholds.
BIOLOGICAL_EVIDENCE = {
    "pinctada_maxima": {
        "salinity_growth_reference_psu": 30.0,
        "salinity_stress_treatments_psu": [20.0, 40.0],
        "depth_observed_m": [28.0, 76.0],
        "depth_observation_note": "Western Australia survey; 91.8% observations <40 m; distribution is not a farm optimum.",
        "citations": ["FAO pearl oyster farming chapter", "McDougall et al. 2021, Frontiers in Marine Science"],
    },
    "pinctada_fucata_martensii": {
        "temperature_growth_reference_c": [20.0, 26.0],
        "temperature_context": "Japanese suspended culture; regional result, not universal lethal limits.",
        "hypoxia_experiment_do_mg_l": 2.0,
        "hypoxia_experiment_duration_days": 25,
        "hypoxia_experiment_mortality_percent_day_25": 61.0,
        "citations": ["FAO pearl oyster farming chapter", "Chen et al. 2022, Aquaculture Reports"],
    },
}

# Each band is an explicit operational screening assumption. `ideal` gives full
# score; the score declines linearly to zero at guard endpoints. These are not
# lethal limits. HAB chlorophyll thresholds are intentionally provisional.
OPERATIONAL_BANDS: dict[str, dict[str, Any]] = {
    "pinctada_maxima": {
        "temperature_c": {"ideal": (23.0, 29.0), "guard": (18.0, 32.0), "weight": 0.25, "critical": None, "evidence": "Provisional tropical farm-screening band; locally calibrate. FAO regional reference reports 23–27°C growth in Gulf of Kutch; other locations differ. No universal P. maxima lethal cutoffs asserted."},
        "depth_m": {"ideal": (10.0, 20.0), "guard": (1.0, 40.0), "weight": 0.15, "critical": None, "evidence": "Operational cage-depth preference centered on FAO's ~15 m; not a species physiological limit. Local currents, bathymetry and gear matter."},
        "chlorophyll_a_ug_l": {"ideal": (0.2, 5.0), "guard": (0.0, 20.0), "weight": 0.10, "critical": None, "evidence": "Low-confidence food proxy; numeric band is a provisional heuristic, not a universal food or HAB threshold."},
        "salinity_psu": {"ideal": (28.0, 34.0), "guard": (20.0, 40.0), "weight": 0.25, "critical": None, "evidence": "Growth-reference evidence near 30 PSU; 20 and 40 PSU were acute-stress experimental treatments. Guard band is not a mortality range."},
        "dissolved_oxygen_mg_l": {"ideal": (5.0, math.inf), "guard": (2.0, math.inf), "weight": 0.25, "critical": ("lt", 2.0), "evidence": "5 mg/L is a conservative operational alert, not a measured P. maxima lethal threshold. General hypoxia is commonly <2–3 mg/L; species, temperature and duration matter. No unsupported upper penalty."},
    },
    "pinctada_fucata_martensii": {
        "temperature_c": {"ideal": (20.0, 26.0), "guard": (13.0, 30.0), "weight": 0.25, "critical": ("lt", 6.0), "evidence": "Regional Japanese growth reference 20–26°C. FAO reports <13°C hibernation, <6°C mortality and >28°C exhaustion for temperate Japanese pearl oysters; regional and life-stage qualifications apply."},
        "depth_m": {"ideal": (10.0, 20.0), "guard": (1.0, 40.0), "weight": 0.15, "critical": None, "evidence": "Operational cage-depth preference centered on FAO's ~15 m; not a physiological limit."},
        "chlorophyll_a_ug_l": {"ideal": (0.2, 5.0), "guard": (0.0, 20.0), "weight": 0.10, "critical": None, "evidence": "Low-confidence food proxy; numeric band is a provisional heuristic, not a universal food or HAB threshold."},
        "salinity_psu": {"ideal": (27.0, 33.0), "guard": (20.0, 40.0), "weight": 0.25, "critical": None, "evidence": "Provisional operational range around marine conditions; culture-site validation required."},
        "dissolved_oxygen_mg_l": {"ideal": (5.0, math.inf), "guard": (2.0, math.inf), "weight": 0.25, "critical": ("lt", 2.0), "evidence": "Conservative operational alert, not a universal species safety limit. P. f. martensii experiment at 2 mg/L for 25 d had 61% mortality; exposure duration is material. No unsupported upper penalty."},
    },
}

ALIASES = {
    "temperature_c": ("temperature_c", "water_temp_c", "temp_c", "temperature"),
    "depth_m": ("depth_m", "depth", "water_depth_m"),
    "chlorophyll_a_ug_l": ("chlorophyll_a_ug_l", "chlorophyll_a", "chl_a_ug_l", "chla"),
    "salinity_psu": ("salinity_psu", "salinity", "psu"),
    "dissolved_oxygen_mg_l": ("dissolved_oxygen_mg_l", "do_mg_l", "dissolved_oxygen", "do"),
}

# Broad plausibility checks catch corrupt/unit-mismatched values, not animal tolerance.
PHYSICAL_RANGES = {
    "temperature_c": (-2.5, 45.0),
    "depth_m": (0.0, 120.0),
    "chlorophyll_a_ug_l": (0.0, 500.0),
    "salinity_psu": (0.0, 60.0),
    "dissolved_oxygen_mg_l": (0.0, 30.0),
}


def _finite(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    return result if math.isfinite(result) else None


def _canonical_readings(data: dict[str, Any]) -> dict[str, float | None]:
    values: dict[str, float | None] = {}
    for metric, aliases in ALIASES.items():
        raw = next((data[key] for key in aliases if key in data), None)
        values[metric] = _finite(raw)
    if values["depth_m"] is None:
        # pressure_dbar is gauge pressure; approximately 1 dbar = 0.994 m.
        gauge = _finite(data.get("pressure_dbar"))
        absolute = _finite(data.get("absolute_pressure_dbar"))
        pressure_kpa = _finite(data.get("pressure_kpa"))
        if absolute is not None:
            gauge = absolute - 10.1325
        elif gauge is None and pressure_kpa is not None:
            gauge = pressure_kpa / 10.066
        if gauge is not None:
            values["depth_m"] = gauge * 0.994
    return values


def _history_frame(history: Any, metric: str) -> pd.Series:
    """Extract finite historic values from {metric:[...]} or sample records."""
    candidates: list[Any] = []
    if isinstance(history, dict):
        values = history.get(metric)
        if values is None:
            for alias in ALIASES[metric]:
                if alias in history:
                    values = history[alias]
                    break
        if isinstance(values, (list, tuple, np.ndarray, pd.Series)):
            candidates.extend(list(values))
    elif isinstance(history, list):
        for row in history:
            if isinstance(row, dict):
                candidates.append(_canonical_readings(row).get(metric))
    return pd.Series([n for item in candidates if (n := _finite(item)) is not None], dtype="float64")


def preprocess_sensor_data(sensor_data: dict[str, Any]) -> dict[str, Any]:
    """Validate readings, normalize units/aliases, and flag isolated spikes.

    With >=5 historical values, a Hampel-style robust deviation check marks a
    current value suspect when it differs by >max(3 scaled MAD, metric floor).
    Suspect readings are excluded from the composite score but preserved in
    `raw_values` and never silently changed. This is QC screening, not smoothing.
    """
    if not isinstance(sensor_data, dict):
        raise ValueError("sensor_data must be a JSON object")
    raw = _canonical_readings(sensor_data)
    clean: dict[str, float | None] = {}
    flags: list[dict[str, str]] = []
    missing: list[str] = []
    floors = {"temperature_c": 0.5, "depth_m": 2.0, "chlorophyll_a_ug_l": 0.5,
              "salinity_psu": 0.5, "dissolved_oxygen_mg_l": 0.5}
    qc_flags = sensor_data.get("qc_flags") if isinstance(sensor_data.get("qc_flags"), dict) else {}
    global_qc_failed = sensor_data.get("qc_pass") is False
    for metric, value in raw.items():
        if value is None:
            clean[metric] = None
            missing.append(metric)
            supplied = any(k in sensor_data for k in ALIASES[metric]) or (metric == "depth_m" and any(k in sensor_data for k in ("pressure_dbar", "absolute_pressure_dbar", "pressure_kpa")))
            if supplied:
                flags.append({"metric": metric, "code": "invalid_nonfinite_or_nonnumeric"})
            continue
        low, high = PHYSICAL_RANGES[metric]
        if value < low or value > high:
            clean[metric] = None
            flags.append({"metric": metric, "code": "outside_plausibility_range", "value": str(value)})
            continue
        if global_qc_failed or qc_flags.get(metric) in (False, "fail", "bad", "invalid", "rejected"):
            clean[metric] = None
            flags.append({"metric": metric, "code": "qc_failed"})
            continue
        history = _history_frame(sensor_data.get("history"), metric)
        if len(history) >= 5:
            center = float(history.median())
            mad = float((history - center).abs().median())
            tolerance = max(3.0 * 1.4826 * mad, floors[metric])
            if abs(value - center) > tolerance:
                clean[metric] = None
                flags.append({"metric": metric, "code": "isolated_robust_outlier", "baseline_median": center, "tolerance": tolerance})
                continue
        clean[metric] = value
    return {"values": clean, "raw_values": raw, "missing_metrics": missing, "quality_flags": flags}


def _metric_score(value: float, ideal: tuple[float, float], guard: tuple[float, float]) -> float:
    low, high = ideal
    guard_low, guard_high = guard
    if math.isinf(high):
        return 100.0 if value >= low else float(np.clip(100.0 * (value - guard_low) / (low - guard_low), 0.0, 100.0))
    if low <= value <= high:
        return 100.0
    if value < low:
        return float(np.clip(100.0 * (value - guard_low) / (low - guard_low), 0.0, 100.0))
    return float(np.clip(100.0 * (guard_high - value) / (guard_high - high), 0.0, 100.0))


def _trend(history: Any, metric: str, current: float | None) -> dict[str, Any] | None:
    series = _history_frame(history, metric)
    if current is None or len(series) < 2:
        return None
    baseline = float(series.median())
    return {"baseline_median": baseline, "current": current,
            "absolute_change": current - baseline,
            "relative_change": (current - baseline) / max(abs(baseline), 0.1)}


def _hazards(raw: dict[str, float | None], clean: dict[str, float | None], data: dict[str, Any], species: str) -> list[dict[str, Any]]:
    hazards: list[dict[str, Any]] = []
    bands = OPERATIONAL_BANDS[species]
    temp = raw.get("temperature_c")
    oxygen = raw.get("dissolved_oxygen_mg_l")
    chla = raw.get("chlorophyll_a_ug_l")
    chla_trend = _trend(data.get("history"), "chlorophyll_a_ug_l", chla)
    oxygen_trend = _trend(data.get("history"), "dissolved_oxygen_mg_l", oxygen)
    if oxygen is not None and oxygen < 2.0:
        hazards.append({"code": "severe_hypoxia", "level": "critical", "message": "Dissolved oxygen is below 2 mg/L; this is severe hypoxia. Duration and oyster response require monitoring."})
    elif oxygen is not None and oxygen < 5.0:
        hazards.append({"code": "low_oxygen", "level": "warning", "message": "Dissolved oxygen is below the conservative 5 mg/L operational alert level."})
    bloom_like_chla = bool(chla is not None and chla >= 10.0 and chla_trend and chla_trend["relative_change"] >= 0.5)
    warming = bool(temp is not None and temp >= bands["temperature_c"]["ideal"][1])
    falling_oxygen = bool(oxygen is not None and oxygen <= 5.0 and oxygen_trend and oxygen_trend["absolute_change"] <= -0.5)
    if chla is not None and chla >= 20.0:
        hazards.append({"code": "very_high_chlorophyll_provisional", "level": "warning", "message": "Chlorophyll-a exceeds a provisional screening trigger (20 µg/L); concentration alone cannot identify harmful algae or toxin risk."})
    if warming and bloom_like_chla and falling_oxygen:
        hazards.append({
            "code": "unsafe_bloom_like_pattern", "level": "critical", "zone_label": "Unsafe algae-bloom-like stress pattern (red screening alert)",
            "message": "Warm water, rising chlorophyll-a and falling/low oxygen co-occur. Treat this as a precautionary bloom-like hazard pattern, not confirmation of a harmful/toxic algal bloom.",
            "evidence": {"temperature_c": temp, "chlorophyll_a_ug_l": chla, "chlorophyll_relative_change": chla_trend["relative_change"], "dissolved_oxygen_mg_l": oxygen, "oxygen_change_mg_l": oxygen_trend["absolute_change"]},
            "confirmation_needed": ["phytoplankton taxonomy/cell counts", "toxin assay or local health authority HAB notice"],
        })
    return hazards


def calculate_pearl_suitability(sensor_data: dict[str, Any], species: str = "pinctada_maxima") -> dict[str, Any]:
    """Return transparent PPPI screening score, per-metric scores, hazards and provenance.

    Sensor input keys: temperature_c, pressure_dbar or depth_m,
    chlorophyll_a_ug_l, salinity_psu, dissolved_oxygen_mg_l. Optional history
    is either {metric: [older values]} or a list of historic sample dictionaries.
    """
    species_key = str(species).lower()
    if species_key not in OPERATIONAL_BANDS:
        raise ValueError(f"Unsupported species profile: {species}")
    prepared = preprocess_sensor_data(sensor_data)
    values = prepared["values"]
    raw = prepared["raw_values"]
    profile = OPERATIONAL_BANDS[species_key]
    parameter_scores: dict[str, Any] = {}
    total_weight = sum(spec["weight"] for spec in profile.values())
    accepted_weight = 0.0
    weighted = 0.0
    critical_metric = False
    for metric, spec in profile.items():
        value = values[metric]
        if value is None:
            continue
        score = _metric_score(value, spec["ideal"], spec["guard"])
        accepted_weight += spec["weight"]
        weighted += spec["weight"] * score
        critical = False
        if spec["critical"]:
            op, cutoff = spec["critical"]
            critical = value < cutoff if op == "lt" else value > cutoff
        critical_metric |= critical
        parameter_scores[metric] = {
            "value": round(value, 4), "unit": {"temperature_c": "°C", "depth_m": "m", "chlorophyll_a_ug_l": "µg/L", "salinity_psu": "PSU", "dissolved_oxygen_mg_l": "mg/L"}[metric],
            "score": round(score, 2), "state": "ideal" if score >= 99.999 else "outside_ideal",
            "weight": spec["weight"], "critical": critical, "evidence_note": spec["evidence"],
        }
    coverage = accepted_weight / total_weight if total_weight else 0.0
    index = round(weighted / accepted_weight, 2) if accepted_weight else None
    hazards = _hazards(raw, values, sensor_data, species_key)
    health_risk_hazards = [h for h in hazards if h["code"] in {"severe_hypoxia", "low_oxygen", "unsafe_bloom_like_pattern"}]
    nacre_metrics = {"temperature_c", "chlorophyll_a_ug_l", "salinity_psu", "dissolved_oxygen_mg_l"}
    nacre_weight = sum(profile[metric]["weight"] for metric in parameter_scores if metric in nacre_metrics)
    nacre_environment_score = round(sum(profile[metric]["weight"] * parameter_scores[metric]["score"] for metric in parameter_scores if metric in nacre_metrics) / nacre_weight, 2) if nacre_weight else None
    if critical_metric or any(h["level"] == "critical" for h in hazards):
        classification = "critical-risk"
    elif coverage < 0.5:
        classification = "insufficient-data"
    elif index is None:
        classification = "insufficient-data"
    elif index >= 80:
        classification = "high-suitability"
    elif index >= 65:
        classification = "promising"
    elif index >= 45:
        classification = "marginal"
    else:
        classification = "low-suitability"
    observed_at = sensor_data.get("observed_at") or datetime.now(timezone.utc).isoformat()
    location = {key: sensor_data[key] for key in ("lat", "lon", "longitude") if key in sensor_data}
    return {
        "index": index,
        "index_name": "Pearl Production Potential Index (PPPI)",
        "classification": classification,
        "species": species_key,
        "model_version": MODEL_VERSION,
        "observed_at": observed_at,
        "location": location,
        "coverage_percent": round(coverage * 100.0, 1),
        "confidence_note": "Coverage measures the share of configured score weight with valid readings; it is not calibrated prediction accuracy.",
        "parameter_scores": parameter_scores,
        "health_risk": {"status": "elevated" if health_risk_hazards else "no_current_sensor_hazard_detected", "hazards": health_risk_hazards},
        "nacre_environment_screen": {"score": nacre_environment_score, "note": "Environmental-condition proxy only; it is not a nacre deposition rate, pearl quality forecast, or calibrated yield prediction."},
        "missing_metrics": prepared["missing_metrics"],
        "quality_flags": prepared["quality_flags"],
        "hazards": hazards,
        "unsafe_zone": any(h["code"] == "unsafe_bloom_like_pattern" for h in hazards),
        "biological_evidence": BIOLOGICAL_EVIDENCE.get(species_key, {}),
        "model_limitations": [
            "This transparent screening score is not a measured probability of oyster health, nacre deposition, or pearl yield.",
            "Bands and weights require validation by species, life stage, farm, season, depth and sensor calibration.",
            "Chlorophyll-a does not identify algal species or toxins; the model cannot confirm HABs.",
        ],
    }
