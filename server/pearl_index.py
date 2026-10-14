"""Explainable environmental suitability scoring for pearl-oyster site screening.

This module computes a screening index, not a biological yield forecast. The
profile bands and weights are versioned product defaults that require local,
species- and life-stage-specific calibration against farm outcomes.
"""
from __future__ import annotations

from datetime import datetime, timezone
import math
from statistics import median
from typing import Any

MODEL_VERSION = "ppi-0.1.0"
PROFILE_VERSION = "indo-pacific-pinctada-maxima-0.2"
_SOURCES = [
    {"id": "1", "title": "FAO Pearl Oyster Farming, Chapter VI", "url": "https://www.fao.org/4/ab726e/AB726E06.htm"},
    {"id": "2", "title": "Distribution of the Pearl Oyster Pinctada maxima off Eighty Mile Beach, Western Australia", "url": "https://doi.org/10.3389/fmars.2021.679749"},
    {"id": "3", "title": "NOAA AOML Argo Program overview", "url": "https://www.aoml.noaa.gov/argo/"},
    {"id": "4", "title": "Physical Responses of Pinctada fucata to Salinity Stress", "url": "https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.792179/full"},
    {"id": "5", "title": "Combined effects of temperature and salinity on Pinctada fucata physiology", "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9751112/"},
]

# Weights are explicit MVP assumptions, not fitted biological coefficients.
_BASE_METRICS: dict[str, dict[str, Any]] = {
    "water_temp_c": {
        "label": "Water temperature", "unit": "°C", "ideal": (26.0, 30.0),
        "outer": (20.0, 34.0), "weight": 0.19, "physical": (-3.0, 50.0),
        "critical": lambda v: v < 20.0 or v > 32.0,
        "rationale": "Provisional tropical screening band; published temperature responses vary by species, life stage, season, and region. Validate locally.",
    },
    "depth_m": {
        "label": "Culture depth", "unit": "m", "ideal": (15.0, 20.0),
        "outer": (5.0, 35.0), "weight": 0.16, "physical": (0.0, 12000.0),
        "critical": lambda v: v < 3.0 or v > 100.0,
        "rationale": "FAO identifies about 15 m as a culture-depth starting point; local bathymetry, gear, currents, and life stage are required.",
    },
    "salinity_psu": {
        "label": "Salinity", "unit": "PSU", "ideal": (32.0, 35.0),
        "outer": (24.0, 50.0), "weight": 0.18, "physical": (0.0, 70.0),
        "critical": lambda v: v < 24.0 or v > 50.0,
        "rationale": "Screening band only. FAO reports short-duration tolerance across a much wider range; growth and pearl outcomes require local calibration.",
    },
    "dissolved_oxygen_mg_l": {
        "label": "Dissolved oxygen", "unit": "mg/L", "ideal": (6.0, math.inf),
        "outer": (2.0, math.inf), "weight": 0.18, "physical": (0.0, 40.0),
        "critical": lambda v: v < 4.0,
        "rationale": "Initial oxygen screen only; no universal upper growth optimum is asserted. Confirm sensor method, depth, temperature, and local farm outcomes.",
    },
    "ph": {
        "label": "pH", "unit": "pH", "ideal": (7.8, 8.6),
        "outer": (7.0, 9.2), "weight": 0.12, "physical": (0.0, 14.0),
        "critical": lambda v: v < 7.5 or v > 9.0,
        "rationale": "Screening band for seawater pH; not a universal P. maxima production range and not a substitute for alkalinity or carbonate-system measurements.",
    },
    "turbidity_ntu": {
        "label": "Turbidity", "unit": "NTU", "ideal": (0.0, 5.0),
        "outer": (0.0, 25.0), "weight": 0.08, "physical": (0.0, 10000.0),
        "critical": lambda v: v > 15.0,
        "rationale": "FAO links clear water and low silt load with pearl-oyster condition; NTU is a provisional proxy and must be calibrated against local suspended solids and Secchi depth.",
    },
    "chlorophyll_a_ug_l": {
        "label": "Chlorophyll-a", "unit": "µg/L", "ideal": (0.25, 5.0),
        "outer": (0.0, 25.0), "weight": 0.09, "physical": (0.0, 500.0),
        "critical": lambda v: v > 25.0,
        "rationale": "Low-confidence food-availability proxy; chlorophyll-a is region- and season-dependent and is not a direct feed or pearl-yield measure.",
    },
}

