-- Run once in Supabase: SQL Editor > New query > paste > Run.
create table if not exists public.skiers (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz not null default now()
);

-- Row level security ON with no policies: the public (anon) key can read nothing,
-- so emails and edit tokens stay private. The server uses the secret key, which bypasses RLS.
alter table public.skiers enable row level security;
