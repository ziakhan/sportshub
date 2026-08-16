---
updated: 2026-08-16
tags: [type/reference, status/active, area/demos]
---

# Waivers: every number on screen, and where it comes from

Status: **SOURCE OF TRUTH for `/demos/waivers`** ("Waivers, start to finish", rebuilt
2026-08-16 to the gold standard set by the season story and the schedule-change demo).

Same two rules as `season-story-numbers.md` and `schedule-change-numbers.md`:

1. **No number appears in the demo without a line here.**
2. **Every scene names the route the flow lives on today** (audit D2). Section A is that list.

| Tag | Meaning |
|---|---|
| `DB` | Read out of the local seeded database on 2026-08-16 (NPH Summer League, season Summer 2026, `seasonId fbbe767c-00e9-4130-9258-4f02c6854efa`, waiver `ea472023-b4cb-450a-ab15-b26552bc3b25`) |
| `PRODUCT` | A constant, label, format or sentence taken from shipping product code (file and line named) |
| `ARITH` | Arithmetic on rows above it, shown in full |
| `OWNER` | A ruling in the 2026-08-16 scenario audit |

Database access for this build was **read only** (owner constraint, 2026-08-16). Nothing was
seeded, patched or backfilled to make a number work; where the world is thin, the demo says so.

---

## 0. Why this runs on the Summer world, and what "the real waiver world" is

There is exactly **one** parent-facing waiver world in this database, and it is the Summer one.

`DB`, every `WaiverDocument` row in the database:

