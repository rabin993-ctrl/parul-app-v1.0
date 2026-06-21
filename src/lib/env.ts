/**
 * Centralized, validated access to public runtime config.
 *
 * Only EXPO_PUBLIC_* vars are available in the client bundle (Expo inlines them).
 * NEVER read the Supabase service-role key here — it must never ship in the app.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    // Fail loud, immediately. Returning '' only defers the failure to
    // createClient(), which throws "supabaseUrl is required." at import time and
    // white-screens the app with a less obvious error. EAS/Vercel inline
    // EXPO_PUBLIC_* at build, so this only fires on a genuinely misconfigured env.
    throw new Error(
      `[env] Missing ${name}. Create .env from .env.example (or set it in your build env).`,
    );
  }
  return value;
}

export const ENV = {
  SUPABASE_URL: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  SUPABASE_ANON_KEY: required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** Optional: Cloudflare CDN host in front of Supabase Storage (e.g. https://cdn.parul.app). */
  CDN_URL: process.env.EXPO_PUBLIC_CDN_URL ?? '',
  // Thumbnail generation is handled server-side by the VPS cron. The old
  // EXPO_PUBLIC_THUMB_WEBHOOK_URL/SECRET were removed: any EXPO_PUBLIC_* value is
  // inlined into the client bundle, so a "secret" shipped to every device is not
  // a secret. Re-introduce only behind a server-side proxy (edge function).
  /** Optional error reporting. */
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  /** Temporary beta feedback button + sheet. Set EXPO_PUBLIC_BETA_FEEDBACK_ENABLED=false to remove. */
  BETA_FEEDBACK_ENABLED: process.env.EXPO_PUBLIC_BETA_FEEDBACK_ENABLED !== 'false',
  /** First-login tutorial carousel. Set EXPO_PUBLIC_APP_TUTORIAL_ENABLED=false to disable. */
  APP_TUTORIAL_ENABLED: process.env.EXPO_PUBLIC_APP_TUTORIAL_ENABLED !== 'false',
} as const;
