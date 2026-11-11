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
  select new_release_id, items.item->>'category', btrim(items.item->>'description'), items.ordinality - 1
  from jsonb_array_elements(p_changes) with ordinality as items(item, ordinality)
  where items.item->>'category' in ('feature', 'improvement', 'fix', 'other')
    and char_length(btrim(items.item->>'description')) between 1 and 500;

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
  select p_id, items.item->>'category', btrim(items.item->>'description'), items.ordinality - 1
  from jsonb_array_elements(p_changes) with ordinality as items(item, ordinality)
  where items.item->>'category' in ('feature', 'improvement', 'fix', 'other')
    and char_length(btrim(items.item->>'description')) between 1 and 500;

  if (select count(*) from public.version_release_changes where release_id = p_id) <> jsonb_array_length(p_changes) then
    raise exception 'invalid_release_change_item' using errcode = '22023';
  end if;
  return p_id;
end;
$$;
