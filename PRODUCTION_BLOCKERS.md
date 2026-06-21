# Parul — Production Readiness Audit

_Generated 2026-06-22. Scope: full codebase (415 TS/TSX files, 76 SQL migrations, 3 edge functions)._

A "blocker" = a concrete production consequence: data leak, broken core flow, build/store
rejection, or crash on a common path. Type-strictness and styling nits are excluded (see
"Not blockers"). Findings verified by tracing actual code paths, not type signatures.

---

## 🔴 BLOCKERS (must fix before launch)

### 1. Private storage buckets are readable by ANY logged-in user (data leak)
`supabase/migrations/0002_storage_buckets.sql:73-75, 95-97, 117-119`

Buckets `adoption-media`, `rescue-media`, `circle-media` are created `public=false`, but each
has a SELECT policy `FOR SELECT TO authenticated USING (bucket_id = '<bucket>')`. That predicate
is true for every authenticated user. **0002 is the only migration that ever touches
`storage.objects`** — the in-file comments promising "Wave 3/4/6 refines to poster/adopter/members"
were never implemented.

**Consequence:** any logged-in user can download every other user's private adoption photos,
rescue-case photos, and **circle (group-chat) images** by enumerating object paths.

**Fix:** replace each `USING (bucket_id=...)` with a membership/ownership predicate (join to the
owning listing / rescue_case / circle_members).

### 2. `users` table exposes everyone's email to any logged-in user (PII leak)
`supabase/migrations/0001_init.sql:842-843` (policy `users_select_all ... using (true)`), email column at `:82`

The only SELECT policy on `users` is `using (true)`; no later migration narrows it. The table
holds `email citext`. Any authenticated client can run `supabase.from('users').select('email')`
for the entire user base.

**Fix:** scope the SELECT policy, or move `email` to a self-only table / use column-level grants
and a SECURITY DEFINER RPC for the public profile fields the app actually needs.

### 3. Mobile build is impossible — missing bundle identifiers
`app.json` (ios block has only `supportsTablet`; android block has only `adaptiveIcon`)

No `ios.bundleIdentifier`, `android.package`, `versionCode`, or `buildNumber` anywhere. EAS
build / prebuild fails immediately and no App Store / Play Store entry can be created.

**Fix:** add `ios.bundleIdentifier`, `android.package`, and build/version numbers.

### 4. Mobile build will be rejected — missing iOS permission strings
`app.json` (no `infoPlist`, `expo-image-picker` not in plugins) vs `src/hooks/useMediaPicker.ts:42,79,83`

The app calls camera + photo-library pickers, but there are no `NSCameraUsageDescription` /
`NSPhotoLibraryUsageDescription` strings. iOS rejects the binary at review, and the app crashes
at runtime when the permission is requested. `expo-image-picker` is a dependency but not
configured in `app.json`.

**Fix:** add the `expo-image-picker` plugin block (or `ios.infoPlist` strings) with usage copy.

### 5. Adoption browse spins forever if any load query rejects
`src/hooks/useAdoptionListings.ts:92-114` + `src/screens/adoption/AdoptionListingScreen.tsx:162-166`

`load()` calls `setLoaded(true)` only on the success path — no `try/finally` around the
`Promise.all` or the `loadListingMediaUrls(...)` await. The screen shows a full-screen spinner
whenever `!listingsLoaded`. Any transient network/RLS rejection wedges the headline adoption
screen permanently with no retry (requires app restart). Same wedge in
`AdoptionShowcaseDetailScreen.tsx:25-30`.

**Fix:** `try { ... } finally { setLoaded(true); }`.

### 6. Community Groups hub spins forever if any load query rejects
`src/context/CommunityGroupsContext.tsx:150-195` + `src/screens/community/CommunityHubScreen.tsx:70-73`

`loadAll` awaits `Promise.all([...3 queries...])` with no try/finally; `setLoading(false)` runs
only on success. The Community Hub gates a full-screen spinner on `loading`. Same permanent-spinner
failure as #5.

**Fix:** wrap in `try { ... } finally { setLoading(false); }`.

### 7. Native password recovery & email confirmation cannot complete in-app
`src/context/AuthContext.tsx:103,131,211-217` · `src/lib/authLinks.ts:11,18,38,52,66` · `app.json` (no `scheme`)

