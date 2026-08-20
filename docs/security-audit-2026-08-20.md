---
updated: 2026-08-20
tags: [theme/security, type/audit, status/open]
---

# Security audit — pre-launch pass (2026-08-20)

Scope: authentication, signup, the API surface (318 route files, 476 handlers),
public data exposure, cron, uploads. Read-only audit; nothing was changed.

The headline is that **the API surface is in better shape than a naive scan
suggests**. Guards are delegated to helpers, so grepping route files for
`getServerSession` produces a long list of false positives. Every one I chased
turned out to be properly guarded. The real findings are concentrated in
signup and in one public lookup.

---

## 🔴 F1 — Signup accepts EXPIRED and already-used claim tokens

**`apps/web/src/app/api/auth/signup/route.ts:54`**

While `PUBLIC_SIGNUPS=false`, a club-claim completion token is one of the two
doors that still opens signup. The gate checks only that the token exists:

```ts
prisma.clubClaim.findUnique({
  where: { completionToken: data.claimToken },
  select: { id: true },
})
```

The claim flow itself validates the same token properly
(`lib/claims/claim-v2.ts:47` and `:359-372`):

```ts
{ status: "VERIFIED_UNBOUND", completionExpiresAt: { gte: new Date() } }
```

So the token is strict in one place and loose in the other, and the loose one
is the gate. **No expiry check, no status check, no single-use consumption.**
A token that has expired, or has already been spent binding a claim, still
mints an account during a gated launch.

Fix: use the same predicate as the claim path, and consume the token on use.

---

## 🟠 F2 — No rate limiting on signup

**`apps/web/src/app/api/auth/signup/route.ts`**

Eighteen routes have rate limiting, including magic-link, the token endpoints,
refresh and the launch notify form. Signup does not. Combined with F3 this is
scriptable.

---

## 🟠 F3 — Email enumeration at signup

Signup returns a distinct **409 "An account with this email already exists"**,
so anyone can probe which addresses have accounts. Alone it is minor; with F2
it is an oracle. Standard fix is a uniform response plus the rate limit.

---

## 🟠 F4 — Invitation checks test EXISTENCE, not validity

Same gate, same file:

```ts
prisma.staffInvitation.findFirst({ where: { invitedEmail: emailFilter }, select: { id: true } })
```

An address that was **ever** invited passes, regardless of whether the invite
was accepted, revoked, or expired. Same shape for `playerInvitation` and
`familyInvitation`.

⚠️ Needs a product decision, not just a patch: should a once-invited address
be able to create an account after the invitation is spent or withdrawn?

---

## 🟠 F5 — `tenants/lookup` has no visibility filters at all

**`apps/web/src/app/api/tenants/lookup/route.ts`**

Public, unauthenticated, and:

```ts
prisma.tenant.findFirst({
  where: slug ? { slug } : { customDomain: domain },
  include: { branding: true, features: true },
})
```

No `publishedAt`, no `mergedIntoId`, no `isDemo`, no `status`. So any tenant
resolves by slug — including the **97 unpublished census imports sitting in
the admin review queue** — and the response carries `branding` **and
`features`**, which is per-tenant feature configuration.

This quietly bypasses the review gate the whole census import process depends
on. Fix: apply the same visibility predicate the directory uses, and stop
returning `features` on a public route.

---

## 🟡 F6 — `clubs/public` omits `isDemo`

**`apps/web/src/app/api/clubs/public/route.ts`**

Filters on `status`, `publishedAt` and `mergedIntoId`, but not `isDemo`, while
the product's visibility rule is all four. **Latent, not active**: queried
against local `youthbasketballhub`, the filter returns 1,323 rows with zero
`isDemo` rows among them, and no `nph*`/demo-slugged row surfaces. It becomes
a live leak the moment a demo world is seeded with published tenants, which is
exactly what the seed scripts do.

---

## ✅ Verified clean — do not re-audit these

- **All six cron routes** gate on `isAuthorizedCron`, which **fails closed**
  when `CRON_SECRET` is unset. `roster-reminders` and `waiver-reminders` look
  unguarded to a grep because the secret lives in `lib/cron-auth`.
- **The season planner cluster** (~15 write endpoints) is guarded by
  `seasonPlannerAuth`: 401 → 404 → league-owner-or-platform-admin 403.
- **Ownership on ID writes**: a scan of every authenticated write handler on a
  dynamic `[id]` route found **zero** without an ownership signal.
- **Uploads** (`api/uploads`): `getCurrentUser()` with a 401, type from magic
  bytes, SVG refused.
- **`api/dev/seed-demo-data`**: returns 404 when `NODE_ENV === "production"`.
- **Stripe webhook**: signature verified.
- **Passwords**: bcrypt cost 12, minimum 8 characters.
- **Legal**: `/legal/terms`, `/legal/privacy`, `/legal/acceptable-use` exist,
  which closes part of blocker C4.

---

## Signup verification (OTP) — the owner's ask

Signup performs **no verification of any kind** today: zero references to
`otp`, `code`, `emailVerified` or `phone` in the route.

**The pattern already exists and should be reused, not rebuilt.**
`lib/claims/claim-v2.ts` implements exactly the spec the owner described, for
club claims:

- 6-digit code from `crypto.randomInt(100000, 1000000)` — CSPRNG, not `Math.random`
- `CODE_TTL_MINUTES = 30`, enforced server-side with a transition to `EXPIRED`
- An attempts cap (`CODE_ATTEMPT_CAP`) counted on the row
- Email **and** SMS channels, SMS gated behind `smsEnabled()`
- A code typed into a screen, never a magic link

The only new decision is the owner's channel rule: **use email when an email
is given (it is free), fall back to phone otherwise** — the claim flow instead
picks the channel from the club's contact on file.

---

## Not yet covered

This pass did not examine: CASL ability definitions in depth, the
impersonation path beyond confirming `getSessionUserId` is the convention,
session/cookie configuration, the native/mobile token endpoints in detail, or
dependency CVEs.
