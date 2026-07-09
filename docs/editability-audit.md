---
updated: 2026-07-09
status: living
tier: 1
area: platform
source: owner
tags: [theme/platform, type/audit, status/living]
---

# ✏️ Editability & lifecycle audit — every entity, every state, every action

**Owner ask (2026-07-09):** audit everything that is created — is it editable, how does it
transition, when *should* it be editable — make edit actions prominent (color + UX), and
auto-derive transitions so admins/end-users see the right actions per state.

**Method:** 6 parallel read-only agents swept schema + every API route + every UI surface
(club programs / offers & money / teams & people / league ops / content & engagement /
accounts & platform). Findings verified against `prisma/schema.prisma` and route code.

---

## 1. The lifecycle model (how states are derived)

Two kinds of state exist in the app — **keep them distinct**:

| Kind | Examples | Rule |
|---|---|---|
| **Declared** (a human decided) | `isPublished`, Offer PENDING→ACCEPTED, Season DRAFT→…→COMPLETED, submission APPROVED | Stored in DB; changed only by an explicit action with authz + state guard |
| **Derived** (a fact of time/data) | past (`endDate < now`), full (`signups ≥ max`), in-progress (between dates), expired (`expiresAt < now`) | **Never stored** — computed at read time so it can't go stale; no cron needed for display |

**Canonical program lifecycle** (Tryout / Camp / HouseLeague — implemented in
`apps/web/src/lib/lifecycle.ts` this session):

```
DRAFT (isPublished=false)
  └─ publish ─▶ OPEN (published, before start, spots left)
                 ├─ auto ─▶ FULL         (signups ≥ maxParticipants)   [derived]
                 ├─ auto ─▶ IN_PROGRESS  (now between start/end)       [derived]
                 └─ auto ─▶ ENDED        (now > end)                   [derived]
       ◀─ unpublish (allowed until start; after start it's history, not a draft)
```

**Action gating by state** (admin side):

| State | Edit details | Edit price | Publish/Unpublish | Delete | View registrants |
|---|---|---|---|---|---|
| DRAFT | ✅ free | ✅ free | ✅ publish | ✅ (nothing depends on it) | — |
| OPEN | ✅ (notify note) | ⚠️ warn once paid signups exist; never retroactive | ✅ unpublish | ⛔ (has/can have signups) → unpublish instead | ✅ |
| FULL | ✅ | ⚠️ same | ✅ | ⛔ | ✅ |
| IN_PROGRESS | ✅ (logistics: time/location/details) | ⛔ fee locked | ⛔ | ⛔ | ✅ |
| ENDED | ⛔ read-only (historical record) | ⛔ | ⛔ | ⛔ | ✅ (export) |

**End-user (family) gating:** register only in OPEN; cancel own signup while OPEN/FULL and
unpaid (PAID → "contact the club", refund is merchant-side); everything read-only from
IN_PROGRESS on.

**Design language (uniform across the app):**
- **Status chip** on every card/detail header — kit `Badge` with dot:
  `ink` Draft · `court` Open · `gold` Full · `live` (pulse) In progress / LIVE · `neutral` Ended ·
  `hoop` Needs attention (expired/pending-response).
- **Edit is a first-class button** — kit `Button variant="subtle"` with pencil icon on every
  card + detail header. Never buried in a submenu.
- **Primary state action** (Publish / Make offer / Finalize) — brand-filled `Button`.
- **Destructive** (Delete / Withdraw / Rescind) — `tone` red family, confirm dialog, only
  rendered in states where it's legal.

---

## 2. The matrix — where every entity stands

Legend: ✅ works · 🔶 API exists, **no UI** · 🔴 nothing exists · 🐛 broken · 🔒 security hole
(File refs in the per-domain agent reports; high-signal ones inline.)

### 2a. Club programs

