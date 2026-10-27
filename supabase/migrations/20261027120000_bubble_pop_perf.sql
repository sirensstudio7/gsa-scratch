-- Faster welcome pops (one round trip) + realtime tap total for projector fill

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

alter publication supabase_realtime add table public.scratch_settings;
