-- search_discoverable_users declared handle as text but users.handle is citext,
-- which made every RPC call fail with 42804 and global username search return nothing.

create or replace function public.search_discoverable_users(
  p_query text,
  p_limit int default 40
)
returns table (
  id uuid,
  name text,
  handle text,
  tint text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_clean text;
  v_pattern text;
begin
  if p_query is null or btrim(p_query) = '' then
    return;
  end if;

  v_clean := regexp_replace(lower(btrim(p_query)), '^@', '');
  if v_clean = '' then
    return;
  end if;

  v_pattern := '%' || replace(replace(replace(v_clean, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  select u.id, u.name, u.handle::text, u.tint
  from users u
  where u.deleted_at is null
    and (
      get_user_discoverable(u.id) = true
      or u.id = auth.uid()
    )
    and not exists (
      select 1
      from blocked_users b
      where (b.blocker_id = auth.uid() and b.blocked_id = u.id)
         or (b.blocker_id = u.id and b.blocked_id = auth.uid())
    )
    and (
      lower(u.handle::text) = v_clean
      or u.name ilike v_pattern escape '\'
      or u.handle ilike v_pattern escape '\'
    )
  order by
    case when lower(u.handle::text) = v_clean then 0 else 1 end,
    u.name
  limit coalesce(p_limit, 40);
end;
$$;

grant execute on function public.search_discoverable_users(text, int) to authenticated;
