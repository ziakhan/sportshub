# Club Owner / Manager — Verbatim Screen Inventory

Scope: club creation, club claiming, team creation + staff assignment, staff
management, tryouts (create/list/signups/check-in), offer templates, offers
(send/track/order sheet), team roster, league roster submission. All strings
below are copied verbatim from the source JSX — nothing paraphrased.

---

## Create Club — `/clubs/create`
- Source files: `apps/web/src/app/(platform)/clubs/create/page.tsx`, `create-club-gate.tsx`, `search-first.tsx`, `create-club-form.tsx`, `apps/web/src/components/country-state-selector.tsx`, `apps/web/src/lib/countries.ts`
- Layout: A centered max-w-2xl column. Header "Create Your Club" + subhead. A white rounded card holds a **gate**: search-first UI until the operator proceeds, then the create form replaces it in place. Below the card, a green-tinted "What's included" box lists product bullets. The gate enforces search-before-create — the create form is inaccessible until the operator searches or explicitly opts out (owner rule: ~1,000 clubs already exist as UNCLAIMED census records; duplicate creation orphans them).
- Page-level copy:
  - H1: "Create Your Club"
  - Subhead: "Set up your youth basketball club and start managing teams, tryouts, and more."
  - Included-box header: "What's included:"
  - Included bullets: "✓ Create and manage unlimited teams", "✓ Host tryouts and collect registrations", "✓ Accept payments with Stripe Connect", "✓ Join leagues and schedule games", "✓ Track player stats and standings", "✓ Your own subdomain ({slug}.youthbasketballhub.com)"

### Gate step 1 — Search first (`search-first.tsx`)
- Fields:
  - Search input — no visible label; placeholder "Search by club name or city…", `autoFocus`. Debounced 300ms against `/api/clubs/search?q=`.
- Copy:
  - Heading: "Is your club already listed?"
  - Subhead: "We've mapped over a thousand Canadian clubs. If yours is here, claim it — you keep its league connections and public page instead of starting from zero." (rendered with `&apos;`)
  - Searching indicator: "Searching…"
  - No-results: "No matches for "{q}"."
- Result row: club name, `[city, state]` joined by ", ", and a button **"This is my club"** → links to `/claim/{club.id}`.
- Buttons/actions:
  - **"This is my club"** (per result) → navigates to `/claim/{clubId}` (the public claim wizard).
  - **"My club isn't listed — create a new one"** (`Button variant="subtle"`) → calls `onProceed()`, swapping in the create form. Disabled until `q.trim().length >= 2` (must search first).
  - Helper under disabled button: "Search first — it takes ten seconds."

### Gate step 2 — Create form (`create-club-form.tsx`)
- Fields (all in one form, sectioned by `<h3>` dividers):
  - "Club Name" * — text, placeholder "Warriors Basketball Club". On blur, auto-generates the slug if slug is empty (lowercases, replaces non-alphanumerics with `-`, trims leading/trailing `-`). Validation: min 3, max 100 chars.
  - "Subdomain Slug" * — text, placeholder "warriors", suffixed with static label ".youthbasketballhub.com". Validation: min 3, max 50, regex `^[a-z0-9-]+$` ("Slug can only contain lowercase letters, numbers, and hyphens"). Helper: "This will be your club's unique URL. Only lowercase letters, numbers, and hyphens."
  - Section header "Contact Information":
    - "Business Phone" * — `type="tel"`, placeholder "(555) 123-4567". Validation: min 7, max 20 ("Enter a valid phone number").
    - "Contact Email" * — `type="email"`, placeholder "info@warriors.com". Validation: email format.
    - "Website (Optional)" — `type="url"`, placeholder "https://www.warriors.com". Validation: optional URL or empty string.
  - Section header "Business Address":
    - "Street Address" * — text, placeholder "123 Basketball Ave". Validation: min 3.
    - "Country" * (from `CountryStateSelector`, only shown if >1 country enabled) — select of `SUPPORTED_COUNTRIES` (United States, Canada, United Kingdom, Australia); default "CA".
    - Subdivision label is dynamic per country: "Province" (CA, default), "State" (US/AU), "County" (GB) — select of `getSubdivisionsForCountry`, placeholder option "Select {label}...". Falls back to free-text input labeled with the subdivision label if the country has no subdivision list.
    - "City" * — text, placeholder "Los Angeles". Validation: min 1, max 100.
    - Postal field label is dynamic: `getCountryConfig(country)?.postalLabel` (e.g. "Postal Code" for CA, "ZIP Code" for US) — text, placeholder "A1A 1A1" (CA) or "90001" (other). Validation: min 3, max 10.
  - Section header "Branding":
    - "Logo URL (Optional)" — `type="url"`, placeholder "https://example.com/logo.png". Helper: "Paste a link to your club logo. You can update this later."
    - "Description (Optional)" — textarea, 3 rows, placeholder "Elite youth basketball program focused on skill development and competitive play..."
  - "Timezone" * — select, options from `getTimezonesForCountry(country)`; default "America/Toronto".
  - Currency is set automatically from country (`getCurrencyForCountry`) — not a visible field.
- Buttons/actions:
  - **"Create Club"** (submit, disabled while submitting → label "Creating...") → `POST /api/tenants`. On success shows the confirmation panel below. On failure shows the error banner with the API's `error` message (or "Failed to create club").
  - **"Cancel"** (Link) → `/dashboard`.
- Success state (replaces the form):
  - Green check icon, "Club Created!"
  - "{name} is ready to go." / "Your club URL: {subdomain}" (mono font)
  - **"Go to Club Dashboard"** (anchor) → `http://{subdomain}/dashboard`.
- Rules/behavior worth showing in a demo: search-before-create gate is a hard rule (owner 2026-07-18); slug auto-fills from name but is editable; postal/subdivision labels swap live per selected country; timezone list re-derives on country change.

---

