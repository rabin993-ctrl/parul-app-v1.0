-- 0011_push_trigger.sql: Fire the notify Edge Function on every notification INSERT
-- Uses pg_net (built-in on Supabase managed projects) to make an async HTTP call
-- to the edge function. The trigger function is SECURITY DEFINER and traps all
-- exceptions so a push failure never rolls back the notification row.
-- Project URL is read from Vault (supabase_project_url) seeded by migration 0072.
-- Bearer token is read from Vault (edge_function_token / fan_out_alert_token).
-- 0072 re-creates this function using helper wrappers — this version is the
-- initial definition and uses the same vault pattern inline.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- Trigger function
-- ────────────────────────────────────────────────────────────────────────────
create or replace function trigger_notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_base  text;
  v_token text;
begin
  select decrypted_secret into v_base
  from vault.decrypted_secrets
  where name = 'supabase_project_url'
  limit 1;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name in ('edge_function_token', 'fan_out_alert_token')
  order by case name when 'edge_function_token' then 1 else 2 end
  limit 1;

  if v_base is null or v_token is null then
    return NEW;
  end if;

  perform net.http_post(
    url     := v_base || '/functions/v1/notify',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body    := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
exception when others then
  -- Never fail a notification insert because of push delivery issues
  return NEW;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Attach trigger to notifications table
-- ────────────────────────────────────────────────────────────────────────────
drop trigger if exists trg_notification_push on notifications;

create trigger trg_notification_push
  after insert on notifications
  for each row
  execute function trigger_notify_push();
