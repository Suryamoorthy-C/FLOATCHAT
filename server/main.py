from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .live_data import FALLBACK_FLOATS, store
from .pearl_index import calculate_pearl_index, species_thresholds
from .query_engine import analyze, render_answer

app = FastAPI(title="FLOATCHAT API", version="0.3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[dict[str, Any]] = Field(default_factory=list, max_length=12)
    context: dict[str, Any] = Field(default_factory=dict)


@app.get("/api/health")
def health():
    fleet = store.fleet()
    return {"status": "ok", "service": "floatchat-api", "data_source": fleet.get("source"), "live": fleet.get("live", False), "fetched_at": fleet.get("fetched_at"), "query_engine": "structured-evidence-v1"}


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
