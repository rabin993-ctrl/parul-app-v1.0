-- Notify adopter on adoption confirm and endorsement.

create or replace function confirm_adoption(p_record_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_rec            adoption_records%rowtype;
  v_confirmed_at   timestamptz := now();
  v_recipient_id   uuid;
  v_actor_name     text;
begin
  select * into v_rec from adoption_records where id = p_record_id;
  if not found then raise exception 'Record not found'; end if;
  if v_rec.poster_user_id != auth.uid() and v_rec.adopter_user_id != auth.uid() then
    raise exception 'Only poster or adopter can confirm an adoption';
  end if;

  update adoption_records
  set status               = 'confirmed',
      confirmed_at         = v_confirmed_at,
      completed_milestones = '{}',
      next_update_due_at   = v_confirmed_at + interval '7 days'
  where id = p_record_id;

  insert into adoption_updates (record_id, type, author_user_id, text)
  values (p_record_id, 'adopter_home', v_rec.adopter_user_id, 'First day home — settling in well.');

  -- Notify the other party (poster confirming → adopter; adopter confirming → poster).
  v_recipient_id := case
    when auth.uid() = v_rec.poster_user_id then v_rec.adopter_user_id
    else v_rec.poster_user_id
  end;

  if v_recipient_id is not null and v_recipient_id <> auth.uid() then
    select name into v_actor_name from users where id = auth.uid();
    insert into notifications (
      recipient_id, type, actor_user_id, entity_type, entity_id, title, body, data
    ) values (
      v_recipient_id,
      'adoption_confirmed',
      auth.uid(),
      'adoption_record',
      p_record_id,
      'Adoption confirmed',
      case
        when v_recipient_id = v_rec.adopter_user_id
          then 'Your adoption of ' || coalesce(v_rec.pet_name, 'your pet') || ' has been confirmed! Welcome to the family.'
        else coalesce(v_rec.pet_name, 'The pet') || '''s adoption has been confirmed.'
      end,
      jsonb_build_object('record_id', p_record_id, 'pet_name', v_rec.pet_name)
    );
  end if;
end;
$$;

create or replace function endorse_adopter(
  p_record_id      uuid,
  p_recommendation text,
  p_text           text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_rec        adoption_records%rowtype;
  v_actor_name text;
begin
  select * into v_rec from adoption_records where id = p_record_id;
  if not found then raise exception 'Record not found'; end if;
  if v_rec.poster_user_id != auth.uid() then
    raise exception 'Only the poster can endorse an adopter';
  end if;

  if p_recommendation = 'not_recommended' and (p_text is null or btrim(p_text) = '') then
    raise exception 'A note is required when not recommending an adopter';
  end if;

  insert into adoption_updates (record_id, type, author_user_id, endorsement, text)
  values (
    p_record_id, 'poster_endorsement', auth.uid(),
    p_recommendation::poster_recommendation_enum, p_text
  );

  update adoption_records
  set poster_endorsed       = (p_recommendation = 'recommended'),
      poster_recommendation = p_recommendation::poster_recommendation_enum
  where id = p_record_id;

  if p_recommendation = 'recommended' and v_rec.adopter_user_id is not null then
    select name into v_actor_name from users where id = auth.uid();
    insert into notifications (
      recipient_id, type, actor_user_id, entity_type, entity_id, title, body, data
    ) values (
      v_rec.adopter_user_id,
      'endorsement_received',
      auth.uid(),
      'adoption_record',
      p_record_id,
      coalesce(v_actor_name, 'Someone') || ' endorsed you',
      coalesce(nullif(btrim(p_text), ''), 'The poster left a recommendation on your adoption.'),
      jsonb_build_object('record_id', p_record_id, 'pet_name', v_rec.pet_name)
    );
  end if;
end;
$$;

grant execute on function public.confirm_adoption(uuid) to authenticated;
grant execute on function public.endorse_adopter(uuid, text, text) to authenticated;
