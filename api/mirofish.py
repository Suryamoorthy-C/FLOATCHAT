"""Small Vercel function for the optional MiroFish bridge.

Kept separate from the legacy FloatChat FastAPI function so bridge health can
remain available even when an unrelated optional API dependency is missing.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="FloatChat MiroFish bridge")

SNAPSHOT = {
    "source": "FloatChat worldwide Argo fallback snapshot",
    "live": False,
    "scope": "global",
    "floats": [
        {"platform_number": "2902746", "region": "Arabian Sea", "latitude": 12.8, "longitude": 72.4, "temperature_c": 27.4, "salinity_psu": 34.8},
        {"platform_number": "2902751", "region": "Bay of Bengal", "latitude": 16.2, "longitude": 80.1, "temperature_c": 26.9, "salinity_psu": 35.1},
        {"platform_number": "2902777", "region": "North Pacific", "latitude": 29.4, "longitude": -148.2, "temperature_c": 22.1, "salinity_psu": 34.6},
        {"platform_number": "2902712", "region": "South Atlantic", "latitude": -18.7, "longitude": -24.8, "temperature_c": 21.4, "salinity_psu": 35.3},
        {"platform_number": "2902844", "region": "Southern Ocean", "latitude": -45.6, "longitude": 83.1, "temperature_c": 8.4, "salinity_psu": 34.3},
    ],
}

class Scenario(BaseModel):
    requirement: str = Field(min_length=1, max_length=1200)
    region: str | None = Field(default=None, max_length=80)
    project_name: str | None = Field(default=None, max_length=120)

def base_url() -> str:
    return os.getenv("MIROFISH_API_BASE_URL", "").strip().rstrip("/")

def app_url() -> str:
    return os.getenv("MIROFISH_APP_URL", "").strip().rstrip("/")

def get_json(url: str, timeout: int = 4) -> dict:
    with urllib.request.urlopen(url, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))

@app.get("/api/mirofish/status")
def status():
    base = base_url()
    if not base:
        return {"configured": False, "available": False, "service": "MiroFish", "app_url": app_url() or None, "message": "Set MIROFISH_API_BASE_URL to enable Argo scenario seeding."}
    try:
        get_json(f"{base}/health")
        return {"configured": True, "available": True, "service": "MiroFish", "app_url": app_url() or None, "message": "MiroFish is ready for Argo scenario seeding."}
    except (OSError, ValueError) as exc:
        return {"configured": True, "available": False, "service": "MiroFish", "app_url": app_url() or None, "message": f"MiroFish is configured but unavailable: {type(exc).__name__}."}

@app.post("/api/mirofish/seed")
def seed(payload: Scenario):
    base = base_url()
    if not base:
        raise HTTPException(status_code=503, detail="MiroFish is not configured on the FloatChat backend.")
    context = {**SNAPSHOT, "region_filter": payload.region or "worldwide"}
    text = "FloatChat Argo seed context\n\nScenario requirement: " + payload.requirement + "\n\n" + json.dumps(context, indent=2)
    boundary = "----FloatChatMiroFishBoundary"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=simulation_requirement\r\n\r\n{payload.requirement}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=project_name\r\n\r\n{payload.project_name or 'FloatChat Argo scenario'}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=additional_context\r\n\r\nPreserve Argo provenance; distinguish simulation from observation.\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=files; filename=floatchat-argo-context.txt\r\nContent-Type: text/plain\r\n\r\n{text}\r\n--{boundary}--\r\n").encode()
    request = urllib.request.Request(f"{base}/api/graph/ontology/generate", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
    try:
        result = get_json(request) if False else None
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"MiroFish scenario seeding failed: {type(exc).__name__}.") from exc
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error") or "MiroFish rejected the scenario.")
    project_id = (result.get("data") or {}).get("project_id")
    return {"success": True, "service": "MiroFish", "project_id": project_id, "project_url": f"{app_url()}/process/{project_id}" if app_url() and project_id else None, "source": SNAPSHOT["source"], "live": False, "data": result.get("data")}
