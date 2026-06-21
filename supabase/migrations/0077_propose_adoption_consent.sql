-- Harden propose_adoption: require that the named adopter actually engaged with
-- the listing before an adoption_records row (and the public endorsement flag
-- that endorse_adopter can later stamp) is created for them.
--
-- Previously the function accepted any p_adopter_user_id and only checked that
-- the caller was the listing poster. A poster could therefore fabricate an
-- adoption record naming an arbitrary victim and then endorse them
-- 'not_recommended', which surfaces publicly via get_adopter_public_flags.
--
-- Consent is satisfied if the adopter either filed an adoption request on this
-- listing OR is a participant in the chat thread the proposal is tied to. Both
-- are paths the real UI always produces, so legitimate proposals are unaffected.

create or replace function propose_adoption(
  p_listing_id       uuid,
  p_adopter_user_id  uuid,
  p_pet_name         text,
  p_species          text,
  p_icon             text,
  p_tint             text,
  p_thread_id        uuid default null,
  p_request_id       uuid default null
) returns uuid
language plpgsql security definer
-- Preserve the search_path hardening pinned in migration 0038 — CREATE OR REPLACE
-- would otherwise reset it, re-opening the mutable-search_path privilege risk.
set search_path = public as $$
declare
  v_poster_user_id uuid;
  v_confirmed_at   timestamptz := now();
  v_record_id      uuid;
  v_has_consent    boolean;
begin
  select poster_user_id into v_poster_user_id
  from adoption_listings where id = p_listing_id;

  if v_poster_user_id is null then raise exception 'Listing not found'; end if;
  if v_poster_user_id != auth.uid() then
    raise exception 'Only the listing poster can propose an adoption';
  end if;

  -- Consent guard (see header).
  select
    exists (
      select 1 from adoption_requests
      where listing_id = p_listing_id
        and requester_user_id = p_adopter_user_id
    )
    or (
      p_thread_id is not null and exists (
        select 1 from thread_participants
        where thread_id = p_thread_id
          and user_id = p_adopter_user_id
      )
    )
  into v_has_consent;

  if not v_has_consent then
    raise exception 'Adopter has no request or conversation on this listing';
  end if;

  insert into adoption_records (
    listing_id, chat_thread_id, poster_user_id, adopter_user_id,
    pet_name, species, icon, tint,
    status, confirmed_at, completed_milestones, next_update_due_at
  ) values (
    p_listing_id, p_thread_id, v_poster_user_id, p_adopter_user_id,
    p_pet_name, p_species, p_icon, p_tint,
    'confirmed', v_confirmed_at, '{}', v_confirmed_at + interval '7 days'
  ) returning id into v_record_id;

  -- Seed bootstrap home update
  insert into adoption_updates (record_id, type, author_user_id, text)
  values (v_record_id, 'adopter_home', p_adopter_user_id, 'First day home — settling in well.');

  -- Mark listing adopted
  update adoption_listings
  set status = 'Adopted', adopted_date = v_confirmed_at
  where id = p_listing_id;

  -- Link thread → record
  if p_thread_id is not null then
    update threads set adoption_record_id = v_record_id where id = p_thread_id;
  end if;

  -- Update request statuses atomically
  if p_request_id is not null then
    update adoption_requests
    set status = 'adopted'
    where id = p_request_id and listing_id = p_listing_id;
  end if;

  -- Reject all other active requests for this listing
  update adoption_requests
  set status = 'rejected'
  where listing_id = p_listing_id
    and status in ('submitted', 'approved')
    and (p_request_id is null or id != p_request_id);

  return v_record_id;
end;
$$;
