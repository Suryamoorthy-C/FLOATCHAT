# Secrets setup

## Supabase
1. Go to supabase.com and sign in.
2. Choose **New project**, name it `agrochat`, select a nearby region, and create a database password.
3. Open **Project Settings → API**.
4. Copy **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
5. Copy the public anonymous key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. Put values only in `.env.local`; do not commit that file.

## Vercel
1. Go to vercel.com and sign in with GitHub.
2. Choose **Add New → Project** and select `FLOATCHAT`.
3. Add the same environment variable names under **Settings → Environment Variables**.
4. Add any server-only AI key as a non-public variable; never prefix it with `NEXT_PUBLIC_`.
5. Deploy and test the production URL.

If a secret is accidentally committed, revoke it immediately and replace it.