| Owner | Title | Type | Required | Renews | Version | Signatures | Sign requests |
|---|---|---|---|---|---|---|---|
| **League: NPH Summer League** | **Concussion Code of Conduct (Rowan's Law)** | CONCUSSION_CODE | **yes** | **yes** | 1 | **27** | **40** |
| Club: Toronto Lords | Photo and Media Consent | MEDIA_CONSENT | no | no | 1 | 0 | 0 |
| Club: Toronto Lords | Photo and Media Consent | MEDIA_CONSENT | no | no | 1 | 0 | 0 |

Every other league in the database (`NPH Showcase League`, `National Circuit`, `NPH D1`,
`Maple Court`, `NPA`, `WNPA`, `Phase1 Test`, `Phase9to15`) holds **zero** waiver documents. So a
waiver demo staged anywhere but NPH Summer League would be a demo of an empty feature, and this
one is staged on the only rows that exist.

The document is not hand-made for the demo either: `scripts/seed-summer-world.ts` lines 1661 to
1711 creates it from the product's own built-in template, `WAIVER_TEMPLATES.find(t => t.key ===
"concussion-code-on")` in `apps/web/src/lib/waivers/templates.ts` lines 63 to 90.

**The world is NOT thin, so nothing is staged.** The brief allowed an honest early state ("a
just-published waiver, zero signed") if the local world held little waiver data. It holds a
rich, believable, mid-flight state instead: 22 approved teams, 220 rostered players, 40 links
minted, 27 signed, 13 links still live and unopened. The demo therefore runs on the real
mid-flight board, and the single signature it performs is the single signature this world is
genuinely waiting for (section D).

---

## A. This flow exists today: scene by scene

29 beats, three chapters. Every one names its route.

| # | Beat | Flow exists today at | Code |
|---|---|---|---|
| 1 | `library`, the league's waiver document | `/manage/leagues/[id]/waivers` | `app/(platform)/manage/leagues/[id]/waivers/page.tsx` → `components/waivers/waivers-manager.tsx` lines 77 to 186 |
| 2 | `renews`, the "Renews yearly" badge | same | `waivers-manager.tsx` line 136, drawn from `WaiverDocument.annualRenewal` |
| 3 | `footnote`, versions and existing signatures | same | `waivers-manager.tsx` lines 179 to 183, verbatim |
| 4 | `board-open`, "N signed / N outstanding" | `/manage/leagues/[id]/seasons/[seasonId]/waivers` | page: `.../seasons/[seasonId]/waivers/page.tsx`; grid: `components/waivers/waiver-status-view.tsx` lines 118 to 142; data: `GET /api/seasons/[id]/waiver-status` |
| 5 | `no-picker`, the auto-send sentence | same page, and the send itself is `PATCH /api/seasons/[id]/teams/[teamId]` | sentence: `seasons/[seasonId]/waivers/page.tsx` lines 55 to 58. Send: `api/seasons/[id]/teams/[teamId]/route.ts` lines 268 to 277 calling `sendWaiversForApprovedSubmission`, `lib/waivers/auto-send.ts` |
| 6 | `expand`, a team row opening | same board | `waiver-status-view.tsx` lines 164 to 197 (the disclosure row) and 198 to 238 (the table) |
| 7 | `pending`, the amber "Pending" cell | same board | `waiver-status-view.tsx` lines 222 to 231 |
| 8 | `email`, the email in her inbox | the transactional email | `sendWaiverSignEmail`, `lib/email.ts` lines 288 to 335 |
| 9 | `open`, "Review and sign" | `GET /waivers/sign/[token]` (public, tokenized) | `app/(public)/waivers/sign/[token]/page.tsx`; token lookup `lib/waivers/tokens.ts`; allowlisted in `lib/public-paths.ts` line 70 |
| 10 | `read`, the document text | same | `page.tsx` lines 108 to 112, the whole `WaiverDocument.body` in a scrolling `<pre>` |
| 11 to 16 | `form`, `name`, `relation`, `pad`, `ack`, `submit` | same page; submit is `POST /api/waivers/sign` | `sign-form.tsx` lines 87 to 158; API `app/api/waivers/sign/route.ts` lines 24 to 91 |
| 17 | `recorded`, "Signed and recorded" | same | `sign-form.tsx` lines 60 to 84 |
| 18 to 20 | `cell`, `badge`, `totals`, the board changed | the board again | `waiver-status-view.tsx`; the recompute is `GET /api/seasons/[id]/waiver-status` lines 119 to 158 |
| 21 | `missing`, the "Only missing" filter | same board | `waiver-status-view.tsx` lines 126 to 133 (the toggle) and line 155 (`filter(team => !onlyMissing || !team.complete)`) |
| 22 | `resend`, "Re-send all outstanding" | `POST /api/seasons/[id]/waiver-status` | button `waiver-status-view.tsx` lines 135 to 141; route `api/seasons/[id]/waiver-status/route.ts` lines 176 to 221 |
| 23 | `skipped`, "Sent 180 emails." | same | notice text `waiver-status-view.tsx` lines 86 to 90; the skip logic is `hasLiveSignRequest` in `auto-send.ts` lines 112 to 121 |
| 24 to 28 | `cadence` and its four rows | `GET /api/cron/waiver-reminders`, daily | route `app/api/cron/waiver-reminders/route.ts`; logic `lib/waivers/reminders.ts` lines 22 to 192. **No product screen shows this**: punch F1 |
| 29 | `end` | n/a, the end card | |

---

## B. The document

| On screen | Value | Source |
|---|---|---|
| League | NPH Summer League | `DB` League `d77d6700-3139-43e2-83f9-dec8f5317011` |
| Season | Summer 2026 | `DB` Season `fbbe767c-00e9-4130-9258-4f02c6854efa`, IN_PROGRESS, 2026-04-04 to 2026-09-30 |
| Title | **Concussion Code of Conduct (Rowan's Law)** | `DB` `WaiverDocument.title` |
| Type label | **Concussion code** | `PRODUCT` `waivers-manager.tsx` line 33, `TYPE_LABELS.CONCUSSION_CODE` |
| Version chip | **v1** | `DB` `version = 1`; chip shape `waivers-manager.tsx` line 134 |
| Required chip | **Required** | `DB` `required = true`; `waivers-manager.tsx` line 135 |
| Renewal chip | **Renews yearly** | `DB` `annualRenewal = true`; `waivers-manager.tsx` line 136 |
| Signature count | **27 signatures** | `DB` count of `WaiverSignature` on this waiver. Copy shape `waivers-manager.tsx` lines 138 to 140 |
| Province | ON | `DB` `province = "ON"` |
| Audience | PARENT | `DB` `audience = PARENT`. Only PARENT documents flow to families (schema line 4395) |
| Row actions | Edit · Deactivate | `PRODUCT` `waivers-manager.tsx` lines 144 to 172 |
| Footnote | "Templates are starting points, not legal advice. Have a lawyer review your final text. Editing a waiver's text creates a new version and everyone signs the new text; existing signatures keep the exact text they signed." | `PRODUCT` `waivers-manager.tsx` lines 179 to 183, verbatim |
| Body length | 1,558 characters, six numbered commitments | `DB` `length(body)` |
| Body text shown | the opening through commitment 1 | `DB` `WaiverDocument.body`, character for character. The rest is below the visible region on both the operator card and the handset, exactly as it is in the product |

### Rowan's Law renewal: VERIFIED, the product models it

Yes, and in three places:

1. `WaiverDocument.annualRenewal` (schema line 4401), comment: *"Rowan's Law-style yearly
   re-acknowledgment: signatures expire 12 months out"*.
2. `WaiverSignature.validUntil` (schema line 4464), comment: *"Set for annualRenewal waivers:
   signedAt + 12 months (Rowan's Law window)"*, written at sign time in
   `api/waivers/sign/route.ts` lines 78 to 81 as `Date.now() + 365 * 24 * 60 * 60 * 1000`.
3. Every "is this satisfied" query re-filters on it, so an expired signature reads as unsigned
   again and auto-send and the reminders pick it up next season: `auto-send.ts` line 86,
   `waiver-status/route.ts` line 94, `reminders.ts` line 99, `inline.ts` line 47.

`DB` confirms it end to end on this world: all 27 signatures carry `validUntil = signedAt + 365
days` (2026-07-18 signed, 2027-07-18 expiring).

The demo therefore states the renewal in words and on the two badges the product really draws,
and shows **no renewal date anywhere**, because no surface has one: punch F2.

---

## C. The board

`PRODUCT` `GET /api/seasons/[id]/waiver-status` builds the grid from **APPROVED** team
submissions only (route line 56), crossed against waivers where `leagueId`, `active: true`,
`required: true`, `audience: "PARENT"` (line 50). One cell per player per required waiver.

| On screen | Value | Source |
|---|---|---|
| Approved teams in the season | **22** | `DB` `TeamSubmission` where seasonId and `status = APPROVED` |
| Players per approved roster | **10**, on every one of the 22 | `DB` `SeasonRosterPlayer` per `SeasonRoster` |
| Required parent waivers | **1** | `DB`, section 0 |
| Cells on the board | **220** | `ARITH` 22 teams × 10 players × 1 waiver |
| **"27 signed"** (opening) | **27** | `DB` current-version, unexpired `WaiverSignature` rows against those 220 cells |
| **"193 outstanding"** (opening) | **193** | `ARITH` 220 − 27, which is exactly what the route counts (lines 128 to 129: every cell increments one counter or the other) |
| **"28 signed"** (closing) | **28** | `ARITH` 27 + the one signature this demo performs |
| **"192 outstanding"** (closing) | **192** | `ARITH` 220 − 28 |
| Teams drawn on screen | **3 of 22** | `OWNER`/composition. Three consecutive rows is what the region holds at scale 1.0 with one roster fully open. The chip states the slice on screen, the same honesty device the schedule-change demo uses for its "3 of 11" games chip |
| Rows drawn, in the endpoint's own order (`createdAt` asc) | positions 16, 17, 18 of 22 | `DB` |

### The three rows, and every signature in them

`DB`, per-team counts against this waiver across all 22 approved teams. Only **four** teams have
any signatures at all:

| Team | Signed | Of |
|---|---|---|
| Toronto Lords Grade 9 | 7 | 10 |
| Burlington Force Grade 9 | 7 | 10 |
| **Toronto Lords Grade 10 Girls** | **6** | 10 |
| Burlington Force Grade 10 Girls | 7 | 10 |
| The other 18 teams | 0 | 10 each |
| **Total** | **27** | **220** |

The three rows on camera, contiguous in the endpoint's order:

| Position | Team | Badge on screen |
|---|---|---|
| 16 | Kings Court Basketball Grade 10 | **0/10 SIGNED** |
| 17 | **Toronto Lords Grade 10 Girls** (the one that opens) | **6/10 SIGNED**, then **7/10 SIGNED** |
| 18 | Burlington Force Grade 10 Girls | **7/10 SIGNED** |

`PRODUCT` the badge reads `{signedCells}/{totalCells} signed` where `totalCells = players ×
waivers` (`waiver-status-view.tsx` lines 157 to 161 and 185 to 188). With one required waiver,
that is players, so `/10`.

**No team in this world is complete**, so the product's `All signed` badge (line 183) never
renders here, and the demo never draws it: punch F3.

### The expanded roster, all ten, in the endpoint's order

`DB` Toronto Lords Grade 10 Girls, `TeamSubmission 1f9aae94-678f-4b85-af72-ff09af21e3de`. The
`signerName` column is what the product prints in the cell (`waiver-status-view.tsx` line 226).

| # | Player | Parent email (`Player.parent.email`) | Cell |
|---|---|---|---|
| 1 | Emma Pierre | parent-summer-lords-159@sportshub.demo | ✓ Dana Sharma |
| 2 | **Danielle Reyes** | **summer-parent-lords@sportshub.demo** | **Pending → ✓ Jordan Reyes** |
| 3 | Brianna Garcia | parent-summer-lords-160@sportshub.demo | ✓ Jordan Wilson |
| 4 | Keisha Boateng | parent-summer-lords-161@sportshub.demo | ✓ Alex Adams |
| 5 | Amara Okafor | parent-summer-lords-162@sportshub.demo | ✓ Raj Rodriguez |
| 6 | Aaliyah Adams | parent-summer-lords-163@sportshub.demo | ✓ Nadia Allen |
| 7 | Faith Osei | parent-summer-lords-164@sportshub.demo | ✓ Wendy Santos |
| 8 | Priya Silva | parent-summer-lords-165@sportshub.demo | Pending |
| 9 | Danielle Wong | parent-summer-lords-166@sportshub.demo | Pending |
| 10 | Priya Diallo | parent-summer-lords-167@sportshub.demo | Pending |

All ten are drawn, not a slice: the beat's claim is that the ones who have not signed are
**named** rather than counted, and hiding four of them would be the demo undercutting its own
point.

`DB`: **zero** players on any approved roster in this season lack a parent email, so the
product's red "No parent email on file" line (`waiver-status-view.tsx` line 219) does not appear
in this world and is not drawn.

---

## D. The family, and what the phone shows word for word

### Why this family

| On screen | Value | Source |
|---|---|---|
| Account | **Jordan Reyes** | `DB` `summer-parent-lords@sportshub.demo` |
| Children in this league | Darius #37 (Toronto Lords Grade 9) and **Danielle #20** (Toronto Lords Grade 10 Girls) | `DB` two `Player` rows with `parentId = 2a6333d5-caca-4101-a19f-9893e2cb6f77` |
| Already signed | Darius, 2026-07-18, signer "Jordan Reyes", `validUntil` 2027-07-18 | `DB` `WaiverSignature 53f9a387-c6fe-437e-acda-825d3a190631` |
| **Still open** | **Danielle**. `WaiverSignRequest ffa1aaa7-f72f-4b41-b2fb-bb888e2ece71`, emailed to `summer-parent-lords@sportshub.demo` on 2026-07-17, expires 2026-10-05, **`consumedAt` NULL** | `DB` |

So the one signature this demo performs is the one signature the seeded world is actually
waiting for, from a guardian who has already proved he will sign. Nothing was written to the
database to make that true, and nothing needed to be.

### The email

`PRODUCT` `sendWaiverSignEmail`, `lib/email.ts` lines 288 to 335. Every string on the card is
that function's output for this player.

| On screen | Value | Source |
|---|---|---|
| Subject | "Action needed: sign Concussion Code of Conduct (Rowan's Law) for Danielle Reyes" | line 309, `Action needed: sign ${waiverTitle} for ${playerName}` |
| Eyebrow | NPH SUMMER LEAGUE | line 313, `orgName` |
| Heading | Concussion Code of Conduct (Rowan's Law) | line 314, `waiverTitle` |
| Context line | "Toronto Lords Grade 10 Girls · Summer 2026" | line 308, `[teamName, seasonLabel].join(" · ")` |
| Greeting | "Hi Jordan," | line 307, `Hi ${parentName},` with `parentName = parent.firstName` |
| Body | "before Danielle Reyes can participate with NPH Summer League, a parent or guardian needs to review and sign this document. It takes about a minute." | lines 316 to 319 |
| Button | **Review and sign** | line 322 |
| Foot | "This link is personal to Danielle Reyes and expires in 30 days. If someone else in your family already signed, the page will tell you and nothing more is needed." | lines 325 to 328 |
| Recipient | summer-parent-lords@sportshub.demo | `DB` `WaiverSignRequest.emailedTo` on the real row |

The 30 day expiry claim checks out against the row: `DB` created 2026-07-17, expires 2026-10-05.
That is 80 days, because the seed back-dated the creation while minting a standard window; the
demo shows the product's sentence, not the row's arithmetic. Recorded here so the discrepancy is
on the record rather than discovered later.

### The signing page

`PRODUCT` `app/(public)/waivers/sign/[token]/page.tsx` and `sign-form.tsx`. Every label,
placeholder, chip, sentence and button on the handset is verbatim.

| On screen | Value | Source |
|---|---|---|
| Eyebrow | NPH SUMMER LEAGUE | `page.tsx` lines 96 to 98, `waiver.orgName` |
| Title | Concussion Code of Conduct (Rowan's Law) | `page.tsx` line 99 |
| Subtitle | "For **Danielle Reyes** · renews yearly" | `page.tsx` lines 100 to 106; the suffix is conditional on `annualRenewal` |
| Document | the stored `body`, in a scrolling `<pre>` | `page.tsx` lines 108 to 112 |
| Field label | **Your full name** | `sign-form.tsx` lines 91 to 93 |
| Placeholder | **First and last name** | `sign-form.tsx` line 99 |
| Field label | **Relationship to player** | `sign-form.tsx` lines 104 to 106 |
| The two chips | **Parent or guardian** (`Parent/Guardian`) · **Player (18 or older)** (`Player (18+)`) | `sign-form.tsx` lines 8 to 11. These are the only two options the product has |
| Field label + hint | **Signature** · **Draw with your finger or mouse** | `sign-form.tsx` lines 119 to 120 |
| Acknowledgment | "I have read and understood this document, and I confirm that I am authorized to sign it for Danielle Reyes." | `sign-form.tsx` lines 134 to 137, template `...sign it for {playerName}.` |
| Submit | **Sign and submit** | `sign-form.tsx` line 150 |
| Storage line | "Your signature, name, the exact document text, and the date and time are stored securely as your signed record." | `sign-form.tsx` lines 153 to 156 |
| Success heading | **Signed and recorded** | `sign-form.tsx` line 76 |
| Success body | "Thank you. NPH Summer League now has your signed copy on file for Danielle Reyes. You can close this page." | `sign-form.tsx` line 81 |

What the submit really writes, `POST /api/waivers/sign` lines 24 to 91: the `WaiverSignRequest`
is consumed atomically (first POST wins), and a `WaiverSignature` is created carrying
`waiverVersion`, `bodySnapshot` (the exact text signed), `signerName`, `relationship`,
`signatureData` (a PNG data URL) and, because this waiver renews, `validUntil = now + 365 days`.
That is the sentence the storage line makes, and it is true.

---

## E. The re-send arithmetic, in full

`PRODUCT` `POST /api/seasons/[id]/waiver-status` loops every approved submission through
`sendWaiversForApprovedSubmission` (`auto-send.ts`) and returns `sent`. The view prints
`Sent ${payload.sent} email${payload.sent === 1 ? "" : "s"}.` (`waiver-status-view.tsx` line 88).

`auto-send.ts` skips a cell when either is true:
- the player already holds a **current-version, unexpired** signature (lines 104 to 107);
- the player already has a **live** sign request, meaning unconsumed and unexpired
  (`hasLiveSignRequest`, lines 112 to 121).

`DB`, evaluated against the real rows as of 2026-08-16:

| Term | Value | Source |
|---|---|---|
| Cells on approved rosters | 220 | section C |
| Already signed | 27 | `DB` |
| Live links (unconsumed, `expiresAt` 2026-10-05 > now) | **13** | `DB` count of `WaiverSignRequest` with `consumedAt IS NULL AND expiresAt > now()` |
| **Would send** | **180** | `ARITH` 220 − 27 − 13 |

After the demo's signature the split moves but the answer does not, which is why the number on
screen is safe either side of the beat:

| Term | Value |
|---|---|
| Already signed | 28 |
| Live links (Danielle's is now consumed) | **12** |
| **Would send** | **180** (`ARITH` 220 − 28 − 12) |

So **"Sent 180 emails."** is the product's own notice with the product's own arithmetic, and the
caption's "the 12 families with a live link were left alone" is the `alreadyRequested` counter.

`DB`, the 40 minted requests break down as 27 consumed and 13 live, and all 40 belong to the
four teams that have any signing activity at all. The other 18 approved teams have never been
emailed, which is the seed's doing, not the product's: punch F4.

---

## F. What the product cannot honestly show, and is therefore NOT staged

### F1. There is no reminder surface anywhere

`sendWaiverReminders` (`lib/waivers/reminders.ts`) runs from `GET /api/cron/waiver-reminders`
daily and sends a bell notification, a push and an email with a **fresh** signing link. Nothing
in the product ever shows a league what it sent, what it is about to send, or who has been
reminded. The `WaiverReminder` table is a write-only ledger with no reader outside the cron.

So the cadence beat is drawn as an explicit **NARRATION card**, in navy, with no console chrome
anywhere near it, exactly as the schedule-change demo draws its fan-out. It can never be mistaken
for a screen the product has.

**The cadence itself, verbatim from the code, not invented:**

| Fact | Value | Source |
|---|---|---|
| Trigger | seasons whose `startDate` is inside the next **7 days** and that have at least one APPROVED submission | `reminders.ts` lines 34 to 46 |
| Window choice | `"24h"` when `startDate − now <= 24 hours`, else `"7d"` | `reminders.ts` lines 58 to 59 |
| 7 day title | **"Waiver still unsigned"** | `reminders.ts` line 165 |
| 24 hour title | **"Sign before the first game"** | `reminders.ts` line 165 |
| Message | `{league} {starts soon|starts tomorrow}: {player} can't play until you sign "{title}". Tap to sign, it takes a minute.` | `reminders.ts` lines 160 to 170 |
| Channels | bell + push (`notifySafe`) **and** email (`sendWaiverSignEmail`) | `reminders.ts` lines 162 to 185 |
| Send once | creating the `WaiverReminder` row **is** the lock; a unique violation is the skip | `reminders.ts` lines 121 to 150; `@@unique([playerId, waiverId, seasonId, window])`, schema line 4483 |
| 24h also writes 7d | yes, to suppress an out of order later run | `reminders.ts` lines 133 to 146 |
| Schema comment backing it | *"push + reminder 7 days / 24 hours before the league season starts for unsigned required waivers"* | schema lines 4471 to 4473 |
| Cron is enabled | yes, on the box (MEMORY: waiver-reminders cron ON) | |

