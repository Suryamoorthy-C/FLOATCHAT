"""Lightweight live ARGO adapter for FLOATCHAT.

The Vercel function uses the official Ifremer ERDDAP CSV endpoint directly.
This avoids bundling the large scientific Python stack while preserving live
worldwide fleet positions and on-demand full profiles.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
import csv
import io
import math
import os
from urllib.parse import quote

import requests

SOURCE_URL = "https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.csv"
SOURCE_LABEL = "ARGO GDAC / Ifremer ERDDAP"
FALLBACK_FLOATS = [
    {"platform_number": "2902746", "project_name": "Global ARGO array", "pi_name": "ARGO", "lat": 12.8, "lon": 72.4, "status": "active", "temperature_c": 27.4, "salinity_psu": 34.8, "last_seen": "2026-10-14T09:34:00Z"},
    {"platform_number": "2902751", "project_name": "Global ARGO array", "pi_name": "ARGO", "lat": 16.2, "lon": 80.1, "status": "active", "temperature_c": 26.9, "salinity_psu": 35.1, "last_seen": "2026-10-14T09:28:00Z"},
    {"platform_number": "2902738", "project_name": "Global ARGO array", "pi_name": "ARGO", "lat": 8.6, "lon": 67.2, "status": "active", "temperature_c": 29.8, "salinity_psu": 33.9, "last_seen": "2026-10-14T09:20:00Z"},
]


def _clean(value: Any) -> float | None:
    try:
        number = float(value)
        return None if not math.isfinite(number) or number <= -999 else number
    except (TypeError, ValueError):
        return None


def _rows(text: str) -> list[dict[str, str]]:
    lines = text.strip().splitlines()
    return list(csv.DictReader(io.StringIO("\n".join([lines[0], *lines[2:]])))) if len(lines) > 2 else []


class LiveArgoStore:
    def __init__(self) -> None:
        self.ttl = int(os.getenv("ARGO_CACHE_SECONDS", "600"))
        self.global_days = int(os.getenv("ARGO_GLOBAL_DAYS", "3"))
        self._lock = Lock()
        self._fleet: dict[str, Any] | None = None
        self._fleet_at: datetime | None = None
        self._profiles: dict[str, tuple[datetime, dict[str, Any]]] = {}

    @property
    def enabled(self) -> bool:
        return os.getenv("FLOATCHAT_DATA_MODE", "live").lower() != "demo"

    def _fetch_global(self) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        start = (now - timedelta(days=self.global_days)).timestamp()
        end = now.timestamp()
        query = (
            "platform_number,latitude,longitude,time,pres,temp,psal"
            f"&longitude>=-180&longitude<=180&latitude>=-90&latitude<=90"
            f"&pres>=0&pres<=10&time>={start}&time<={end}"
            "&latitude!=NaN&longitude!=NaN"
        )
        response = requests.get(SOURCE_URL + "?" + query, timeout=90)
        response.raise_for_status()
        latest: dict[str, dict[str, Any]] = {}
        for item in _rows(response.text):
            platform = str(item.get("platform_number", "")).strip()
            observed = item.get("time", "")
            if not platform or platform in latest and observed <= latest[platform]["last_seen"]:
                continue
            latest[platform] = {
                "platform_number": platform, "project_name": "Global ARGO array", "pi_name": "ARGO GDAC",
                "lat": _clean(item.get("latitude")), "lon": _clean(item.get("longitude")), "status": "active",
                "temperature_c": _clean(item.get("temp")), "salinity_psu": _clean(item.get("psal")),
                "pressure_dbar": _clean(item.get("pres")), "cycle": None, "last_seen": observed,
            }
        data = [row for row in latest.values() if row["lat"] is not None and row["lon"] is not None]
        return {"count": len(data), "data": data, "source": SOURCE_LABEL, "source_url": SOURCE_URL, "fetched_at": now.isoformat(), "live": True, "scope": "global", "window_days": self.global_days}

    def fleet(self, force: bool = False) -> dict[str, Any]:
        with self._lock:
            fresh = self._fleet and self._fleet_at and (datetime.now(timezone.utc) - self._fleet_at).total_seconds() < self.ttl
            if fresh and not force:
                return self._fleet
            try:
                self._fleet = self._fetch_global() if self.enabled else {"count": len(FALLBACK_FLOATS), "data": FALLBACK_FLOATS, "source": "FLOATCHAT demo fallback", "live": False, "scope": "global"}
            except Exception as exc:
                self._fleet = {"count": len(FALLBACK_FLOATS), "data": FALLBACK_FLOATS, "source": "FLOATCHAT demo fallback", "live": False, "scope": "global", "error": str(exc)[:180]}
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
            query = f'platform_number,cycle_number,pres,temp,psal,time&platform_number="{float_id}"&pres>=0&pres<=2000&orderBy("time")'
            response = requests.get(SOURCE_URL + "?" + quote(query, safe='(),>=&="'), timeout=90)
            response.raise_for_status()
            records = _rows(response.text)
            cycles = [int(float(row["cycle_number"])) for row in records if row.get("cycle_number", "").strip()]
            selected_cycle = int(cycle) if cycle is not None else max(cycles or [0])
            selected = [row for row in records if row.get("cycle_number", "").strip() and int(float(row["cycle_number"])) == selected_cycle]
            data = []
            for row in selected:
                pressure = _clean(row.get("pres")); temp = _clean(row.get("temp")); sal = _clean(row.get("psal"))
                if pressure is not None and (temp is not None or sal is not None):
                    data.append({"depth_m": pressure, "temperature_c": temp, "salinity_psu": sal})
            result = {"float_id": float_id, "cycle": selected_cycle, "data": sorted(data, key=lambda item: item["depth_m"]), "source": SOURCE_LABEL, "source_url": SOURCE_URL, "fetched_at": datetime.now(timezone.utc).isoformat(), "latest_observation": max((row.get("time", "") for row in selected), default=None), "live": True}
        except Exception as exc:
            result = {"float_id": float_id, "cycle": cycle or 0, "data": [], "source": "FLOATCHAT demo fallback", "live": False, "error": str(exc)[:180]}
        with self._lock:
            self._profiles[key] = (datetime.now(timezone.utc), result)
        return result

    def anomalies(self) -> dict[str, Any]:
        fleet = self.fleet(); rows = fleet["data"]
        sal = [r["salinity_psu"] for r in rows if r.get("salinity_psu") is not None]
        temp = [r["temperature_c"] for r in rows if r.get("temperature_c") is not None]
        def mean(values): return sum(values) / len(values) if values else 0
        def std(values, avg): return math.sqrt(sum((value - avg) ** 2 for value in values) / len(values)) if values else 0
        sal_mean, temp_mean = mean(sal), mean(temp); sal_std, temp_std = std(sal, sal_mean), std(temp, temp_mean)
        found = []
        for row in rows:
            if row.get("salinity_psu") is not None and sal_std and abs(row["salinity_psu"] - sal_mean) > 2 * sal_std:
                found.append({"title": "Salinity outlier", "region": "Global ocean", "severity": "moderate", "float_id": row["platform_number"], "value": row["salinity_psu"]})
            elif row.get("temperature_c") is not None and temp_std and abs(row["temperature_c"] - temp_mean) > 2 * temp_std:
                found.append({"title": "Temperature outlier", "region": "Global ocean", "severity": "moderate", "float_id": row["platform_number"], "value": row["temperature_c"]})
        return {"count": len(found), "data": found, "source": fleet.get("source"), "fetched_at": fleet.get("fetched_at"), "live": fleet.get("live", False)}

    def stats(self) -> dict[str, Any]:
        fleet = self.fleet()
        return {"active_floats": sum(1 for row in fleet["data"] if row.get("status") == "active"), "profiles_week": None, "anomalies": self.anomalies()["count"], "coverage_percent": None, "synced_at": fleet.get("fetched_at"), "source": fleet.get("source"), "live": fleet.get("live", False)}


store = LiveArgoStore()