## Claim Your Club (public wizard) — `/claim/[tenantId]`
- Source files: `apps/web/src/app/(public)/claim/[tenantId]/page.tsx`, `claim-wizard.tsx`
- Layout: Public, unauthenticated, anonymous page (`robots: noindex`). Single centered card (`max-w-xl`). Fetches its own options from `/api/clubs/claim-v2/{tenantId}` on mount — no session needed. Steps are client-side state: `options → code → verified` (or `proof-sent`).
- Meta title: "Claim your club — SportsHub"
- Loading text: "Loading…" · Not-found text: "Club not found."
- Terminal states before the wizard renders:
  - **Already claimed**: club name heading + "This club is already managed on SportsHub. If you believe that's wrong, contact support."
  - **Claim in progress**: club name heading, `Badge tone="warning"` "Claim in progress", + "Someone is already claiming this club. If that stalls, the reservation expires on its own and you can try again."
- Header (all non-terminal steps): eyebrow "Claim your club", club name (H1, uppercase condensed), city subline if present.

### Step "options"
- Copy: "To prove you run this club, we send a code to the contact info already on file — no account needed yet."
- Channel choice buttons (one per `options.channels`), each a full-width bordered button, selected state highlighted:
  - Email channel label: `Email a code to {hint}`
  - SMS channel label: `Text a code to {hint}`
  - Proof channel label: "I can't access those — submit proof instead", with helper "Describe your proof (website admin, registration papers, social account) and an admin will review it."
- If "proof" channel selected, two extra fields appear:
  - Email input — placeholder "Your email (for the decision)"
  - Textarea — placeholder "What can you show that proves you run this club?", 3 rows
- Corrections toggle link: "Our info looks wrong? Propose corrections" ⟷ "Hide corrections" (toggle). When open, a 2-col grid of plain inputs, placeholders: "Club name", "City", "Website", "Contact email", "Phone". Helper: "Corrections apply when the claim completes."
- Buttons/actions:
  - **"Send the code"** (default) / **"Submit for review"** (when channel = proof) / "Working…" while busy. Disabled until a channel is chosen (and, for proof, until email + a proof note ≥10 chars are filled). → `POST /api/clubs/claim-v2/{tenantId}`. On success: proof → step "proof-sent"; otherwise → step "code" (stores `claimId`, `sentTo`).
  - Error banner shows API's `error` or "Couldn't start the claim".

### Step "code"
- Copy: "We sent a 6-digit code to **{sentTo}**. It expires in 30 minutes."
- Field: numeric code input, `inputMode="numeric"`, placeholder "••••••", strips non-digits, max length 6, centered mono large text.
- Button: **"Verify"** (disabled until 6 digits) / "Checking…" while busy → `PATCH /api/clubs/claim-v2/{tenantId}` with `{claimId, code}`. On success stores `completionToken`, goes to step "verified". Error banner shows API's error or "Verification failed".

### Step "verified"
- `Badge tone="success"` "Verified"
- Copy: "{name} is reserved for you for 14 days. Create an account (any email works) or sign in — the club binds to *your account*, not the inbox that got the code."
- Button: **"Take ownership"** (Link) → `/claim/complete?token={completionToken}`.
- Footer note: "We also emailed this link to the verified contact."

### Step "proof-sent"
- `Badge tone="play"` "Submitted"
- Copy: "An admin will review your proof — you'll hear back at **{claimantEmail}**. If approved, that email gets a link to take ownership."
- Rules/behavior: no contact on file → paper-proof note + claimant email → admin review (async, no code). All channel copy and corrections are entirely driven by the `/api/clubs/claim-v2/{tenantId}` response — nothing hardcoded beyond labels above.

---

## Take Ownership (claim completion) — `/claim/complete`
- Source files: `apps/web/src/app/(public)/claim/complete/page.tsx`, `complete-claim.tsx`
- Layout: Single centered card. Reads `?token=` from the URL. Uses `useSession()` — behavior branches on auth status. If already authenticated when the token loads, it auto-redeems (no button click needed).
- Meta title: "Take ownership of your club — SportsHub"
- Eyebrow: "Take ownership"
- Missing token: "This link is missing its token — check the email."
- Loading / working: "Working…"
- **Unauthenticated** state:
  - Copy: "Your club is verified and reserved. Sign in or create an account — any email works — and the club binds to your account."
  - Buttons: **"Create an account"** (Link → `/sign-up?callbackUrl=/claim/complete?token=...`), **"I already have an account"** (Link → `/sign-in?callbackUrl=...`).
- **Done** state (after `POST /api/clubs/claim-complete`):
  - `Badge tone="success"` "Club claimed"
  - Club name heading
  - Copy: "You're the owner — everything about the club is now yours to edit."
  - Button: **"Go to your club dashboard"** → `/clubs/{club.id}`.
- **Error** state: shows the API's error message + **"Try again"** button (retries `complete()`).
- Rules/behavior: signed-in visitors redeem automatically on load (`useEffect` fires `complete()` the moment `status === "authenticated"`); the callback URL round-trips through sign-in/sign-up so the redeem happens post-auth.

---

## Create Team — `/clubs/[id]/teams/create`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/teams/create/page.tsx`
- Layout: `max-w-2xl` column with a back link, then three stacked white cards: "Team Details", "Practice Days", "Staff Assignment", then Cancel/Create buttons. On success the whole page swaps to a confirmation panel.
- Back link: "← Back to Teams" → `/clubs/{clubId}/teams`
- Header: "Create New Team" / "Add a team to your club and assign coaching staff"

### Card: Team Details
- Fields:
  - "Team Name" * — text, placeholder "Warriors U12". Validation: min 3, max 100.
  - "Age Group" * — select. Placeholder option "Select age group". Options: U5, U6, U7, U8, U9, U10, U11, U12, U13, U14, U15, U16, U17, U18, Adult. Validation: required.
  - "Gender" — select. Placeholder option "Select gender". Options: "Male" (MALE), "Female" (FEMALE), "Co-ed" (COED). Optional.
  - "Season" — text, placeholder "Spring 2026". Optional.
  - "Description" — textarea, 3 rows, placeholder "Team description...". Optional.

### Card: Practice Days
- Copy: "Optional — leave empty if practice days are TBD. Families are only notified when you announce the schedule (from the team calendar, closer to the season)."
- Per-slot row (repeatable, up to 7): Day-of-week select (Sunday…Saturday), time input (`type="time"`, default "18:30"), duration select (60/75/90/105/120/150/180 "min", default 90), Location text input (placeholder "Location (optional)", maxLength 200), remove "×" button.
- Button: **"+ Add practice day"** (dashed border) — hidden once 7 slots exist. Default new slot: Tuesday (dayOfWeek 2), 18:30, 90 min, empty location.

