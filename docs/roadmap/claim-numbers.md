---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Claim your club: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/claim-your-club`** ("Claim your club and make it yours",
rebuilt 2026-08-16 to the gold standard set by the season story, the schedule-change demo, the
waivers demo, game day, the referees demo, the roster story, the money picture, the loop story and
your week).

Same two rules as the rest of the set:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file named) |
| `ARITH` | Arithmetic on rows above it |
| `OWNER` | A ruling in the 2026-08-16 scenario audit or the overnight brief |

Database access for this build was **read only**. No claim was started, no tenant was modified.

---

## 0. The one-identity question, answered

`OWNER`, the brief: *"note in the derivation page that claiming an UNCLAIMED imported listing is
pre-identity and does not violate the one-identity law."*

It does not, and the reason is structural rather than a promise:

1. **The claim is anonymous.** `app/(public)/claim/[tenantId]/page.tsx` requires no session, and
   the API's own header says so: *"Club claiming v2, ANONYMOUS endpoints... Proof of control = the
   code lands at the club's contact ON FILE, so no session is required to start; the account binds
   at completion via /api/clubs/claim-complete."*
2. **Proof of control is never something the claimer supplies.** The six-digit code goes to
   `Tenant.contactEmail` or `Tenant.phoneNumber`, the values the census import wrote. A claimer
   cannot nominate a destination, so the flow creates no identity and trusts none.
3. **Identity attaches exactly once, at the end, to a real `User`.** `POST /api/clubs/claim-complete`
   calls `getSessionUserId()` and 401s without one, and `completeClaim()` writes
   `UserRole { userId, role: "ClubOwner", tenantId }`. The product's own sentence to the claimer:
   *"the club binds to your account, not the inbox that got the code."*
4. **An UNCLAIMED tenant is not a person.** It is a directory row with `status: "UNCLAIMED"`, a
   published profile and no `UserRole` behind it, which is why it can be claimed at all.

So the sequence is: no identity → proof of control over a listing → one identity, once, at
completion. Nothing in it creates a second account for anybody, and nothing in it lets an email
address own a club.

---

## A. This flow exists today: scene by scene

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 to 3 | `open`, `search`, `row` | `/club` | `app/(public)/club/page.tsx` with `club-search.tsx` hitting `GET /api/clubs/public?q=`, fed by `lib/queries/directory-clubs.ts` |
| 4 | `page`, the public listing | `/club/[slug]` | `app/(public)/club/[slug]/page.tsx`, assembled by `lib/queries/club-profile.ts` |
| 5 | `claim-btn` | the same page → `/claim/[tenantId]` | `club/[slug]/page.tsx` lines 310 to 327, the "Claim this club" link that replaces the Follow button when `status === "UNCLAIMED"` |
| 6 to 9 | `channels`, `masked`, `corrections`, `fix` | `/claim/[tenantId]` | `claim/[tenantId]/claim-wizard.tsx`, options from `GET /api/clubs/claim-v2/[id]` |
| 10 to 12 | `send`, `expiry`, `verify` | `POST` then `PATCH /api/clubs/claim-v2/[id]` | `lib/claims/claim-v2.ts` `startClaim` and `verifyClaimCode` |
| 13 to 15 | `reserved`, `identity`, `take` | `/claim/complete?token=` → `POST /api/clubs/claim-complete` | `claim/complete/complete-claim.tsx`; `completeClaim()` |
| 16 | `writes` | the same transaction | `claim-v2.ts` lines 334 to 417 |
| 17 to 20 | `customize`, `colour`, `words`, `save` | `/clubs/[id]/customize` → `PATCH /api/clubs/[id]` | `clubs/[id]/customize/club-page-editor.tsx` |
| 21 | `public`, the branded page | `/club/[slug]` | `lib/club-page/brand.ts` `chosenBrandColor` painting the crest, the CTA and the baseline stripe |
| 22 | `end` | n/a, the end card | |

---

## B. The listing, and it is a real one

`DB` `Tenant fb71b08a`:

| Field | Value |
|---|---|
| Name | **Alpha Elite Sports Group** |
| Slug | `alpha-elite-sports-group` |
| Status | **UNCLAIMED** |
| Published | 2026-08-15 |
| City | **"Toronto ON"** (the province is stuck on the end of the city) |
| Phone | **"6476189295"** (ten unbroken digits) |
| Website | **"alphaelitesportsgroup.com"** (no scheme) |
| Contact email | `contact@alphaelitesportsgroup.com` |
| Data sources | `contact-enrichment,geocode,ontario-circuit-list,website-scrape` |

Those three imperfections are not written for the demo. They are what the row holds, and they are
exactly why `claim-v2` has a corrections step. The demo corrects those three and nothing else.

### The population behind it

`DB`, unclaimed tenants that are published and not merged away:

| Count | What |
|---|---|
| **1,325** | published unclaimed listings |
| **1,003** | carry a `contactEmail`, so the self-serve code path works |
| **94** | carry only a phone number |
| **228** | carry neither, and must go through the proof-and-admin path |
| 1,468 | unclaimed rows in total, published or not |

The demo puts 1,325 on screen and reads the split out underneath it, because the split is the
honest picture of how far self-serve claiming actually reaches.

### The masked hints, produced by the real functions

`PRODUCT` `maskEmail` and `maskPhone` in `lib/sms.ts`, run against this row for this build:

```
maskEmail("contact@alphaelitesportsgroup.com") → co•••@alphaelitesportsgroup.com
maskPhone("6476189295")                        → 64••••9295
```

The wizard never renders the raw values. The comment on the function is the design: *"enough to
recognize, not to harvest."*

---

## C. The wizard, word for word

| On screen | Value | Source |
|---|---|---|
| Eyebrow | "Claim your club" | `PRODUCT` verbatim |
| Intro | "To prove you run this club, we send a code to the contact info already on file · no account needed yet." | `PRODUCT` verbatim, em-dash to middot |
| Email option | "Email a code to co•••@alphaelitesportsgroup.com" | `PRODUCT` `` `Email a code to ${c.hint}` `` |
| Proof option | "I can't access those · submit proof instead" | `PRODUCT` verbatim, em-dash to middot |
| Proof helper | "Describe your proof (website admin, registration papers, social account) and an admin will review it." | `PRODUCT` verbatim |
| Corrections toggle | "Our info looks wrong? Propose corrections" | `PRODUCT` verbatim |
| Corrections fields | Club name, City, Website, Contact email, Phone | `PRODUCT` the five real labels; the demo edits three |
| Corrections helper | "Corrections apply when the claim completes." | `PRODUCT` verbatim |
| Send button | "Send the code" | `PRODUCT` |
| Code sent | "We sent a 6-digit code to {masked}. It expires in 30 minutes." | `PRODUCT` verbatim, with `CODE_TTL_MINUTES = 30` |
| Attempt cap | **5**, then the claim is forced to EXPIRED | `PRODUCT` `CODE_ATTEMPT_CAP = 5`, and the error "Too many attempts, start again" |
| The code itself | 418305 | Six digits, the shape of `crypto.randomInt(100000, 1000000)`. Not a real code: no claim was started |
| Verified badge | "Verified" | `PRODUCT` |
| Reservation | "{club} is reserved for you for **14** days. Create an account (any email works) or sign in · the club binds to your account, not the inbox that got the code." | `PRODUCT` verbatim, `RESERVATION_DAYS = 14` |
| Also emailed | "We also emailed this link to the verified contact." | `PRODUCT` verbatim |
| Take ownership | "Take ownership" | `PRODUCT` |
| Claimed | "Club claimed" / "You're the owner. Everything about the club is now yours to edit." | `PRODUCT` verbatim |

### What the completion writes, in one transaction

`PRODUCT` `completeClaim()`, `claim-v2.ts` lines 334 to 417, and the demo's card lists exactly
these five:

1. `ClubClaim` → `status: "APPROVED"`, `userId`, `reviewedAt`, `reviewNote: "Completed via verified claim token"`.
2. `Tenant` → `status: "ACTIVE"`.
3. The same `Tenant` update applies the stored corrections (`name`, `website`, `contactEmail`, `phoneNumber`, `city`, `description`).
4. `UserRole` → `{ userId, role: "ClubOwner", tenantId }`, created only if absent.
5. `audit()` → action `CLAIM_COMPLETE`.

All inside one `$transaction`, which is why the demo's line "if any part of it failed, none of it
happened" is a statement about the code rather than a flourish.

---

## D. The branding chapter, and why it is not decoration

| On screen | Value | Source |
|---|---|---|
| Page title | "Customize your public page" | `PRODUCT` verbatim |
| Page subtitle | "Brand it, add your info, and arrange the sections. Changes go live when you save." | `PRODUCT` verbatim |
| Section | "Brand" / "Your banner, logo, colors, and the words at the top of the page." | `PRODUCT` verbatim |
| Tagline placeholder | "e.g. Developing players since 2009" | `PRODUCT` verbatim; the demo types the phrase without the "e.g." |
| Banner hint | "Wide hero image. No image = a gradient in your primary color." | `PRODUCT` verbatim |
| Logo | square, up to 512px | `PRODUCT` `ImageUploadField` `maxSize={512}` |
| Save | "Save changes", then "Saved · your public page is updated." | `PRODUCT` verbatim, em-dash to middot |
| The default colour it starts on | **#1a73e8** | `PRODUCT` `DEFAULT_BRAND_HEX` in `lib/club-page/brand.ts`, the schema default |
| The colour the owner picks | #7c3aed | Any non-default hex; the demo picks one |

**The gate that makes this chapter matter.** `PRODUCT` `hasChosenBrand()`:

```ts
if (input.status?.toUpperCase() === "UNCLAIMED") return false
const hex = normalizeHex(input.primaryColor)
if (!hex) return false
return hex !== DEFAULT_BRAND_HEX
```

So an unclaimed listing is **always** navy no matter what colour its row holds, and a claimed club
is **still** navy until a human moves the colour off the schema default. The module's own comment
explains why: *"About a thousand clubs were bulk-imported as UNCLAIMED tenants and every one of
them was stamped with the schema default colour... So a colour only counts once a human stood
behind it."*

That is the sentence the demo's last beat is built on, and it is why the branded page at the end is
a genuine state change rather than a coat of paint.

---

## F. What the product cannot honestly show, and is therefore declared

### 1. The text-message channel does not render on this machine

`PRODUCT` `smsEnabled()` requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
`TWILIO_FROM_NUMBER`. None is set locally, and `getClaimOptions()` only appends the SMS channel
when `smsEnabled()` is true. So the wizard renders **two** options, email and proof, and the demo
shows two. `maskPhone` was still run against this club's number for this sheet
(`6476189295 → 64••••9295`) so the masking is documented even though the channel is not on screen.

**PUNCH: 94 published unclaimed listings have a phone number and no email.** Until SMS is
configured in production, every one of them has to go through the proof-and-admin path.

### 2. 228 listings have no contact at all

`DB`. For those the only route is `channel: "proof"`, which creates a PENDING claim, notifies every
`PlatformAdmin`, and waits for a human at `/dashboard/admin/claims`. That path is real and is not
filmed here; the demo says the number and moves on.

### 3. Nothing in this database has actually been claimed

`DB` the `ClubClaim` table is empty, and the `UserRole` table holds exactly one row (a
`PlatformAdmin`), the same live-world defect recorded in four other numbers sheets. So the demo
performs the flow rather than replaying a completed one, and every value it types (the six-digit
code, the chosen colour, the tagline) is declared here as typed rather than read.

### 4. The `EMAIL_VERIFIED` status is dead

`ClaimStatus` is `PENDING | EMAIL_SENT | EMAIL_VERIFIED | VERIFIED_UNBOUND | APPROVED | REJECTED |
EXPIRED`, and the v2 path never writes `EMAIL_VERIFIED`: the real transitions are
`PENDING/EMAIL_SENT → VERIFIED_UNBOUND → APPROVED`, or `→ EXPIRED` / `→ REJECTED`. A v1 leftover.
**PUNCH: drop the unused value** so nobody builds a screen for a state that never happens.

---

## G. Numbers deliberately NOT shown

| Not shown | Why |
|---|---|
| The unmasked contact email | The product never renders it, and neither does the demo |
| The proof-and-admin path in full | Real (`/dashboard/admin/claims`, `PATCH /api/admin/claims/[id]`), and a different story. The demo names it and gives its size |
| A dispute or a second claimant | Real (`liveClaimFor` blocks a live claim, "Someone is already claiming this club"), and `DB` no claim rows exist |
| A follower count, reviews or programs on the public page | Real on a claimed club page, and beside the point here |
| The secondary and accent colours | Real fields; the primary is the one the brand gate tests |

---

## H. Composition choices, declared

| Choice | Why |
|---|---|
| **Desktop, one region, no phone** | `OWNER` audit section D: claiming and the customize editor are operator working surfaces. The claim wizard is responsive, but the branding editor is a two-column editor and the chapter that matters most is on it |
| A real club, named | The directory already publishes these 1,325 listings, so the demo shows one exactly as the product shows it, including its masked contact. Nothing private is on screen |
| Three corrections, not five | `PRODUCT` offers five fields. This row is wrong in exactly three of them, and inventing a fourth would be inventing |
| The two other search results | Composed, to show a search returning more than one row. The club being claimed is the real one |
| The maps of what the transaction writes | A composition of `completeClaim()`'s five statements, listed in the order the function runs them |
| Chapter titles are short | Long chip labels wrap the player's control row and drop the render scale under 1.0 |
| The middot replaces the product's em-dashes | House copy rule. Every affected string is flagged in section C |

---

## I. Gates, this cut

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/claim-your-club` | **0 violations**, minimum stage scale **1.000**, 22 beats, 26 scenes audited |
| Same, `--viewport 390x844 --floor 11 --scope stage` (keyhole) | **0 violations** |
| Same, `--viewport 390x844 --floor 14 --scope chrome` | **0 violations** |
| Full playback drive, 22 beats stepped twice plus a 2x autoplay pass | **0 console errors**, **0 page errors** |
| Chapter jumps | **4 of 4 exact**: beats 1, 6, 13, 17 |
| Runtime at 1x | **1 min 53 sec** |
| Scene overflow (any node past the composed box) | **0 px**, all 22 beats |
| 390x844 horizontal overflow | **0 px** |
| `tsc --noEmit` | clean |
| Em-dash sweep | clean |
| Database writes | **none**. The masking functions were run read-only against the club's own row |