**The correction the brief asked for.** The brief described the cadence as "7 days / 24 hours
dedupe". There is no rolling 24 hour anti-spam cooldown in this code. **7 days** and **24 hours**
are the two TRIGGER POINTS before season start; the DEDUPE is per (player, waiver, season,
window), enforced by the unique key, so each window fires exactly once. The demo states it that
way.

### F2. No expiry is shown to anybody, ever

`WaiverSignature.validUntil` is written and every satisfaction query filters on it, but there is
no surface, parent side or league side, that says when a signature lapses. The success page does
not, the board does not, the library card does not. The demo therefore says renewal in words and
on the two badges the product really draws, and shows **no renewal date**. The previous cut of
this demo invented a "Renews 14 Oct 2027" row on the success screen; it is gone.

**Recommend:** a "renews {date}" line on the success page and an expiring-soon filter on the
board. Leagues will ask for it the first time a season straddles an anniversary.

### F3. No team in this world is complete

Best team is 7 of 10. The product's `All signed` badge (`waiver-status-view.tsx` line 183) is
therefore never rendered by this data, and the demo never draws it. The previous cut ended on a
fully green board with "a hundred and ten of a hundred and ten"; no such state exists.

### F4. Approval sent to four teams, not twenty two

`DB`: only 40 sign requests exist, all inside the four teams that have signatures. The other 18
approved teams have never had a waiver email, even though `PATCH /api/seasons/[id]/teams/[teamId]`
would have sent one on approval. This is a **seed** artifact (`seed-summer-world.ts` seeds a
signed/pending mix on a subset), not a product defect, and it is why the board reads 27 of 220
rather than something closer to complete.

