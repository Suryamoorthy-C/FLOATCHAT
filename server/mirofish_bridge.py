"""Optional MiroFish integration for Argo-aware scenario seeding.

MiroFish runs as a separate Flask service because its graph, Zep, and OASIS
workflows are not suitable for a Vercel serverless function. This adapter keeps
FloatChat's contract small: health discovery plus creation of a MiroFish graph
project seeded with current Argo context.
"""
from __future__ import annotations

import json
import os
from typing import Any

import requests

from .live_data import store


class MiroFishBridgeError(RuntimeError):
    """A configured MiroFish bridge could not be reached or accepted a request."""


def _base_url() -> str:
    return os.getenv("MIROFISH_API_BASE_URL", "").strip().rstrip("/")


def _app_url() -> str:
    return os.getenv("MIROFISH_APP_URL", "").strip().rstrip("/")


def status() -> dict[str, Any]:
    base_url = _base_url()
    app_url = _app_url()
    if not base_url:
        return {
            "configured": False,
            "available": False,
            "service": "MiroFish",
            "app_url": app_url or None,
            "message": "Set MIROFISH_API_BASE_URL to enable Argo scenario seeding.",
        }
    try:
        response = requests.get(f"{base_url}/health", timeout=4)
        response.raise_for_status()
        return {
            "configured": True,
            "available": True,
            "service": "MiroFish",
            "app_url": app_url or None,
            "message": "MiroFish is ready for Argo scenario seeding.",
        }
    except requests.RequestException as exc:
        return {
            "configured": True,
            "available": False,
            "service": "MiroFish",
            "app_url": app_url or None,
            "message": f"MiroFish is configured but unavailable: {type(exc).__name__}.",
        }


def _argo_seed_text(requirement: str, region: str | None = None) -> str:
    fleet = store.fleet()
    rows = fleet.get("data", [])
    if region:
        needle = region.lower()
        rows = [
            row for row in rows
            if needle in str(row.get("project_name", "")).lower()
            or needle in str(row.get("region", "")).lower()
        ]
    rows = rows[:80]
    context = {
        "source": fleet.get("source"),
        "source_url": fleet.get("source_url"),
        "live": fleet.get("live", False),
        "fetched_at": fleet.get("fetched_at"),
        "float_count": len(rows),
        "floats": [
            {
                "platform_number": row.get("platform_number"),
                "region": row.get("project_name") or row.get("region"),
                "latitude": row.get("lat"),
                "longitude": row.get("lon"),
                "temperature_c": row.get("temperature_c"),
                "salinity_psu": row.get("salinity_psu"),
                "pressure_dbar": row.get("pressure_dbar"),
                "status": row.get("status"),
                "last_seen": row.get("last_seen"),
            }
            for row in rows
        ],
    }
    return (
        "FloatChat Argo seed context\n"
        "===========================\n"
        f"Scenario requirement: {requirement.strip()}\n"
        f"Region filter: {region or 'worldwide'}\n\n"
        "The following observations are an evidence snapshot for simulation setup. "
        "They are not a forecast and must remain attributable to their source.\n\n"
        + json.dumps(context, indent=2, ensure_ascii=False)
    )


def seed_scenario(requirement: str, region: str | None = None, project_name: str | None = None) -> dict[str, Any]:
    base_url = _base_url()
    if not base_url:
        raise MiroFishBridgeError("MiroFish is not configured on the FloatChat backend.")
    if not requirement or not requirement.strip():
        raise MiroFishBridgeError("A scenario requirement is required.")
    filename = "floatchat-argo-context.txt"
    seed_text = _argo_seed_text(requirement, region)
    files = {"files": (filename, seed_text.encode("utf-8"), "text/plain")}
    data = {
        "simulation_requirement": requirement.strip(),
        "project_name": (project_name or "FloatChat Argo scenario")[:120],
        "additional_context": "Use the attached Argo snapshot as source context. Preserve its provenance and clearly distinguish simulation from observation.",
    }
    try:
        response = requests.post(
            f"{base_url}/api/graph/ontology/generate",
            files=files,
            data=data,
            timeout=45,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise MiroFishBridgeError(f"MiroFish scenario seeding failed: {type(exc).__name__}.") from exc
    if not payload.get("success"):
        raise MiroFishBridgeError(str(payload.get("error") or "MiroFish rejected the scenario."))
    project_id = (payload.get("data") or {}).get("project_id")
    app_url = _app_url()
    return {
        "success": True,
        "service": "MiroFish",
        "project_id": project_id,
        "project_url": f"{app_url}/process/{project_id}" if app_url and project_id else None,
        "source": "FloatChat Argo fleet snapshot",
        "live": bool(store.fleet().get("live", False)),
        "data": payload.get("data"),
    }