_METRIC_EVIDENCE = {
    "water_temp_c": {"source_refs": ["1", "2"], "evidence_quality": "medium"},
    "depth_m": {"source_refs": ["1", "2"], "evidence_quality": "medium"},
    "salinity_psu": {"source_refs": ["1"], "evidence_quality": "medium"},
    "dissolved_oxygen_mg_l": {"source_refs": ["1", "3"], "evidence_quality": "low"},
    "ph": {"source_refs": ["3", "4"], "evidence_quality": "low"},
    "turbidity_ntu": {"source_refs": ["1"], "evidence_quality": "medium"},
    "chlorophyll_a_ug_l": {"source_refs": ["2", "3"], "evidence_quality": "low"},
}
_PROFILE_EVIDENCE_OVERRIDES = {
    "pinctada_fucata": {
        "water_temp_c": {"source_refs": ["4", "5"], "evidence_quality": "low"},
        "salinity_psu": {"source_refs": ["4", "5"], "evidence_quality": "low"},
    }
}

_SPECIES = {
    "pinctada_maxima": {
        "common_name": "Gold-lip pearl oyster",
        "scientific_name": "Pinctada maxima",
        "profile_version": PROFILE_VERSION,
        "metrics": _BASE_METRICS,
        "profile_note": "Indo-Pacific tropical screening defaults informed by FAO farm guidance and a Western Australia habitat study; not a locally validated yield model.",
    },
    "pinctada_fucata": {
        "common_name": "Akoya pearl oyster",
        "scientific_name": "Pinctada fucata",
        "profile_version": "pinctada-fucata-response-center-0.1",
        "metrics": {
            **_BASE_METRICS,
            "water_temp_c": {
                **_BASE_METRICS["water_temp_c"], "ideal": (24.0, 26.0), "outer": (20.0, 30.0),
                "rationale": "Narrow band around a controlled-study physiological response-surface center; not field- or pearl-yield validated.",
            },
            "salinity_psu": {
                **_BASE_METRICS["salinity_psu"], "ideal": (27.0, 29.0), "outer": (23.0, 33.0),
                "rationale": "Narrow band around a controlled-study physiological response-surface center; not field- or pearl-yield validated.",
            },
        },
        "profile_note": "Controlled-study response-surface center for P. fucata; the experiment is not a field suitability map or yield model. Confirm location, stage, and production objective.",
    },
}

_ALIASES = {
    "water_temp_c": ("water_temp_c", "temperature_c", "temp_c", "temperature"),
    "depth_m": ("depth_m", "water_depth_m", "depth"),
    "salinity_psu": ("salinity_psu", "salinity", "psu"),
    "dissolved_oxygen_mg_l": ("dissolved_oxygen_mg_l", "do_mg_l", "dissolved_oxygen", "do"),
    "ph": ("ph", "pH"),
    "turbidity_ntu": ("turbidity_ntu", "turbidity"),
    "chlorophyll_a_ug_l": ("chlorophyll_a_ug_l", "chlorophyll_a", "chl_a_ug_l"),
}

_OUTLIER_FLOORS = {
    "water_temp_c": 0.5, "depth_m": 5.0, "salinity_psu": 0.5,
    "dissolved_oxygen_mg_l": 1.0, "ph": 0.15, "turbidity_ntu": 2.0,
    "chlorophyll_a_ug_l": 0.5,
}


def _number(value: Any) -> float | None:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if math.isfinite(numeric) else None


def _read_value(payload: dict[str, Any], metric: str) -> float | None:
    for key in _ALIASES[metric]:
        if key in payload:
            return _number(payload[key])
    if metric == "depth_m":
        pressure = _number(payload.get("pressure_dbar"))
        absolute_pressure = _number(payload.get("absolute_pressure_dbar"))
        pressure_kpa = _number(payload.get("pressure_kpa"))
        if absolute_pressure is not None:
            pressure = absolute_pressure - 10.1325
        elif pressure is None and pressure_kpa is not None:
            pressure = pressure_kpa / 10.066
        if pressure is not None:
            # Approximately 1 dbar = 0.994 m seawater; expects gauge pressure.
            return pressure * 0.994
    return None


def _qc_rejected(metric: str, payload: dict[str, Any]) -> tuple[bool, str | None]:
    if payload.get("qc_pass") is False:
        return True, "sample-level QC failed"
    flags = payload.get("qc_flags") or {}
    candidates = [metric, *_ALIASES.get(metric, ())]
    if metric == "depth_m":
        candidates.extend(("pressure_dbar", "absolute_pressure_dbar", "pressure_kpa"))
    flag = next((flags[key] for key in candidates if key in flags), None) if isinstance(flags, dict) else None
    if isinstance(flag, dict):
        if flag.get("passed") is False:
            return True, str(flag.get("reason") or "sensor QC failed")
        flag = flag.get("status")
    if flag is False or (isinstance(flag, str) and flag.lower() in {"fail", "bad", "rejected", "invalid"}):
        return True, "sensor QC failed"
    return False, None


def _history_values(history: Any, metric: str) -> list[float]:
    if not isinstance(history, dict):
        return []
    raw = history.get(metric)
    if not isinstance(raw, list):
        return []
    return [value for item in raw if (value := _number(item)) is not None]


