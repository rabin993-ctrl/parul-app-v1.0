-- Allow authenticated users to read successfully rehomed (Adopted) listings in the hub.

drop policy if exists "adoption_listings_select" on public.adoption_listings;

create policy "adoption_listings_select" on public.adoption_listings
  for select using (
    deleted_at is null and (
      status in ('Available', 'Urgent', 'Adopted')
      or poster_user_id = auth.uid()
      or exists (
        select 1 from public.adoption_requests ar
        where ar.listing_id = adoption_listings.id
          and (ar.requester_user_id = auth.uid() or ar.poster_user_id = auth.uid())
      )
    )
  );

drop policy if exists "adoption_listing_media_select" on public.adoption_listing_media;

create policy "adoption_listing_media_select" on public.adoption_listing_media
  for select using (
    exists (
      select 1 from public.adoption_listings al
      where al.id = adoption_listing_media.listing_id
        and al.deleted_at is null
        and (
          al.status in ('Available', 'Urgent', 'Adopted')
          or al.poster_user_id = auth.uid()
        )
    )
  );
