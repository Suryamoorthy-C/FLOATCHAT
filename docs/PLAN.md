# ARGOCHAT plan

## Product
A focused ocean-device operations assistant. The first release displays device telemetry, highlights abnormal readings, explains them in plain language, and lets an operator review incidents.

## Architecture
Next.js App Router → Route Handler → server-side AI/provider adapter → Supabase Postgres. Vercel hosts the app. Keep provider keys on the server.

## Data
- `devices`: `id`, `name`, `location`, `status`, `last_seen_at`
- `telemetry`: `id`, `device_id`, `metric`, `value`, `unit`, `recorded_at`
- `incidents`: `id`, `device_id`, `severity`, `summary`, `status`, `created_at`
- `conversations`: `id`, `user_id`, `title`, `created_at`
- `messages`: `id`, `conversation_id`, `role`, `content`, `created_at`
- Optional `profiles`: `id`, `preferred_language`, `created_at`

## API
- `GET /api/devices`: list devices and latest status.
- `GET /api/devices/:id/telemetry`: return recent readings.
- `POST /api/chat`: validate an operator question, explain telemetry, and return an answer plus request id.
- `GET /api/conversations`: list the signed-in user’s recent conversations.
- `POST /api/conversations`: create a conversation.

## UI
Single responsive dashboard: device status cards, latest telemetry, anomaly banner, incident details, chat panel, loading state, retry state, and recent incidents.

## Priorities
1. Working device-to-dashboard golden path.
2. Clear ocean telemetry and anomaly explanation.
3. Loading/error handling.
4. Save and reload recent incidents.
5. Mobile layout.
6. Basic operator login.
7. Device map or location view.
8. Historical analytics.

Hard cut after T+180: keep 1–5; cut 6–8 if needed.
