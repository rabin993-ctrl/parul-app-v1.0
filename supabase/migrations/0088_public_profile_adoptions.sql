-- Public profile Rehomed / Adopted placements for viewers who can see the profile.

create or replace function public.can_view_adoption_placement(
  p_poster_user_id uuid,
  p_adopter_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_poster_user_id = auth.uid() or p_adopter_user_id = auth.uid() then
    return true;
  end if;
  if public.can_view_user_profile(p_poster_user_id) then
    return true;
  end if;
  if public.can_view_user_profile(p_adopter_user_id) then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.get_public_profile_adoptions(p_profile_user_id uuid)
returns table (
  id uuid,
  listing_id uuid,
  chat_thread_id uuid,
  poster_user_id uuid,
  adopter_user_id uuid,
  pet_name text,
  species text,
  icon text,
  tint text,
  new_home text,
  status text,
  confirmed_at timestamptz,
  completed_milestones public.milestone_enum[],
  poster_endorsed boolean,
  poster_recommendation public.poster_recommendation_enum,
  next_update_due_at timestamptz,
  closed_reason text,
  closed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_profile_user_id is null then
    return;
  end if;

  if not public.can_view_user_profile(p_profile_user_id) then
    return;
  end if;

  return query
  select
    ar.id,
    ar.listing_id,
    ar.chat_thread_id,
    ar.poster_user_id,
    ar.adopter_user_id,
    ar.pet_name,
    ar.species,
    ar.icon,
    ar.tint,
    ar.new_home,
    ar.status::text,
    ar.confirmed_at,
    ar.completed_milestones,
    ar.poster_endorsed,
    ar.poster_recommendation,
    ar.next_update_due_at,
    ar.closed_reason,
    ar.closed_at
  from public.adoption_records ar
  where ar.status <> 'pending_confirmation'
    and (ar.poster_user_id = p_profile_user_id or ar.adopter_user_id = p_profile_user_id)
  order by coalesce(ar.confirmed_at, ar.created_at) desc;
end;
$$;

create or replace function public.get_public_adoption_record(p_record_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rec public.adoption_records%rowtype;
  v_updates jsonb;
begin
  if p_record_id is null then
    return null;
  end if;

  select * into v_rec
  from public.adoption_records ar
  where ar.id = p_record_id
    and ar.status <> 'pending_confirmation';

  if not found then
    return null;
  end if;

  if not public.can_view_adoption_placement(v_rec.poster_user_id, v_rec.adopter_user_id) then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', au.id,
        'record_id', au.record_id,
        'type', au.type,
        'author_user_id', au.author_user_id,
        'text', au.text,
        'endorsement', au.endorsement,
        'photo_count', au.photo_count,
        'has_video', au.has_video,
        'milestone_id', au.milestone_id,
        'created_at', au.created_at
      )
      order by au.created_at asc
    ),
    '[]'::jsonb
  )
  into v_updates
  from public.adoption_updates au
  where au.record_id = v_rec.id
    and au.type in ('adopter_home', 'poster_endorsement', 'adopter_response');

  return jsonb_build_object(
    'id', v_rec.id,
    'listing_id', v_rec.listing_id,
    'chat_thread_id', v_rec.chat_thread_id,
    'poster_user_id', v_rec.poster_user_id,
    'adopter_user_id', v_rec.adopter_user_id,
    'pet_name', v_rec.pet_name,
    'species', v_rec.species,
    'icon', v_rec.icon,
    'tint', v_rec.tint,
    'new_home', v_rec.new_home,
    'status', v_rec.status::text,
    'confirmed_at', v_rec.confirmed_at,
    'completed_milestones', to_jsonb(v_rec.completed_milestones),
    'poster_endorsed', v_rec.poster_endorsed,
    'poster_recommendation', v_rec.poster_recommendation,
    'next_update_due_at', v_rec.next_update_due_at,
    'closed_reason', v_rec.closed_reason,
    'closed_at', v_rec.closed_at,
    'updates', v_updates
  );
end;
$$;

create or replace function public.get_public_adoption_listing(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_listing public.adoption_listings%rowtype;
  v_poster record;
  v_record public.adoption_records%rowtype;
  v_allowed boolean := false;
begin
  if p_listing_id is null then
    return null;
  end if;

  select * into v_listing
  from public.adoption_listings al
  where al.id = p_listing_id
    and al.deleted_at is null;

  if not found then
    return null;
  end if;

  if v_listing.poster_user_id = auth.uid() then
    v_allowed := true;
  elsif v_listing.status in ('Available', 'Urgent') then
    v_allowed := true;
  else
    select ar.* into v_record
    from public.adoption_records ar
    where ar.listing_id = p_listing_id
      and ar.status <> 'pending_confirmation'
    order by ar.confirmed_at desc nulls last
    limit 1;

    if found then
      v_allowed := public.can_view_adoption_placement(v_record.poster_user_id, v_record.adopter_user_id);
    else
      v_allowed := public.can_view_user_profile(v_listing.poster_user_id);
    end if;
  end if;

  if not v_allowed then
    return null;
  end if;

  select u.name, u.handle, u.tint
  into v_poster
  from public.users u
  where u.id = v_listing.poster_user_id;

  return jsonb_build_object(
    'id', v_listing.id,
    'poster_user_id', v_listing.poster_user_id,
    'name', v_listing.name,
    'species', v_listing.species,
    'breed', v_listing.breed,
    'age', v_listing.age,
    'age_group', v_listing.age_group,
    'gender', v_listing.gender,
    'location', v_listing.location,
    'icon', v_listing.icon,
    'tint', v_listing.tint,
    'vaccination', v_listing.vaccination,
    'neutered', v_listing.neutered,
    'microchipped', v_listing.microchipped,
    'health_notes', v_listing.health_notes,
    'personality', v_listing.personality,
    'story', v_listing.story,
    'requirements', v_listing.requirements,
    'urgent', v_listing.urgent,
    'status', v_listing.status,
    'posted_at', v_listing.posted_at,
    'adopted_date', v_listing.adopted_date,
    'adopted_note', v_listing.adopted_note,
    'poster', jsonb_build_object(
      'name', v_poster.name,
      'handle', v_poster.handle,
      'tint', v_poster.tint
    )
  );
end;
$$;

grant execute on function public.can_view_adoption_placement(uuid, uuid) to authenticated;
grant execute on function public.get_public_profile_adoptions(uuid) to authenticated;
grant execute on function public.get_public_adoption_record(uuid) to authenticated;
grant execute on function public.get_public_adoption_listing(uuid) to authenticated;