| Entity | Create | Edit | Publish/Unpub | Delete | Registrants view | Family cancel |
|---|---|---|---|---|---|---|
| Tryout | ✅ | ✅ page (Staff/TM can create but **not** edit — authz mismatch) | 🐛 Unpublish broken — `api/tryouts/[id]/publish` hard-codes `true` | 🔴 | ✅ signups + check-in | ✅ unless PAID |
| Camp | ✅ | 🔶 PATCH full, **no edit page/button** | ✅ toggle | 🔴 | 🔴 club can't see who registered | 🔴 no API/UI |
| HouseLeague | ✅ | 🔶 same as Camp | ✅ toggle | 🔴 | 🔴 | 🔴 (WAITLISTED/CANCELLED enum dead) |
| Tournament | ✅ | 🔶 PATCH full, **no core-fields form** | 🔶 split: list toggles DRAFT↔REGISTRATION; manage only advances forward; can't reopen | 🔴 | ✅ teams tab | 🔴 club can't withdraw team (WITHDRAWN unreachable) |

Also: club overview dashboard counts **tryouts only** — camps/HL/tournaments invisible in stats
and quick actions. `GET ?tenantId` list endpoints (tryouts/camps/HL) require session but **no
club role** — any signed-in user can read a club's full program list incl. drafts.

### 2b. Offers & money

| Entity | Findings |
|---|---|
| Offer | 🔴 **Club cannot edit/rescind/withdraw a PENDING offer** — no API, no UI. Wrong fee ⇒ family can still accept ⇒ debt minted + deposit charged. Biggest business gap in the app. |
| Offer expiry | 🔴 No cron — rows stay PENDING past `expiresAt` (lazy flip on family touch / team finalize only). 🐛 `pay-intent` checks status but **not `expiresAt`** ⇒ deposit can be charged on a stale offer whose accept then fails ⇒ orphan deposit needing manual refund. |
| "Resend" | 🔴 Doesn't exist — EXPIRED/DECLINED can't be revived; workaround is a brand-new offer from the tryout signups page only. |
| OfferTemplate | ✅ full edit/archive with buttons; snapshot-at-send design makes fee edits safe. |
| Obligation / Payment | ✅ **money is immutable post-create everywhere** (by design). Waive = owner/manager-gated; Refund = owner/manager, SUCCEEDED+unrefunded, amount-bounded, destination reverse-transfer. Terminal states respected. No unguarded money edit exists — the safe part of the system. |
| Family un-accept | 🔴 by design (terminal) — needs at least a documented club-side path (waive + release roster spot). |

### 2c. Teams & people

| Entity | Findings |
|---|---|
| Team | Create+edit ✅ (edit button on dashboard). 🔴 No delete/archive ever — dead teams accumulate. No status field. |
| Player | Parent edit ✅. 🔶 **Soft-delete API (with offer/tryout cascade + roster guard) has ZERO UI callers** — no remove button anywhere. |
| `mediaConsent` | 🔴 **Never writable** — gates public names/media, stays UNSET forever. Consent can also never be revoked (PATCH omits consent fields). COPPA-adjacent; fix soon. |
| TeamPlayer | Release ✅ / 🔶 reactivate API exists but released players are filtered out of the roster view — unreachable. SUSPENDED enum dead. |
| UserRole (staff) | 🔴 Designation not editable — promote Assistant→Head = remove + re-add. 🐛 club staff "Remove" deletes only `roles[0]` of a multi-role user (partial remove). Authz drift: club-remove Owner-only vs team-remove Owner/Manager. |
| StaffInvitation | 🔴 **No cancel/revoke + no expiry** (no `expiresAt` field, CANCELLED/EXPIRED enum dead) — stale PENDING invites block re-inviting that person forever. Sent-invites list is display-only. |
| PlayerInvitation | ✅ full lifecycle (accept/decline/lazy-expire/revoke) — the model to copy. Only nit: buried in a collapsible panel. |
| TeamSubmission | 🔴 club cannot self-withdraw from a league; 🔶 WITHDRAWN cascade (cancel games, notify, void fee) exists API-side, **no button renders it** even for the league. No un-approve for wrong-division fixes. |

### 2d. League ops

