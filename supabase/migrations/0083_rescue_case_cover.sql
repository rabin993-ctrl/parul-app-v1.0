-- Rescue case cover photo. Previously the "open a case" form collected a photo
-- but there was nowhere to store it, so the case detail/feed fell back to a mock
-- stock image. Add a cover reference to media_assets.
--
-- The cover lives in the PUBLIC post-media bucket (served via the CDN) because the
-- rescue feed is world-readable to authenticated users — so it's cached at the
-- edge with no per-view Supabase egress and no signed-URL expiry.

alter table public.rescue_cases
  add column if not exists cover_media_id uuid references public.media_assets(id);

create index if not exists rescue_cases_cover_media_id_idx
  on public.rescue_cases (cover_media_id);
