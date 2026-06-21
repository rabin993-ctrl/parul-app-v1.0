-- Username availability check for the sign-up form.
--
-- Sign-up happens pre-auth (the anon role), which cannot read public.users
-- (RLS is authenticated-only and column SELECT is locked down in 0080). So the
-- form can't check the users table directly. This SECURITY DEFINER function
-- returns only a boolean — no row data — and normalizes the input the same way
-- handle_new_user (0028) does, so the check matches what sign-up will actually
-- store.

create or replace function public.is_handle_available(p_handle text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.users
    where handle = nullif(regexp_replace(lower(coalesce(p_handle, '')), '[^a-z0-9_]', '', 'g'), '')
  );
$$;

-- Callable before login (anon) and after (authenticated). Lock out everything else.
revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to anon, authenticated;
