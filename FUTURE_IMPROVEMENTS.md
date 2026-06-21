# Parul — Future Improvements & Follow-ups

_Running log of deferred suggestions and follow-ups. Last updated 2026-06-22._

---

## CDN / Supabase egress (storage)

Current state (working): `cdn.parul.pet` is nginx on the VPS (`167.71.238.179`) proxying
public buckets (`avatars`, `post-media`) to Supabase Storage. nginx caches responses for
30 days (the `Set-Cookie`/`Cache-Control` ignore fix was applied 2026-06-22 — before that
the cache was 100% MISS and every view hit Supabase egress). The app stores CDN URLs in the
DB and the feed requests **thumbnails**, so storage egress ≈ one fetch per unique image per
30 days.

Optional improvements (not required for beta):
- **Put Cloudflare in front of `cdn.parul.pet`** (free). Adds a global edge cache and offloads
  repeat-view bandwidth from the single VPS (currently Bangalore-only, nginx-only). Set the
  Cloudflare cache rule to respect the long `Cache-Control` nginx already sends.
- **Cache-warm popular images** — a small script/cron to pre-fetch hot images through the CDN
  so the first viewer doesn't pay the MISS latency.
- **Private media egress** — adoption/rescue/circle media use **signed URLs** (can't be
  CDN-cached), so each download is direct Supabase egress. Fine at beta volume; if it grows,
  consider a signed-URL-aware edge cache or moving non-sensitive media to a public bucket.
- **API/realtime/DB egress** is separate from storage. Keep queries bounded (`.limit()`s were
  added to the big lists); revisit pagination if data grows.

Verify periodically: `curl -sI https://cdn.parul.pet/media/<bucket>/<path>` should show
`X-Cache-Status: HIT` on repeat requests.

---

## Security follow-ups

- **Rotate the Vercel token** — `VERCEL_TOKEN` was pasted in chat during CI setup. Create a new
  token (Vercel → Account → Tokens), update the GitHub secret, delete the old one.
- **Rotate the Google OAuth client secret** — also pasted in chat. Reset it in Google Cloud →
  Credentials, then re-push: `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=… supabase config push`
  (the env var must be set whenever running `config push`, or it overwrites the secret blank).
- **Delete stale secrets** (the client no longer uses the thumb webhook): remove
  `EXPO_PUBLIC_THUMB_WEBHOOK_URL` and `EXPO_PUBLIC_THUMB_WEBHOOK_SECRET` from **both** GitHub
  repo secrets and the Vercel project.
- **Run Supabase's security advisor** on the prod project to confirm RLS/grant posture.

---

## Deploy / CI

- **Avoid double deploys** — ensure Vercel's GitHub auto-deploy is OFF (Vercel → Project →
  Settings → Git). The GitHub Actions workflow (`.github/workflows/deploy-web.yml`) is the
  single deploy path.
- **Make the typecheck a hard gate** — it's currently `continue-on-error: true` because of ~25
  pre-existing `tsc` errors. Once those are cleaned, flip to `false` so type errors block deploys.
- **Skip deploys for docs-only changes** — workflow ignores `**.md` / `docs/**` so editing this
  file (etc.) doesn't trigger a production rebuild.

---

## App features still to finish

- **Native (mobile app) email-confirmation & password-recovery deep links** — currently web-only.
  Needs an `expo-linking` handler that routes the `parul://` auth callback into the app and calls
  `setSession`/`exchangeCodeForSession`, plus adding `parul://` to Supabase Auth redirect allow-list.
  (Web flows already work.)
- **Native Google sign-in** — implemented (expo-web-browser + PKCE) but **only works in a dev/EAS
  build**, not Expo Go (custom `parul://` scheme). Test on a real build.
- **Circle previews at scale (m6)** — `useCirclePreviews` uses a single global
  `.limit(dbIds.length * 20)`; a very busy circle can starve quiet ones. Proper fix is a
  per-circle "last message + unread" RPC (`DISTINCT ON (circle_id)`).
- **Clean up the ~25 `tsc` errors** — mostly type-strictness noise (RN web style props,
  navigation generics); none block the Babel/Metro build, but clearing them enables the CI gate.

---

## Notes / known limitations

- The new Supabase project is `vqhmmpwynbcdlqlppwju`; the old one (`zoezppkypxogylwypdwu`) was
  swapped out everywhere (app, CDN nginx, thumbnail cron). Old-project media is **not** migrated —
  only new uploads exist on the new project.
- See `PRODUCTION_BLOCKERS.md` for the original audit and what was fixed.
