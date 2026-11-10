create or replace function public.log_v2_calendar_update()
returns trigger
language plpgsql
as $$
begin
  insert into public.v2_activity (action, entity_type, entity_title, actor_id, actor_name, is_public)
  values ('calendar_updated', 'calendar', new.title, new.created_by, 'Administration', true);
  return new;
end;
$$;

drop trigger if exists v2_calendar_update_activity on public.v2_calendar_events;
create trigger v2_calendar_update_activity
  after update of title, kind, starts_at, ends_at, location, details on public.v2_calendar_events
  for each row execute function public.log_v2_calendar_update();
