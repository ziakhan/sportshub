---
updated: 2026-07-18
tags: [theme/infra, type/runbook, status/ready]
---

# Domain migration: ysportshub.com → youthsportshub.com

Owner reserved youthsportshub.com (2026-07-18) and will edit DNS himself.
This is the complete list of every system the domain touches, who does each
step, and the safe order. **Golden rule: keep ysportshub.com alive and
serving indefinitely** — installed native apps (Android vc6, TestFlight
builds), emailed links, and subscribed calendar feeds all point at it until
OTA + time fix that. Two live domains is fine; canonical = the new one.

## Phase 0 — Owner: GoDaddy DNS (new domain)
| Record | Value |
|---|---|
| A @ (apex) | `147.5.125.7` (the box's reserved OCI IP — same as ysportshub.com) |
| CNAME www | `youthsportshub.com` (or A → same IP) |

Nothing else yet — email DNS comes in Phase 3. Old domain's records stay
untouched.

## Phase 1 — Me (box): serve the new domain
1. Caddy: add `youthsportshub.com, www.youthsportshub.com` alongside the old
   hostnames (Caddy auto-provisions Let's Encrypt certs once DNS resolves —
   requires Phase 0 done first).
2. `/etc/sportshub/web.env`: `NEXTAUTH_URL=https://youthsportshub.com`,
   `NEXT_PUBLIC_APP_URL=https://youthsportshub.com`.
   ⚠️ NEXT_PUBLIC_* is baked at build → **needs a box rebuild** (~2 min with
   turbo cache), not just a restart. siteUrl() (canonicals, sitemap, email
   link base, magic links) follows these envs automatically.
3. `/etc/sportshub/sidecar.env`: append `https://youthsportshub.com` to
   `CORS_ORIGINS` (comma-separated; keep the old origin).
4. Restart sportshub-web + sportshub-sidecar.
5. Do NOT blanket-301 the old domain: old native builds call
   `https://ysportshub.com/api/*` (POSTs don't survive 301/302). Later,
   optionally redirect *browser page* routes only, never `/api/*` or
   `/socket*`.

Session note: cookies are host-bound (no hardcoded cookie domain in
auth.ts) — everyone signed in on the old domain simply signs in again on the
new one. Expected, not a bug.

## Phase 2 — Owner: single sign-on consoles (exact strings)

**Google — console.cloud.google.com → APIs & Services → Credentials → the
OAuth 2.0 Web client:**
- Authorized JavaScript origins: ADD `https://youthsportshub.com`
- Authorized redirect URIs: ADD
  `https://youthsportshub.com/api/auth/callback/google`
- OAuth consent screen → Authorized domains: ADD `youthsportshub.com`
- KEEP all existing ysportshub.com entries (multiple values are allowed;
  removing them breaks sign-in on the old domain).
- Client ID/secret do NOT change — no env edits needed for Google.

**Apple — developer.apple.com → Certificates, IDs & Profiles →
Identifiers → Services IDs → `com.ysportshub.web` → Sign In with Apple →
Configure:**
- Domains and Subdomains: ADD `youthsportshub.com`
- Return URLs: ADD `https://youthsportshub.com/api/auth/callback/apple`
- KEEP the ysportshub.com entries.
- ⚠️ Do NOT rename the Services ID (`com.ysportshub.web`) or the app bundle
  ID (`com.ysportshub.app`) — they're opaque identifiers, not domains;
  renaming the bundle ID would mean a brand-new App Store app. They can keep
  the old spelling forever (nobody sees them).
- APPLE_CLIENT_ID env stays `com.ysportshub.web` — unchanged.

**Not affected:** Expo/EAS (token-based), Stripe (not live yet — will be
configured against the new domain when keys arrive), Neon/Vercel (dormant;
add the domain to the Vercel project only if/when that deploy path wakes up).

## Phase 3 — Owner + me: email (OCI Email Delivery)
Can lag the cutover — sending from @ysportshub.com keeps working as long as
the old domain's DNS records stay (they should, permanently).
1. Me/owner: OCI console (ca-toronto-1) → Email Delivery → add approved
   senders `no-reply@youthsportshub.com`, `login@youthsportshub.com`; create
   DKIM for the new domain (new selector, e.g. `ysh2-2026`).
2. Owner: GoDaddy DNS on **youthsportshub.com**: DKIM CNAME from step 1,
   SPF `v=spf1 include:rp.oracleemaildelivery.com ~all`, DMARC
   `_dmarc TXT v=DMARC1; p=none`.
3. Me: box web.env `SMTP_FROM="SportsHub <no-reply@youthsportshub.com>"` +
   restart; test send.

## Phase 4 — Me: code + native apps
1. Fix hardcodes (repo):
   - `apps/web/src/lib/reviews/invites.ts:106-107` — two literal
     `https://ysportshub.com` → use `siteUrl()` (bug regardless of
     migration).
   - `apps/mobile/src/lib/api.ts:35` — fallback URL → new domain.
   - `apps/mobile/eas.json` — `EXPO_PUBLIC_API_URL`/`EXPO_PUBLIC_SOCKET_URL`
     in all 3 profiles → new domain.
2. Publish OTA update (channel preview, inline EXPO_PUBLIC_* env = new
   domain) → installed apps flip on next launch. Native rebuild NOT required
   (URLs are JS-side), but the next scheduled APK/TestFlight builds inherit
   eas.json automatically.
3. Cosmetic: update `.env.local` comments, docs, memory.

## Phase 5 — Verify E2E (me)
- https://youthsportshub.com: TLS, pages 200, credentials login, session.
- Google sign-in on new domain (owner click-through too).
- Apple sign-in on new domain (form_post cross-site cookies — SameSite=None
  config is env-derived, should just work on https).
- Magic-link email: link base = new domain.
- Native app after OTA: boot, API, socket (CORS), push deep links.
- Old domain still serves app + API (installed apps unaffected).
- iCal feeds subscribed on old URLs still refresh.

## Explicitly NOT needed
- Google Search Console change-of-address — SEO kill-switch is OFF
  (robots Disallow-all); when indexing turns on, canonical tags already point
  at the new domain via siteUrl(). Register both properties then.
- Cookie/session migration — host-bound, users just re-login.
- New Google client or Apple key — same credentials, new URLs only.
- TestFlight/app-store re-submission — bundle IDs unchanged; only future
  App Store listing URLs (support/marketing) should use the new domain.
