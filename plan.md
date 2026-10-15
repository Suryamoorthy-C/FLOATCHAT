# FLOATCHAT Supabase backend migration plan

## Scope and implementation approach

Replace Vercel-unsafe SQLite persistence for user threshold profiles and avatar bytes with Supabase Postgres plus a private Supabase Storage bucket. The FastAPI routes and frontend API contract remain stable, so existing Profile-page behavior continues to work. A small REST adapter uses the server-only Supabase service-role key; explicit SQLite paths remain supported for local development and tests.

The one-time SQL migration creates `public.user_profiles`, enables row-level security, and creates the private `avatars` bucket. Vercel receives `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_AVATAR_BUCKET`, and `SUPABASE_TIMEOUT_SECONDS` as environment variables. No Supabase secret is placed in the repository or exposed to Vite.

## Project structure

- `server/supabase_store.py`: shared Supabase PostgREST and Storage adapter.
- `server/threshold_alerts.py`: threshold profile persistence and alert evaluation; Supabase in production, SQLite fallback locally.
- `server/profile_avatars.py`: image validation plus Supabase Storage metadata/bytes handling; SQLite fallback locally.
- `supabase/migrations/20261015000000_floatchat_profiles.sql`: hosted schema and private bucket setup.
- `docs/SUPABASE.md`: setup and environment instructions.
- `api/index.py` and `vercel.json`: existing Vercel FastAPI entrypoint and `/api/*` rewrite.

## Design decisions

- **Design movement:** restrained ocean-instrument control room (0.04 probability); editorial marine field log (0.06); utilitarian cloud operations console (0.90). Chosen: utilitarian cloud operations console.
- **Core principles:** preserve the existing API surface; keep storage private; fail clearly instead of faking persistence; make local tests independent of hosted credentials.
- **Color philosophy:** retain the existing oceanic palette and use status colors only for operational meaning, not decoration.
- **Layout paradigm:** no new UI layout; the migration is backend-only and preserves the existing dashboard/profile composition.
- **Signature elements:** existing float-network visualization, provenance surfaces, and profile alert controls remain unchanged.
- **Interaction philosophy:** existing save/upload/remove actions stay synchronous from the client’s perspective and return the same response shapes.
- **Animation:** no new motion; persistence changes must not alter loading or streaming behavior.
- **Typography system:** preserve the repository’s current typography and hierarchy.
- **Brand essence:** ocean intelligence for operators who need explainable float data; grounded, technical, calm.
- **Brand voice:** direct and evidence-led, e.g. “Your custom alert thresholds have been saved.”
- **Wordmark/logo:** preserve the existing FLOATCHAT identity.
- **Signature brand color:** preserve the current deep ocean teal.
