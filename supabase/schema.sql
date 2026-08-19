-- Run this in Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null check (gender in ('Pria', 'Wanita', 'Lainnya', 'Male', 'Female', 'Other')),
  pos_x double precision not null,
  pos_y double precision not null,
  submitted_at timestamptz not null default now()
);

create index if not exists participants_submitted_at_idx
  on public.participants (submitted_at desc);

alter table public.participants enable row level security;

-- Public wall can read display fields
create policy "Allow public read participants"
  on public.participants
  for select
  to anon, authenticated
  using (true);

-- Inserts only via service role (API routes) — no public insert policy

-- Enable realtime
alter publication supabase_realtime add table public.participants;

-- Collective wall reveal progress (optional; memory mode works without this)
create table if not exists public.scratch_counts (
  asset text primary key check (asset in ('hat', 'pencil', 'ribbon')),
  count integer not null default 0
);

insert into public.scratch_counts (asset, count) values
  ('hat', 0),
  ('pencil', 0),
  ('ribbon', 0)
on conflict (asset) do nothing;

create table if not exists public.scratch_claims (
  client_id text not null,
  asset text not null check (asset in ('hat', 'pencil', 'ribbon')),
  claimed_at timestamptz not null default now(),
  primary key (client_id, asset)
);

alter table public.scratch_counts enable row level security;
alter table public.scratch_claims enable row level security;

create policy "Allow public read scratch_counts"
  on public.scratch_counts
  for select
  to anon, authenticated
  using (true);

create table if not exists public.scratch_settings (
  id integer primary key default 1 check (id = 1),
  target integer not null default 20,
  complete boolean not null default false
);

insert into public.scratch_settings (id, target, complete)
values (1, 20, false)
on conflict (id) do nothing;

alter table public.scratch_settings enable row level security;

create policy "Allow public read scratch_settings"
  on public.scratch_settings
  for select
  to anon, authenticated
  using (true);
