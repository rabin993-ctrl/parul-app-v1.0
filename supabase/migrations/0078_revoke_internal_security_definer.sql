-- Defense-in-depth: explicitly revoke client roles from SECURITY DEFINER
-- functions that are only meant to run from triggers / pg_cron / server-side
-- scripts and have no internal auth check. Under the locked-down grant regime
-- (see supabase/config.toml) these are likely not client-reachable already, but
-- an explicit REVOKE makes that guarantee independent of the expose-defaults.
--
-- Internal callers are unaffected: the fan-out trigger calls fan_out_post_alert
-- as its definer, pg_cron runs do_milestone_sweep as the job owner, and the
-- seed/token writers are invoked by the service-role migration scripts.

REVOKE ALL ON FUNCTION public.fan_out_post_alert(uuid)
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.do_milestone_sweep()
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.parul_set_edge_function_token(text)
  FROM public, anon, authenticated;

REVOKE ALL ON FUNCTION public.parul_seed_vault_edge_secrets()
  FROM public, anon, authenticated;