def _robust_outlier(value: float, values: list[float], metric: str) -> bool:
    if len(values) < 5:
        return False
    center = median(values)
    mad = median([abs(item - center) for item in values])
    sigma = 1.4826 * mad
    threshold = max(3.0 * sigma, _OUTLIER_FLOORS[metric])
    return abs(value - center) > threshold


def _metric_score(value: float, ideal: tuple[float, float], outer: tuple[float, float]) -> float:
    ideal_low, ideal_high = ideal
    outer_low, outer_high = outer
    if math.isinf(ideal_high) and math.isinf(outer_high):
        if value >= ideal_low:
            return 100.0
        width = ideal_low - outer_low
        return 0.0 if width <= 0 or value <= outer_low else 100.0 * (value - outer_low) / width
    if ideal_low <= value <= ideal_high:
        return 100.0
    if value < ideal_low:
        width = ideal_low - outer_low
        return 0.0 if width <= 0 or value <= outer_low else 100.0 * (value - outer_low) / width
    width = outer_high - ideal_high
    return 0.0 if width <= 0 or value >= outer_high else 100.0 * (outer_high - value) / width


def _public_band(band: tuple[float, float]) -> list[float | None]:
    return [band[0], band[1] if math.isfinite(band[1]) else None]


def _display_band(band: tuple[float, float]) -> str:
    return f"≥ {band[0]}" if math.isinf(band[1]) else f"{band[0]}–{band[1]}"


def _zone_class(score: float, coverage: float, critical: bool) -> str:
    if coverage < 0.5:
        return "insufficient-data"
    if critical:
        return "critical-risk"
    if score >= 80:
        return "high-suitability"
    if score >= 65:
        return "promising"
    if score >= 45:
        return "marginal"
    return "low-suitability"


def species_thresholds(species: str = "pinctada_maxima") -> dict[str, Any]:
    """Return a JSON-ready, versioned species profile and its evidence notes."""
    key = str(species or "pinctada_maxima").lower()
    profile = _SPECIES.get(key)
    if profile is None:
        raise ValueError(f"Unsupported species profile: {species}")
    metrics = {}
    for metric, spec in profile["metrics"].items():
        evidence = _PROFILE_EVIDENCE_OVERRIDES.get(key, {}).get(metric, _METRIC_EVIDENCE[metric])
        metrics[metric] = {
            "label": spec["label"], "unit": spec["unit"],
            "ideal": _public_band(spec["ideal"]), "guard": _public_band(spec["outer"]),
            "weight": spec["weight"], "rationale": spec["rationale"],
            "provisional": metric in {"turbidity_ntu", "chlorophyll_a_ug_l"},
            "evidence_quality": evidence["evidence_quality"], "source_refs": evidence["source_refs"],
        }
    return {
        "species": key, "scientific_name": profile["scientific_name"],
        "common_name": profile["common_name"], "profile_version": profile["profile_version"],
        "model_version": MODEL_VERSION, "profile_note": profile["profile_note"],
        "metrics": metrics, "sources": _SOURCES,
        "classification_bands": {"high-suitability": [80, 100], "promising": [65, 79.999], "marginal": [45, 64.999], "low-suitability": [0, 44.999]},
        "confidence_semantics": "coverage is the fraction of configured metric weight present and QC-valid; it is not prediction accuracy",
    }