### Card: Staff Assignment
- Copy: "Assign coaches and team managers. You can also invite people by email."
- Existing assignment/invite rows list with a remove "×" icon each; invites show "Pending invite" in amber and a dashed border.
- Role badge labels: "Head Coach", "Assistant Coach", "Team Manager" (via `getStaffRoleLabel`).
- "Add Existing Staff" sub-section:
  - Label: "Add Existing Staff"
  - Loading: "Loading staff..." Empty: "No available staff. Use the invite section below to add new staff."
  - Staff select — placeholder "Select a staff member"; option label `{name} ({currentRoles joined by ", "})`.
  - Role select — options "Head Coach" (disabled if a Head Coach is already assigned/invited), "Assistant Coach", "Team Manager". Default "Assistant Coach".
  - Button **"Add"** — disabled until a staff member is selected. Blocks duplicates ("This staff member is already assigned") and a second Head Coach ("Only one Head Coach is allowed per team").
- "Invite by Email" sub-section:
  - Label: "Invite by Email"
  - Email input — placeholder "staff@example.com" (Enter key also submits).
  - Role select — same three options, default "Assistant Coach".
  - Button **"Invite"** — disabled until email is non-empty. Validates email format ("Please enter a valid email address"), blocks duplicate invite ("This email is already in the invite list"), blocks already-assigned email ("This person is already assigned as staff"), and blocks a second Head Coach ("Only one Head Coach is allowed per team").
  - Helper: "The invited person will receive a notification and be assigned to this team once they accept."
- Buttons/actions (page footer):
  - **"Cancel"** → `router.back()`.
  - **"Create Team"** (disabled + "Creating..." while submitting) → `POST /api/teams` with `{name, ageGroup, tenantId, season?, description?, gender?, staff?, practiceSlots?}`. Staff assignments map to `{type: "assign", userId, role: "TeamManager"|"Staff", designation: "HeadCoach"|"AssistantCoach"|null}`; invites map to `{type: "invite", email, role, designation}`.
- Success state (replaces the whole form):
  - Green check icon, "Team Created!"
  - "**{name}** ({ageGroup}) has been created."
  - If staff assigned/invited: "{n} staff member(s) assigned/invited." (pluralizes "member"/"members")
  - Buttons: **"View Teams"** → `/clubs/{clubId}/teams`; **"Create Another Team"** (resets all local state, stays on page).
- Rules/behavior: only one Head Coach per team enforced client-side for both the assign and invite paths; practice slots and staff are entirely optional and omitted from the payload if empty.

---

## Club Staff — `/clubs/[id]/staff`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/staff/page.tsx`
- Layout: Stacked `Card` panels: "Invite staff" form, conditional "Staff requests" (incoming join requests), "Current staff" (grouped by user, club-level + team-level roles), conditional "Pending invitations" (outgoing).

### Panel: Invite staff
- Fields:
  - "Email" — `type="email"`, required, placeholder "staff@example.com".
  - "Role" — select. Options: "Staff — a coach or team member" (value `Staff`), "Manager — helps run the whole club" (value `ClubManager`). Default `Staff`.
  - "Message (optional)" — text, placeholder "We'd love you to join our staff!".
- Info callout (info icon): "**Staff** are the people you assign to teams — you'll choose their role (Head Coach, Assistant Coach, or Team Manager) when adding them to a team. **Managers** can help run the entire club: managing teams, tryouts, and staff."
- Button: **"Send Invite"** (icon = paper-plane), disabled + "Sending..." while inviting → `POST /api/clubs/{clubId}/staff`. Success banner: "Invitation sent to {email}". Error banner shows API error or generic fallback.

### Panel: Staff requests (only rendered when `requests.length > 0`)
- Header: "Staff requests" + count pill.
- Row copy: name (or invited email), "Wants to join as {role}" + optional ` — "{message}"`.
- Buttons per row: **"Accept"** → `PATCH /api/invitations/{id}` `{action:"accept", role}`; **"Decline"** (subtle) → same endpoint `{action:"decline"}`.

### Panel: Current staff
- Header: "Current staff" + count pill. Empty state: "No staff members yet."
- Per member row:
  - Name + club-role badge(s): `ClubOwner` → static `Badge tone="hoop"` "Owner"; otherwise an inline **select** styled as a pill for `Staff` ⟷ `ClubManager` (in-place role change, `PATCH .../staff` with `{roleId, role}`).
  - Email shown below name.
  - "Team Assignments" section label (uppercase, only if the member has team roles): pill-links per team = `{team.name} · {label}` where label is "Head Coach" / "Asst. Coach" / "Manager" / "Staff" (`getTeamRoleLabel`); links to `/clubs/{clubId}/teams/{teamId}/edit`. For plain "Staff" team-rows, an inline designation select appears with options "Staff" (blank), "Asst. Coach", "Head Coach" (`PATCH .../staff` with `{roleId, designation}`).
  - If the member has no team roles and isn't Owner/Manager: badge "Not assigned to any team".
  - **"Remove"** button (not shown for the Owner) — confirm dialog: "Remove {name} from staff? This removes ALL their roles at this club and its teams." → `DELETE /api/clubs/{clubId}/staff?userId={id}&all=1`.

### Panel: Pending invitations (only rendered when `sentInvites.length > 0`)
- Header: "Pending invitations" + count pill.
- Row: invited email + status badge (`toneForStatus`), "Invited as {role}" subline.
- Button: **"Revoke"** — confirm dialog "Revoke the invitation to {email}?" → `DELETE /api/invitations/{id}`.
- Rules/behavior: removing a staff member is all-roles-at-once (club + every team) by design, called out in the confirm copy; role/designation changes are in-place selects, no separate edit form.

---

## Create Tryout — `/clubs/[id]/tryouts/create`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/tryouts/create/page.tsx`
- Layout: `max-w-2xl`, back link, one `Card` with three `PanelHeader` sections ("Tryout details", "Schedule", "Fee & capacity") inside a single form, then Cancel/Create buttons. Success state replaces the card.
- Back link: "← Back to Tryouts" → `/clubs/{clubId}/tryouts`
- Header: "Create Tryout" / "Set up a tryout for your club. You can publish it to the marketplace after creation."

