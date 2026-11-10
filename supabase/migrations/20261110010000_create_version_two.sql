create table if not exists public.v2_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  username text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (username = lower(username)),
  check (char_length(username) between 3 and 32)
);

create unique index if not exists v2_users_username_lower_idx
  on public.v2_users (lower(username));

create table if not exists public.v2_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  kind text not null check (kind in ('technique', 'event', 'meeting', 'other')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text check (location is null or char_length(location) <= 160),
  details text check (details is null or char_length(details) <= 1000),
  created_by uuid references public.v2_users(id) on delete set null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists v2_calendar_events_starts_at_idx
  on public.v2_calendar_events (starts_at asc);

create table if not exists public.v2_file_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  filename text not null check (char_length(filename) between 1 and 255),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.v2_users(id) on delete set null,
  submitted_by_name text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists v2_file_requests_status_created_idx
  on public.v2_file_requests (status, created_at desc);

create table if not exists public.v2_activity (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_title text not null,
  actor_id uuid references public.v2_users(id) on delete set null,
  actor_name text not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists v2_activity_created_idx
  on public.v2_activity (created_at desc);

create or replace function public.log_v2_activity()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'v2_calendar_events' then
    insert into public.v2_activity (action, entity_type, entity_title, actor_id, actor_name, is_public)
    values ('calendar_created', 'calendar', new.title, new.created_by, new.created_by_name, true);
    return new;
  elsif tg_table_name = 'v2_file_requests' then
    if tg_op = 'INSERT' then
      insert into public.v2_activity (action, entity_type, entity_title, actor_id, actor_name, is_public)
      values ('file_submitted', 'file', new.title, new.submitted_by, new.submitted_by_name, false);
    elsif old.status is distinct from new.status then
      insert into public.v2_activity (action, entity_type, entity_title, actor_name, is_public)
      values (
        case new.status when 'approved' then 'file_approved' else 'file_rejected' end,
        'file',
        new.title,
        'Administration',
        new.status = 'approved'
      );
    end if;
    return new;
  elsif tg_table_name = 'v2_users' then
    if tg_op = 'INSERT' then
      insert into public.v2_activity (action, entity_type, entity_title, actor_name, is_public)
      values ('access_added', 'access', new.name, 'Administration', false);
    elsif old.active and not new.active then
      insert into public.v2_activity (action, entity_type, entity_title, actor_name, is_public)
      values ('access_revoked', 'access', new.name, 'Administration', false);
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists v2_calendar_activity on public.v2_calendar_events;
create trigger v2_calendar_activity
  after insert on public.v2_calendar_events
  for each row execute function public.log_v2_activity();

drop trigger if exists v2_file_activity on public.v2_file_requests;
create trigger v2_file_activity
  after insert or update of status on public.v2_file_requests
  for each row execute function public.log_v2_activity();

drop trigger if exists v2_user_activity on public.v2_users;
create trigger v2_user_activity
  after insert or update of active on public.v2_users
  for each row execute function public.log_v2_activity();

alter table public.v2_users enable row level security;
alter table public.v2_calendar_events enable row level security;
alter table public.v2_file_requests enable row level security;
alter table public.v2_activity enable row level security;

revoke all on public.v2_users, public.v2_calendar_events, public.v2_file_requests, public.v2_activity
  from anon, authenticated;
grant all on public.v2_users, public.v2_calendar_events, public.v2_file_requests, public.v2_activity
  to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('v2-file-requests', 'v2-file-requests', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
