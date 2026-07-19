# Parent-Facing Screens — Verbatim Inventory

Source repo: `apps/web/src/app`. All strings below are quoted verbatim from source. Computed-text templates are shown as `${...}` with the exact literal surrounding text preserved.

---

## Programs & Tryouts Marketplace — `/events`
- Source files: `apps/web/src/app/(public)/events/page.tsx`, `apps/web/src/app/(public)/events/events-browser.tsx`, `apps/web/src/lib/queries/programs.ts`
- Layout: Server-rendered header (h1 + subtitle) above a client-side browser. The browser renders a filter-pill row + search box, then a responsive grid of program cards (`grid-cols-1` → `md:grid-cols-2` → `lg:grid-cols-3`). Each card has a 2px color strip (club brand color) on top, then a type badge row, title, club name, date/location/age-group meta lines, and a price footer. This is the SEO aggregate page — also feeds the native app's Browse → Programs screen via the same `getAllPrograms()` query.
- Fields:
  - "Search by name, club, or location..." — text input, filters client-side once 2+ characters typed (matches event name, club name, or location, case-insensitive)
  - Filter pills (buttons, not a form control): "All", "Tryouts", "House Leagues", "Camps", "Tournaments" — selected pill gets `bg-play-600 text-white`
- Buttons/actions:
  - Each card is a `Link` to the program's detail page (`/tryout/{id}`, `/house-league/{id}`, `/camp/{id}`, `/tournament/{id}`) — no in-place action, navigates away
- Status/badge strings:
  - Type badge label per card: "Tryout", "House League", "Camp", "Tournament"
  - Tournament only, when `status === "REGISTRATION"`: `<Badge tone="court" dot>Open for teams</Badge>`
  - Tournament only, when `status === "IN_PROGRESS"`: `<Badge tone="live" dot>Underway</Badge>`
  - Top-right of each card, `spotsInfo` (computed, no label prefix):
    - Tryout: `` `${signupCount}${maxParticipants ? `/${maxParticipants}` : ""} signed up` ``
    - House league: `` `${signupCount}${maxParticipants ? `/${maxParticipants}` : ""} registered` ``
    - Camp: `` `${signupCount}${maxParticipants ? `/${maxParticipants}` : ""} registered` ``
    - Tournament: `` `${teamCount} team${teamCount !== 1 ? "s" : ""} registered` ``
- Empty state: heading "No programs found", body "Try adjusting your filters or search terms." (dashed-border card)
- Rules/behavior worth showing in a demo:
  - Page heading: "Find Programs & Tryouts"; subtitle: "Browse tryouts, house leagues, camps, and tournaments to find the right fit for your player."
  - Fee display: `"FREE"` if fee is 0, else `formatCurrency(fee, currency)` (e.g. "$45.00"); tournaments append a small `feeUnit` suffix — "per team" — next to the price when fee ≠ 0
  - Extra meta line per type: house league → `` `${daysOfWeek} ${startTime}-${endTime}` ``; camp → `` `${TYPE_LABELS[campType]} • ${numberOfWeeks} week${s}` `` (TYPE_LABELS: MARCH_BREAK→"March Break", HOLIDAY→"Holiday", SUMMER→"Summer", WEEKLY→"Weekly"); tournament → `` `${gamesGuaranteed} games guaranteed` ``
  - Date line: `MMM d, yyyy` and, if an end date exists, ` - ${end date}`
  - Age/gender line: `` `${ageGroup}${gender ? ` • ${gender}` : ""}` `` (only rendered if either is present)
  - All four program types (tryouts, house leagues, camps, tournaments) are aggregated and date-sorted together — single source shared with the native app's Browse endpoint

---