### Section: Tryout details
- Fields:
  - "Team" * — select, placeholder "Select a team"; options `{team.name} ({ageGroup} / {genderLabel})`. Loading: "Loading teams...". Empty state: "No teams found. **Create a team** first." (link → `/clubs/{clubId}/teams/create`). Preselected from `?teamId=` query param.
  - When a team is selected, two read-only badges appear: `Badge tone="play"` "Age group · {ageGroup}" and `Badge tone="play"` `{genderLabel}` (genderLabel: MALE→"Boys", FEMALE→"Girls", COED→"Co-ed", null→"Any").
  - "Title" * — text, placeholder "Spring 2026 U12 Boys Tryout". Validation: min 3, max 200.
  - "Description" — textarea, 3 rows, placeholder "What to expect, what to bring...". Optional.
  - "Location" * — text, placeholder "Main Gym, 123 Court Ave". Validation: min 3.

### Section: Schedule
- Fields:
  - "Date & Time" * — `type="datetime-local"`. Validation: required.
  - "Duration (minutes)" — number, placeholder "90". Optional.

### Section: Fee & capacity
- Fields:
  - "Fee ($)" * — number, min 0, step 0.01, placeholder "0.00". Default 0. Validation: ≥0.
  - "Max Participants" — number, min 1, placeholder "No limit". Optional.
  - "Public tryout (visible on marketplace when published)" — checkbox, default checked (`isPublic` defaults true).
  - Static note: "Tryouts are saved as drafts. You can publish them to the marketplace from the tryouts list."
- Buttons/actions:
  - **"Cancel"** (subtle) → `/clubs/{clubId}/tryouts`.
  - **"Create Tryout"** (disabled until a team is selected; "Creating..." while submitting) → `POST /api/tryouts` with `{title, description?, ageGroup (from team), location, scheduledAt (ISO), fee, isPublic, tenantId, teamId, gender? (from team), duration?, maxParticipants?}`.
- Success state:
  - Green check icon, "Tryout Created!"
  - "**{title}** has been created as a draft."
  - "You can publish it to the marketplace from the tryouts list."
  - Buttons: **"View Tryouts"** → `/clubs/{clubId}/tryouts`; **"Create Another Tryout"** (resets form + team selection).
- Rules/behavior: age group/gender are inherited from the selected team, not entered directly; tryouts always start as an unpublished draft regardless of the "Public" checkbox — publishing is a separate action on the list page.

---

## Tryouts List — `/clubs/[id]/tryouts`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/tryouts/page.tsx`, `tryouts-filter.tsx`, `publish-button.tsx`
- Layout: Header with "Tryouts" title + "Create Tryout" button. Filter pill row + team dropdown + search box (`TryoutsFilter`). Card list, one per tryout, each showing title/badges, date/location/age-group line, signup count, and action buttons.
- Header: "Tryouts" (H2) + **"Create Tryout"** button → `/clubs/{id}/tryouts/create`.
- Empty state (no tryouts at all): "No tryouts yet" / "Create a tryout and publish it to the marketplace so parents can sign up." + **"Create Your First Tryout"** button.
- Filter pills (`TryoutsFilter`), each `{label} ({count})`: "All", "Published", "Draft", "Needs Offer", "Past". Toggling re-navigates with `?status=`.
- Team dropdown: placeholder "All Teams", then team names. Search box: placeholder "Search tryouts...", submit button "Search".
- Filtered-empty state: "No tryouts match the current filters." + **"Clear filters"** button.
- Per-tryout card:
  - Title + status badge: `Badge tone="neutral"` "Past" (if past date) else `Badge tone="court"` "Published" or `Badge tone="hoop"` "Draft".
  - Team name pill (link → team dashboard) if a team is linked.
  - Detail line: formatted date "MMM d, yyyy 'at' h:mm a", location, age group.
  - Signup count: `{total}{ " / " + maxParticipants if set}` + "signups" label; if any need an offer: `({n} need(s) offer)` in red.
  - Buttons: **"Signups"** → `/clubs/{id}/tryouts/{id}/signups`; **"Edit"** → `/clubs/{id}/tryouts/{id}/edit`; **"Public listing"** → `/tryout/{id}`; **Publish/Unpublish** toggle (only if not past).
- Table columns: none (card list, not a table).
- Publish button (`publish-button.tsx`): label **"Publish"** (primary) when unpublished, **"Unpublish"** (subtle) when published; "..." while loading. → `POST /api/tryouts/{id}/publish` `{isPublished: !isPublished}`, then `router.refresh()`. On failure: `alert("Failed to update")`.
- Rules/behavior: "Past" badge overrides Published/Draft once `scheduledAt` has passed, and the Publish/Unpublish button disappears for past tryouts.

---

## Tryout Signups — `/clubs/[id]/tryouts/[tryoutId]/signups`
- Source files: `.../tryouts/[tryoutId]/signups/page.tsx`, `bulk-offer-button.tsx`, `make-offer-button.tsx`, `apps/web/src/components/offers/offer-composer.tsx`
- Layout: Back button, header (`{title} - Signups` + date/location/team badge), action row (Bulk-offer + Check-in buttons), then a table (desktop) / accordion cards (mobile, `sm:hidden`) of signups inside a `PanelHeader` banded card.
- Back button: **"Back to Tryouts"** → `/clubs/{id}/tryouts`.
- Header: "{tryout.title} - Signups"; subline: formatted date, location, `Badge tone="play"` team name if present.
- Action buttons (shown when signups exist):
  - **"Send Offers ({eligibleCount})"** (BulkOfferButton) — only rendered if the tryout has a linked team and there's at least one eligible signup.
  - **"Check-in ({checkedInCount}/{total})"** → `/clubs/{id}/tryouts/{tryoutId}/check-in`.
