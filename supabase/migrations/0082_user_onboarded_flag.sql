-- Onboarding flag: distinguishes users who chose a username at signup
-- (email/password flow) from OAuth signups (Google) who got an auto-generated
-- handle and should be prompted to pick a username + confirm their name.

alter table public.users
  add column if not exists onboarded boolean not null default false;

-- Existing users already have handles — treat them all as onboarded so they are
-- never prompted.
update public.users set onboarded = true where onboarded = false;

-- 0080 revoked blanket SELECT on users and re-granted specific columns; expose
-- the new column so the client can read it.
grant select (onboarded) on public.users to authenticated;

-- Signup trigger: mark onboarded when the caller supplied a handle in metadata
-- (email/password signup picks a username). OAuth signups have no handle in
-- metadata, so they start un-onboarded and the app prompts them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  base_handle  text;
  final_handle text;
  v_has_handle boolean;
  n int := 0;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    split_part(coalesce(new.email, 'friend'), '@', 1)
  );

  v_has_handle := nullif(
    regexp_replace(lower(new.raw_user_meta_data->>'handle'), '[^a-z0-9_]', '', 'g'),
    ''
  ) is not null;

  base_handle := coalesce(
    nullif(regexp_replace(lower(new.raw_user_meta_data->>'handle'), '[^a-z0-9_]', '', 'g'), ''),
    regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g')
  );
  if base_handle = '' then base_handle := 'user'; end if;

  final_handle := base_handle;
  while exists (select 1 from public.users where handle = final_handle) loop
    n := n + 1;
    final_handle := base_handle || n::text;
  end loop;

  insert into public.users (id, handle, name, email, onboarded)
  values (new.id, final_handle, display_name, new.email, v_has_handle)
  on conflict (id) do nothing;

  insert into public.user_privacy_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.treat_wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
