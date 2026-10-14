from __future__ import annotations

import asyncio
import json
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .live_data import FALLBACK_FLOATS, SOURCE_LABEL, store

app = FastAPI(title="FLOATCHAT API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    fleet = store.fleet()
    return {"status": "ok", "service": "floatchat-api", "data_source": fleet.get("source"), "live": fleet.get("live", False), "fetched_at": fleet.get("fetched_at")}


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
    if not row:
        return {"float_id": float_id, "points": [], "source": fleet.get("source"), "live": fleet.get("live", False)}
    return {"float_id": float_id, "points": [{"lat": row["lat"], "lon": row["lon"], "cycle": row.get("cycle")}], "source": fleet.get("source"), "live": fleet.get("live", False)}


@app.get("/api/profiles")
def profiles(float_id: str = Query("2902746"), cycle: int | None = None, param: str = "temperature"):
    result = store.profile(float_id, cycle)
    if param in {"temperature", "salinity"}:
        key = "temperature_c" if param == "temperature" else "salinity_psu"
        result = {**result, "parameter": param, "data": [{"depth_m": row["depth_m"], "value": row.get(key)} for row in result["data"] if row.get(key) is not None]}
    return result


@app.get("/api/anomalies")
def anomalies():
    return store.anomalies()


@app.get("/api/stats/overview")
def stats():
    return store.stats()


def _answer(question: str, fleet: dict) -> tuple[str, list[str]]:
    rows = fleet.get("data", [])
    ids = [str(row.get("platform_number")) for row in rows[:5]]
    if "salin" in question:
        values = [row["salinity_psu"] for row in rows if row.get("salinity_psu") is not None]
        avg = sum(values) / len(values) if values else 0
        answer = f"I queried the live {fleet.get('source', SOURCE_LABEL)} window. {len(rows)} float positions were returned, with mean surface salinity {avg:.2f} PSU. The map is using the latest available profile observations; select a float to load its full depth profile."
    elif "temp" in question or "thermo" in question:
        values = [row["temperature_c"] for row in rows if row.get("temperature_c") is not None]
        avg = sum(values) / len(values) if values else 0
        answer = f"The live ARGO window contains {len(rows)} float positions. Mean sampled temperature is {avg:.2f} °C. Full temperature and salinity curves are fetched from the selected WMO profile on demand."
    elif "anomal" in question:
        signals = store.anomalies()["data"]
        answer = f"I checked the latest live window and found {len(signals)} statistical outlier(s) using a simple 2-sigma screen. These are screening signals, not scientific QC decisions; use the profile QC flags before publication."
    else:
        answer = f"Live ARGO mode is active. I found {len(rows)} observations in the recent Indian Ocean window from {fleet.get('source', SOURCE_LABEL)}. Ask for salinity, temperature, anomalies, a WMO number, or a depth profile."
    return answer, ids


@app.post("/api/chat")
async def chat(payload: dict):
    question = (payload.get("message") or "").lower()
    fleet = await asyncio.to_thread(store.fleet)
    answer, citations = await asyncio.to_thread(_answer, question, fleet)

    async def stream():
        for word in answer.split():
            yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            await asyncio.sleep(0.008)
        yield f"data: {json.dumps({'done': True, 'citations': citations, 'source': fleet.get('source'), 'fetched_at': fleet.get('fetched_at'), 'live': fleet.get('live', False)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
