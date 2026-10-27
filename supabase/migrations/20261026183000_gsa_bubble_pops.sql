-- Log each welcome bubble pop (icon shown on /wall side rails)

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