- Empty state: "No signups yet" / "Once parents sign up their children, they'll appear here."
- Panel header action text: `{n} signup(s)` + ` • {checkedInCount} checked in` if any.
- Table columns (desktop, `sm:hidden` mirrors as cards): "Player", "Parent", "Age / Gender", "Status", "Signed Up", "Action".
- Per-row content:
  - Player name + "✓ in" pill if checked in (tooltip: checked-in time).
  - Notes shown under player name if present.
  - Parent name + email (muted, smaller).
  - Age / Gender as `{age} / {gender}`.
  - Status badge: if an offer exists, `Badge tone={toneForStatus(offerStatus)}` "Offer {status lowercased}"; else `Badge tone={toneForStatus(status)}` `{status lowercased}`.
  - Signed-up date "MMM d, yyyy".
  - Action cell (`SignupAction`): if team + matched player + no offer yet → **"Make Offer"** button; if an offer exists → plain text "Offer {status lowercased}"; if team but no matched player profile → "No player profile matched"; else → "No team linked".
- Mobile accordion (`<details>`) shows the same fields as labeled rows: "Parent", "Age / Gender", "Signed up", "Notes" (if present), then the same `SignupAction`.
- Rules/behavior: signup rows with `status: CANCELLED` are excluded entirely from the fetch. "Signups" count includes non-cancelled only.

### Make Offer modal (`make-offer-button.tsx`)
- Trigger button: **"Make Offer"** (small, per-row).
- Modal header: "Make Offer" / "{playerName} → {teamName}".
- Body: `<OfferComposer>` (see shared component below), plus:
  - "Message (optional)" — textarea, 2 rows, placeholder "We'd love to have you on the team…".
  - "Expires in" — select, options 3/5/7/10/14 "days"; default 7.
- Buttons: **"Cancel"** (closes modal); **"Send Offer"** (disabled until ≥1 package + while submitting → "Sending…") → `POST /api/offers` `{teamId, playerId, tryoutSignupId, options: packagePayload(packages), message?, expiresAt}`.
- Success: replaces the button with "Offer sent!" (green text), page auto-refreshes after 1s.

### Bulk Offer modal (`bulk-offer-button.tsx`)
- Trigger button: **"Send Offers ({eligibleCount})"**.
- Modal header: "Send Offers — {teamName}" / "Compose the packages once; everyone you tick gets the same offer."
- Recipient checklist: each row = checkbox (pre-checked + enabled only if `eligible`) + player name; ineligible rows show muted status text ("Offer {status}", "Cancelled", "No player profile"). Helper: "{selected} of {eligibleCount} eligible selected".
- Body: `<OfferComposer>`, plus "Message (optional)" input (placeholder "Congrats — we'd love to have you!") and "Expires in" select (3/5/7/10/14 days, default 7).
- Buttons: **"Cancel"**; **"Send to {n} player(s)"** (disabled until packages + selection exist; "Sending…" while busy) → `POST /api/offers/bulk` `{teamId, signupIds, options, message?, expiresAt}`.
- Result panel: "{n} offer(s) sent"; if any skipped: "Skipped ({n}):" list of "{playerName} — {reason}"; **"Done"** button closes.

### Shared: Offer Composer (`offer-composer.tsx`)
Used by both Make Offer and Bulk Offer modals — builds 1-4 "package options" the family chooses between at accept time.
- Per-package card:
  - "Option {n}" pill + package name input (placeholder "Package name" for the first, "e.g. Returning Player" for subsequent), maxLength 60.
  - Remove "×" (only when >1 package).
  - "Fee $" number input (min 0, step 0.01).
  - "Installments" number input (min 1, max 12).
  - "Practices" number input (min 0).
  - Item checkboxes: "Uniform", "Tracksuit", "Shoes", "Basketball", "Bag".
  - Payment terms sub-section (border-top):
    - "Pay in full" checkbox (default checked).
    - "Payment plan (deposit + installments)" checkbox — toggling on with no existing terms auto-fills via `autofillPlan` (25% deposit + 3 monthly installments on the 1st of each of the next 3 months).
    - If plan enabled: "Deposit (due on accept) $" number input; **"Auto: 25% + 3 monthly"** link-button (re-runs `autofillPlan`); per-installment rows (`#{n}`, amount number input, date input, "×" remove); **"+ Add installment"** link-button.
    - Live validation line (`PlanSum`): "Deposit ${d} + installments ${i} = ${total}" + " ✓" if it matches the fee, else " (should equal fee ${fee})" in red.
- Add-package select: placeholder "+ Add a package (pick a template)…" (first) / "+ Add another option (e.g. Returning Player)…" (subsequent); lists the club's offer templates as `{name} — ${seasonFee}`, plus a "Blank package (no template)" option. Hidden once 4 packages exist.
- Footer note (only if >1 package): "The family picks ONE of these when they accept — sizes are only asked for what their chosen package includes."

---

## Tryout Check-in — `/clubs/[id]/tryouts/[tryoutId]/check-in`
- Source files: `.../check-in/page.tsx`, `check-in-list.tsx`
- Layout: Back button, header (`{title} — Check-in` + date/location/team line), a sticky progress card, optional search box, then a tap-to-toggle list of players.
- Back button: **"Back to Signups"** → `/clubs/{id}/tryouts/{tryoutId}/signups`.
- Header: "{title} — Check-in"; subline: formatted date " • " location " • " team name (if any).
- Sticky progress card: big number `{checkedInCount} / {total}` + "checked in" label, plus a filled progress bar.
- Search box (only shown when >7 signups): `type="search"`, placeholder "Search player or parent…".
- Empty state (no signups): "No signups for this tryout yet."
- No-match state (search yields nothing): `No players match "{query}".`
- Per-player row (tap the whole row to toggle): checkmark circle (filled green when checked in), player name, `{age} • {gender lowercased} • {parentName}` subline, right-aligned either the check-in time ("h:mm a", green) or "Tap to check in" (muted).
- Rules/behavior: toggling is optimistic (updates UI instantly, then calls `POST /api/tryouts/{tryoutId}/signups/{id}/check-in {checkedIn}`) and rolls back with an error banner on failure: "Couldn't update {playerName} — check your connection and try again." Rows disable individually (not globally) while their own request is pending.

---

## Offer Templates — `/clubs/[id]/offer-templates`
(Note: the team-scoped route `/clubs/[id]/teams/[teamId]/offer-templates/page.tsx` is a dead redirect — `redirect(/clubs/{id}/offer-templates)` — templates are club-wide, not per-team.)
- Source files: `apps/web/src/app/(platform)/clubs/[id]/offer-templates/page.tsx`, `template-form.tsx`, `template-card.tsx`
- Layout: Header + subhead (copy differs for admins vs. non-admins). Admins see an inline create form/button above a responsive grid of template cards (1/2/3 columns).
- Header: "Offer Templates"
- Subhead (admin): "Create reusable templates for sending offers to players. All teams in the club share these templates."
- Subhead (non-admin): "Templates created by club management for sending offers to players."
- Empty state (admin): "No templates yet" / "Create your first offer template above. Templates define the fee structure and included items for offers sent to players."
- Empty state (non-admin): "No templates yet" / "No templates have been created yet. Ask your club owner or manager to set up offer templates."