All auth deep-link handling is gated `Platform.OS === 'web'`. On native, `getSiteUrl()` returns
`https://parul.pet`, so reset-password / confirm links open the mobile browser and never return
to the app. There is no `scheme` in `app.json` and no `expo-linking` listener, so the OS cannot
route a callback back into the installed app. The `recovery` phase that shows `SetNewPasswordScreen`
is only set on web-gated branches → a native user who forgets their password is stuck.

Works on web (a web build is deployed via `vercel.json` + `expo export -p web`), so severity is
native-only — but native auth-by-email is the norm for a mobile app.

**Fix:** add a `scheme`, register an `expo-linking` handler, and set `redirectTo` to the app
scheme on native.

---

## 🟠 MAJOR (fix before or immediately after launch)

### 8. `env.ts` missing-env guard is non-functional → hard white-screen crash
`src/lib/env.ts:8-15` → `src/lib/supabase.ts:18`

`required()` logs a warning and returns `''` instead of throwing. The empty string flows into
`createClient('', '')`, which throws `"supabaseUrl is required."` synchronously at module import —
before any error boundary mounts, white-screening the app. The guard gives false confidence the
case is handled. (Only fires on misconfigured env; EAS/Vercel inline `EXPO_PUBLIC_*` at build, so
a correctly-built binary is fine — but the guard does the opposite of what it claims.)

**Fix:** throw a clear error in `required()` for the two required vars.

### 9. `EXPO_PUBLIC_THUMB_WEBHOOK_SECRET` is shipped in the client bundle
`src/lib/env.ts:24` → `src/lib/uploads.ts:31-35`

Any `EXPO_PUBLIC_*` var is inlined into the shipped JS. If this secret is set in the build env
(as `.env.example` invites), anyone can extract the bearer token from the bundle and hammer the
VPS thumbnail webhook (resource abuse / DoS). Bounded blast radius (no data breach).

**Fix:** trigger thumbnail generation from a Supabase edge function (server-side); remove the
secret from the client.

### 10. `propose_adoption` trusts a client-supplied adopter id (reputation smear)
`supabase/migrations/0024_fix_propose_adoption_rpc.sql:5,25`

Checks the *poster* is `auth.uid()` but accepts any `p_adopter_user_id` with no consent / approved
-request check. A poster can mint an `adoption_records` row naming any victim, then `endorse_adopter`
stamps `not_recommended`, which `get_adopter_public_flags` surfaces as a **public** negative trust
flag on the victim's profile.

**Fix:** require an existing approved adoption request (or adopter consent) for the named adopter.

### 11. Unbounded queries + unfiltered global realtime reload storms
- `src/hooks/useAdoptionListings.ts:96-100` (no `.limit()`) and `:118-130` (subscribes to `event:'*'` on the **whole** `adoption_listings` table, calls `load()` on any change app-wide)
- `src/hooks/useAdoptionThreads.ts:224-229` (all messages, no `.limit()`) and `:375-384` (unfiltered `threads` subscription → full reload)

At scale: Supabase's implicit 1000-row cap silently drops older rows, and every listing/thread
change anywhere re-runs the full unbounded fetch for every client (self-inflicted reload storm).

**Fix:** add `.limit()` + pagination; filter realtime subscriptions to the relevant rows.

### 12. Rules-of-Hooks violation can crash Circle Settings
`src/screens/pawCircles/CircleSettingsScreen.tsx:231`

A `useCallback` sits **after** an early `return` at line 208. When the screen opens before
`PawCircleContext` has hydrated (cold start, notification deep-link straight to settings, or the
`CircleAdminScreen.tsx:16` `replace('CircleSettings')` redirect), the early return fires and skips
the hook; once context hydrates the hook runs → "Rendered more hooks than during the previous
render" crash.

**Fix:** move the `useCallback` above the `if (!circle)` return.

### 13. Community feed has no realtime
`src/context/CommunityFeedContext.tsx` (no `supabase.channel`)

A user viewing a community never sees others' new posts/comments until they leave and re-enter.
(Sibling `FeedPostContext` does subscribe — inconsistent.) `loadPosts:178-188` also has the same
unguarded loading flag as #5/#6 (latent spinner blocker — currently no screen gates on it).

