create table if not exists public.version_releases (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  version_number text check (version_number is null or char_length(version_number) <= 32),
  release_date date not null,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by uuid references public.v2_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'draft' and published_at is null) or (status in ('published', 'archived') and published_at is not null))
);

create index if not exists version_releases_publication_idx
  on public.version_releases (release_date desc, published_at desc)
  where published_at is not null;
create index if not exists version_releases_status_updated_idx
  on public.version_releases (status, updated_at desc);

create table if not exists public.version_release_changes (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.version_releases(id) on delete cascade,
  category text not null check (category in ('feature', 'improvement', 'fix', 'other')),
  description text not null check (char_length(btrim(description)) between 1 and 500),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create index if not exists version_release_changes_release_order_idx
  on public.version_release_changes (release_id, sort_order, created_at);

create table if not exists public.version_release_reads (
  release_id uuid not null references public.version_releases(id) on delete cascade,
  reader_key text not null,
  reader_role text not null check (reader_role in ('member', 'admin')),
  user_id uuid references public.v2_users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (release_id, reader_key),
  check (
    (reader_role = 'member' and user_id is not null and reader_key = user_id::text)
    or (reader_role = 'admin' and user_id is null and reader_key = 'admin')
  )
);

create index if not exists version_release_reads_user_idx
  on public.version_release_reads (user_id, read_at desc)
  where reader_role = 'member';

create or replace function public.create_version_release(
  p_name text,
  p_version_number text,
  p_release_date date,
  p_description text,
  p_changes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_release_id uuid;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'invalid_release_changes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) not between 1 and 100 then
    raise exception 'invalid_release_changes' using errcode = '22023';
  end if;

  insert into public.version_releases (name, version_number, release_date, description)
  values (btrim(p_name), nullif(btrim(coalesce(p_version_number, '')), ''), p_release_date, btrim(p_description))
  returning id into new_release_id;

  insert into public.version_release_changes (release_id, category, description, sort_order)
  select new_release_id, item->>'category', btrim(item->>'description'), item.ordinality - 1
  from jsonb_array_elements(p_changes) with ordinality as items(item, ordinality)
  where item->>'category' in ('feature', 'improvement', 'fix', 'other')
    and char_length(btrim(item->>'description')) between 1 and 500;

  if (select count(*) from public.version_release_changes where release_id = new_release_id) <> jsonb_array_length(p_changes) then
    raise exception 'invalid_release_change_item' using errcode = '22023';
  end if;
  return new_release_id;
end;
$$;

create or replace function public.update_version_release(
  p_id uuid,
  p_name text,
  p_version_number text,
  p_release_date date,
  p_description text,
  p_changes jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'invalid_release_changes' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) not between 1 and 100 then
    raise exception 'invalid_release_changes' using errcode = '22023';
  end if;

  update public.version_releases
  set name = btrim(p_name),
      version_number = nullif(btrim(coalesce(p_version_number, '')), ''),
      release_date = p_release_date,
      description = btrim(p_description),
      updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'version_release_not_found' using errcode = 'P0002';
  end if;

  delete from public.version_release_changes where release_id = p_id;
  insert into public.version_release_changes (release_id, category, description, sort_order)
  select p_id, item->>'category', btrim(item->>'description'), item.ordinality - 1
  from jsonb_array_elements(p_changes) with ordinality as items(item, ordinality)
  where item->>'category' in ('feature', 'improvement', 'fix', 'other')
    and char_length(btrim(item->>'description')) between 1 and 500;

  if (select count(*) from public.version_release_changes where release_id = p_id) <> jsonb_array_length(p_changes) then
    raise exception 'invalid_release_change_item' using errcode = '22023';
  end if;
  return p_id;
end;
$$;

create or replace function public.publish_version_release(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.version_releases
  set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  where id = p_id and status <> 'archived';
  if not found then
    raise exception 'version_release_not_publishable' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

create or replace function public.archive_version_release(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.version_releases
  set status = 'archived', updated_at = now()
  where id = p_id and status = 'published';
  if not found then
    raise exception 'version_release_not_archivable' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

alter table public.version_releases enable row level security;
alter table public.version_release_changes enable row level security;
alter table public.version_release_reads enable row level security;

revoke all on public.version_releases, public.version_release_changes, public.version_release_reads
  from public, anon, authenticated;
grant all on public.version_releases, public.version_release_changes, public.version_release_reads
  to service_role;

revoke all on function public.create_version_release(text, text, date, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_version_release(uuid, text, text, date, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.publish_version_release(uuid)
  from public, anon, authenticated;
revoke all on function public.archive_version_release(uuid)
  from public, anon, authenticated;
grant execute on function public.create_version_release(text, text, date, text, jsonb) to service_role;
grant execute on function public.update_version_release(uuid, text, text, date, text, jsonb) to service_role;
grant execute on function public.publish_version_release(uuid) to service_role;
grant execute on function public.archive_version_release(uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'version_releases'
    ) then
    alter publication supabase_realtime add table public.version_releases;
  end if;
end;
$$;
