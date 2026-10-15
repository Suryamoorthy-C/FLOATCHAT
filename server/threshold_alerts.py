"""Persistence and evaluation for user-defined agro-float threshold alerts.

SQLite is a practical single-process prototype store. Production deployments
should point FLOATCHAT_DB_PATH at durable shared storage / replace this module
with the application's managed database and derive user_id from authentication.
"""
from __future__ import annotations

import os
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


@dataclass(frozen=True)
class Thresholds:
    min_temperature_c: float | None = None
    max_temperature_c: float | None = None
    min_pressure_dbar: float | None = None
    max_pressure_dbar: float | None = None

    def as_dict(self) -> dict[str, float | None]:
        return asdict(self)


class ThresholdStore:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("FLOATCHAT_DB_PATH", "./data/floatchat.sqlite3")
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        if self.db_path != ":memory:":
            Path(self.db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.db_path, timeout=10)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                min_temperature_c REAL,
                max_temperature_c REAL,
                min_pressure_dbar REAL,
                max_pressure_dbar REAL,
                updated_at TEXT NOT NULL
            )""")

    def get(self, user_id: str) -> dict[str, Any] | None:
        with self._connect() as db:
            row = db.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
        if row is None:
            return None
        return {"user_id": row["user_id"], "email": row["email"], "thresholds": {
            key: row[key] for key in Thresholds.__dataclass_fields__
        }, "updated_at": row["updated_at"]}

    def save(self, user_id: str, email: str, thresholds: Thresholds) -> dict[str, Any]:
        values = thresholds.as_dict()
        updated_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as db:
            db.execute("""INSERT INTO users (
                user_id, email, min_temperature_c, max_temperature_c,
                min_pressure_dbar, max_pressure_dbar, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                email=excluded.email,
                min_temperature_c=excluded.min_temperature_c,
                max_temperature_c=excluded.max_temperature_c,
                min_pressure_dbar=excluded.min_pressure_dbar,
                max_pressure_dbar=excluded.max_pressure_dbar,
                updated_at=excluded.updated_at""",
                (user_id, email, values["min_temperature_c"], values["max_temperature_c"],
                 values["min_pressure_dbar"], values["max_pressure_dbar"], updated_at))
        return {"user_id": user_id, "email": email, "thresholds": values, "updated_at": updated_at}


def evaluate_thresholds(reading: dict[str, Any], thresholds: Thresholds) -> list[dict[str, Any]]:
    """Return one breach per metric when a configured bound is exceeded."""
    timestamp = reading.get("observed_at") or datetime.now(timezone.utc).isoformat()
    breaches: list[dict[str, Any]] = []
    metrics = (
        ("temperature_c", "Temperature", "°C", thresholds.min_temperature_c, thresholds.max_temperature_c),
        ("pressure_dbar", "Pressure / depth", "dbar", thresholds.min_pressure_dbar, thresholds.max_pressure_dbar),
    )
    for key, label, unit, lower, upper in metrics:
        value = reading.get(key)
        if value is None:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if lower is not None and numeric < lower:
            breaches.append({"metric": key, "label": label, "reading": numeric, "unit": unit,
                             "bound": "minimum", "threshold": lower, "observed_at": timestamp})
        if upper is not None and numeric > upper:
            breaches.append({"metric": key, "label": label, "reading": numeric, "unit": unit,
                             "bound": "maximum", "threshold": upper, "observed_at": timestamp})
    return breaches


def send_resend_alert(email: str, device_id: str, breach: dict[str, Any]) -> dict[str, Any]:
    """Send a single alert via Resend. Missing credentials are reported, not faked."""
    api_key = os.getenv("RESEND_API_KEY")
    sender = os.getenv("ALERT_FROM_EMAIL")
    if not api_key or not sender:
        return {"sent": False, "reason": "Email is not configured (set RESEND_API_KEY and ALERT_FROM_EMAIL)."}
    timestamp = str(breach["observed_at"])
    subject = f"Float alert: {breach['label']} {breach['bound']} threshold breached"
    body = (f"Agro-float {device_id} crossed your custom {breach['bound']} {breach['label'].lower()} threshold.\n\n"
            f"Custom threshold: {breach['threshold']} {breach['unit']}\n"
            f"Live reading: {breach['reading']} {breach['unit']}\n"
            f"Observed at: {timestamp}\n")
    response = requests.post("https://api.resend.com/emails", json={
        "from": sender,
        "to": [email],
        "subject": subject,
        "text": body,
    }, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=10)
    if not response.ok:
        return {"sent": False, "reason": f"Email provider returned HTTP {response.status_code}."}
    return {"sent": True, "provider_id": response.json().get("id")}


def check_and_notify(store: ThresholdStore, user_id: str, reading: dict[str, Any],
                     sender=send_resend_alert) -> dict[str, Any]:
    user = store.get(user_id)
    if user is None:
        return {"user_id": user_id, "breaches": [], "notifications": [], "reason": "No saved threshold profile for this user."}
    limits = Thresholds(**user["thresholds"])
    breaches = evaluate_thresholds(reading, limits)
    notifications = []
    for breach in breaches:
        try:
            result = sender(user["email"], str(reading.get("device_id", "unknown float")), breach)
        except requests.RequestException as exc:
            result = {"sent": False, "reason": f"Email delivery failed: {exc.__class__.__name__}."}
        notifications.append({**breach, **result})
    return {"user_id": user_id, "breaches": breaches, "notifications": notifications}