### Create form (`template-form.tsx`, admin-only)
- Collapsed state: button **"Create Template"** (plus icon).
- Expanded panel header: "New offer template".
- Fields:
  - "Template Name" * — text, placeholder "e.g. Competitive Package, Development Package", required.
  - "Season Fee ($)" — number, min 0, step 0.01. Default "0".
  - "Installments" — select. Options `{n === 1 ? "Full payment" : "{n} installments"}` for n in [1,2,3,4,6,12]. Default 1.
  - "Practice Sessions" — number, min 0. Default "0".
  - "Included Items" — 5 checkbox cards, each with a label + description: "Uniform"/"Shirt + Shorts", "Tracksuit"/"Jacket + Pants", "Shoes"/"Basketball shoes", "Basketball"/"Game ball", "Bag"/"Equipment bag".
- Buttons: **"Cancel"** (resets + collapses); **"Create Template"** (disabled + "Creating..." while submitting) → `POST /api/clubs/{clubId}/offer-templates`.
- Note: there is no season start/end date field on templates — only fee, installment count, practice-session count, and included-item checkboxes.

### Template card (`template-card.tsx`, view + inline edit)
- View mode: template name (H4), "Edit"/"Archive" buttons (admin only), rows "Season Fee" → formatted currency, "Payment" → "Full payment" or "{n} installments", "Practice Sessions" → count (only if >0), and an "Includes" badge row (only if any items are included) listing whichever of Uniform/Tracksuit/Shoes/Basketball/Bag are true.
- **"Archive"** button — confirm dialog: "Archive this template? Existing offers won't be affected." → `DELETE /api/clubs/{clubId}/offer-templates/{id}`.
- **"Edit"** button switches the card into an edit form with the same fields as the create form (abbreviated installment labels "Full"/"{n}x"), plus **"Cancel"**/**"Save"** ("Saving..." while submitting) → `PATCH /api/clubs/{clubId}/offer-templates/{id}`.

---

## Offers — `/clubs/[id]/offers`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/offers/page.tsx`, `offers-filter.tsx`, `rescind-button.tsx`
- Layout: Header + "Order Sheet" button (shown only if there are accepted offers). Row of 4-5 clickable stat tiles (status counts). Team filter dropdown. Active-filter chip row. Offers grouped into a card per team, each with a header (team name, counts, "Team Dashboard"/"View Roster" buttons) and a list of offer rows.
- Header: "Offers" / "Manage offers sent to players from tryouts"
- **"Order Sheet"** button (only if `acceptedCount > 0`) → `/clubs/{id}/offers/summary{?team=}`.
- Stat tiles (each clickable, toggles `?status=`): "Pending" (gold), "Accepted" (court), "Declined" (hoop), "Expired" (ink) — always shown; a 5th "Rescinded" tile (ink) only appears once `rescindedCount > 0`.
- Team filter: `OffersFilter` select, placeholder "All Teams".
- Active-filter row (only when a filter is set): "Filtered by:" + status badge (lowercased) and/or team-name pill, + **"Clear all"** link.
- Empty states:
  - No offers at all: "No offers yet" / "Go to a tryout's signups page to make offers to players." + **"View Tryouts"** button.
  - Filtered to nothing: "No matching offers" / "No offers match the current filters." + **"Clear filters"** link.
- Per-team group header: colored accent bar, team name (H3), "{n} offer(s) · {n} accepted"; buttons **"Team Dashboard"** (always) and **"View Roster"** (only if that team has ≥1 accepted offer) → `/clubs/{id}/teams/{teamId}/roster`.
- Per-offer row: player name; fee + `({n} installments)` if >1, in muted small text; if accepted and a uniform size is set: "Size: {uniformSize}" + jersey prefs "| Pref: #{p1}, #{p2}, #{p3}"; status badge (`toneForStatus`, lowercased text); **"Rescind"** button (only when status is PENDING); created date "MMM d".
- Table columns: none — this is a grouped list, not a `<table>`.
- **Rescind button** (`rescind-button.tsx`): confirm dialog "Withdraw the offer to {playerName}? The family will be notified and can no longer accept it." → `POST /api/offers/{id}/rescind`. Button label "Rescind" ("..." while busy).
- Rules/behavior: query is capped at the newest 500 offers per club (comment: "offers accumulate every season"). Rescind is only possible from PENDING.

---

## Order Sheet (Offers Summary) — `/clubs/[id]/offers/summary`
- Source files: `apps/web/src/app/(platform)/clubs/[id]/offers/summary/page.tsx`, `download-order-csv.tsx`, `summary-team-filter.tsx`, `apps/web/src/lib/offers/order-rollup.ts`
- Layout: Back link, header + team filter + CSV download button, a club-wide totals card (size breakdowns per item), then one card per team with a rollup chip row and a detail table.
- Back link: "← Back to Offers" → `/clubs/{id}/offers`.
- Header: "Order Sheet" / "Equipment to order from accepted offers — totals by size, per team. No forms, no spreadsheets."
- Team filter (`SummaryTeamFilter`): select, placeholder "All Teams".
- **"Download CSV"** button (only if offers exist) — CSV columns: "Team", "Player", "Jersey #", "Uniform", "Tracksuit", "Shoes", "Ball", "Bag"; filename `order-sheet-{slugified team-or-club name}.csv`.
- Empty state: "No accepted offers for {team}" or "No accepted offers yet" / "Once players accept their offers, sizes and totals will appear here automatically." + (if team-filtered) "Show all teams" link.
- Club/team totals card: "{Team} — Order Totals" or "Club Order Totals"; "{n} accepted offer(s)" (+ "across {n} teams" if unfiltered and multi-team). Size-block components per item ("Uniforms", "Tracksuits", "Shoes" — each lists totals by size + "Size TBD" row for missing sizes; "Basketballs"/"Bags" — plain counts, "One size" caption). If nothing is ordered at all: "No equipment is included in these offers — nothing to order." Missing-size warning banner: "Some accepted offers are missing sizes ("Size TBD") — check the player rows below before placing the order."
- Per-team card: team name, "{n} accepted offer(s)", **"Team Dashboard"** link, rollup chips e.g. "{n} uniform(s) ({size breakdown})", "{n} tracksuit(s) (...)", "{n} shoes (...)", "{n} ball(s)", "{n} bag(s)".
- Table columns: "Player", "Jersey #", "Fee", "Uniform", "Tracksuit", "Shoes", "Items", "Jersey Prefs".
- Row content: player name + gender/height/weight subline; jersey # badge (or "-"); fee + `({n}x)` if installments >1; uniform/tracksuit/shoe size badges (or "TBD" in amber if included-but-unsized, or "-" if not included); "Items" = "Ball, Bag" style join of includesBall/includesBag; "Jersey Prefs" = "#1, #2, #3" join or "-".

---

## Team Roster — `/clubs/[id]/teams/[teamId]/roster`
- Source files: `.../teams/[teamId]/roster/page.tsx`, `roster-manager.tsx`, `roster-row-actions.tsx`, `finalize-button.tsx`, `apps/web/src/components/withdrawal-requests-panel.tsx`
- Layout: Back link, header ("{team} - Roster" + age/gender/season line) with a conditional "Finalize Roster" button, a withdrawal-requests panel (collapsible, only if any pending), a collapsible "Add players manually" panel, the active-roster table, a "Released" section (if any), and a "Jersey Preferences" summary (if unfinalized offers remain).
- Back link: "← Back to Team Dashboard" → `/clubs/{id}/teams/{teamId}/dashboard`.
- Header: "{team.name} - Roster"; subline `{ageGroup}{" " + gender if set}{" - " + season if set}`.
- **"Finalize Roster"** button (`FinalizeButton`) — only shown if there are accepted offers AND at least one active player still lacks a jersey number.

### Withdrawal Requests panel (shared component, shown here for `teamId`)
- Only renders when there's ≥1 pending PLAYER_FROM_TEAM request for this team.
- Header: "Withdrawal requests" + count badge (`tone="warning"`).
- Copy: "These families are asking for a release from the roster. Approving frees the roster spot (history is kept)."
- Row: `{player} — release from {team}`; `"{reason}" — {requestedBy}, {date}`.
- Buttons: **"Approve"** / **"Decline"** (decline prompts `window.prompt("Add a note for the requester (optional):")`) → `PATCH /api/withdrawal-requests/{id}` `{action, note?}`.

### Add players manually (`roster-manager.tsx`, collapsible)
- Toggle header: "Add players manually" + badge "{n} invite(s) pending" if any; chevron ▴/▾.
- Tabs: **"Existing club player"** / **"Invite by email"**.
- Tab "Existing club player":
  - "Player (anyone already connected to your club)" — select, option label `{name}{" (" + birthYear + ")" if set}{" — on " + currentTeams.join(", ") if any}`; placeholder "Loading…" / "Choose player…".
  - "Jersey #" — number, min 0, max 99, placeholder "—".
  - Button **"Add to roster"** (disabled until a player chosen; "Adding…" while busy) → `POST /api/teams/{teamId}/players {playerId, jerseyNumber}`. Success message: "Player added to the roster."
- Tab "Invite by email":
  - "Parent email" — email, placeholder "parent@example.com".
  - "Player name (optional)" — text, placeholder "e.g. Marcus Chen".
  - "Offer package on acceptance (optional)" — select (only shown if templates exist), placeholder option "No package — roster spot only", then template names.
  - Message textarea, 2 rows, placeholder "Message to the family (optional)".
  - Button **"Send invitation"** (disabled until email contains "@"; "Sending…" while busy) → `POST /api/player-invitations {teamId, email, playerName?, templateId?, message?}`. Success message: "Invitation sent to {email}."
- Pending invitations list (if any): "Pending invitations" label, rows `{playerName + " — " if set}{email}` + **"Revoke"** link (confirm "Revoke this invitation?") → `DELETE /api/player-invitations/{id}`.

### Active roster table
- Empty state: "No players on roster" / "Players will appear here once they accept their offers."
- Table columns: "#", "Player", "Position", "Height / Weight", "Uniform", "Tracksuit", "Shoes", "Status", "Actions".
- Row content: jersey number pill (or "-"); player name (link → `/player/{id}`) + gender subline; position or "-"; `{height} / {weight} lbs` (each "-" if missing); uniform/tracksuit/shoe size (falls back from roster record to the accepted offer's size, else "-"); status badge — `Badge tone="court"` "Finalized" if jersey assigned, else `Badge tone="gold"` "Pending finalization".
- Row actions (`RosterRowActions`, active players): **"Edit #"** → inline jersey number input + "Save"/"✕"; PATCH `/api/teams/{teamId}/players/{playerId} {jerseyNumber}`. **"Release"** — confirm "Release {playerName} from this roster? Their history is kept; they can be re-added any time." → PATCH `{action: "release"}`.

### Released section (only if any released players)
- Header: "Released ({n})" + "Not on the active roster — reactivate to bring a player back."
- Row: player name (muted) + `Badge tone="neutral"` "Released" + **"Reactivate"** action (`RosterRowActions` with `status="INACTIVE"`) → PATCH `{action: "reactivate"}` (server may reject on jersey clash, shown via `alert`).

### Jersey Preferences summary (only if unfinalized accepted offers remain)
- Header: "Jersey Preferences (Accepted Offers)"
- Row: player name + "Prefs: #{p1}, #{p2}, #{p3}" (only numbers present are shown).

### Finalize Roster confirm modal (`finalize-button.tsx`)
- Trigger: **"Finalize Roster"**.
- Confirm modal: "Finalize {teamName} Roster?" / "This will assign jersey numbers based on player preferences (first-come, first-served) and expire all remaining pending offers." **"Cancel"** / **"Confirm & Finalize"** ("Finalizing..." while busy) → `POST /api/teams/{teamId}/finalize`.
- Result modal: "Roster Finalized!" — list of `{playerName}` + `#{jerseyNumber}` pill or "No preference available"; footer note: "All remaining pending offers have been expired. Page will refresh shortly." (auto-refreshes after 2s.)

---

## League Rosters — `/clubs/[id]/teams/[teamId]/league-rosters`
- Source files: `.../teams/[teamId]/league-rosters/page.tsx`, `league-roster-manager.tsx`, `apps/web/src/lib/seasons/roster-policy.ts` (`evaluateRosterEdit`)
- Layout: Back link, header ("{team} — League Rosters" + club-roster-size note) + "Add this team to a league" button, then one card per league/season submission that has a roster version, each with a band header (league/season/division), status/lock/policy meta line, and a read-only or editable roster table.
- Back link: "← Back to Team Dashboard" → `/clubs/{id}/teams/{teamId}/dashboard`.
- Header: "{team.name} — League Rosters"; subline: "Each league only sees the version you submitted to it — your club roster of {n} stays yours."
- Button: **"Add this team to a league"** → `/browse-leagues?team={teamId}`.
- Empty state: "No league submissions yet" / "Submit this team to a league and its roster version will appear here."

### Per-submission card (`LeagueRosterManager`)
- Band header title: `{leagueName} · {seasonLabel}` (+ ` · {divisionName}` if set).
- Header actions (conditional on editability + submission state):
  - **"Edit roster"** — only if `canEdit` and not already editing.
  - **"Request change"** — only if `canRequest`, no pending request, and not already requesting.
  - Withdrawal controls: if a withdrawal request is already pending → `Badge tone="warning"` "Withdrawal requested" + **"Cancel request"**; else if `submissionStatus === "PENDING"` → **"Withdraw from league"** (direct); else if `submissionStatus === "APPROVED"` → **"Request withdrawal"** (opens the reason box below, since an approved team needs league sign-off).
- Meta line: `Badge` "Withdrawn" (if withdrawn), lock dot-badge "Locked"/"Open", policy pill — `POLICY_LABEL`: "OPEN_UNTIL_DEADLINE" → "changes open until deadline", "REQUEST_ONLY" → "changes by league approval", "CLOSED" → "no changes after lock" (+ deadline date if set), "submitted {date}" if set, "{n} players".
- If not editable: shows `reason` text from `evaluateRosterEdit` in muted small text below the meta line.
- If a change request is pending: amber note "Change request pending with the league since {date}: "{message}"".

#### Request-withdrawal inline box (APPROVED submissions)
- Copy: "Request withdrawal from {leagueName}" / "Your team is approved for this season, so the league has to sign off. If approved, upcoming games are cancelled and opponents notified."
- Field: textarea, placeholder "Why is the team withdrawing? (required)", 2 rows.
- Buttons: **"Send request"** (disabled until reason ≥3 chars) → `POST /api/withdrawal-requests {type:"CLUB_FROM_LEAGUE", submissionId, reason}`; **"Never mind"** (cancels the box).
- Success toast text: "Withdrawal request sent — {leagueName} will review it."
- Cancel path: **"Cancel request"** → `PATCH /api/withdrawal-requests/{id} {action:"cancel"}`; success text: "Withdrawal request cancelled."

#### Direct withdraw (PENDING submissions)
- **"Withdraw from league"** button — confirm dialog: "Withdraws the team from the season — future games are cancelled and opponents notified." → `PATCH /api/seasons/{seasonId}/teams/{submissionId} {status:"WITHDRAWN"}`. Success text: "Withdrawn from {leagueName}" + " — {n} upcoming game(s) cancelled." if any were cancelled.

#### Request-change inline box (`canRequest`)
- Two checklists side by side:
  - "Remove from league roster ({n})" — checkboxes over the current league roster (or "Roster is empty.").
  - "Add from club roster ({n})" — checkboxes over club-roster players not already in this league version (or "Everyone on the club roster is already in this league.").
- "Note for the league (optional)" textarea, placeholder "e.g. Two call-ups from our Grade 8 squad after an injury", maxLength 2000.
- Helper: "Nothing changes until the league approves — approval applies these adds/removes to the locked roster."
- Buttons: **"Send request{ (+n / -n) if any}"** (disabled unless adds/removes exist or message ≥5 chars; "Sending…" while busy) → `POST /api/seasons/{seasonId}/submissions/{submissionId}/roster {message, additions[], removals[]}`; success text: "Request sent — the league will review it."; **"Cancel"**.

#### Edit-roster inline box (`canEdit`)
- Copy: "Pick this league's version from your club roster ({selected}/{total} selected)"
- Checklist of the full club roster (`#{jersey} {name}` + position if set).
- Buttons: **"Save version ({n} players)"** (disabled while busy or 0 selected; "Saving…") → `PATCH /api/seasons/{seasonId}/submissions/{submissionId}/roster {playerIds}`; success text: "Roster saved ({n} players)." (+ " — the roster is locked again." if `relocked`); **"Cancel"**.

### Read-only roster table (when neither editing nor requesting)
- Table columns: "#", "Player", "Position".
- Row content: jersey number or "—"; player name; position or "—".

Rules/behavior worth showing in a demo: this page makes the club/league roster-version split explicit — the same club roster can have a different, independently editable "version" per league submission, gated by each season's `rosterChangePolicy` (OPEN_UNTIL_DEADLINE / REQUEST_ONLY / CLOSED) and lock state; withdrawing an APPROVED team requires league sign-off via the withdrawal-request flow, while a still-PENDING submission can be withdrawn directly by the club.

---

## Screens named in the brief that were NOT separately found
- The tryout **create** page (`tryouts/create`) is the only creation form — there is no separate "edit" screen covered here (an `edit/page.tsx` exists at `tryouts/[tryoutId]/edit/page.tsx` but was outside the requested list).
- The offer-templates screen requested at the **team** path (`clubs/[id]/teams/[teamId]/offer-templates/page.tsx`) is a redirect stub only — the real, fully-featured screen lives at the **club** level (`clubs/[id]/offer-templates/page.tsx`), documented above. There is no team-scoped template UI; templates are shared club-wide.
- No season start/end date fields exist anywhere in the offer-template or offer-composer models — templates/packages are defined by fee + installment count + practice-session count + included items only (confirmed by reading `template-form.tsx`, `template-card.tsx`, and `offer-composer.tsx` in full).
