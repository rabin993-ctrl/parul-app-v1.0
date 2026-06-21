-- B1: restrict circle-media reads to members of the owning circle.
--
-- 0002 created circle-media (a PRIVATE bucket) with a SELECT policy of
-- USING (bucket_id = 'circle-media') for every authenticated user — so anyone
-- logged in could mint a signed URL for any circle's private group-chat images
-- by enumerating object paths. The promised "Wave 6 refines to members" never
-- shipped.
--
-- Object paths are `{uploaderUserId}/{mediaId}/{original|thumb|full}.{ext}`
-- (see uploadMediaAsset). `media_assets.id` == that `{mediaId}` folder, and
-- circle_message_media.media_id -> media_assets.id -> circle_id ties an object
-- to its circle. Allow a read when the caller uploaded the object OR is a member
-- of the circle that posted it.
--
-- The membership lookup is a SECURITY DEFINER helper (mirroring is_circle_member,
-- which gates circle_messages itself) so it bypasses the nested RLS on
-- circle_message_media / circle_members — otherwise media access could silently
-- diverge from message access.
--
-- NOTE: adoption-media and rescue-media intentionally keep "authenticated read".
-- Those back the adoption hub and rescue feed, which are browseable by every
-- signed-in user (the underlying adoption_listings / rescue_cases rows are
-- world-readable to authenticated users), so all viewers must be able to sign
-- their photos. They are public-facing content, not private data.

create or replace function public.can_read_circle_media(p_object_name text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from circle_message_media cmm
    join circle_members cm on cm.circle_id = cmm.circle_id
    where cm.user_id = auth.uid()
      -- path is {userId}/{mediaId}/{file}; [2] is the media_assets id. Compare as
      -- text so a non-UUID path element can never raise a cast error.
      and cmm.media_id::text = (storage.foldername(p_object_name))[2]
  );
$$;

DROP POLICY IF EXISTS "circle_media_select_auth" ON storage.objects;

CREATE POLICY "circle_media_select_member"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'circle-media'
    AND (
      -- Uploader can always read their own objects (also covers the brief window
      -- before the circle_message_media row is inserted).
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_read_circle_media(name)
    )
  );
