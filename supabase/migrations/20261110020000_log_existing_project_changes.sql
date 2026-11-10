create or replace function public.log_existing_project_activity()
returns trigger
language plpgsql
as $$
declare
  action_name text;
  title text;
  actor_name text := 'Administration';
begin
  if tg_table_name = 'comments' then
    if tg_op = 'INSERT' then
      action_name := 'comment_added';
      title := new.name || ' hat einen Kommentar hinzugefügt';
      actor_name := new.name;
    else
      action_name := 'comment_deleted';
      title := old.name || 's Kommentar wurde gelöscht';
    end if;
  elsif tg_table_name = 'documents' then
    if tg_op = 'INSERT' then
      action_name := 'document_added';
      title := new.title;
    elsif tg_op = 'UPDATE' then
      action_name := 'document_updated';
      title := new.title;
    else
      action_name := 'document_deleted';
      title := old.title;
    end if;
  elsif tg_table_name = 'roadmap_status' then
    action_name := 'status_updated';
    title := new.step_id || ' · ' || new.status;
  end if;

  insert into public.v2_activity (action, entity_type, entity_title, actor_name, is_public)
  values (
    action_name,
    case tg_table_name when 'roadmap_status' then 'roadmap' when 'comments' then 'comment' else 'document' end,
    title,
    actor_name,
    true
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists comments_v2_activity on public.comments;
create trigger comments_v2_activity
  after insert or delete on public.comments
  for each row execute function public.log_existing_project_activity();

drop trigger if exists documents_v2_activity on public.documents;
create trigger documents_v2_activity
  after insert or update or delete on public.documents
  for each row execute function public.log_existing_project_activity();

drop trigger if exists roadmap_status_v2_activity on public.roadmap_status;
create trigger roadmap_status_v2_activity
  after update of status on public.roadmap_status
  for each row execute function public.log_existing_project_activity();
