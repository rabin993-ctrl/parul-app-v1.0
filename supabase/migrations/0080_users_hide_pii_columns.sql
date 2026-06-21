-- B2: stop exposing every user's email/phone to all authenticated clients.
--
-- The only SELECT policy on `users` is `users_select_all USING (true)`, and the
-- table holds `email` and `phone`. RLS is row-level only, so a policy cannot hide
-- a column — any authenticated client could `select email, phone from users` for
-- the entire user base. The correct tool is column-level privileges.
--
-- We revoke blanket SELECT and re-grant SELECT on every column EXCEPT email and
-- phone. Profile reads (name/handle/tint/avatar/bio/...) are unaffected; the app
-- never selects email/phone from this table (own email comes from the auth
-- session). SECURITY DEFINER functions run as the table owner and bypass these
-- role grants, so signup/notification logic that reads email still works.

REVOKE SELECT ON public.users FROM anon, authenticated;

GRANT SELECT (
  id,
  handle,
  name,
  tint,
  avatar_media_id,
  bio,
  location,
  website,
  verified,
  online_last_seen,
  joined_at,
  created_at,
  updated_at,
  deleted_at
) ON public.users TO authenticated;
