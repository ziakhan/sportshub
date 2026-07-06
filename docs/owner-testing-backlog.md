# Owner testing backlog

Running list of gaps and design questions the owner finds while test-driving
the site. These are DISCUSSION-FIRST items — capture here, decide together,
then schedule into a fix batch. Distinct from the machine audit ledger
(docs/ux-audit-2026-07-06.md); cross-reference when they overlap.

Format: `OB-###` · date found · where · what · decision needed · status.

---

## OB-001 · 2026-07-06 · /club/[slug] · Public team counts / club-page visibility

**Found:** the public club page shows how many teams a club has (and lists
them). Not every club wants to advertise its size or structure.

**Discussion needed:** should clubs control what their public page exposes?
Options to weigh when we take this up:
- Per-club "public page settings" (show/hide: team count, team list, staff
  count, programs) — likely a `TenantFeatures`-style toggle set, editable in
  club settings, defaulting to visible.
- Or a simpler platform-wide policy (e.g. never show counts, always show
  team names).
- Interacts with UNCLAIMED clubs: nobody exists to choose settings for the
  188 imported clubs — what's the right default for them?

**Status:** open — needs owner decision on approach.

## OB-002 · 2026-07-06 · /club/[slug] · "Claim This Club" — verification flow unclear

**Found:** the claim button exists but the owner doesn't know how claiming
is verified or whether it is trustworthy.

**What exists today (for the discussion):** a full flow is already built —
claim request → 6-digit verification code emailed to the club's on-file
`contactEmail` (imported with the 188 real clubs) → claimant enters the code
→ status `EMAIL_VERIFIED` → **platform admin reviews and approves/rejects**
at /dashboard/admin/claims (with optional message from the claimant and
admin review notes). If a club has no contact email on file the claim parks
as `PENDING` for manual handling.

**Discussion needed:**
- Is email-code + admin approval sufficient proof of ownership? (Risk: the
  imported contactEmail may be stale/generic info@; whoever reads that inbox
  can claim.)
- What documentation should the manual `PENDING` path require (no contact
  email on file) — incorporation papers, website admin proof, phone call?
- Who is "the admin" operationally once real clubs start claiming, and what
  SLA/notification do they get on new claims?
- The claim CTA also appears for logged-out visitors → sends to /clubs/find;
  is that the intended entry point?

**Status:** open — flow exists; owner to validate the trust model.

---

_Add new items above this line as OB-003, OB-004, …_
