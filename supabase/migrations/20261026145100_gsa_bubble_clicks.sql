-- GSA wall: global welcome bubble tap counter + atomic increment (run on your GSA Supabase project)

alter table public.scratch_settings
  add column if not exists bubble_clicks integer not null default 0;

create or replace function public.increment_bubble_clicks(step integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
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

grant execute on function public.increment_bubble_clicks(integer) to anon, authenticated, service_role;