---

## 🟡 MINOR (polish / scale / cleanup)

- **Peer member sheet silently broken on media messages** — `src/screens/pawCircles/CircleChatScreen.tsx:561` uses `item.userId` (undefined on the list-item type) instead of `message.userId`; tapping the avatar on an incoming media message no-ops. One-line fix.
- **Fire-and-forget mutations** — `useAdoptionListings.ts` `updateListing`/`markAdopted`/`relistListing`, and `CommunityFeedContext.tsx:201-233` `toggleHelpful`/`toggleSaved`: optimistic UI diverges from DB on failure until reload.
- **Duplicate adoption system messages** — `useAdoptionThreads.ts:918-938` appends `opt-sys-` ids that realtime echo never reconciles → double message on accept/confirm.
- **"Forward" is a no-op toast** — `CommunityPostDetailScreen.tsx:155-160` shows "Link copied" with no clipboard/share.
- **More unbounded queries (degrade at scale, not launch)** — `RescueFeedContext.tsx:189,195` (also no realtime → stale rescue feed), `FeedPostContext.tsx`, `PawCircleContext.tsx`, `usePostsByCompanion.ts`, `usePostComments.ts`, `useReviews.ts`, `useCircleMembers.ts:57-61`, `useProfileViewData.ts`.
- **Defense-in-depth: revoke unauthenticated SECURITY DEFINER fns** — `fan_out_post_alert` (`0046:23`), `do_milestone_sweep` (`0005_wave3_rls.sql:495`), Vault writers `parul_set_edge_function_token`/`parul_seed_vault_edge_secrets` (`0072`). Likely not client-reachable under the locked-down grant regime (`config.toml`), but add explicit `REVOKE ALL ... FROM public`. **Run Supabase's security advisor against the real prod project to confirm.**
- **Web confirm path can hang** — `AuthContext.tsx:110-113` `setInitializing(false)` outside try/finally (web-only).
- **`StyleSheet.absoluteFillObject` removed in RN 0.85** — `AppTutorialCarousel.tsx:505`; spread of `undefined` is a no-op so no crash, but `decorWrap` loses absolute positioning (cosmetic). Change to `absoluteFill`.
- **Dead mock-data fallbacks (cleanup, NOT rendered)** — `adoptionPostListing.ts:13` (`DEMO_ADOPTION_LISTINGS` default param), `rescueData.ts:112-116` (`getRescueCaseById` fallbacks). Unreachable because demo ids aren't UUIDs, but delete to be safe.
- **Vercel build skips `prepare-web-public-assets.sh`** — `vercel.json:2` diverges from `package.json` build; works only because `public/` is committed. Fragile.
- **`deploy-web.sh` references `.github/workflows/deploy-web.yml` which doesn't exist** — prod deploys are manual-only; confirm intent.
- **39 `console.log/warn/error` calls in `src/`** — strip or gate behind `__DEV__` for production.

---

## ✅ Verified healthy (NOT bugs)
- `.env` and secret files are correctly gitignored / untracked; no hardcoded secrets in `src/`.
- Supabase anon-key exposure is by design (RLS is the auth layer).
- `notify` edge function gates on JWT and does not leak notification content to the caller.
- Private tables (`messages`, `circle_messages`, `notifications`, `push_tokens`, `user_privacy_settings`, `treat_wallets`, `beta_feedback`, `blocked_users`) have correct owner/membership RLS.
- Core flows are wired to real Supabase (no mock data rendered in production). Adoption propose/confirm/endorse, Paw Circles chat/join/invite, notifications + push registration all persist correctly. Realtime channels that exist are cleaned up (no subscription leaks).
- The 27 `tsc` errors do **not** block the build (Expo/Metro uses Babel; `expo export` doesn't run tsc). Most are `outlineStyle/boxShadow` web-CSS-on-RN StyleProp noise. Only #12 and the `CircleChatScreen:561` item above are real runtime bugs hiding among them.

---

## Suggested fix order
1. **#1, #2** — close the two data leaks (one migration each).
2. **#3, #4** — unblock the mobile build (`app.json` edits).
3. **#5, #6** — add `try/finally` to the two infinite-spinner loaders.
4. **#7, #8** — native auth deep links + real env guard.
5. **#9–#13** — the majors.
