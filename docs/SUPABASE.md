# Supabase production setup

FLOATCHAT uses Supabase only from the FastAPI backend:

- **Postgres** stores user alert thresholds and avatar metadata.
- **Private Storage bucket** `avatars` stores sanitized JPEG/PNG profile photos.
- The backend streams avatar bytes through `/api/users/{id}/avatar`; no storage URL is exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be prefixed with `VITE_` or committed.

## One-time schema setup

Run [`supabase/migrations/20261015000000_floatchat_profiles.sql`](../supabase/migrations/20261015000000_floatchat_profiles.sql) in the Supabase SQL Editor. It creates `public.user_profiles`, enables RLS, and creates the private `avatars` bucket.

## Vercel variables

Set these in the Vercel project for **Production** and **Preview** as needed:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AVATAR_BUCKET=avatars`
- `SUPABASE_TIMEOUT_SECONDS=12`

The API automatically falls back to SQLite only when the two Supabase credentials are absent, which is useful for local tests but should not be used for Vercel production persistence.
