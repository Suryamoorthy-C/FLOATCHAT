"""Live ARGO adapter for FLOATCHAT.

The public Ifremer ERDDAP service is queried through argopy. The map uses a
small recent global recent surface window; full profiles are fetched only for a
selected WMO float. Results are cached briefly so a dashboard refresh does not
hammer the public service.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
import math
import os
import csv
import io
import requests

import numpy as np

try:
    from argopy import DataFetcher
except Exception:  # pragma: no cover - demo fallback when optional dependency is absent
    DataFetcher = None

SOURCE_URL = "https://erddap.ifremer.fr/erddap"
SOURCE_LABEL = "ARGO GDAC / Ifremer ERDDAP"
DEFAULT_BOX = [55, 95, -5, 25, 0, 50]
GLOBAL_SOURCE_URL = "https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.csv"
FALLBACK_FLOATS = [
    {"platform_number": "2902746", "project_name": "Global Ocean Array", "pi_name": "ARGO", "lat": 12.8, "lon": 72.4, "status": "active", "temperature_c": 27.4, "salinity_psu": 34.8, "last_seen": "2026-10-14T09:34:00Z"},
    {"platform_number": "2902751", "project_name": "Bay of Bengal Survey", "pi_name": "ARGO", "lat": 16.2, "lon": 80.1, "status": "active", "temperature_c": 26.9, "salinity_psu": 35.1, "last_seen": "2026-10-14T09:28:00Z"},
    {"platform_number": "2902738", "project_name": "Arabian Sea Watch", "pi_name": "ARGO", "lat": 8.6, "lon": 67.2, "status": "warning", "temperature_c": 29.8, "salinity_psu": 33.9, "last_seen": "2026-10-14T09:20:00Z"},
]


def _clean(value: Any) -> float | None:
    try:
        number = float(value)
        return None if not math.isfinite(number) or number <= -999 else number
    except (TypeError, ValueError):
        return None


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return value.astype("datetime64[s]").item().replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    except Exception:
        text = str(value).replace(" ", "T")
        return text if text.endswith("Z") else f"{text}Z"


class LiveArgoStore:
    def __init__(self) -> None:
        self.ttl = int(os.getenv("ARGO_CACHE_SECONDS", "600"))
        self.box = DEFAULT_BOX
        self.scope = os.getenv("ARGO_SCOPE", "global").lower()
        self._lock = Lock()
        self._fleet: dict[str, Any] | None = None
        self._fleet_at: datetime | None = None
        self._profiles: dict[str, tuple[datetime, dict[str, Any]]] = {}

    @property
    def enabled(self) -> bool:
        return DataFetcher is not None and os.getenv("FLOATCHAT_DATA_MODE", "live").lower() != "demo"

    def _fetch_global(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=int(os.getenv("ARGO_GLOBAL_DAYS", "3")))).timestamp()
        end = now.timestamp()
        query = (
            "platform_number,latitude,longitude,time,pres,temp,psal"
            f"&longitude>=-180&longitude<=180&latitude>=-90&latitude<=90"
            f"&pres>=0&pres<=10&time>={start}&time<={end}"
            "&latitude!=NaN&longitude!=NaN"
        )
        response = requests.get(GLOBAL_SOURCE_URL + "?" + query, timeout=90)
        response.raise_for_status()
        rows: dict[str, dict[str, Any]] = {}
        for item in csv.DictReader(io.StringIO(response.text)):
            platform = str(item.get("platform_number", "")).strip()
            if not platform:
                continue
            observed = item.get("time", "")
            if platform not in rows or observed > rows[platform].get("last_seen", ""):
                rows[platform] = {
                    "platform_number": platform, "project_name": "Global ARGO array", "pi_name": "ARGO GDAC",
                    "lat": _clean(item.get("latitude")), "lon": _clean(item.get("longitude")), "status": "active",
                    "temperature_c": _clean(item.get("temp")), "salinity_psu": _clean(item.get("psal")),
                    "pressure_dbar": _clean(item.get("pres")), "cycle": None, "last_seen": observed,
                }
        data = [row for row in rows.values() if row["lat"] is not None and row["lon"] is not None]
        return {"count": len(data), "data": data, "source": SOURCE_LABEL, "source_url": GLOBAL_SOURCE_URL, "fetched_at": now.isoformat(), "live": True, "scope": "global", "window_days": int(os.getenv("ARGO_GLOBAL_DAYS", "3"))}

    def _fetch_fleet(self) -> dict[str, Any]:
        if not self.enabled:
            return {"count": len(FALLBACK_FLOATS), "data": FALLBACK_FLOATS, "source": "FLOATCHAT demo fallback", "live": False}
        if self.scope == "global":
            return self._fetch_global()
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=14)).strftime("%Y-%m-%d")
        end = now.strftime("%Y-%m-%d")
        box = [*self.box, start, end]
        ds = DataFetcher(src="erddap", mode="standard").region(box).load().data
        rows: dict[str, list[dict[str, Any]]] = {}
        for i in range(int(ds.sizes.get("N_POINTS", 0))):
            platform = str(ds["PLATFORM_NUMBER"].values[i])
            rows.setdefault(platform, []).append({
                "platform_number": platform,
                "lat": _clean(ds["LATITUDE"].values[i]),
                "lon": _clean(ds["LONGITUDE"].values[i]),
                "temperature_c": _clean(ds["TEMP"].values[i]) if "TEMP" in ds else None,
                "salinity_psu": _clean(ds["PSAL"].values[i]) if "PSAL" in ds else None,
                "pressure_dbar": _clean(ds["PRES"].values[i]) if "PRES" in ds else None,
                "cycle": int(ds["CYCLE_NUMBER"].values[i]) if "CYCLE_NUMBER" in ds else None,
                "time": ds["TIME"].values[i] if "TIME" in ds else None,
            })
        data = []
        for platform, samples in rows.items():
            sample = max(samples, key=lambda x: str(x.get("time")))
            data.append({
                "platform_number": platform,
                "project_name": "ARGO global ARGO window",
                "pi_name": "ARGO GDAC",
                "lat": sample["lat"], "lon": sample["lon"],
                "status": "active",
                "temperature_c": sample["temperature_c"],
                "salinity_psu": sample["salinity_psu"],
                "pressure_dbar": sample["pressure_dbar"],
                "cycle": sample["cycle"],
                "last_seen": _iso(sample["time"]),
            })
        data = [row for row in data if row["lat"] is not None and row["lon"] is not None]
        return {"count": len(data), "data": data, "source": SOURCE_LABEL, "source_url": SOURCE_URL, "fetched_at": now.isoformat(), "live": True, "window_days": 14}

    def fleet(self, force: bool = False) -> dict[str, Any]:
        with self._lock:
            fresh = self._fleet and self._fleet_at and (datetime.now(timezone.utc) - self._fleet_at).total_seconds() < self.ttl
            if fresh and not force:
                return self._fleet
            try:
                self._fleet = self._fetch_fleet()
            except Exception as exc:
                self._fleet = {"count": len(FALLBACK_FLOATS), "data": FALLBACK_FLOATS, "source": "FLOATCHAT demo fallback", "live": False, "scope": self.scope, "error": str(exc)[:180]}
            self._fleet_at = datetime.now(timezone.utc)
            return self._fleet

    def profile(self, float_id: str, cycle: int | None = None) -> dict[str, Any]:
        key = f"{float_id}:{cycle or 'latest'}"
        with self._lock:
            cached = self._profiles.get(key)
            if cached and (datetime.now(timezone.utc) - cached[0]).total_seconds() < self.ttl:
                return cached[1]
        try:
            if not self.enabled:
                raise RuntimeError("live adapter disabled")
            fetcher = DataFetcher(src="erddap", mode="standard").float(int(float_id))
            ds = fetcher.load().data
            cycles = np.asarray(ds["CYCLE_NUMBER"].values)
            selected_cycle = int(cycle) if cycle is not None else int(cycles[-1])
            mask = cycles == selected_cycle
            if not mask.any():
                selected_cycle = int(cycles[-1]); mask = cycles == selected_cycle
            depth, temp, sal, times = [], [], [], []
            for i in np.where(mask)[0]:
                p = _clean(ds["PRES"].values[i]); t = _clean(ds["TEMP"].values[i]); s = _clean(ds["PSAL"].values[i])
                if p is not None and (t is not None or s is not None):
                    depth.append(p); temp.append(t); sal.append(s); times.append(ds["TIME"].values[i])
            rows = [{"depth_m": d, "temperature_c": t, "salinity_psu": s} for d, t, s in sorted(zip(depth, temp, sal))]
            result = {"float_id": float_id, "cycle": selected_cycle, "data": rows, "source": SOURCE_LABEL, "source_url": SOURCE_URL, "fetched_at": datetime.now(timezone.utc).isoformat(), "latest_observation": _iso(max(times) if times else None), "live": True}
        except Exception as exc:
            result = {"float_id": float_id, "cycle": cycle or 0, "data": [], "source": "FLOATCHAT demo fallback", "live": False, "scope": self.scope, "error": str(exc)[:180]}
        with self._lock:
            self._profiles[key] = (datetime.now(timezone.utc), result)
        return result

    def anomalies(self) -> dict[str, Any]:
        fleet = self.fleet()
        rows = fleet["data"]
        sal = [r["salinity_psu"] for r in rows if r.get("salinity_psu") is not None]
        temp = [r["temperature_c"] for r in rows if r.get("temperature_c") is not None]
        sal_mean = float(np.mean(sal)) if sal else 0.0; sal_std = float(np.std(sal)) if sal else 0.0
        temp_mean = float(np.mean(temp)) if temp else 0.0; temp_std = float(np.std(temp)) if temp else 0.0
        found = []
        for r in rows:
            if r.get("salinity_psu") is not None and sal_std and abs(r["salinity_psu"] - sal_mean) > 2 * sal_std:
                found.append({"title": "Salinity outlier", "region": "global ARGO window", "severity": "moderate", "float_id": r["platform_number"], "value": r["salinity_psu"]})
            elif r.get("temperature_c") is not None and temp_std and abs(r["temperature_c"] - temp_mean) > 2 * temp_std:
                found.append({"title": "Temperature outlier", "region": "global ARGO window", "severity": "moderate", "float_id": r["platform_number"], "value": r["temperature_c"]})
        return {"count": len(found), "data": found, "source": fleet.get("source"), "fetched_at": fleet.get("fetched_at"), "live": fleet.get("live", False)}

    def stats(self) -> dict[str, Any]:
        fleet = self.fleet(); rows = fleet["data"]
        active = sum(1 for r in rows if r.get("status") == "active")
        return {"active_floats": active, "profiles_week": None, "anomalies": self.anomalies()["count"], "coverage_percent": None, "synced_at": fleet.get("fetched_at"), "source": fleet.get("source"), "live": fleet.get("live", False)}


store = LiveArgoStore()
