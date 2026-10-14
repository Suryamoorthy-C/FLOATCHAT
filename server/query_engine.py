"""Deterministic query understanding and evidence packaging for FloatChat."""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

from .live_data import SOURCE_LABEL, store

REGIONS = {
    "bay of bengal": (80, 100, 5, 23),
    "arabian sea": (50, 78, 5, 30),
    "indian ocean": (20, 120, -40, 30),
    "global": (-180, 180, -90, 90),
    "global ocean": (-180, 180, -90, 90),
}


def _region(question: str) -> tuple[str | None, tuple[float, float, float, float] | None]:
    for name, bounds in REGIONS.items():
        if name in question:
            return name.title(), bounds
    return None, None


def _numbers(question: str) -> list[float]:
    return [float(value) for value in re.findall(r"(?<![a-z])\d+(?:\.\d+)?", question)]


def interpret(question: str) -> dict[str, Any]:
    normalized = question.strip().lower()
    region, bounds = _region(normalized)
    float_match = re.search(r"(?:wmo|float|platform|profile)\s*(?:id|number)?\s*[:#-]?\s*(\d{6,8})", normalized)
    float_id = float_match.group(1) if float_match else None
    variables = []
    if any(word in normalized for word in ("temperature", "temp", "thermocline")): variables.append("temperature")
    if "salin" in normalized or "halocline" in normalized: variables.append("salinity")
    if any(word in normalized for word in ("oxygen", "o2", "chlorophyll", "nitrate", "ph")): variables.append("biogeochemical")
    if not variables: variables = ["temperature", "salinity"]
    if any(word in normalized for word in ("anomal", "unusual", "outlier")): intent = "anomaly"
    elif any(word in normalized for word in ("compare", "comparison", "versus", " vs ")): intent = "compare"
    elif any(word in normalized for word in ("profile", "depth", "thermocline", "halocline")) or float_id: intent = "profile"
    elif any(word in normalized for word in ("map", "where", "show", "available", "floats")): intent = "map"
    elif any(word in normalized for word in ("source", "support", "evidence", "data used")): intent = "explain"
    else: intent = "lookup"
    depth_range = None
    nums = _numbers(normalized)
    if "below" in normalized and nums: depth_range = {"min_pressure_dbar": nums[0], "max_pressure_dbar": None}
    elif "above" in normalized and nums: depth_range = {"min_pressure_dbar": 0, "max_pressure_dbar": nums[0]}
    elif "between" in normalized and len(nums) >= 2 and any(word in normalized for word in ("m", "meter", "dbar")):
        depth_range = {"min_pressure_dbar": min(nums[-2:]), "max_pressure_dbar": max(nums[-2:])}
    return {"intent": intent, "region": region, "bounds": bounds, "variables": variables, "float_id": float_id, "depth_range": depth_range, "visualization": "profile" if intent == "profile" else "globe_markers", "method": "2-sigma screening" if intent == "anomaly" else "descriptive statistics"}


def _in_bounds(row: dict[str, Any], bounds: tuple[float, float, float, float] | None) -> bool:
    if not bounds: return True
    lon, lat = row.get("lon"), row.get("lat")
    return lon is not None and lat is not None and bounds[0] <= lon <= bounds[1] and bounds[2] <= lat <= bounds[3]


def _num_stats(values: list[float]) -> dict[str, Any]:
    if not values: return {"value": None, "unit": None, "count": 0}
    return {"value": round(sum(values) / len(values), 4), "unit": None, "count": len(values)}


