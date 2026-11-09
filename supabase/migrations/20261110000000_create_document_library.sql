create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pdf', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  filename text,
  storage_path text unique,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'pdf' and filename is not null and storage_path is not null and url is null)
    or (kind = 'link' and filename is null and storage_path is null and url is not null)
  ),
  check (url is null or url like 'https://%')
);

create index if not exists documents_kind_created_at_idx
  on public.documents (kind, created_at desc);

create index if not exists comments_created_at_idx
  on public.comments (created_at desc, id desc);

create or replace function public.enforce_document_limits()
returns trigger
language plpgsql
as $$
declare
  document_count integer;
  document_limit integer;
begin
  if new.kind = 'pdf' then
    perform pg_advisory_xact_lock(20261110, 1);
  else
    perform pg_advisory_xact_lock(20261110, 2);
  end if;

  document_limit := case new.kind when 'pdf' then 10 else 15 end;
  select count(*) into document_count
  from public.documents
  where kind = new.kind;

  if document_count >= document_limit then
    raise exception 'document_limit_%', new.kind using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_enforce_limits on public.documents;
create trigger documents_enforce_limits
  before insert on public.documents
  for each row execute function public.enforce_document_limits();

alter table public.documents enable row level security;
revoke all on public.documents from anon, authenticated;
grant all on public.documents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-documents', 'project-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
