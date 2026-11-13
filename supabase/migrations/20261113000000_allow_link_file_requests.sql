alter table public.v2_file_requests
  add column if not exists kind text not null default 'pdf',
  add column if not exists url text;

alter table public.v2_file_requests
  alter column filename drop not null,
  alter column storage_path drop not null;

alter table public.v2_file_requests
  drop constraint if exists v2_file_requests_content_check,
  drop constraint if exists v2_file_requests_kind_check;

alter table public.v2_file_requests
  add constraint v2_file_requests_kind_check
    check (kind in ('pdf', 'link')),
  add constraint v2_file_requests_content_check
    check (
      (kind = 'pdf' and filename is not null and storage_path is not null and url is null)
      or (kind = 'link' and filename is null and storage_path is null and url ~* '^https://')
    );