def calculate_pearl_index(telemetry: dict[str, Any], species: str | None = None) -> dict[str, Any]:
    """Score one multi-sensor telemetry sample and return structured JSON data.

    Accepted canonical metrics are water_temp_c, depth_m (or pressure_dbar),
    salinity_psu, dissolved_oxygen_mg_l, ph, turbidity_ntu, and
    chlorophyll_a_ug_l. Optional `history` maps metric names to recent values.
    """
    if not isinstance(telemetry, dict):
        raise ValueError("telemetry must be a JSON object")
    species_key = str(species or telemetry.get("species") or "pinctada_maxima").lower()
    profile = _SPECIES.get(species_key)
    if profile is None:
        raise ValueError(f"Unsupported species profile: {species_key}")

    total_weight = sum(spec["weight"] for spec in profile["metrics"].values())
    accepted_weight = 0.0
    weighted_total = 0.0
    metric_scores: dict[str, Any] = {}
    excluded: list[dict[str, str]] = []
    missing: list[dict[str, str]] = []
    warnings: list[dict[str, Any]] = []
    critical = False
    history = telemetry.get("history", {})

    for metric, spec in profile["metrics"].items():
        rejected, reason = _qc_rejected(metric, telemetry)
        value = _read_value(telemetry, metric)
        if value is None:
            supplied = any(key in telemetry for key in _ALIASES[metric]) or metric == "depth_m" and any(k in telemetry for k in ("pressure_dbar", "absolute_pressure_dbar", "pressure_kpa"))
            missing.append({"metric": metric, "reason": "supplied but non-finite/non-numeric" if supplied else "not supplied"})
            continue
        physical_low, physical_high = spec["physical"]
        if value < physical_low or value > physical_high:
            rejected, reason = True, "outside sensor-physical range"
        recent = _history_values(history, metric)
        if not rejected and _robust_outlier(value, recent, metric):
            rejected, reason = True, "robust outlier (>3 MAD-scaled deviations from recent history)"
        if rejected:
            excluded.append({"metric": metric, "reason": reason or "QC rejected"})
            warnings.append({"code": "metric-excluded", "metric": metric, "severity": "warning", "message": f"{spec['label']} excluded from this score: {reason or 'QC rejected'}."})
            continue

        score = _metric_score(value, spec["ideal"], spec["outer"])
        accepted_weight += spec["weight"]
        weighted_total += spec["weight"] * score
        state = "ideal" if score >= 99.999 else "outside-ideal"
        evidence = _PROFILE_EVIDENCE_OVERRIDES.get(species_key, {}).get(metric, _METRIC_EVIDENCE[metric])
        metric_scores[metric] = {
            "label": spec["label"], "value": round(value, 3), "unit": spec["unit"],
            "score": round(score, 1), "state": state,
            "ideal": _public_band(spec["ideal"]), "weight": spec["weight"],
            "evidence_quality": evidence["evidence_quality"], "source_refs": evidence["source_refs"],
            "provisional": metric in {"turbidity_ntu", "chlorophyll_a_ug_l"},
        }
        if state != "ideal":
            is_critical = bool(spec["critical"](value))
            critical = critical or is_critical
            severity = "critical" if is_critical else "warning"
            ideal_label = _display_band(spec["ideal"])
            evidence = _PROFILE_EVIDENCE_OVERRIDES.get(species_key, {}).get(metric, _METRIC_EVIDENCE[metric])
            warnings.append({
                "code": "outside-ideal-band", "metric": metric, "severity": severity,
                "value": round(value, 3), "unit": spec["unit"],
                "ideal": _public_band(spec["ideal"]),
                "message": f"{spec['label']} is outside the initial ideal band {ideal_label} {spec['unit']}. {spec['rationale']}",
                "evidence_quality": evidence["evidence_quality"], "source_refs": evidence["source_refs"],
            })

    coverage = accepted_weight / total_weight if total_weight else 0.0
    index = weighted_total / accepted_weight if accepted_weight else None
    zone_class = _zone_class(index or 0.0, coverage, critical)
    if coverage < 1.0:
        warnings.append({
            "code": "incomplete-coverage", "severity": "info",
            "message": f"Only {coverage * 100:.0f}% of configured metric weight is present and QC-valid; missing values were not imputed.",
        })

    observed_at = telemetry.get("observed_at")
    if isinstance(observed_at, str):
        try:
            timestamp = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=timezone.utc)
            age_minutes = (datetime.now(timezone.utc) - timestamp.astimezone(timezone.utc)).total_seconds() / 60
            if age_minutes > 15:
                warnings.append({"code": "stale-sample", "severity": "warning", "message": f"The sample is {age_minutes:.0f} minutes old."})
            elif age_minutes < -5:
                warnings.append({"code": "future-timestamp", "severity": "warning", "message": "The sample timestamp is more than five minutes in the future; check device clock synchronization."})
        except ValueError:
            warnings.append({"code": "invalid-timestamp", "severity": "warning", "message": "observed_at is not a valid ISO-8601 timestamp."})

    position = {}
    lat = _number(telemetry.get("lat"))
    lon = _number(telemetry.get("lon", telemetry.get("longitude")))
    if lat is not None and lon is not None and -90 <= lat <= 90 and -180 <= lon <= 180:
        position = {"lat": lat, "lon": lon}

    return {
        "index": round(index, 1) if index is not None else None,
        "index_name": "Pearl Production Index",
        "index_semantics": "environmental suitability screen; not a measured or predicted pearl yield",
        "zone_class": zone_class,
        "coverage": round(coverage, 3),
        "coverage_percent": round(coverage * 100, 1),
        "coverage_is_accuracy": False,
        "species": profile["scientific_name"], "species_profile": species_key,
        "profile_version": profile["profile_version"], "model_version": MODEL_VERSION,
        "profile_note": profile["profile_note"], "threshold_sources": _SOURCES,
        "device_id": telemetry.get("device_id"), "observed_at": observed_at,
        "position": position or None,
        "parameter_scores": metric_scores, "missing_metrics": missing, "excluded_metrics": excluded,
        "warnings": warnings,
        "interpretation": "Use this screening result to prioritize site review. Confirm local conditions and farm outcomes before operational or yield decisions.",
    }