| Entity | Findings |
|---|---|
| League | ✅ fully editable anytime (no lifecycle). Delete blocked while seasons exist. `requireRefereeApproval` flippable mid-season (retroactive gating — note in UI). |
| Season | Manual forward-only status button ✅. 🔴 **No un-finalize** — even API status rollback leaves rosters `isLocked` + tiebreakers locked (side-effects have no undo). 🐛 API PATCH accepts any status jump (no state-machine validation). Inconsistent: fees/dates/playoff format still editable **after** finalize. |
| Division | 🔴 **Never editable — no PATCH route at all.** Create+delete only, and both are blocked once season locks. A typo in a division name is permanent. |
| Game | Reschedule/cancel/forfeit ✅ (schedule tab). 🔶 **Correcting a COMPLETED game is API-only** (re-finalize, owner/admin) — console dead-ends at read-only "Final", game drops off /score list. 🐛 generic `PATCH /api/games/[id]` lacks the COMPLETED guard that finalize/DELETE have. |
| Submission roster | ✅ the **best lifecycle in the app**: policy-gated edits, one-shot unlock on approved change request, auto re-lock on save, audited league override. Copy this pattern. |
| Referee/scorekeeper | Assign/unassign ✅ (game-day). ACCEPTED shift offer can't be cancelled/reassigned; pool-remove doesn't unassign games; assign routes don't check game status (can assign to COMPLETED/CANCELLED). |
| Practice | Move/cancel/restore ✅ w/ notifications. Can't edit location/notes of an occurrence; slot PUT is destructive replace; COMPLETED enum dead. |

### 2e. Content & engagement

| Entity | Findings |
|---|---|
| AI recap (Post) | 🔴 **No edit/regenerate/takedown** (code comment promises it). Re-finalize silently overwrites. 4 of 5 PostStatus values dead. No `/api/posts` at all. |
| Review | 🔴 Author can't edit/delete (empty `api/reviews/[id]/` dir!). 🔴 Full moderation schema (FLAGGED/REMOVED/moderatorNotes) with zero driving code — also a launch blocker (H4). |
| Poll | Close/reopen/delete ✅. 🔴 **Not editable ever** — typo or missing option = delete + lose all votes. No scheduled auto-close (`closedAt` manual only). |
| Announcement | Pin/delete ✅. 🔴 PATCH toggles pin **only** — content not editable; typo = delete + repost. `teamId` scope write-dead. |
| Chat message | Soft-delete ✅ (sender or staff). 🔴 No edit. Dock lacks the delete control the full page has. |
| MediaAsset | 🔴 Fully internal — no upload/delete/reorder; VIDEO types unreachable. |
| Notification | Mark-read ✅. 🔴 No dismiss/delete — accumulate forever. |
| Follow | ✅ clean toggle — nothing to fix. |

### 2f. Accounts & platform

| Entity | Findings |
|---|---|
| User | 🔴 **No email change, no password change** (only admin reset → hardcoded `TempPass123!` returned in the response), no avatar write path, no account deletion (DELETED enum dead). The identity-management basics are missing. |
| RefereeProfile | Edit ✅ (cert/fee/regions) + PIN change w/ current-PIN ✅. `certificationExpiry` not editable (absent from schemas/form). No way to relinquish the role. |
| Tenant (club) | Settings ✅ + Customize ✅ — but two overlapping surfaces for the same rows; slug edit has no broken-URL warning; no club delete/archive. Claim flow ✅ (email code self-serve + admin queue). Suspend/reactivate/plan/feature/transfer ✅ admin. |
| League branding | 🐛 **UI/API authz mismatch** — customize page renders for LeagueManager but PATCH allows owner-only ⇒ manager sees editor, every save 403s. |
| Venue | 🔒 **`PATCH /api/venues/[id]` has NO authz** — any signed-in user can rename any global venue (no UI calls it, but the hole is live). 🔶 No venue edit UI, no delete, no merge tool for dupes. Courts/hours edit ✅. |
| Admin console | Suspend/plan/feature/transfer/roles ✅. Settings split across two pages (countries vs payment postures) with no cross-link. No delete-user/delete-tenant. Impersonation ✅ (cookie, 1h, audited). |
| Consent/COPPA | Under-13 gate ✅ at registration. 🔴 `mediaConsent` + consent revocation gaps (see 2c). |

---

## 3. Dead enum inventory (states that exist in schema but nothing sets)