def analyze(question: str) -> dict[str, Any]:
    parsed = interpret(question)
    now = datetime.now(timezone.utc).isoformat()
    if parsed["intent"] == "profile" and not parsed["float_id"]:
        return {"status": "needs_clarification", "interpreted_question": "Depth/profile analysis", "summary": "Which WMO float or profile should I analyze? The global map feed contains recent surface positions; a thermocline or depth profile requires a selected float.", "data_sources": [], "query_parameters": parsed, "observations": [], "analysis": {"method": "not run", "results": [], "assumptions": [], "limitations": ["No float identifier was supplied."]}, "visualizations": [], "uncertainty": ["A thermocline or halocline cannot be inferred from the surface fleet index alone."], "suggested_followups": ["Ask for a WMO float number, for example: show the temperature profile for WMO 2902746."]}
    if parsed["intent"] == "compare" and not parsed["region"] and not parsed["float_id"]:
        return {"status": "needs_clarification", "interpreted_question": "Profile or regional comparison", "summary": "Which two floats, regions, or observation periods should I compare?", "data_sources": [], "query_parameters": parsed, "observations": [], "analysis": {"method": "not run", "results": [], "assumptions": [], "limitations": ["A comparison baseline was not specified."]}, "visualizations": [], "uncertainty": ["The request does not identify the two comparison groups."], "suggested_followups": ["Name two WMO float IDs, or provide a region and two dates."]}
    if parsed["intent"] in {"lookup", "explain"} and not any(word in question.lower() for word in ("argo", "float", "ocean", "temperature", "salinity", "pressure", "depth", "data", "source")):
        return {"status": "needs_clarification", "interpreted_question": "Unsupported or incomplete ocean-data question", "summary": "I can answer questions about retrieved ARGO observations, profiles, regions, depth, temperature, salinity, and potential anomalies.", "data_sources": [], "query_parameters": parsed, "observations": [], "analysis": {"method": "not run", "results": [], "assumptions": [], "limitations": ["The request does not identify an available ocean-data operation."]}, "visualizations": [], "uncertainty": [], "suggested_followups": ["Ask for a regional float map, a WMO profile, temperature/salinity, or anomaly screening."]}

    if parsed["float_id"]:
        profile = store.profile(parsed["float_id"])
        if not profile.get("live") or not profile.get("data"):
            return {"status": "no_data", "interpreted_question": f"Profile for WMO {parsed['float_id']}", "summary": "No usable profile records were retrieved for that float.", "data_sources": [{"name": profile.get("source"), "uri": profile.get("source_url"), "retrieved_at": profile.get("fetched_at")}], "query_parameters": parsed, "observations": [], "analysis": {"method": "profile extraction", "results": [], "assumptions": [], "limitations": [profile.get("error", "The requested profile was unavailable.")]}, "visualizations": [], "uncertainty": ["No valid profile points were available."], "suggested_followups": ["Try another WMO identifier from the map."]}
        rows = profile["data"]
        selected = [row for row in rows if not parsed["depth_range"] or (row["pressure_dbar"] >= parsed["depth_range"]["min_pressure_dbar"] and (parsed["depth_range"]["max_pressure_dbar"] is None or row["pressure_dbar"] <= parsed["depth_range"]["max_pressure_dbar"]))]
        results = []
        for variable, key, unit in (("temperature", "temperature_c", "°C"), ("salinity", "salinity_psu", "PSU")):
            if variable in parsed["variables"]:
                values = [row[key] for row in selected if row.get(key) is not None]
                stats = _num_stats(values); stats["unit"] = unit; stats["variable"] = variable
                results.append(stats)
        return {"status": "success" if selected else "no_data", "interpreted_question": f"{', '.join(parsed['variables'])} profile for WMO {parsed['float_id']}", "summary": f"Retrieved {len(selected)} quality-usable profile points for WMO {parsed['float_id']} (cycle {profile.get('cycle')}).", "data_sources": [{"name": profile.get("source"), "uri": profile.get("source_url"), "retrieved_at": profile.get("fetched_at"), "platform_id": parsed["float_id"], "observation_time": profile.get("latest_observation")}], "query_parameters": parsed, "observations": selected[:200], "analysis": {"method": "profile extraction with missing numeric values excluded", "results": results, "assumptions": ["Pressure is reported in dbar; depth_m is not populated because a pressure-to-depth conversion was not applied."], "limitations": ["Only variables present in this profile are reported."]}, "visualizations": [{"type": "temperature_depth_profile", "variables": parsed["variables"], "units": ["°C", "PSU"], "float_id": parsed["float_id"]}], "uncertainty": ["ARGO sampling is discrete in space and time; this is not a continuous sensor record."], "suggested_followups": ["Ask for the source evidence or compare this profile with another WMO float."]}

    fleet = store.fleet()
    rows = [row for row in fleet.get("data", []) if _in_bounds(row, parsed["bounds"])]
    if not rows:
        return {"status": "no_data", "interpreted_question": question, "summary": "No matching live ARGO positions were retrieved for the requested filter.", "data_sources": [{"name": fleet.get("source"), "uri": fleet.get("source_url"), "retrieved_at": fleet.get("fetched_at")}], "query_parameters": parsed, "observations": [], "analysis": {"method": parsed["method"], "results": [], "assumptions": [], "limitations": ["No records matched the requested region or filters."]}, "visualizations": [], "uncertainty": ["No conclusion can be drawn without matching observations."], "suggested_followups": ["Broaden the region or ask for global coverage."]}
    results = []
    for variable, key, unit in (("temperature", "temperature_c", "°C"), ("salinity", "salinity_psu", "PSU")):
        if variable in parsed["variables"]:
            stats = _num_stats([row[key] for row in rows if row.get(key) is not None]); stats.update({"variable": variable, "unit": unit}); results.append(stats)
    anomalies = store.anomalies().get("data", []) if parsed["intent"] == "anomaly" else []
    if parsed["intent"] == "anomaly":
        results.append({"variable": "potential_anomalies", "count": len([a for a in anomalies if any(a.get("float_id") == r.get("platform_number") for r in rows)]), "unit": "signals"})
    location = f" in {parsed['region']}" if parsed["region"] else " globally"
    summary = f"Retrieved {len(rows)} live ARGO float positions{location} from {fleet.get('source', SOURCE_LABEL)}."
    if parsed["intent"] == "anomaly": summary += f" Screening found {results[-1]['count']} potential outlier signal(s); this is not a confirmed environmental event."
    else: summary += " Results are descriptive summaries of the retrieved surface observations."
    return {"status": "success", "interpreted_question": question, "summary": summary, "data_sources": [{"name": fleet.get("source"), "uri": fleet.get("source_url"), "retrieved_at": fleet.get("fetched_at"), "window_days": fleet.get("window_days")}], "query_parameters": parsed, "observations": rows[:200], "analysis": {"method": parsed["method"], "results": results, "assumptions": ["Only the latest retrieved surface observation per float is summarized."], "limitations": ["The map feed is a recent near-real-time sample, not a complete historical archive.", "No causal environmental interpretation is made."]}, "visualizations": [{"type": "globe_markers", "variable": parsed["variables"], "units": ["°C", "PSU"], "float_count": len(rows)}] + ([{"type": "anomaly_overlay", "label": "potential anomaly"}] if parsed["intent"] == "anomaly" else []), "uncertainty": ["Coverage varies by float, transmission time, measured variables, and quality-control availability."], "suggested_followups": ["Select a WMO float to load its full profile.", "Ask for the evidence or a narrower region."]}


def render_answer(result: dict[str, Any]) -> str:
    status = result["status"]
    if status == "needs_clarification": return result["summary"] + ""
    if status == "no_data": return result["summary"] + " No fabricated values are shown."
    source = result.get("data_sources", [{}])[0]
    provenance = source.get("name", "configured source")
    methods = result.get("analysis", {}).get("method", "documented analysis")
    return f"{result['summary']} Method: {methods}. Source: {provenance}. Retrieval time: {source.get('retrieved_at', 'unavailable')}. Limitations: {' '.join(result.get('analysis', {}).get('limitations', []))}"
