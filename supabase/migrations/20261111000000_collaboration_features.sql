alter table public.v2_users
  add column if not exists theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system'));

alter table public.comments
  add column if not exists actor_id uuid references public.v2_users(id) on delete set null,
  add column if not exists actor_is_admin boolean not null default false;

alter table public.roadmap_status
  add column if not exists updated_by uuid references public.v2_users(id) on delete set null,
  add column if not exists updated_by_is_admin boolean not null default false;

alter table public.documents
  add column if not exists created_by uuid references public.v2_users(id) on delete set null,
  add column if not exists updated_by uuid references public.v2_users(id) on delete set null,
  add column if not exists created_by_is_admin boolean not null default false,
  add column if not exists updated_by_is_admin boolean not null default false;

alter table public.v2_calendar_events
  add column if not exists created_by_is_admin boolean not null default false,
  add column if not exists updated_by uuid references public.v2_users(id) on delete set null,
  add column if not exists updated_by_is_admin boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.v2_users(id) on delete set null,
  sender_name text not null check (char_length(btrim(sender_name)) between 1 and 80),
  sender_is_admin boolean not null default false,
  content text not null check (char_length(btrim(content)) between 1 and 4000),
  reply_to_id uuid references public.team_chat_messages(id) on delete set null,
  edited boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reply_to_id is null or reply_to_id <> id)
);

create index if not exists team_chat_messages_created_idx
  on public.team_chat_messages (created_at desc, id desc);
create index if not exists team_chat_messages_reply_idx
  on public.team_chat_messages (reply_to_id) where reply_to_id is not null;

