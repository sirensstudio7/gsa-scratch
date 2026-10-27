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
  complete boolean not null default false,
  fill_started_at timestamptz,
  fill_minutes integer check (fill_minutes is null or fill_minutes in (3, 5, 7)),
  bubble_clicks integer not null default 0
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

create policy "Allow anon write scratch_settings"
  on public.scratch_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

create or replace function public.increment_bubble_clicks(step integer default 1)
returns integer
language plpgsql
as $$
declare
  next_total integer;
  delta integer := greatest(1, least(5, coalesce(step, 1)));
begin
  update public.scratch_settings
  set bubble_clicks = bubble_clicks + delta
  where id = 1
  returning bubble_clicks into next_total;
  return coalesce(next_total, 0);
end;
$$;

create or replace function public.record_bubble_pop(p_icon_id text, step integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  next_total integer;
  pop_row public.bubble_pops%rowtype;
  delta integer := greatest(1, least(5, coalesce(step, 1)));
  icon text := nullif(trim(coalesce(p_icon_id, '')), '');
begin
  update public.scratch_settings
  set bubble_clicks = bubble_clicks + delta
  where id = 1
  returning bubble_clicks into next_total;

  if icon is not null then
    insert into public.bubble_pops (icon_id)
    values (icon)
    returning * into pop_row;

    return jsonb_build_object(
      'total', coalesce(next_total, 0),
      'pop', jsonb_build_object(
        'id', pop_row.id,
        'icon_id', pop_row.icon_id,
        'created_at', pop_row.created_at
      )
    );
  end if;

  return jsonb_build_object('total', coalesce(next_total, 0));
end;
$$;

grant execute on function public.record_bubble_pop(text, integer) to anon, authenticated, service_role;

create table if not exists public.bubble_pops (
  id bigint generated always as identity primary key,
  icon_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists bubble_pops_created_at_idx
  on public.bubble_pops (created_at);

alter table public.bubble_pops enable row level security;

drop policy if exists "bubble_pops_select_anon" on public.bubble_pops;
create policy "bubble_pops_select_anon"
  on public.bubble_pops
  for select
  to anon, authenticated
  using (true);

alter publication supabase_realtime add table public.bubble_pops;
alter publication supabase_realtime add table public.scratch_settings;
