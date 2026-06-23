-- Resolve a sign-in identifier (email or username/handle) to the auth email.
--
-- Sign-in happens pre-auth (anon), which cannot read public.users.email (0080).
-- Supabase Auth signInWithPassword requires email, so this SECURITY DEFINER
-- helper maps handle → email. Returns only the email string (or null).

create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  trimmed text;
  normalized_handle text;
  found_email text;
begin
  trimmed := lower(trim(coalesce(p_identifier, '')));
  if trimmed = '' then
    return null;
  end if;

  if position('@' in trimmed) > 0 then
    return trimmed;
  end if;

  normalized_handle := nullif(regexp_replace(trimmed, '[^a-z0-9_]', '', 'g'), '');
  if normalized_handle is null then
    return null;
  end if;

  select u.email
  into found_email
  from public.users u
  where u.handle = normalized_handle
    and u.deleted_at is null
  limit 1;

  return found_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