create table if not exists public.team_chat_reads (
  user_id uuid primary key references public.v2_users(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

create table if not exists public.team_chat_admin_reads (
  id boolean primary key default true check (id),
  last_read_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.v2_users(id) on delete cascade,
  recipient_role text not null default 'member' check (recipient_role in ('member', 'admin')),
  actor_id uuid references public.v2_users(id) on delete set null,
  event_key text not null,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 240),
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (href like '/%'),
  check ((recipient_role = 'member' and user_id is not null) or (recipient_role = 'admin' and user_id is null))
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null and recipient_role = 'member';
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc) where recipient_role = 'member';
create index if not exists notifications_admin_unread_idx
  on public.notifications (created_at desc) where read_at is null and recipient_role = 'admin';

create or replace function public.notify_active_members(
  p_actor_id uuid,
  p_event_key text,
  p_title text,
  p_description text,
  p_href text,
  p_skip_user_id uuid default null,
  p_actor_is_admin boolean default false,
  p_skip_admin boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, recipient_role, actor_id, event_key, title, description, href)
  select u.id, 'member', p_actor_id, p_event_key, p_title, p_description, p_href
  from public.v2_users u
  where u.active
    and u.id is distinct from p_actor_id
    and u.id is distinct from p_skip_user_id;
  if not p_actor_is_admin and not p_skip_admin then
    insert into public.notifications (user_id, recipient_role, actor_id, event_key, title, description, href)
    values (null, 'admin', p_actor_id, p_event_key, p_title, p_description, p_href);
  end if;
end;
$$;

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.team_chat_messages%rowtype;
begin
  if new.reply_to_id is not null then
    select * into parent from public.team_chat_messages where id = new.reply_to_id;
  end if;

  perform public.notify_active_members(
    new.sender_id,
    'chat:' || new.id::text,
    case when new.reply_to_id is null then 'Neue Teamchat-Nachricht' else 'Neue Teamchat-Antwort' end,
    left(new.content, 240),
    '/?section=teamchat',
    case when new.reply_to_id is not null then parent.sender_id else null end,
    new.sender_is_admin,
    case when new.reply_to_id is not null then parent.sender_is_admin else false end
  );

  if new.reply_to_id is not null and not new.sender_is_admin
    and (parent.sender_id is not null or parent.sender_is_admin) then
    insert into public.notifications (user_id, recipient_role, actor_id, event_key, title, description, href)
    values (
      parent.sender_id, case when parent.sender_is_admin then 'admin' else 'member' end,
      new.sender_id, 'reply:' || new.id::text,
      'Antwort auf deine Nachricht', left(new.content, 240), '/?section=teamchat'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists team_chat_notify_insert on public.team_chat_messages;
create trigger team_chat_notify_insert
  after insert on public.team_chat_messages
  for each row execute function public.notify_chat_message();

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notify_active_members(
    new.actor_id, 'comment:' || new.id::text, 'Neuer Kommentar',
    left(new.name || ': ' || new.message, 240),
    '/?section=roadmap&step=' || new.step_id,
    null, new.actor_is_admin
  );
  return new;
end;
$$;

drop trigger if exists comments_notify_insert on public.comments;
create trigger comments_notify_insert
  after insert on public.comments
  for each row execute function public.notify_new_comment();

create or replace function public.notify_roadmap_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    perform public.notify_active_members(
      new.updated_by, 'roadmap:' || new.step_id || ':' || new.updated_at::text,
      'Roadmap aktualisiert', 'Der Status eines Roadmap-Eintrags wurde geändert.',
      '/?section=roadmap&step=' || new.step_id, null, new.updated_by_is_admin
    );
  end if;
  return new;
end;
$$;

drop trigger if exists roadmap_status_notify_update on public.roadmap_status;
create trigger roadmap_status_notify_update
  after update of status on public.roadmap_status
  for each row execute function public.notify_roadmap_status_change();

create or replace function public.notify_document_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  document_id uuid;
  document_title text;
  change_time timestamptz;
  actor_is_admin boolean;
begin
  if tg_op = 'DELETE' then
    actor := old.updated_by;
    document_id := old.id;
    document_title := old.title;
    change_time := now();
    actor_is_admin := true;
  else
    actor := case when tg_op = 'INSERT' then new.created_by else new.updated_by end;
    document_id := new.id;
    document_title := new.title;
    change_time := new.updated_at;
    actor_is_admin := case when tg_op = 'INSERT' then new.created_by_is_admin else new.updated_by_is_admin end;
  end if;
  perform public.notify_active_members(
    actor, 'document:' || document_id::text || ':' || change_time::text,
    case when tg_op = 'INSERT' then 'Neues Dokument'
      when tg_op = 'DELETE' then 'Dokument entfernt' else 'Dokument aktualisiert' end,
    document_title, '/?section=documents', null, actor_is_admin
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists documents_notify_change on public.documents;
create trigger documents_notify_change
  after insert or update of title, filename, storage_path, url or delete on public.documents
  for each row execute function public.notify_document_change();

create or replace function public.notify_file_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify_active_members(
      new.submitted_by, 'file-request:' || new.id::text,
      'Neue Dateifreigabe angefragt', new.title, '/?section=documents', null, false
    );
  elsif new.status is distinct from old.status then
    perform public.notify_active_members(
      null, 'file-status:' || new.id::text || ':' || new.status,
      'Freigabestatus geändert',
      new.title || case when new.status = 'approved' then ' wurde freigegeben.' else ' wurde abgelehnt.' end,
      '/?section=documents', null, true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists v2_file_request_notify_change on public.v2_file_requests;
create trigger v2_file_request_notify_change
  after insert or update of status on public.v2_file_requests
  for each row execute function public.notify_file_request_change();

create or replace function public.notify_calendar_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
begin
  actor := case when tg_op = 'INSERT' then new.created_by else new.updated_by end;
  perform public.notify_active_members(
    actor, 'calendar:' || new.id::text || ':' || new.updated_at::text,
    case when tg_op = 'INSERT' then 'Neuer Kalendertermin' else 'Kalendertermin geändert' end,
    new.title, '/?section=calendar', null,
    case when tg_op = 'INSERT' then new.created_by_is_admin else new.updated_by_is_admin end
  );
  return new;
end;
$$;

create or replace function public.touch_calendar_event()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists v2_calendar_touch_updated_at on public.v2_calendar_events;
create trigger v2_calendar_touch_updated_at
  before update on public.v2_calendar_events
  for each row execute function public.touch_calendar_event();

drop trigger if exists v2_calendar_notify_change on public.v2_calendar_events;
create trigger v2_calendar_notify_change
  after insert or update of title, kind, starts_at, ends_at, location, details on public.v2_calendar_events
  for each row execute function public.notify_calendar_change();

alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reads enable row level security;
alter table public.team_chat_admin_reads enable row level security;
alter table public.notifications enable row level security;

revoke all on public.team_chat_messages, public.team_chat_reads, public.team_chat_admin_reads, public.notifications
  from public, anon, authenticated;
grant all on public.team_chat_messages, public.team_chat_reads, public.team_chat_admin_reads, public.notifications
  to service_role;

revoke all on function public.notify_active_members(uuid, text, text, text, text, uuid, boolean, boolean)
  from public, anon, authenticated;
revoke all on function public.notify_chat_message() from public, anon, authenticated;
revoke all on function public.notify_new_comment() from public, anon, authenticated;
revoke all on function public.notify_roadmap_status_change() from public, anon, authenticated;
revoke all on function public.notify_document_change() from public, anon, authenticated;
revoke all on function public.notify_file_request_change() from public, anon, authenticated;
revoke all on function public.notify_calendar_change() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_chat_messages'
    ) then
      alter publication supabase_realtime add table public.team_chat_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end;
$$;