**Recommend:** the summer seed should either mint requests for every approved roster or say in
its log that it does not. Until then the board is a truthful picture of a league that approved
teams in waves.

### F5. The season's reminder windows are already in the past

`DB` Summer 2026 started **2026-04-04**. The cron only looks at seasons starting inside the next
seven days, so this season is past both windows and there are **zero** `WaiverReminder` rows for
this waiver. (The 800 `WaiverReminder` rows in the database belong to integration-test seasons
and waivers, unrelated to any demo world.)

The cadence card therefore states the RULE and its code path, never a send that happened, and
the card's own closing line says so on camera: *"The cron only looks at seasons starting inside
the next seven days, so this season, which tipped off in April, is past both of its windows."*

---

## G. Fidelity: what the demo does that the real screen does not

No capture of the waiver screens exists in the 2026-08-16 real-screens set (it covers the season
console), so these surfaces are mirrored from component code rather than from a screenshot. Every
deviation is listed.

| Real | Demo | Verdict |
|---|---|---|
| Site header, sidebar, `SmartBack`, the page `<h1>` block | Removed; one slim context strip carries the location | KEEPING. Presentation law D2.1 |
| The board is a plain vertical stack of team cards under the badges row, with no section header | Same: no panel chrome, no section title | MIRRORED (an earlier draft added a panel header; it was removed for fidelity **and** for the 40px) |
| Badges row: "N signed", "N outstanding", "Only missing", then "Re-send all outstanding" on the right | Same, plus a "3 of 22 teams" slice chip | MIRRORED, with the slice STATED rather than hidden |
| Player cell stacks the name over the parent email | Name and email on one line | DEVIATION, recorded. Stacking ten players costs about 100px the region does not have; the information is identical |
| The board lists all 22 approved teams | Three consecutive rows, positions 16 to 18 | DEVIATION, stated on screen by the count chip |
| Waiver library reveals the body only through Edit | The body is shown under the document row on the library screen | DEVIATION, recorded. Same string (`WaiverDocument.body`), shown without pressing Edit so the operator scene has the text on it |
| The signing page is one long scroll: header, document, form | Two positions of the same page, swapped with a fade; the form view keeps one compact context line instead of the full header | DEVIATION, recorded. A 390 by 576 handset cannot hold the whole page at 14px and up, and the real page has no sticky header, so a thumb at the form has scrolled the title block away |
| The signature pad is a real canvas | A pre-drawn path that animates in | KEEPING. The same device the previous cut used; a demo cannot draw with a finger |
| The email is HTML in a mail client | A card in a plain inbox surface, with the real subject, greeting, body, button and expiry line | KEEPING. Clearly her inbox, clearly not our product |
| `PATCH /api/seasons/[id]/teams/[teamId]` fires the auto-send | Not shown as an action; stated in the "no recipient picker" beat and cited here | KEEPING. The approval beat belongs to the season story; repeating it would cost 20 seconds for a screen this demo is not about |

