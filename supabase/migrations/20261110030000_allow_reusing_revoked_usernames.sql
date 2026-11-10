drop index if exists public.v2_users_username_lower_idx;

create unique index v2_users_username_lower_idx
  on public.v2_users (lower(username))
  where active;
