-- FLOATCHAT hosted persistence for Vercel.
-- Run this once in Supabase SQL Editor or with the Supabase CLI.

create table if not exists public.user_profiles (
  user_id text primary key,
  email text,
  min_temperature_c double precision,
  max_temperature_c double precision,
  min_pressure_dbar double precision,
  max_pressure_dbar double precision,
  avatar_path text,
  avatar_mime_type text,
  avatar_updated_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_profiles_updated_at_idx on public.user_profiles (updated_at desc);

-- The Python API uses the service-role key, so client roles cannot access this table.
alter table public.user_profiles enable row level security;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

-- Keep the storage bucket private. The API streams avatar bytes after validating the user id.
-- No anon/authenticated policies are required for the server-only service-role path.