## Public Club Page — Programs section — `/club/[slug]#programs`
- Source files: `apps/web/src/app/(public)/club/[slug]/page.tsx`, `apps/web/src/app/(public)/club/[slug]/club-blocks.tsx` (scope limited to the "Open programs" block + the hero's program CTA, per task instructions — About/Teams/Schedule/News/Reviews/Contact blocks on this same page are out of scope here)
- Layout: Full club profile page with a colored hero (banner image, logo, club name, tagline, city/state, quick-stats strip) and a sticky sub-nav (`About / Teams / Programs / Schedule / Contact` — only tabs whose block is visible in the layout config appear; tabs never disappear just because a section is empty). Below the hero, a 2-col desktop grid (`lg:grid-cols-3`, main zone spans 2 cols) with the Programs block typically in the main zone. On mobile everything stacks to a single column. The Programs block itself is a soft brand-tinted rounded card containing a 2-col grid (`sm:grid-cols-2`) of individual program rows.
- Fields: none (browse-only; each row is a link to the program detail page)
- Buttons/actions:
  - Hero "View programs" button (gold pill, only rendered `hasBlockContent("programs", data)`) — anchors to `#programs`
  - Each `ProgramRow` is a `Link` to `/tryout/{id}`, `/house-league/{id}`, `/camp/{id}`, or `/tournament/{id}`
- Status/badge strings:
  - Section header: "Open programs" with a count badge (total across tryouts + house leagues + camps + tournaments)
  - Per-row tag chip: "Tryout", "House league", "Camp", "Tournament" (note: sentence case "House league" here, vs Title Case "House League" on `/events`)
  - Per-row status chip: "Registering" (court dot) by default; "Underway" (live dot, pulsing) only for tournaments with `status === "IN_PROGRESS"`
  - Per-row CTA text (bottom-right, with arrow icon): "Register" by default; "View" if the tournament is `IN_PROGRESS`
- Empty state: "Nothing is open for registration right now — check back soon, or follow the club to hear when signups open."
- Rules/behavior worth showing in a demo:
  - Row meta line per type:
    - Tryout: `` `${MMM d, yyyy} · ${location}` ``
    - House league: `` `${ageGroups}${season ? ` · ${season}` : ""} · ${location}` ``
    - Camp: `` `${ageGroup} · ${numberOfWeeks} week${s} · ${location}` ``
    - Tournament: `` `${MMM d} – ${MMM d, yyyy} · ${city, state}` ``
  - Row price: `"FREE"` (green) or `formatCurrency`; camp shows `` `${formatCurrency(weeklyFee)}/wk` ``; tournament shows `` `${formatCurrency(teamFee)}/team` ``
  - Hero quick-stats strip includes: value = team count, label "Team"/"Teams"; value = program count, label "Open programs"; value = next game date (`MMM d`) or "—", label "Next game"; value = average rating (1 decimal) or staff count, label "Rating" or "Staff"
  - If the club is `UNCLAIMED`, the hero shows "Claim this club" instead of the Follow button

---

## Public Tryout Details — `/tryout/[id]`
- Source files: `apps/web/src/app/(public)/tryout/[id]/page.tsx`
- Layout: Colored club-brand header bar with a back link and club name, then a 3-col grid (`lg:grid-cols-3`) — main content card (2 cols) with badges/title/description/detail tiles, and a sidebar (1 col) with the fee + a CTA card, plus a small "View {club} Profile" card underneath. Single-column stack on mobile.
- Fields: none — this is the signed-out/browse view (no signup form; the form lives at the signed-in `/tryouts/[id]` route)
- Buttons/actions:
  - "← Back to Marketplace" — link to `/events`
  - Club name — link to `/club/{slug}`
  - If signed in (`session` present) and open: "Sign Up Now" — link to `/tryouts/{id}` (the signed-in flow)
  - If signed out and open: "Sign In to Sign Up" — link to `/sign-in?callbackUrl=/tryouts/{id}`
  - "View {tryout.tenant.name} Profile →" — link to `/club/{slug}`
- Status/badge strings:
  - "Closed" (neutral tone) — shown when `isPast`
  - "Full" (danger tone) — shown when `isFull && !isPast`
  - "Open" (court tone) — shown otherwise
- Empty/blocked states (sidebar CTA area):
  - Past: "This tryout has already taken place."
  - Full: "This tryout is full."
  - Signed out: "Sign in to register your player for this tryout."
- Rules/behavior worth showing in a demo:
  - Detail tiles: "Date & Time" (`EEEE, MMMM d, yyyy` + `h:mm a`, plus `` ` (${duration} min)` `` if set), "Location", "Age Group & Gender" (`` `${ageGroup}${gender ? ` • ${gender}` : ""}` ``), "Spots" (`` `${signupCount} signed up` `` + `` ` (${spotsLeft} spot${s} left)` `` if capacity is set)
  - Fee: "FREE" or `formatCurrency`; caption "per player" shown only if fee > 0
  - `isFull` is computed from `maxParticipants !== null && signupCount >= maxParticipants` — an uncapped tryout (`maxParticipants` null) can never show Full

---

## Signed-In Tryout Signup — `/tryouts/[id]`
- Source files: `apps/web/src/app/(platform)/tryouts/[id]/page.tsx`, `apps/web/src/app/(platform)/tryouts/[id]/signup-form.tsx`, `apps/web/src/lib/validations/tryout-signup.ts`
- Layout: Same club-brand header + 3-col grid pattern as the public tryout page, but styled with the reveal/animation kit (`reveal`, staggered `InfoTile`s with icons) and a sticky sidebar card (`lg:sticky lg:top-6`) that hosts the live `SignupForm`. This is the actual purchase/registration entry point for signed-in parents.
- Fields (inside `SignupForm`, only rendered once the parent has at least one non-signed-up player):
  - "Select Player *" — `<select>` id `playerId`; default option "Choose a player...", then one option per available player (`{firstName} {lastName}`); zod: `playerId: z.string().uuid("Select a player")` — error text "Select a player"
  - "Notes (optional)" — `<textarea>` id `notes`, rows 3, placeholder "Any additional info for the club..."; zod: `z.string().max(500).optional()`
  - Checkbox: "Email me about future programs from this club" (`marketingConsent`, plain local state, merged into the POST body outside react-hook-form)
- Buttons/actions:
  - Submit button: "Signing up..." while submitting; else "Sign Up (Free)" if `tryoutFee === 0`, else `` `Sign Up (${formatCurrency(fee, currency)})` ``. POSTs to `/api/tryouts/{id}/signup`.
  - "Add a Player" button (when the parent has zero players) → `/players/add?redirect=/tryouts/{id}`
  - "View in Dashboard →" link → `/dashboard` (post-success)
  - Sign-in gate (no session): Button "Sign In to Sign Up" → `/sign-in?callbackUrl=/tryouts/{id}`
- Status/badge strings: same as the public page — "Closed" (neutral), "Full" (danger, dot), "Open" (court, dot)
- Empty/blocked states:
  - Past: "This tryout has already taken place."
  - Full: "This tryout is full. Check back for future openings." (note: wording differs slightly from the public page's "This tryout is full.")
  - No players on the account: heading "Add a Player First", body "You need to add a player before signing up for a tryout."
  - All players already signed up (and at least one player exists): heading "Already Signed Up", body "All your players are already signed up for this tryout." — followed by a list of `{playerName}` with their status text (colored green if `CONFIRMED`, yellow otherwise)
- Success confirmation (verbatim):
  - Heading: "You're confirmed!" if `status === "CONFIRMED"`, else "Signup registered!"
  - Body if confirmed: `` `{playerName} is confirmed for this tryout. See you at {tryoutLocation} on {tryoutDate}.` `` (playerName bold)
  - Body if not confirmed (fee > 0, no payment processed yet): `` `{playerName} has been registered. Payment of {formatCurrency(fee)} will be required when payment processing is available.` `` — **no Stripe/payment collection is wired into tryout signup**; it is fee-notice only
- Rules/behavior worth showing in a demo:
  - If the parent has some players already signed up but others available, a small "Already signed up:" summary strip (`{playerName} ({status})`) shows above the form
  - Fee note shown above the checkbox when `tryoutFee > 0`: "This tryout requires a {formatCurrency(fee)} fee. Payment processing will be available soon. Your signup will be marked as pending until payment is completed."
  - Detail tiles identical to the public page but with an `AnimatedNumber` for the live signup count

---

## Add a Player — `/players/add`
- Source files: `apps/web/src/app/(platform)/players/add/page.tsx`, `apps/web/src/lib/validations/tryout-signup.ts` (`addPlayerSchema`)
- Layout: Centered single-column card (`max-w-xl`) with a back link, heading, and a form; success state replaces the whole card with a confirmation panel and two buttons. Reached from the Players page ("Add Player"/"Add your first player") and from the tryout signup form's "Add a Player First" prompt (`?redirect=` param controls where Cancel/View-My-Players return to).
- Fields:
  - "First Name *" — text, placeholder "First name"; zod: required, max 50, error "First name is required"
  - "Last Name *" — text, placeholder "Last name"; zod: required, max 50, error "Last name is required"
  - "Date of Birth *" — `type="date"`; zod: must parse to a valid date in the past, error "Enter a valid date of birth"
  - "Gender *" — select; default "Select gender"; options "Male" (`MALE`), "Female" (`FEMALE`), "Other" (`COED`); zod enum, error via `required_error` "Select a gender"
  - "Jersey Number (optional)" — text, placeholder "e.g. 23"; zod: max 10, optional
  - "Height (optional)" — text, placeholder `` `e.g. 5'6"` ``; zod: max 10, optional
  - "Weight (lbs) (optional)" — number, placeholder "e.g. 120"; zod: coerced number 1–500, optional
  - "Position (optional)" — select; default "Select position"; options "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"; zod: max 50, optional
  - COPPA consent (only rendered if computed age < 13): checkbox "I am the parent or legal guardian and I consent to registering this child." above copy: "This child is under 13. Federal law (COPPA) requires a parent or guardian to give explicit consent before we can collect or store their information." (`parentalConsentGiven`, optional in schema but the Submit button is disabled client-side until checked for minors)
- Buttons/actions:
  - "Cancel" → back to `redirectTo` or `/players`
  - Submit: "Adding..." while submitting, else "Add Player"; disabled while submitting or (`isMinor && !consent`); POSTs to `/api/players`
  - Success panel: "View My Players" → `redirectTo` or `/players`; "Add Another Player" → resets the form in place
- Status/badge strings: none
- Empty states: n/a (form screen)
- Success copy (verbatim): heading "Player Added!", body `` `{firstName} {lastName} has been registered.` `` (name bold)

---

## My Offers — `/offers`
- Source files: `apps/web/src/app/(platform)/offers/page.tsx`, `apps/web/src/app/(platform)/offers/offer-response-form.tsx`
- Layout: Header card (eyebrow pill "Offers", h1, subtitle), then a "Pending" section and a "Past Offers" section, each a vertical stack of cards. Pending cards can expand in place to an Accept form (`OfferResponseForm`) or a Decline confirmation — no navigation away, no modal (except the new-card Stripe modal inside the accept flow). Fetches `/api/offers?mine=true` client-side on mount.
- Fields: none directly on the list page. Inside `OfferResponseForm` (Accept flow):
  - "Choose your package *" — radio group, one per `OfferPackage` option (only shown if the club sent multiple packages); each option row shows label, price, and "Includes {items}" or "No gear included"
  - "Uniform Size *" — select, default "Select...", options from `CLOTHING_SIZES`: "Youth Small" (YS), "Youth Medium" (YM), "Youth Large" (YL), "Adult Small" (AS), "Adult Medium" (AM), "Adult Large" (AL), "Adult XL" (AXL) — only if the chosen package includes a uniform
  - "Tracksuit Size *" — same `CLOTHING_SIZES` list — only if package includes a tracksuit
  - "Shoe Size *" — select, default "Select...", options from `SHOE_SIZES`: 4, 4.5, 5, 5.5 … up to 13 (half-sizes) — only if package includes shoes
  - "Jersey Number Preferences *" — three number inputs (min 0, max 99, placeholder "#"), sub-labeled "1st Choice", "2nd Choice", "3rd Choice"
  - Payment plan radios (only if the club takes online payment and a fee is owed):
    - "Pay in full — **{formatCurrency(fee)}** now"
    - "Payment plan — **{depositAmount}** deposit now, then {installments joined, each as `{amount} on {MMM d}`}" with caption "Auto-charged to your card on file." (only if the option `allowInstallments` and has a deposit)
  - Saved card selector: radio per saved card `` `{brand} •••• {last4}` `` + " (default)" suffix for the default card; link "Use a different card" / "Use a saved card" toggle
- Buttons/actions:
  - "Accept Offer" (court tone) — opens the accept form inline
  - "Decline" (secondary/hoop tone) — opens the decline confirm inline
  - Decline confirm: "Confirm Decline" ("Declining..." while busy) / "Cancel" — PATCHes `/api/offers/{id}` with `{action: "decline"}`
  - Accept form submit button label logic: "Processing…" while submitting; `` `Pay ${amountDue} & Accept` `` if payment needed and a card is already selected; "Add card & Accept" if payment needed and no card on file (or "use a new card" chosen); "Confirm & Accept" if no payment is due — PATCHes `/api/offers/{id}` with `{action: "accept", ...}` after any Stripe step completes
  - Accept form "Cancel" — closes the inline form
  - New-card Stripe modal (only if a new card must be entered): heading `` `Pay {amountLabel}` ``, caption "Your card is saved securely by Stripe for future payments.", Stripe `PaymentElement`, buttons "Cancel" / "Pay & Accept" ("Paying…" while paying)
- Status/badge strings:
  - Pending section heading: `` `Pending (${count})` ``
  - Past section heading: `` `Past Offers (${count})` ``
  - Expired pending offer: `<Badge tone={toneForStatus("EXPIRED")}>Expired</Badge>` in place of Accept/Decline buttons
  - Past offer status badge: lowercased status text (e.g. "accepted", "declined", "expired") except `RESCINDED` which renders as "withdrawn by club"
- Empty state: heading "No offers yet", body "When a club sends an offer for one of your players, it will appear here."
- Rules/behavior worth showing in a demo (offer contents):
  - Multi-package pending offer price area: `` `from {min(seasonFee across options)}` `` + `` `{count} package options` ``; single/chosen-option price area: `formatCurrency(seasonFee)` + chosen package label (if any) + `` `{installments} installments` `` (if `installments > 1`)
  - "Your package choices:" box (multi-option, unchosen): per option, `` `{label} — {formatCurrency(seasonFee)} · {items joined}` `` or `` ` · no gear` `` if none
  - "What's included:" box (single/chosen option): pill chips — `` `{practiceSessions} practice sessions` `` (if > 0), "Uniform (Shirt + Shorts)", "Tracksuit", "Shoes", "Basketball", "Bag" (each only if included)
  - Club message, if present: rendered as a quoted italic block: `` `"{offer.message}"` ``
  - Footer line: `` `Received {MMM d, yyyy}` `` and either `` `Expires {MMM d, yyyy}` `` or the "Expired" badge
  - Past/accepted offer detail line: `` `Uniform: {size}` ``, `` ` | Tracksuit: {size}` ``, `` ` | Shoes: {size}` ``, `` ` | Jersey prefs: #{p1}, #{p2}, #{p3}` `` (each segment only if present)
  - Validation messages in the accept form: "Please choose a package first", "Please select a uniform size", "Please select a shoe size", "Please select a tracksuit size", "Please enter at least your first jersey number preference", "Jersey numbers must be between 0 and 99", "Jersey number preferences must be different"
  - Offline-paying club note (no online payment configured, fee > 0): "This club collects payment offline — accepting reserves the spot; the club will arrange your {formatCurrency(fee)} fee."
  - "Due now: **{formatCurrency(amountDue)}**" line always shown under the online-payment block

---

## My Payments — `/payments`
- Source files: `apps/web/src/app/(platform)/payments/page.tsx`, `apps/web/src/components/payments/obligations-table.tsx`, `apps/web/src/components/payments/pay-online.tsx`, `apps/web/src/components/payments/types.ts`, `apps/web/src/lib/payments/queries.ts`
- Layout: Header card (eyebrow "Payments", h1, dynamic subtitle), then — only if the parent has any installment-based payments — a "Payment plan" panel listing each deposit/installment as a row, then the full `ObligationsTable` (filterable list/table of every obligation, expandable per row to show individual payment records), then a closing help note. Server component (`dynamic = "force-dynamic"`).
- Fields:
  - Filter pills on the obligations table: "All", "Open", plus one per status present via `OBLIGATION_STATUS_STYLE` labels ("Paid", "Waived", "Cancelled", "Partially paid", "Owed", "Refunded")
- Buttons/actions:
  - "Manage cards →" link → `/settings/payments`
  - "Pay online" button (payer view, only on open obligations where `payOnline` is true) — POSTs `/api/obligations/{id}/checkout`, opens a Stripe `PaymentElement` modal; button reads "Starting…" while the checkout session is being created
  - Modal: heading `` `Pay {formatCurrency(amount)}` ``, buttons "Cancel" / `` `Pay {formatCurrency(amount)}` `` ("Processing…" while paying)
  - Payee name in the "To" column links to `payeeHref` (`/club/{slug}` or `/league/hub/{id}`)
- Status/badge strings:
  - Page subtitle: "You're all settled up." if there are no open items; else `` `{n} open item${s} — {formatCurrency(owing)} outstanding.` ``
  - Installment row status badges (`STATUS_LABEL` map): `SUCCEEDED` → "Paid" (court), `PENDING` → "Upcoming" (neutral), `PROCESSING` → "Processing" (play), `FAILED` → "Failed — retrying" (danger)
  - Obligation status badges (`OBLIGATION_STATUS_STYLE`): `PENDING` → "Owed", `PARTIALLY_PAID` → "Partially paid", `PAID` → "Paid", `WAIVED` → "Waived", `CANCELLED` → "Cancelled", `REFUNDED` → "Refunded"
  - Obligation type tag (`TYPE_LABEL`, shown next to each "For" description): `TryoutSignup` → "Tryout fee", `Offer` → "Season fee", `CampSignup` → "Camp", `HouseLeagueSignup` → "House league", `TeamSubmission` → "Team fee"
  - Payment success toast in modal: "✓ Payment received" / "Updating your balance…"
- Empty states:
  - No installment plan section rendered at all if there are none
  - `ObligationsTable` with zero obligations: "No payments here yet."
  - Expanded row with zero payments recorded: "No payments recorded yet." — if payer view and the payee also accepts offline methods, appended: `` ` This organization also accepts: {methods joined} — pay them directly and they'll record it here.` ``
- Rules/behavior worth showing in a demo:
  - Installment row label: "Deposit" if `installmentNumber === 1`, else `description` or `` `Installment {n}` ``; due date shown as `{month day, year}` or "Paid at signup" if no due date
  - Installments are sorted PENDING/unpaid first, then PAID (owner rule: "money that needs action sorts first")
  - Footer copy under the plan panel: "Scheduled payments charge automatically to your default card. Update it any time under Manage cards."
  - Expanded payment row detail (per historical payment): `` `{MMM d, yyyy} · {method label}` `` + optional `` ` · recorded by {first} {last}` `` + optional `` ` · "{note}"` ``; amount shown with `` ` (refunded {amount})` `` if partially/fully refunded, `` ` · processing` `` if PENDING, `` ` · failed` `` if FAILED
  - Bottom-of-page note: "Need a refund or a correction? Contact the club or league directly — they manage payments on their side."

---

## My Players — `/players`
- Source files: `apps/web/src/app/(platform)/players/page.tsx`, `apps/web/src/app/(platform)/players/remove-player-button.tsx`
- Layout: Header card (eyebrow "Players", h1, subtitle, "Add Player" button), then a responsive grid (`lg:grid-cols-2`) of player cards. Each card has a name/age/gender header row with Stats/Edit/Remove actions, and below a divider, a list of the player's current teams (or an empty note). Client component; fetches `/api/players` on mount.
- Fields: none (browse/management list; adding happens on `/players/add`)
- Buttons/actions:
  - "Add Player" (header) → `/players/add`
  - "Add your first player" (empty state) → `/players/add`
  - "Stats" link (per player) → `/player/{id}`
  - "Edit" link (per player) → `/players/{id}/edit`
  - Remove (trash icon button, `aria-label="Remove {playerName}"`) — opens a confirm dialog (see below)
  - Team row link (per team) → `/team/{id}`
- Status/badge strings:
  - Per-player pill badges: `` `Age {age}` ``, `{gender}` (raw gender string)
  - Per-team-row jersey suffix: `` `#{jerseyNumber}` `` (only if set)
- Empty states:
  - No players: heading "No players yet", body "Add a player profile to start signing up for tryouts, camps, and team programs."
  - Player with no teams: "Not on a team yet — accepted offers place players on their team automatically."
  - Fetch error: "Failed to load players"
- Rules/behavior worth showing in a demo (Remove-player dialog, `remove-player-button.tsx`):
  - If the player is **not** on an active roster: dialog title `` `Remove {playerName}?` ``, body "Pending offers are declined and upcoming tryout signups cancelled. This can't be undone here." Buttons: "Cancel" / "Remove player" ("Working..." while removing). DELETEs `/api/players/{id}` directly.
  - If the DELETE fails because the player is on an active team roster (`code === "ACTIVE_ROSTER"`), the dialog flips into a **release request** mode instead of a hard delete: title `` `Request release from {teamName}?` ``, body `` `{playerName} is on {teamName}'s active roster, so leaving needs the club's sign-off. Tell them why and they'll review it.` ``, a required textarea placeholder "Why is your child leaving the team? (required)", and buttons "Cancel" / "Send release request" ("Working..." while sending; disabled until the reason is ≥3 characters). POSTs `/api/withdrawal-requests` with `{type: "PLAYER_FROM_TEAM", playerId, teamId, reason}`.
  - After a release request is sent: confirmation copy `` `Release request sent — {teamName} will review it and you'll be notified of their decision.` ``, button changes to "Close"
  - Team row subtitle: `` `{tenantName} · {ageGroup}` `` + `` ` · joined {month year}` `` if `joinedAt` is set

---

## Summary

Covered all eight requested screens/flows end-to-end, including every client component and zod schema they import: `/events` (marketplace aggregate + `EventsBrowser` + `getAllPrograms()`), `/club/[slug]` Programs block (`club-blocks.tsx` `ProgramsBlock`/`ProgramRow`, plus the hero's "View programs"/"Claim this club" CTAs for context), `/tryout/[id]` (public, signed-out browse view), `/tryouts/[id]` (signed-in flow, full `SignupForm` + `tryoutSignupSchema`), `/offers` (list + full `OfferResponseForm` accept flow including package choice, uniform/shoe/tracksuit sizing, jersey number preferences, payment-plan choice, saved-card vs. new-card Stripe `PaymentElement`), `/payments` (installment plan panel + `ObligationsTable` + `PayOnlineButton`/Stripe modal + `queries.ts` obligation shaping), and `/players` (list + `RemovePlayerButton`'s release-request flow). Also transcribed `/players/add` (the "Add a Player" form, including the COPPA under-13 consent gate) since both the tryout signup form and the players list route into it and it is core to completing the parent journey — this file was not on the original list but was reached via direct links from the requested pages.

Not found / not applicable: no separate zod schema file exists for offers (the accept-flow's client-side `validate()` function in `offer-response-form.tsx` does manual field checks rather than a shared zod schema — this is documented under the Offers section's validation messages). `players/[id]/edit/page.tsx` exists but is only reachable via a plain `<Link>` (not an import) from `/players`, so per the "follow imports" instruction it was left untranscribed.