`PostStatus`: PENDING_REVIEW, REJECTED, TAKEN_DOWN (+DRAFT never written) ·
`ReviewStatus`: FLAGGED, REMOVED · `UserStatus`: DELETED (+INACTIVE) ·
`TeamPlayerStatus`: SUSPENDED · `InvitationStatus` (StaffInvitation only): CANCELLED, EXPIRED ·
`HouseLeagueSignupStatus`: WAITLISTED, CANCELLED · `PracticeStatus`: COMPLETED ·
`ObligationStatus`: REFUNDED (reserved by design).
**Rule going forward:** an enum value ships with the transition that sets it, or it doesn't ship.

## 4. Security/authz findings (fix independent of UX)

1. 🔒 `PATCH /api/venues/[id]` — no role check at all. **FIXED this session** (PlatformAdmin-gated until a venue-ownership model exists).
2. `GET /api/{tryouts,camps,house-leagues}?tenantId=` — session-only, no club-role check (drafts readable by any user).
3. Offer `pay-intent` missing `expiresAt` check. **FIXED this session** (lazy-expire + 400).
4. Generic game PATCH missing COMPLETED guard. **FIXED this session** (409 → use re-finalize).
5. League customize LeagueManager 403 mismatch (align API to UI or vice versa).
6. Admin `resetPassword` hardcodes `TempPass123!` and returns it in the response body.

---

## 5. Fix waves (prioritized)

### ✅ Wave 1 — SHIPPED this session (local)
- `lib/lifecycle.ts` — derived DRAFT/OPEN/FULL/IN_PROGRESS/ENDED + per-state action gates +
  badge mapping; single source of truth for program entities.
- **Camp + HouseLeague edit pages** (`clubs/[id]/camps/[campId]/edit`, `.../house-leagues/[hlId]/edit`)
  — PATCH APIs already existed; fee field warns once paid signups exist.
- **Camp + HouseLeague registrants pages** (`.../signups`) — clubs can finally see who signed up.
- **Prominent per-card actions** on Camps/House-Leagues/Tryouts lists: lifecycle status chip +
  Edit (pencil, always visible) + Registrants + View public + Publish/Unpublish, all kit-styled,
  gated by `lifecycle.can()`.
- **Tournament edit page** for core fields + Edit buttons on list/manage.
- 🐛 fixes: tryout unpublish (publish route now respects body), venue PATCH authz,
  game PATCH COMPLETED guard, pay-intent expiry check.

### Wave 2 — money & league correctness (needs owner sign-off on semantics)
- **Offer rescind** (club withdraws PENDING offer) — new status `RESCINDED` or reuse EXPIRED;
  + prominent button on club offers page; + offer-expiry cron.
- **Club self-withdraw from league** + league-side Withdraw button (cascade exists).
- **Game "Correct result" button** (owner/admin) on completed games → re-finalize flow.
- **Division rename** (PATCH route + inline edit, allowed even while locked — it's cosmetic).
- **Season un-finalize** (explicit owner-only "Reopen season" that reverses roster locks) or
  formally document finalize as one-way and validate status jumps server-side.
- StaffInvitation cancel + expiry (copy PlayerInvitation's model).

### Wave 3 — people & consent
- `mediaConsent` editor (parent, player edit page) + consent display on rosters.
- Player remove button (parent) wiring the existing soft-delete API.
- Staff designation PATCH (promote in place); fix multi-role remove; reactivate released players.
- Self-service email/password change + forgot-password; avatar upload.

### Wave 4 — content round-trips
- Recap edit/regenerate/takedown (club/league) — honor the promised `PostStatus` states.
- Review author edit/delete + admin moderation queue (launch blocker H4).
- Poll edit (pre-votes free; post-votes add-option only) + scheduled auto-close.
- Announcement content edit. Chat message edit-within-N-minutes. Notification dismiss.

---

## 6. Auto-derivation rules adopted

1. **Time/capacity states are always computed, never stored** (`lifecycle.ts`) — no stale flags, no display crons.
2. **Enforcement crons only where money moves** (offer expiry belongs next to `charge-due`).
3. **Every mutation route re-derives state server-side** — the UI hiding a button is never the guard.
4. **Terminal states are explicit**: ENDED programs, COMPLETED games (via re-finalize only), PAID obligations, responded offers/invitations.
5. **One-shot unlock pattern** (roster change requests) is the template for "edit a locked thing" everywhere else.

⬅ [[_dashboard|Roadmap dashboard]] · [[_moc-platform]] · related: [[design-system-elevation]] · [[feature-backlog]]
