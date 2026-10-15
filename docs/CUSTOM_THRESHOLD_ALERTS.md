# Custom threshold alerts

This feature stores temperature and pressure/depth bounds per user, evaluates each submitted telemetry sample against that user's saved limits, and asks Resend to send an email only for bounds actually crossed.

## Settings and persistence

The profile page (`src/pages/Profile.jsx`) reads and saves the four nullable fields through the API:

- `min_temperature_c`, `max_temperature_c` (°C)
- `min_pressure_dbar`, `max_pressure_dbar` (dbar)

A `null` bound is disabled. Equality is not a breach: a notification occurs only when a reading is strictly below its configured minimum or strictly above its configured maximum. Bounds are validated and minimum must be less than maximum. The user table is initialized by `server/threshold_alerts.py`; `docs/profile-subscription.schema.json` describes the matching client profile shape.

Production uses Supabase Postgres through `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Run `supabase/migrations/20261015000000_floatchat_profiles.sql` once in the Supabase SQL Editor before deploying. Local development and tests can omit those variables and use SQLite at `FLOATCHAT_DB_PATH` (default `./data/floatchat.sqlite3`).

## Email configuration

Set `RESEND_API_KEY` and `ALERT_FROM_EMAIL` in the FastAPI service environment. The sender address/domain must be verified with Resend. When either setting is absent, breaches are still returned in the API response, but email is reported as not sent. Provider failures are returned per alert; they do not silently become successful notifications.

## API contract

Read settings:

```http
GET /api/users/{user_id}/thresholds
```

Save settings:

```http
PUT /api/users/{user_id}/thresholds
Content-Type: application/json

{
  "email": "operator@example.com",
  "thresholds": {
    "min_temperature_c": 18,
    "max_temperature_c": 30,
    "min_pressure_dbar": 2,
    "max_pressure_dbar": 100
  }
}
```

Process one sample:

```http
POST /api/telemetry/ingest
Content-Type: application/json

{
  "user_id": "usr_demo_001",
  "device_id": "AF-007",
  "observed_at": "2026-10-15T04:00:00Z",
  "temperature_c": 31.2,
  "pressure_dbar": 42
}
```

The response includes `breaches` and one `notifications` entry per breach, including metric, custom bound, live value, unit, timestamp, delivery status, and provider ID when available. Sensor integrations should invoke `check_and_notify` from `server/threshold_alerts.py` after validating their telemetry envelope rather than trusting arbitrary client-side evaluation.

## Security and rollout notes

This repository currently has no authentication system or authenticated device-ingestion pipeline. These prototype routes accept a `user_id` in the URL/body and **must not be exposed as-is to untrusted production clients**: anyone able to call them could access or alter another user's settings or spoof telemetry. Before production, authenticate the operator, derive `user_id` from the verified session/token (never request input), authorize each device-to-user relationship, and protect the ingestion route with device credentials or a trusted MQTT/backend gateway. Configure CORS narrowly and add rate limits, audit logging, retries/outbox semantics, and alert deduplication/cooldowns for production use.

## Verification

Run `python -m unittest discover -s tests` and `npm run build`. The test suite covers per-user persistence, strict outside-the-range comparisons, and notification payloads without making real email requests.
