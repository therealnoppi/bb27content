create extension if not exists pgcrypto;

create table if not exists public.roadmap_status (
  step_id text primary key,
  status text not null default 'green'
    check (status in ('green', 'yellow', 'red')),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  step_id text not null references public.roadmap_status(step_id) on update cascade on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists comments_step_created_at_idx
  on public.comments (step_id, created_at desc);

insert into public.roadmap_status (step_id, status)
values
  ('discovery', 'green'),
  ('foundations', 'green'),
  ('prototype', 'green'),
  ('build', 'green'),
  ('launch', 'green')
on conflict (step_id) do nothing;

alter table public.roadmap_status enable row level security;
alter table public.comments enable row level security;

revoke all on public.roadmap_status from anon, authenticated;
revoke all on public.comments from anon, authenticated;
grant all on public.roadmap_status to service_role;
grant all on public.comments to service_role;
