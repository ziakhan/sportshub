---
updated: 2026-07-18
tags: [theme/infra, type/runbook, status/done]
---

# Dual domains: ysportshub.com + sportshubone.com (both first-class)

> **✅ EXECUTED 2026-07-18 evening.** Steps 1–4 done (owner: DNS + Google +
> Apple consoles; box script ran with owner approval). Step 5 verified by
> Claude: TLS live, www→apex 301, homepage 200 on both, providers endpoint
> returns per-host callbacks for credentials/magic/google/apple on
> sportshubone.com, old domain untouched. Homepage marketing wall (f5533c0)
> deployed same evening, live on both domains. REMAINING: owner click-tests
> Google + Apple sign-in on sportshubone.com; owner registering
> sportshubone.ca.

Owner bought **sportshubone.com** (2026-07-18) and ruled: **both domains fully
functional standalone, right now** — each serves the whole site with working
single sign-on; no redirect between them for now (maybe later); API/native
apps can use either. This replaces the earlier youthsportshub.com draft (that
domain was never his).

## How both-domains SSO works (verified in source)
next-auth 4.24.13 `detectOrigin()`: when `AUTH_TRUST_HOST` is set, the auth
base URL comes from `X-Forwarded-Host` per request — so Google/Apple
callbacks are built for whichever domain the visitor is on. Caddy already
sends `header_up X-Forwarded-Host {host}`. Cookies are host-bound (sessions
are per-domain — signing in on one does not sign you into the other;
expected). Middleware treats any non-youthbasketballhub.com host as a
pass-through while `CUSTOM_DOMAINS_ENABLED` is unset, so the new apex needs
no code change. ⚠️ When the custom club domains feature launches, BOTH apex
domains must be excluded from the club-domain resolver.

## Step 1 — Owner: GoDaddy DNS (sportshubone.com)
Currently parked (A → 3.33.130.190 / 15.197.148.33). Change to:
| Record | Name | Value | TTL |
|---|---|---|---|
| A | @ | `147.5.125.7` (the box, same as ysportshub.com) | 600 |
| CNAME | www | `sportshubone.com.` (GoDaddy's default "www → @" forward is fine too) | 1 hr |
Delete/replace the parked A records. ysportshub.com records: untouched.

## Step 2 — Box (blocked for Claude in auto mode; owner runs or approves)
Idempotent script committed at
`scripts/deploy/oracle-box/add-sportshubone-domain.sh`: (a) appends the
sportshubone.com + www site blocks to `/etc/caddy/Caddyfile` (backup,
`caddy validate`, `systemctl reload caddy`); (b) sets `AUTH_TRUST_HOST=true`
in `/etc/sportshub/web.env` + `systemctl restart sportshub-web`. Safe to run
BEFORE DNS lands — Caddy retries cert issuance until sportshubone.com
resolves to the box, then TLS just appears. No rebuild needed
(AUTH_TRUST_HOST is runtime, not NEXT_PUBLIC_*).

## Step 3 — Owner: Google SSO console (~2 min)
1. console.cloud.google.com → select the project that owns our OAuth client.
2. Menu → **APIs & Services → Credentials**.
3. Under "OAuth 2.0 Client IDs" click the **Web client** (ID = our
   GOOGLE_CLIENT_ID).
4. **Authorized JavaScript origins** → ADD URI → `https://sportshubone.com`
5. **Authorized redirect URIs** → ADD URI →
   `https://sportshubone.com/api/auth/callback/google`
6. **Save.** KEEP all ysportshub.com entries (both domains must work).
7. **APIs & Services → OAuth consent screen** (aka Google Auth Platform →
   Branding) → **Authorized domains** → add `sportshubone.com` → Save.
No client-ID/secret change, no env change.

## Step 4 — Owner: Apple SSO console (~2 min)
1. developer.apple.com/account (personal team `V5S8N9K3X8`, khanzia@gmail.com)
   → **Certificates, Identifiers & Profiles → Identifiers**.
2. Filter dropdown top-right: switch **App IDs → Services IDs**.
3. Click **`com.ysportshub.web`**.
4. Row "Sign In with Apple" → **Configure**.
5. **Domains and Subdomains**: add `sportshubone.com` (keep ysportshub.com).
6. **Return URLs**: add `https://sportshubone.com/api/auth/callback/apple`.
7. Next/Done → **Save** top-right.
No verification file needed (Apple dropped that). Do NOT rename the Services
ID or bundle ID (`com.ysportshub.*`) — identifiers, not domains.

## Step 5 — Verify (Claude, once 1+2 done)
- https://sportshubone.com — TLS padlock, homepage 200, club pages.
- `/api/auth/providers` 200 on both hosts.
- Credentials + magic-link + Google + Apple sign-in ON THE NEW DOMAIN
  (owner click-through for Google/Apple).
- ysportshub.com unchanged (native apps, iCal feeds, emailed links all
  still target it — that's fine and intended).

## Rulings / notes
- **No redirects between the domains for now** (owner). Revisit canonical
  choice when SEO indexing turns on — canonicals currently emit
  NEXT_PUBLIC_APP_URL (= ysportshub.com on the box) on both hosts; harmless
  while the robots kill-switch is OFF.
- Mobile apps + eas.json keep `https://ysportshub.com` (owner: "API can use
  whatever domain"). Flip later only if branding demands it (OTA needed).
- Email keeps sending from @ysportshub.com; add OCI senders/DKIM for
  sportshubone.com only if/when the FROM should change.
- Stripe (not live), Search Console (indexing off), TestFlight (bundle IDs
  unchanged): nothing to do.