---

## H. Gate results, 2026-08-16

| Gate | Result |
|---|---|
| `scripts/demo/readability-audit.mjs --routes /demos/waivers` | **0 violations**, minimum stage scale **1.000**, 32 scenes audited |
| Full playback drive, 29 beats plus 3 chapter jumps | **0 console errors**, **0 page errors**, **0 request failures**, **0 stage overflows** |
| Chapter jumps | 1 → beat 1, 2 → beat 8, 3 → beat 18, exact |
| Runtime at 1x | **2 min 13 sec** (132,840 ms), inside the 1:45 to 2:15 target |
| `tsc --noEmit` (apps/web) | clean |
| Em-dash sweep | clean across the story, the registry entry and this page |
| Screenshots | `scratchpad/overnight/waivers/` : phone signing, board going green, reminder cadence |

---

## Sweep, 2026-08-16

**FULL SCREENS.** The compliance board drew **three** team rows under a "3 of 22" chip with about
290px of empty panel under them, while the beat said the board counts the whole season. All
**twenty two** approved teams are on it now, as a two column grid, each with the signed count read
out of the database on 2026-08-16 (27 signatures across 220 rostered players: Toronto Lords Grade 9
7/10, Burlington Force Grade 9 7/10, Toronto Lords Grade 10 Girls 6/10, Burlington Force Grade 10
Girls 7/10, and eighteen teams on 0/10). Opening a roster narrows the board to a three row window
around that team, because the expansion names all ten of its players; the chip says "3 of 22" only
then. "Only missing" now really filters the grid.

**The cron confession is out.** The reminder card's footer read: "The cron only looks at seasons
starting inside the next seven days, so this season, which tipped off in April, is past both of its
windows. The rule is the product; the dates are the calendar." Deleted, along with the context strip
that called the card "What the cron does next" (no such screen exists) and the "lists built by hand"
row's clipboard joke. The card still states the rule, the two windows and the ledger row that
guarantees the once; the season-date caveat lives in this file.

**Copy, 17 captions and balloons.** Gone: "not an attachment somebody emails", "where the league
actually stands today", "named, not counted", "word for word", "The document is the document",
"Nothing else is asked for", "so the product asks rather than assuming", "Not a tick box agreeing to
nothing in particular", "The league did not type this in", "no spreadsheet anywhere near it", "the
list a coach would otherwise build by hand", "made for free", "never blasts the same inbox twice",
"And nobody chases anybody". The registry description lost "the badge that costs leagues a season if
they miss it", "turns the camera around" and "the part nobody demos".

Gate re-run: readability audit **0 violations**, minimum stage scale **1.000**, 29 beats / 32
scenes, one headless drive with a clean console. Runtime **2 min 02 sec**.
