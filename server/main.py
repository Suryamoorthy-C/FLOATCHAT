from __future__ import annotations

import asyncio
import json
import sqlite3
from typing import Any

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field, root_validator

from .live_data import FALLBACK_FLOATS, store
from .pearl_index import calculate_pearl_index, species_thresholds
from .query_engine import analyze, render_answer
from .threshold_alerts import ThresholdStore, Thresholds, check_and_notify
from .pearl_suitability import calculate_pearl_suitability
from .profile_avatars import (
    MAX_AVATAR_BYTES,
    ALLOWED_IMAGE_FORMATS,
    AvatarUploadError,
    ProfileAvatarStore,
    sanitize_avatar,
)

app = FastAPI(title="FLOATCHAT API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
threshold_store = ThresholdStore()
profile_avatar_store = ProfileAvatarStore()


class ThresholdSettings(BaseModel):
    min_temperature_c: float | None = Field(default=None, ge=-5, le=60)
    max_temperature_c: float | None = Field(default=None, ge=-5, le=60)
    min_pressure_dbar: float | None = Field(default=None, ge=0, le=12000)
    max_pressure_dbar: float | None = Field(default=None, ge=0, le=12000)

    @root_validator(skip_on_failure=True)
    def validate_ranges(cls, values):
        for lower, upper in (("min_temperature_c", "max_temperature_c"), ("min_pressure_dbar", "max_pressure_dbar")):
            lo, hi = values.get(lower), values.get(upper)
            if lo is not None and hi is not None and lo >= hi:
                raise ValueError(f"{lower} must be less than {upper}")
        return values


class ThresholdProfileUpdate(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    thresholds: ThresholdSettings


class TelemetryIngest(BaseModel):
    user_id: str = Field(min_length=1, max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    observed_at: str | None = Field(default=None, max_length=80)
    temperature_c: float | None = Field(default=None, ge=-100, le=100)
    pressure_dbar: float | None = Field(default=None, ge=0, le=12000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    context: dict[str, Any] = Field(default_factory=dict)


@app.get("/api/health")
def health():
    fleet = store.fleet()
    return {"status": "ok", "service": "floatchat-api", "data_source": fleet.get("source"), "live": fleet.get("live", False), "fetched_at": fleet.get("fetched_at"), "query_engine": "structured-evidence-v1"}


@app.get("/api/users/{user_id}/thresholds")
def get_user_thresholds(user_id: str):
    profile = threshold_store.get(user_id)
    if profile is None:
        return {"user_id": user_id, "email": None, "thresholds": Thresholds().as_dict(), "updated_at": None}
    return profile


@app.put("/api/users/{user_id}/thresholds")
def save_user_thresholds(user_id: str, payload: ThresholdProfileUpdate):
    return threshold_store.save(user_id, payload.email, Thresholds(**payload.thresholds.dict()))


@app.get("/api/users/{user_id}/profile")
def get_user_profile(user_id: str):
    try:
        return profile_avatar_store.get_profile(user_id)
    except AvatarUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/users/{user_id}/avatar")
async def upload_user_avatar(user_id: str, file: UploadFile = File(...)):
    """Validate, sanitize, and persist a JPEG/PNG profile image."""
    if file.content_type not in {None, "application/octet-stream", *ALLOWED_IMAGE_FORMATS.values()}:
        await file.close()
        raise HTTPException(status_code=415, detail="Only JPEG and PNG images are supported.")
    try:
        payload = await file.read(MAX_AVATAR_BYTES + 1)
    finally:
        await file.close()
    if len(payload) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 4 MiB or smaller.")
    try:
        sanitized, mime_type = sanitize_avatar(payload)
        return profile_avatar_store.save_avatar(user_id, sanitized, mime_type)
    except AvatarUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (OSError, sqlite3.Error) as exc:
        raise HTTPException(status_code=503, detail="Avatar storage is unavailable.") from exc


@app.get("/api/users/{user_id}/avatar")
def get_user_avatar(user_id: str):
    try:
        avatar = profile_avatar_store.get_avatar(user_id)
    except AvatarUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if avatar is None:
        raise HTTPException(status_code=404, detail="No profile photo is saved for this user.")
    image_data, mime_type, updated_at = avatar
    return Response(
        content=image_data,
        media_type=mime_type,
        headers={
            "Cache-Control": "private, no-cache, max-age=0",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline",
        },
    )


@app.delete("/api/users/{user_id}/avatar")
def delete_user_avatar(user_id: str):
    try:
        return profile_avatar_store.delete_avatar(user_id)
    except AvatarUploadError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/telemetry/ingest")
def ingest_telemetry(payload: TelemetryIngest):
    """Evaluate one incoming sample and email only for configured bound breaches."""
    if payload.temperature_c is None and payload.pressure_dbar is None:
        raise HTTPException(status_code=422, detail="At least one sensor reading is required.")
    reading = payload.dict(exclude={"user_id"})
    return {"accepted": True, **check_and_notify(threshold_store, payload.user_id, reading)}


@app.get("/api/floats")
def floats(status: str | None = None, region: str | None = None, live: bool = True, refresh: bool = False):
    result = store.fleet(force=refresh) if live else {"count": len(FALLBACK_FLOATS), "data": FALLBACK_FLOATS, "source": "FLOATCHAT demo fallback", "live": False}
    rows = result["data"]
    if status:
        rows = [row for row in rows if row.get("status") == status]
    if region:
        rows = [row for row in rows if region.lower() in str(row.get("project_name", "")).lower() or region.lower() in str(row.get("region", "")).lower()]
    return {**result, "count": len(rows), "data": rows}


@app.get("/api/floats/{float_id}/trajectory")
def trajectory(float_id: str):
    fleet = store.fleet()
    row = next((item for item in fleet["data"] if item["platform_number"] == float_id), None)
    return {"float_id": float_id, "points": ([{"lat": row["lat"], "lon": row["lon"], "cycle": row.get("cycle"), "timestamp": row.get("last_seen")} ] if row else []), "source": fleet.get("source"), "live": fleet.get("live", False), "limitation": "Only one latest position is currently indexed; a trajectory requires multiple valid position records."}


@app.get("/api/profiles")
def profiles(float_id: str = Query("2902746"), cycle: int | None = None, param: str = "temperature"):
    result = store.profile(float_id, cycle)
    if param in {"temperature", "salinity"}:
        key = "temperature_c" if param == "temperature" else "salinity_psu"
        result = {**result, "parameter": param, "unit": "°C" if param == "temperature" else "PSU", "data": [{"pressure_dbar": row["pressure_dbar"], "depth_m": row.get("depth_m"), "value": row.get(key), "qc_flags": row.get("qc_flags", {})} for row in result["data"] if row.get(key) is not None]}
    return result


@app.get("/api/anomalies")
def anomalies():
    return store.anomalies()


@app.get("/api/stats/overview")
def stats():
    return store.stats()


@app.get("/api/pearl/thresholds")
def pearl_thresholds(species: str = Query("pinctada_maxima")):
    try:
        return species_thresholds(species)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/pearl/index")
def pearl_index(payload: dict):
    try:
        return calculate_pearl_index(payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/pearl/suitability")
def pearl_suitability(payload: dict):
    """Calculate a five-sensor PPPI screening score and hazard patterns."""
    species = payload.get("species", "pinctada_maxima")
    try:
        return calculate_pearl_suitability(payload, species=species)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/query")
async def query(payload: ChatRequest) -> dict[str, Any]:
    """Structured ASK -> UNDERSTAND -> RETRIEVE -> ANALYZE -> EXPLAIN contract."""
    return await asyncio.to_thread(analyze, payload.message, payload.history, payload.context)


@app.post("/api/chat")
async def chat(payload: ChatRequest):
    result = await asyncio.to_thread(analyze, payload.message, payload.history, payload.context)
    answer = render_answer(result)

    async def stream():
        for word in answer.split():
            yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            await asyncio.sleep(0.004)
        yield f"data: {json.dumps({'done': True, 'result': result, 'citations': result.get('citations', []), 'research_sources': result.get('research_sources', []), 'workflow': result.get('workflow', []), 'suggested_followups': result.get('suggested_followups', []), 'source': (result.get('data_sources') or [{}])[0].get('name'), 'fetched_at': result.get('retrieved_at'), 'live': any(source.get('live') for source in result.get('data_sources', []))})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
