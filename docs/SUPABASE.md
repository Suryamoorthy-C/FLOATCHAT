# Supabase production setup

FLOATCHAT uses Supabase Auth in the browser and the server-side Supabase REST/Storage APIs in FastAPI:

- **Auth** provides email/password sign-in, first-time signup, and bearer-token sessions.
- **Postgres** stores user alert thresholds and avatar metadata.
- **Account metadata** stores the authenticated user's display name, email, and role.
- **Private Storage bucket** `avatars` stores sanitized JPEG/PNG profile photos.
- The backend streams avatar bytes through `/api/users/{id}/avatar`; no storage URL is exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be prefixed with `VITE_` or committed.

## One-time schema setup

Run [`supabase/migrations/20261015000000_floatchat_profiles.sql`](../supabase/migrations/20261015000000_floatchat_profiles.sql) in the Supabase SQL Editor. It creates `public.user_profiles`, enables RLS, and creates the private `avatars` bucket.

## Vercel variables

Set these in the Vercel project for **Production** and **Preview** as needed:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AVATAR_BUCKET=avatars`
- `SUPABASE_TIMEOUT_SECONDS=12`

Set these public Vite variables for the frontend build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Account behavior

Unauthenticated visitors can use the public FloatChat data pages. Opening Account redirects to the Login page, where a first-time viewer can create an email/password account. After sign-in, the frontend stores the short-lived Supabase session and sends its bearer token to the FastAPI account routes. The backend verifies the token with Supabase Auth and derives the user ID from the verified session; it never trusts a client-supplied user ID for another account.

The API automatically falls back to SQLite only when the two Supabase credentials are absent, which is useful for local tests but should not be used for Vercel production persistence.
