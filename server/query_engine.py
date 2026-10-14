"""Grounded conversational query engine for FloatChat.

The engine is intentionally deterministic at the evidence boundary: language
understanding routes the request, the data store supplies observations, the
research layer supplies cited context, and the composer only summarizes those
results. It never fills missing measurements with guesses.
"""
from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any

from .live_data import SOURCE_LABEL, store
from .research import retrieve_research

REGIONS = {
    "bay of bengal": (80, 100, 5, 23),
    "arabian sea": (50, 78, 5, 30),
    "indian ocean": (20, 120, -40, 30),
    "global": (-180, 180, -90, 90),
    "global ocean": (-180, 180, -90, 90),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _region(question: str) -> tuple[str | None, tuple[float, float, float, float] | None]:
    for name, bounds in REGIONS.items():
        if name in question:
            return name.title(), bounds
    return None, None


def _numbers(question: str) -> list[float]:
    return [float(value) for value in re.findall(r"(?<![a-z])\d+(?:\.\d+)?", question)]


def _previous_user_text(history: list[dict[str, Any]] | None) -> str:
    for item in reversed(history or []):
        if item.get("role") == "user" and item.get("content"):
            return str(item["content"])
    return ""


def _casual_kind(question: str) -> str | None:
    """Recognize low-risk conversational turns before scientific routing."""
    normalized = re.sub(r"[^a-z0-9?' ]+", "", question.strip().lower())
    if re.fullmatch(r"(hi|hello|hey|hiya|yo|good morning|good afternoon|good evening)( there)?", normalized):
        return "greeting"
    if any(phrase in normalized for phrase in ("how are you", "how's it going", "how is it going")):
        return "wellbeing"
    if any(phrase in normalized for phrase in ("thank you", "thanks", "thx", "appreciate it")):
        return "thanks"
    if any(phrase in normalized for phrase in ("who are you", "what are you", "your name")):
        return "identity"
    if any(phrase in normalized for phrase in ("what can you do", "how can you help", "help me", "capabilities")):
        return "help"
    if any(phrase in normalized for phrase in ("tell me a joke", "make me laugh")):
        return "joke"
    if normalized in {"bye", "goodbye", "see you", "see ya", "talk later"}:
        return "goodbye"
    return None


def _casual_reply(kind: str) -> str:
    replies = {
        "greeting": "Hi! I’m FloatChat. We can chat normally, or dig into ARGO observations, ocean science, and regional comparisons whenever you’re ready.",
        "wellbeing": "I’m doing well and ready to help. What’s on your mind—something casual, or an ocean question you want to investigate?",
        "thanks": "You’re welcome. I’m happy to help—ask a follow-up whenever you like.",
        "identity": "I’m FloatChat, a conversational ocean research assistant. I can handle casual conversation, then switch into evidence-based analysis when you ask about the ocean or ARGO data.",
        "help": "I can chat casually, explain ocean science in simple language, retrieve available ARGO observations, compare the Bay of Bengal and Arabian Sea, inspect float profiles, screen potential anomalies, and cite research when it adds context.",
        "joke": "Why did the oceanographer bring a ladder? To get a little closer to the deep end. I can also answer a real ocean question if you want.",
        "goodbye": "See you later. I’ll be here when you want to chat or explore the ocean data.",
    }
    return replies[kind]


def interpret(question: str, history: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    normalized = question.strip().lower()
    prior = _previous_user_text(history).lower()
    contextual_text = f"{prior} {normalized}".strip()
    casual_kind = _casual_kind(question)
    region, bounds = _region(contextual_text)
    float_match = re.search(r"(?:wmo|float|platform|profile)\s*(?:id|number)?\s*[:#-]?\s*(\d{6,8})", contextual_text)
    float_id = float_match.group(1) if float_match else None
    variables: list[str] = []
    if any(word in contextual_text for word in ("temperature", "temp", "thermocline")):
        variables.append("temperature")
    if "salin" in contextual_text or "halocline" in contextual_text:
        variables.append("salinity")
    if any(word in contextual_text for word in ("oxygen", "o2", "chlorophyll", "fluorescence", "nitrate", "ph")):
        variables.append("biogeochemical")
    if not variables:
        variables = ["temperature", "salinity"]

    research_terms = ("why", "what is", "explain", "mechanism", "research", "study", "published", "literature", "meaning", "ecosystem")
    if casual_kind:
        intent = "casual"
    elif any(word in normalized for word in ("anomal", "unusual", "outlier")):
        intent = "anomaly"
    elif any(word in normalized for word in ("compare", "comparison", "versus", " vs ")):
        intent = "compare"
    elif any(word in normalized for word in ("profile", "depth", "thermocline", "halocline")) or float_id:
        intent = "profile"
    elif any(word in normalized for word in ("map", "where", "show", "available", "floats")):
        intent = "map"
    elif any(word in normalized for word in research_terms):
        intent = "research" if any(word in normalized for word in ("research", "study", "published", "literature")) else "general"
    else:
        intent = "lookup"

    nums = _numbers(contextual_text)
    depth_range = None
    if "below" in normalized and nums:
        depth_range = {"min_pressure_dbar": nums[-1], "max_pressure_dbar": None}
    elif "above" in normalized and nums:
        depth_range = {"min_pressure_dbar": 0, "max_pressure_dbar": nums[-1]}
    elif "between" in normalized and len(nums) >= 2 and any(word in normalized for word in ("m", "meter", "dbar")):
        depth_range = {"min_pressure_dbar": min(nums[-2:]), "max_pressure_dbar": max(nums[-2:])}

    needs_data = intent in {"anomaly", "compare", "profile", "map", "lookup"} or any(word in normalized for word in ("observation", "reading", "measurement", "data"))
    needs_research = intent in {"research", "general"} or any(word in normalized for word in ("why", "mechanism", "published", "study", "ecosystem"))
    return {
        "intent": intent,
        "region": region,
        "bounds": bounds,
        "variables": variables,
        "float_id": float_id,
        "depth_range": depth_range,
        "needs_data": needs_data,
        "needs_research": needs_research,
        "visualization": "profile" if intent == "profile" else "globe_markers" if needs_data else None,
        "method": "2-sigma screening" if intent == "anomaly" else "regional comparison" if intent == "compare" else "descriptive statistics",
        "casual_kind": casual_kind,
        "context_used": bool(prior),
    }


def _in_bounds(row: dict[str, Any], bounds: tuple[float, float, float, float] | None) -> bool:
    if not bounds:
        return True
    lon, lat = row.get("lon"), row.get("lat")
    return lon is not None and lat is not None and bounds[0] <= lon <= bounds[1] and bounds[2] <= lat <= bounds[3]


def _usable(value: Any) -> bool:
    return isinstance(value, (int, float)) and value == value and value not in {-999, -9999}


def _stats(values: list[float], unit: str, variable: str) -> dict[str, Any]:
    clean = [float(value) for value in values if _usable(value)]
    if not clean:
        return {"variable": variable, "value": None, "unit": unit, "count": 0}
    avg = sum(clean) / len(clean)
    variance = sum((value - avg) ** 2 for value in clean) / len(clean)
    return {
        "variable": variable,
        "value": round(avg, 4),
        "mean": round(avg, 4),
        "min": round(min(clean), 4),
        "max": round(max(clean), 4),
        "stddev": round(variance ** 0.5, 4),
        "unit": unit,
        "count": len(clean),
    }


def _source_record(source: dict[str, Any] | None) -> dict[str, Any]:
    source = source or {}
    return {key: value for key, value in source.items() if value is not None}


def _workflow(*, retrieved: bool, researched: bool, analyzed: bool) -> list[dict[str, str]]:
    return [
        {"stage": "understand", "status": "complete", "detail": "Question intent, region, variables, and context were parsed."},
        {"stage": "retrieve", "status": "complete" if retrieved else "skipped", "detail": "ARGO observations were queried." if retrieved else "No observation retrieval was needed."},
        {"stage": "research", "status": "complete" if researched else "skipped", "detail": "Authoritative scientific context was attached." if researched else "No external research was needed."},
        {"stage": "analyze", "status": "complete" if analyzed else "skipped", "detail": "Only available, quality-usable values were summarized." if analyzed else "No numerical analysis was needed."},
        {"stage": "answer", "status": "complete", "detail": "Answer composed from the available evidence."},
        {"stage": "visualize", "status": "available", "detail": "Existing globe, profile, or anomaly views can show relevant observations."},
    ]


def _base_result(parsed: dict[str, Any], question: str) -> dict[str, Any]:
    return {
        "status": "success",
        "interpreted_question": question,
        "query_parameters": parsed,
        "observations": [],
        "analysis": {"method": parsed["method"], "results": [], "assumptions": [], "limitations": []},
        "data_sources": [],
        "research_sources": [],
        "citations": [],
        "visualizations": [],
        "uncertainty": [],
        "suggested_followups": [],
        "workflow": _workflow(retrieved=False, researched=False, analyzed=False),
        "retrieved_at": _now(),
    }


def analyze(question: str, history: list[dict[str, Any]] | None = None, context: dict[str, Any] | None = None) -> dict[str, Any]:
    parsed = interpret(question, history)
    result = _base_result(parsed, question)
    if context:
        parsed["ui_context"] = {key: context.get(key) for key in ("selected_float_id", "selected_region", "depth_m") if context.get(key) is not None}

    if parsed["intent"] == "casual":
        result.update({
            "status": "success",
            "summary": _casual_reply(parsed["casual_kind"] or "greeting"),
            "analysis": {"method": "conversational reply", "results": [], "assumptions": [], "limitations": []},
            "suggested_followups": ["Ask me anything about ocean science or ARGO data.", "Or just keep chatting—what are you thinking about?"],
            "workflow": _workflow(retrieved=False, researched=False, analyzed=False),
        })
        return result

    if parsed["intent"] == "profile" and not parsed["float_id"]:
        result.update({
            "status": "needs_clarification",
            "summary": "Which WMO float or profile should I analyze? A depth profile needs a float identifier; the current fleet map only contains latest positions.",
            "uncertainty": ["A thermocline or halocline cannot be inferred from the surface fleet index alone."],
            "suggested_followups": ["Ask for a WMO float number, for example: show the temperature profile for WMO 2902746."],
            "workflow": _workflow(retrieved=False, researched=False, analyzed=False),
        })
        return result

    if parsed["intent"] == "compare" and not parsed["region"] and not parsed["float_id"]:
        result.update({
            "status": "needs_clarification",
            "summary": "What two regions, floats, depths, or time periods should I compare?",
            "uncertainty": ["A comparison baseline was not specified."],
            "suggested_followups": ["Try: compare temperature and salinity in the Bay of Bengal and Arabian Sea."],
            "workflow": _workflow(retrieved=False, researched=False, analyzed=False),
        })
        return result

    if parsed["needs_research"]:
        result["research_sources"] = retrieve_research(question, parsed)
        result["citations"].extend(result["research_sources"])

    if parsed["needs_data"]:
        fleet = store.fleet()
        rows = [row for row in fleet.get("data", []) if _in_bounds(row, parsed["bounds"])]
        result["data_sources"].append(_source_record({
            "name": fleet.get("source", SOURCE_LABEL),
            "uri": fleet.get("source_url"),
            "retrieved_at": fleet.get("fetched_at"),
            "window_days": fleet.get("window_days"),
            "live": fleet.get("live", False),
        }))
        result["observations"] = rows[:200]
        result["workflow"] = _workflow(retrieved=True, researched=bool(result["research_sources"]), analyzed=False)

        if parsed["float_id"]:
            profile = store.profile(parsed["float_id"])
            result["data_sources"].append(_source_record({"name": profile.get("source"), "uri": profile.get("source_url"), "retrieved_at": profile.get("fetched_at"), "platform_id": parsed["float_id"], "observation_time": profile.get("latest_observation")}))
            if not profile.get("live") or not profile.get("data"):
                result.update({"status": "no_data", "summary": f"I could not retrieve a quality-usable profile for WMO {parsed['float_id']}.", "uncertainty": [profile.get("error", "No valid profile points were returned.")], "suggested_followups": ["Try another WMO identifier from the map, or ask for a regional surface summary."]})
            else:
                profile_rows = profile["data"]
                selected = [row for row in profile_rows if not parsed["depth_range"] or (row.get("pressure_dbar") is not None and row["pressure_dbar"] >= parsed["depth_range"]["min_pressure_dbar"] and (parsed["depth_range"]["max_pressure_dbar"] is None or row["pressure_dbar"] <= parsed["depth_range"]["max_pressure_dbar"]))]
                result["observations"] = selected[:200]
                for variable, key, unit in (("temperature", "temperature_c", "°C"), ("salinity", "salinity_psu", "PSU")):
                    if variable in parsed["variables"]:
                        result["analysis"]["results"].append(_stats([row.get(key) for row in selected], unit, variable))
                result["summary"] = f"I retrieved {len(selected)} quality-usable profile point(s) for WMO {parsed['float_id']} (cycle {profile.get('cycle')})."
                result["visualizations"].append({"type": "temperature_depth_profile", "variables": parsed["variables"], "units": ["°C", "PSU"], "float_id": parsed["float_id"]})
                result["suggested_followups"] = ["Ask me to compare this profile with another WMO float.", "Ask which depths have the strongest temperature or salinity change."]
                result["analysis"]["assumptions"].append("Pressure is reported in dbar; no pressure-to-depth conversion was applied by the backend.")
                result["analysis"]["limitations"].append("Only variables present in this profile are reported; BGC variables are not assumed to exist.")
                result["workflow"] = _workflow(retrieved=True, researched=bool(result["research_sources"]), analyzed=True)
        elif not rows:
            result.update({"status": "no_data", "summary": "No matching ARGO positions were retrieved for that region or filter.", "uncertainty": ["No conclusion can be drawn without matching observations."], "suggested_followups": ["Broaden the region or ask for global coverage."]})
        else:
            for variable, key, unit in (("temperature", "temperature_c", "°C"), ("salinity", "salinity_psu", "PSU")):
                if variable in parsed["variables"]:
                    result["analysis"]["results"].append(_stats([row.get(key) for row in rows], unit, variable))
            if parsed["intent"] == "compare" and parsed["region"]:
                other_regions = [name for name in REGIONS if name.title() != parsed["region"] and name not in {"global", "global ocean"}]
                comparisons = []
                for name in other_regions[:1]:
                    other_rows = [row for row in fleet.get("data", []) if _in_bounds(row, REGIONS[name])]
                    comparisons.append({"region": name.title(), "temperature": _stats([r.get("temperature_c") for r in other_rows], "°C", "temperature"), "salinity": _stats([r.get("salinity_psu") for r in other_rows], "PSU", "salinity")})
                result["analysis"]["comparisons"] = comparisons
            result["summary"] = f"I retrieved {len(rows)} ARGO surface observation(s)" + (f" in the {parsed['region']}" if parsed["region"] else "") + "."
            if parsed["intent"] == "anomaly":
                anomalies = store.anomalies().get("data", [])
                matching = [item for item in anomalies if any(str(item.get("float_id")) == str(row.get("platform_number")) for row in rows)]
                result["analysis"]["results"].append({"variable": "potential_anomalies", "count": len(matching), "unit": "signals"})
                result["summary"] += f" The current 2-sigma screening found {len(matching)} potential outlier signal(s); that does not confirm an environmental event."
                result["visualizations"].append({"type": "anomaly_overlay", "label": "potential anomaly"})
            else:
                result["summary"] += " The statistics are descriptive summaries of the retrieved measurements, not a continuous field."
            result["analysis"]["assumptions"].append("Only the latest retrieved observation per float is summarized.")
            result["analysis"]["limitations"].extend(["The map feed is a recent near-real-time sample, not a complete historical archive.", "A correlation or outlier is not proof of causation."])
            result["visualizations"].append({"type": "globe_markers", "variables": parsed["variables"], "units": ["°C", "PSU"], "float_count": len(rows)})
            result["suggested_followups"] = ["Select a WMO float to load its full profile.", "Ask for the evidence or a narrower region."]
            result["workflow"] = _workflow(retrieved=True, researched=bool(result["research_sources"]), analyzed=True)

    if parsed["needs_research"] and not result.get("summary"):
        contexts = [source.get("context") for source in result.get("research_sources", []) if source.get("context")]
        result["summary"] = (" ".join(contexts[:2]) if contexts else "Here is the scientific context I found; no live ARGO measurement was needed for this question.")
        result["summary"] += " This is published or program context, not a new local measurement."
        result["analysis"]["method"] = "literature context"
        result["analysis"]["limitations"].append("This explanation is literature-based and should not be read as a new local observation.")
        result["suggested_followups"] = ["Ask me to check this explanation against current ARGO observations in the Bay of Bengal or Arabian Sea."]
        result["workflow"] = _workflow(retrieved=False, researched=bool(result["research_sources"]), analyzed=False)

    if not result.get("summary"):
        result.update({
            "status": "needs_clarification",
            "summary": "I can help with ARGO observations, profiles, temperature, salinity, depth, anomalies, and published ocean research. What would you like to investigate?",
            "suggested_followups": ["Ask why the Bay of Bengal is fresher than the Arabian Sea.", "Ask for a WMO float profile or regional comparison."],
        })
    result["uncertainty"].append("ARGO observations are discrete in space and time; coverage and measured variables vary by float.")
    return result


def render_answer(result: dict[str, Any]) -> str:
    """Compose a concise, conversational answer from the evidence package."""
    answer = result.get("summary", "I could not compose an evidence-based answer.")
    analysis = result.get("analysis", {})
    stats = [item for item in analysis.get("results", []) if item.get("count", 0)]
    if stats:
        details = "; ".join(f"{item['variable']}: mean {item.get('mean', item.get('value'))} {item.get('unit', '')} across {item['count']} point(s)" for item in stats if item.get("value") is not None)
        if details:
            answer += f" Evidence summary: {details}."
    comparisons = analysis.get("comparisons") or []
    if comparisons:
        answer += " I also prepared a regional comparison in the evidence panel."
    if result.get("research_sources"):
        answer += " I separated the literature context from the live measurements and attached the sources below."
    limitations = analysis.get("limitations") or []
    if limitations:
        answer += " Limitation: " + " ".join(limitations[:2])
    return answer
