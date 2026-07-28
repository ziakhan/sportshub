# Tester Wishlist — Jacob's Session (2026-07-28)

> Suggestions and improvements raised during Jacob's testing Q&A session, discussed and refined with Claude.
> Bugs/defects found during testing belong in `qa-triage-2026-07-23.md` (or a follow-up triage doc), not here.
> Status meanings: **Agreed** = both aligned, ready for dev consideration · **Countered** = original idea revised, final form recorded · **Open** = still under discussion.

## Executive summary (session closed 2026-07-28)
**24 wishlist items (W-001–W-024) · 4 defects (D-001–D-004).** Reports were native-app-first; every item was cross-checked against web and carries a platform scope (see Session Notes platform map).

**Start here (highest impact):**
- **W-017** — native app has NO way to add a player (any account type, incl. 13+ self-registration), and registration copy points to a flow that doesn't exist. Breaks the money path for app-first users. *High priority.*
- **W-006 + D-002** — one navigation-architecture bug, four verified symptoms (back-strands from feed/scores, stale team history, Browse tab resuming stale game). Fix together.
- **D-004** — web calendar hides a referee's entire schedule behind a wrong "No teams yet" gate (one-line condition fix).
- **D-003** — keyboard fully covers inputs on the create-event form (proven fix exists in the chat screen; sweep all forms).
**Quick wins (tiny/small):** W-009 (pill casing, one component), W-011 (team-name dedup), W-016 (sign-in landing), W-001 (web stat-label casing), W-020 (location-icon convention).
**Owner decisions required before work starts:** W-015 (native scoring access), W-019 (native program creation; league creation open), W-023 (club creation), W-024 (operator game-day console) — each amends a documented design rule; W-014 waits on the object-storage decision.

## How to read this doc
Each item records: the original suggestion, the discussion outcome, and a concrete recommendation for developers.

---

## Wishlist Items

### W-001 · Box score rebound abbreviations → all-caps OREB / DREB (and unify all stat-label casing) · **Agreed**
- **Jacob's suggestion:** Rebounds are shown as `Oreb`/`Dreb` — either fully capitalize them or shorten to `OR`/`DR`.
- **Discussion:** Full caps wins. OREB/DREB is the NBA/ESPN standard, so parents recognize it; OR/DR is scorekeeper shorthand that reads badly inline (`OR` = the word "or", `DR` = "doctor") and space isn't tight where these appear (leaders sub-line, not a table column). Investigation also showed three casing styles coexist today: all-caps `PTS/REB/AST` units on leader cards, mixed-case `DReb · OReb` in the sub-line of the *same* card, and Title-case `Pts/Reb/Ast` box-score table headers.
- **Recommendation for devs:** Standardize every stat abbreviation to all-caps across all surfaces.
  - `apps/web/src/app/(public)/live/[gameId]/live-view.tsx:353` — `DReb · OReb` → `DREB · OREB`
  - `apps/web/src/app/(public)/live/[gameId]/live-view.tsx:724-726` — table headers `Pts/Reb/Ast` → `PTS/REB/AST`
  - `apps/web/src/components/flow-demo/scenes/season.tsx:526-527` — demo mirror of the same sub-line
  - `apps/web/src/components/flow-demo/scenes/game-page.tsx:405` — demo table header `Reb`
  - Sweep for any other Title-case/mixed-case stat labels (scoresheet, mobile app) while in there. Scoring console already uses all-caps `REB` — leave as is.
- **Sizing:** Small — string-only changes, no logic.
- **Platform note (2026-07-28):** Jacob reports native-app-first, but the mixed-case strings do **not** exist in `apps/mobile` — the native game screen is already all-caps (`PTS REB AST STL TO`, `browse/game/[id].tsx:412`) and has no OREB/DREB split. The sighting was almost certainly the web game page in a phone browser (shared game links open the website). This item is a **web-side fix**; native already conforms.

### W-002 · Box score: left-align "Bench" divider + repeat stat headers at the bench break (ESPN pattern) · **Agreed (refined)**
- **Jacob's suggestion:** Move the "Bench" label to the left, directly above the player names, and reiterate the stat column headers in that same divider line for easier visual scanning.
- **Discussion:** Investigation showed the surfaces disagree today: the web live box score already left-aligns "Bench" flush with the name column, but the **mobile app centers its BENCH strip** — so the alignment half is a mobile→web parity fix. The header-repetition half is the standard ESPN/NBA box-score pattern and genuinely helps on phones, where the top header scrolls away before the bench section. Refinement agreed: instead of adding a row, make the dividers *be* the headers — replace the informationally-empty "Player" top-header cell with "Starters", and turn the "Bench" divider into a second header row ("BENCH" left, stat abbreviations right-aligned over each column). Zero extra rows, exact ESPN look.
- **Recommendation for devs:**
  - `apps/mobile/src/app/(tabs)/browse/game/[id].tsx:660` — `benchStrip`: drop `alignItems: "center"`, left-align with the roster name column, and repeat the stat abbreviations across the strip aligned to the stat columns.
  - `apps/web/src/app/(public)/live/[gameId]/live-view.tsx:719-760` — thead first cell "Player" → "Starters" (only when a starters/bench split exists; games with no LINEUP event keep "Player"); bench divider row (751-760) → header-style row: "BENCH" in the name column + `PTS REB AST STL BLK TO PF` (all-caps per W-001) right-aligned per column, respecting the existing responsive hiding (Blk/PF hidden < sm, Min conditional).
  - `apps/web/src/components/flow-demo/scenes/game-page.tsx:401-415` — mirror the same treatment in the demo box score.
- **Sizing:** Small-to-medium — markup/layout only, no data changes; the fiddly part is keeping repeated headers in sync with responsive column hiding (consider extracting one shared header-row component used by both thead and bench row).

### W-003 · SSO buttons: standardize on "Continue with Google" / "Continue with Apple" everywhere · **Agreed (clarified)**
- **Jacob's suggestion:** Mobile says "Sign in with Google" while web says "Continue with Google" — standardize on the "Continue with" wording across platforms.
- **Discussion:** Confirmed the inconsistency is worse than reported — three conventions across four surfaces: web sign-in uses "Continue with", web sign-up uses "Sign up with", mobile sign-in/sign-up use "Sign in with"/"Sign up with". Agreed to standardize on **"Continue with X"** everywhere: SSO does double duty (same tap signs in or creates the account), so "Continue" is the only verb accurate on both screens; it removes the "do I already have an account?" hesitation for returning parents; and both Google's brand guidelines and Apple's HIG explicitly approve the "Continue with" variant (no App Store review risk). Clarified: this stays **two separate buttons** (one per provider) — a combined "Continue with Google and Apple" button is impossible (different auth flows) and violates both vendors' branding rules.
- **Recommendation for devs:** Change all six labels to "Continue with Google" / "Continue with Apple":
  - `apps/web/src/app/(auth)/sign-up/[[...sign-up]]/sign-up-form.tsx:120,126` — "Sign up with X" → "Continue with X" (web sign-in form already correct)
  - `apps/mobile/src/app/sign-in.tsx:159,170` — "Sign in with X" → "Continue with X"
  - `apps/mobile/src/app/sign-up.tsx:196,207` — "Sign up with X" → "Continue with X"
  - **Bonus (recommended):** mobile's Apple button is a hand-rolled `Pressable` with custom text; Apple reviews that button's appearance strictly. While renaming, switch to `expo-apple-authentication`'s native `AppleAuthenticationButton` with `buttonType: CONTINUE` — approved styling + auto-localized label for free. (Per apps/mobile/AGENTS.md: check the Expo v57 docs for the current API before coding.)
- **Sizing:** Small — six string changes; the native-Apple-button swap is an optional small extra.

### W-004 · Mobile price display: match web's `CA$250.00` format via one shared currency helper · **Agreed**
- **Jacob's suggestion:** Mobile shows registration costs as "CAD" + whole integer (e.g. `CAD 250`); web shows `CA$` with decimals (e.g. `CA$250.00`), which looks more professional. Mobile should match web.
- **Discussion:** Confirmed, and worse than reported — mobile has **three** hand-rolled formats: `CAD 250` (programs list + camp/tryout/training detail), bare `$250` with no currency indicator at all (club profile programs), and `CAD 250.00` (offers/payments). Web is consistent because everything funnels through one `formatCurrency` helper (`Intl.NumberFormat` currency style → `CA$250.00`). Agreed to standardize mobile on the exact web format: decimals signal exactness on payment-adjacent numbers, `CA$` disambiguates for a Canadian audience, and `Intl.NumberFormat` is the industry-standard renderer. Considered and rejected dropping ".00" on browse/marketing surfaces — every price here is one tap from checkout; one rule, no judgment calls.
- **Recommendation for devs:**
  - Create one shared `formatCurrency(amount, currency)` — ideally hoisted from `apps/web/src/lib/countries.ts:153-165` into a shared package (e.g. `packages/config` or a small `packages/format`) consumed by both apps so they can't drift; a mirrored `apps/mobile/src/lib/format.ts` copy is the pragmatic fallback.
  - Route every mobile price through it: `apps/mobile/src/app/(tabs)/browse/programs.tsx:94`, `browse/program/[type]/[id].tsx:217` (+ line 162 payment copy), `browse/club/[slug].tsx:131` (currently bare `$` with no code — worst offender), `offers/index.tsx:104`, `offers/[offerId].tsx:247,267,281,285,374-375`, `account/payments.tsx:90,107`.
  - Verify `Intl.NumberFormat` currency style output on-device for the Expo SDK 57 / Hermes runtime (per apps/mobile/AGENTS.md, check the Expo v57 docs) — it's expected to work, but the fallback branch in the web helper exists for a reason.
- **Sizing:** Medium-small — one tiny helper + ~12 call-site swaps across 6 mobile files; no data/API changes.

### W-005 · Mobile program detail (tryouts/camps/training): description under the title + micro-icons on meta rows · **Agreed (refined)**
- **Jacob's suggestion:** (1) The description sits in a separate box below the info card — move it directly beneath the program title. (2) Add small icons beside the meta text (date, participants, location) that correspond to each line — a nice touch.
- **Discussion:** Part 1 is a straight **web-parity fix**: the web tryout page already renders title → description → facts (`apps/web/src/app/(public)/tryout/[id]/page.tsx:117-121`), while mobile renders title → bare meta lines → spots, with the description exiled to a separate card below. Part 2: mobile's meta lines are unlabeled stacked text (`U13 · Male` / `Sat, Aug 2` / `Main Gym`) — the reader must infer what each line is; web labels its tiles with text ("Date & Time", "Location"), and icons are the mobile-native equivalent (label without horizontal cost; Ionicons already shipped, no new dependency). Refinement agreed: clamp the relocated description to ~3 lines with a "more" expander so a long paragraph can't push date/location/price below the fold on a phone.
- **Scope clarification (Jacob, 2026-07-28):** the change is **native-only and applies to every program type** — camps, tryouts, training sessions, tournaments. On native the description currently sits *below* the info card in a separate box; move it up to directly beneath the title, exactly mirroring the web layout, **which Jacob explicitly likes and which must stay untouched** (verified: web tryout, training, and camp pages all already render title → description). Native serves all program types from the one shared screen below, so the relocation covers every type automatically — this note exists so it isn't implemented as a tryout-only special case.
- **Recommendation for devs:** In `apps/mobile/src/app/(tabs)/browse/program/[type]/[id].tsx`:
  - Move `program.description` from its own Card (lines 244-248) into the main Card directly after the title (line 221, before/after the club ListRow), with `numberOfLines={3}` + tap-to-expand; keep `program.details` where it is.
  - Convert the meta `<Text>` stack (lines 233-241) to icon+text rows using Ionicons: `person-outline` age/gender · `calendar-outline` date · `time-outline` schedule · `location-outline` location · `people-outline` signed-up/spots. Muted icon color matching the meta text tone, ~16px, fixed-width column so text aligns.
  - Apply the same icon treatment to the programs *list* rows (`browse/programs.tsx`) if trivial, for consistency between list and detail.
- **Sizing:** Small-to-medium — single-file layout change + one expander state; icons are mechanical.

### W-006 · Mobile back navigation: tapping a game from Social/Home/Scores strands you in the Browse tab · **Agreed** (borderline defect)
- **Jacob's report:** From the social feed, tapping a post opens the game box score; pressing back lands on a clubs-ish screen, and back again lands on the homepage — never back to the feed, where he started.
- **Root cause (traced):** Each mobile tab has its own navigation stack, and the game screen lives only in the Browse tab's stack (`/browse/game/[id]`). Cross-tab pushes (`apps/mobile/src/app/(tabs)/social.tsx:93`, `index.tsx:101,220`, `scores.tsx:64`, plus `event-card.tsx:219` and deep-link remaps in `lib/nav-links.ts:13`) switch the user to the Browse tab and push there. Back then pops Browse's stack → Browse hub (the "clubs" screen), then falls through to Home. The originating tab is never in the chain. Web does NOT have this problem — `SmartBack` (shipped 2026-07-23) does a true one-step return; mobile lacks the equivalent.
- **Discussion:** Jacob's expectation (back = return to the feed) is the correct behavior and the standard native pattern (Instagram et al.: details push onto the *current* tab's stack). Affects every tab that links to a game, not just Social.
- **Recommendation for devs:** Use expo-router **shared routes** (group-array syntax) so the game detail screen — and by the same token article, player, club, and program details — registers in each tab's stack and pushes onto the tab the user is standing in; back becomes a true one-step return preserving scroll. Alternative: hoist shared detail screens into the root stack above the tab bar. Update `lib/nav-links.ts` remaps accordingly. Verify per Expo SDK 57 docs (apps/mobile/AGENTS.md).
- **Sizing:** Medium — routing restructure touching several screens and every game link; behavior change is well-understood, testing is the bulk (back from each tab, deep links, notifications).
- **Confirmed repro paths (Jacob, 2026-07-28):** (1) Social feed → post → game → back lands on Browse hub, then Home. (2) Home → "Live scores / this week's games" → Scores → game → back lands on the Browse hub (its Programs/Events previews — reported as "programs and tryouts") instead of Scores. Same root cause; both must pass after the fix.
- **Symptom #3 (Jacob, 2026-07-28, trainer account):** tapping the **Browse tab (search icon)** opens a stale game box score (an NPH Summer League seeded game) instead of the Browse hub. Mechanism: tabs preserve their stacks, and since every game link app-wide pushes onto the Browse stack, the last-viewed game sits on top — re-selecting the tab resumes it. **Additional fix requirement:** selecting the Browse tab should pop its stack to the hub root (standard tab-press-resets-stack behavior), on top of the shared-routes fix that removes the contamination source. All three symptoms must pass. **Verified (Jacob):** after a fresh app launch, Browse opens the hub correctly — proving stack contamination is the entire mechanism (no initial-route bug).
- **Note:** Arguably a defect rather than a wish — consider also logging in the QA triage doc so it gets defect-priority treatment.

### W-007 · Bring the flow demos to the native mobile app · **Agreed** (WebView embed recommended)
- **Jacob's request:** The demos aren't visible on the iOS/mobile app — he wants them available there.
- **Current state:** Zero demo code in `apps/mobile`. The demos are web-only: routes `/demo` (hub) + `/demo/parents`, powered by ~30 files in `apps/web/src/components/flow-demo/` (ten-act animated walkthrough: club setup → tryout → parent signup → offers → league → registration → schedule → game day → final, plus a custom animation engine). Crucially, they are already phone-functional — `flow-demo/mobile-notice.tsx` exists precisely because the demos work on phones (it just nudges toward desktop for the best experience).
- **Discussion:** Two options weighed. **(1) WebView embed — recommended:** add an in-app entry point ("See how SportsHub works" card on the Browse hub and/or the sign-in screen) opening the existing web demo in an in-app WebView; reuses everything, never drifts from web, days not weeks. **(2) Native port:** rewrite engine + scenes in React Native — weeks of work and a second copy that drifts on every web update; only justified if demos become core in-app onboarding rather than marketing.
- **Recommendation for devs:** Ship option 1: `react-native-webview` (or `expo-web-browser` for a simpler modal) pointing at the production `/demo` URL, with a query flag (e.g. `?app=1`) that `mobile-notice.tsx` reads to suppress the "view it on a computer" pop-up inside the app — telling native users to leave the app is off-message. Demos are public routes, so no auth plumbing. Revisit a native port only if analytics show heavy in-app demo usage.
- **Sizing:** Small (embed) — one entry point, one WebView screen, one query-flag check in the web notice. Native port would be Large; not recommended now.
- **⚠️ Constraint discovered later (see W-019):** owner rule "no webviews anywhere" in the native app (`operator.tsx` header). If that rule stands, the embed becomes a **system-browser link-out** instead of an in-app WebView — same reuse benefit, one less tap of polish; owner call.

### W-008 · Mobile team chat: show which chat you're in + de-bland the conversation UI · **Agreed (refined)**
- **Jacob's report:** Club chats are too basic — white/black with purple names only, and no chat title on top, so a club owner with multiple teams can't tell which chat they're in. Wants a chat title and suggestions to make the chat look better.
- **Findings from code review** (`apps/mobile/src/app/(tabs)/chat/[teamId].tsx`):
  - The missing title is a **bug**: the header title is a pass-through route param — the chat hub passes the team name (`chat/index.tsx:145`) but the team page's "Team chat" row pushes without it (`team/[teamId].tsx:92`), as do deep-link remaps (`lib/nav-links.ts:11`) — so Jacob's entry path shows a generic "Chat". Fix: the chat screen fetches/derives the team name itself (e.g., include `teamName` in the `/api/teams/[id]/messages` response) instead of trusting the caller.
  - **No timestamps are rendered anywhere in the thread** — `createdAt` is fetched but never displayed. No day separators either.
- **Agreed improvements, in impact order:**
  1. **Header identity:** team monogram + team name + club context line; team-color accent stripe. Answers "which chat am I in" at a glance for multi-team owners. (Title fetched server-side per the bug above.)
  2. **Day separators + message times:** "Today" / "Mon Jul 27" pills between days; time on bubbles. Table-stakes chat furniture; also breaks visual monotony.
  3. **Sender monograms:** initial-circles beside others' messages, stable per-person color from a small palette (existing `Monogram` ui component). Single biggest cure for the "all one color" feel.
  4. **Message grouping:** consecutive same-sender messages within ~5 min collapse under one name/monogram with tighter spacing (iMessage/WhatsApp pattern).
  5. **Role badges:** replace plain "· Staff" text with a small tinted pill (Coach/Staff gold, parent context gray).
- **Countered:** team-colored or multi-colored message bubbles — arbitrary team colors as bubble backgrounds create contrast/legibility failures. Keep own-bubbles brand purple; spend color on accents (header, monograms, badges) only.
- **Out of scope:** photo sharing (deliberately deferred in chat v1 pending object storage — per the screen's own design notes).
- **Sizing:** Medium — one screen + small API addition (teamName in messages response); items 1–2 alone are Small and deliver most of the value.

### W-009 · Category pills app-wide: capitalize the first letter (scope broadened 2026-07-28) · **Agreed (broadened)**
- **Jacob's suggestion:** Originally: the calendar's event-type widgets ("game", "practice", "event") are lowercase — capitalize them. Broadened on follow-up: **every** categorizing widget/pill in the native app (training session, tryout, etc.) should get a capitalized first letter — "more normal."
- **Discussion:** Sweep of all `TonePill` call sites confirmed lowercase category pills across the app, not just the calendar: calendar kind pills (`event-card.tsx:153-160` — raw `item.kind`, next to a correctly-cased "Cancelled" pill on the same card); program-type pills "camp / tryout / training session" on the Browse hub (`browse/index.tsx:103`), club page (`browse/club/[slug].tsx:132`), programs list (`browse/programs.tsx:80`), and program detail (`browse/program/[type]/[id].tsx:214`); payment status pills **explicitly lowercased** (`account/payments.tsx:88`); article kind pills explicitly lowercased (`browse/article/[slug].tsx:67`). Count pills ("3 going") start with a digit and are naturally unaffected.
- **Recommendation for devs:** Fix once at the component boundary — sentence-case the first character inside `TonePill` (`components/ui.tsx:154`) so all ~10 current call sites and every future pill inherit correct casing by construction (same principle as W-020). Already-cased labels pass through unchanged. Remove the now-redundant explicit `.toLowerCase()` at the payments/article call sites (their enum labels become "Paid", "Player of game" via the transform). Web calendar surfaces: labels already Title Case (verified) — native-only.
- **Sizing:** Tiny — one transform in one component + deleting two `.toLowerCase()` calls.

### W-010 · Social feed: fix reaction interaction (tap = like, long-press = picker) + add comment deletion/moderation · **Agreed (refined)**
- **Jacob's report & question:** (1) The only way to remove a reaction is re-clicking the heart and re-tapping the emoji — feels weird. (2) No way to delete comments on a post. (3) Asked whether multi-emoji reactions are worth keeping vs a simple heart-only like.
- **Findings (`apps/mobile/src/app/(tabs)/social.tsx:95-222`, cross-checked against web 2026-07-28):**
  - Tapping the heart opens a 6-emoji picker — even a plain like costs two taps; removal requires reopening the picker and re-tapping your emoji, and the **native** picker shows no selected state, so removal is undiscoverable guesswork. (Web's picker already highlights your active emojis — `feed-card.tsx:387` — so the highlight is a native-parity fix.)
  - One user can stack multiple emojis on one post (`myEmojis` is an array) — inflates counts and confuses un-reacting. **Both platforms** share this model.
  - **Correction (initial claim was wrong):** comment deletion is NOT missing end-to-end — web has it fully: `DELETE /api/comments/[id]` + `/api/comments/[id]/report` endpoints exist, and web's feed shows Delete on your own comments and Report on others' (`feed-card.tsx:507-521`). The **native app simply never implemented either** — comments render as inert text. So this is a native-parity fix against existing endpoints, much smaller than first assessed. What's genuinely missing on both: staff moderation of *others'* comments on their own posts (web offers only Report for non-mine).
- **Agreed design (Facebook/Instagram-settled pattern):**
  1. **Tap heart = instant ❤️ like toggle** (tap again = unlike) — fixes the reported weirdness outright.
  2. **Long-press heart = emoji picker** for expressive reactions.
  3. **Highlight the user's active emoji in the picker** (tinted ring) so removal is visible.
  4. **One reaction per user per post** — choosing a new emoji replaces the old one.
  5. **Comment deletion + moderation:** native app wires up the **existing** `DELETE /api/comments/[id]` and report endpoints (long-press own comment → Delete, others' → Report) — pure parity, no new API. New work (both platforms): staff moderation of others' comments on posts they own.
- **Jacob's heart-only question — answered: keep the emojis.** The feed is celebration content (finals, recaps, player of the game); 🏀 is on-brand; team chat already uses the same 6-emoji set (consistency); the problem was the interaction model, not the emoji concept. Heart-only would simplify but lose expressiveness parents actually use.
- **Sizing:** Medium — interaction rework is UI-only (small); comment deletion needs API + both clients; the moderation piece (item 5) is the part worth prioritizing and arguably belongs in QA triage as a safety gap.

### W-011 · Mobile team screen: stop repeating the team name — in-card title becomes "Team overview" · **Agreed (refined)**
- **Jacob's suggestion:** The team name appears twice at the top (nav header + first card); replace one with "Team Overview".
- **Discussion:** Confirmed: `apps/mobile/src/app/(tabs)/team/[teamId].tsx:79` (SubHeader) and `:87` (card title) both render `team.teamName`. Refinement on *which* to replace: keep the name in the **header** — it stays visible while scrolling and multi-team club managers need constant "which team am I in" context (same principle as W-008's chat-title fix) — and replace the **in-card** duplicate with a small "Team overview" eyebrow over the club name + chat row.
- **Sizing:** Tiny — one-file layout tweak.

### W-012 · Schedule rows: micro-icons on location/time lines (extends W-005's icon language) · **Agreed**
- **Jacob's suggestion:** Add micro icons to locations in the upcoming schedule so the info reads at a glance — some people won't parse unlabeled text.
- **Discussion:** Same rationale as W-005 (unlabeled meta lines force inference); this extends the agreed icon vocabulary to event/schedule rows everywhere they appear: team screen "Coming up" list and the calendar agenda (`apps/mobile/src/components/event-card.tsx`, `agenda-list.tsx`). Use the same Ionicons set as W-005 — `location-outline` venue, `time-outline` times, `calendar-outline` dates — muted color, fixed-width column, so W-005 + W-012 produce one consistent visual language app-wide.
- **Sizing:** Small — mechanical once W-005's row treatment exists; implement together.

### W-013 · Add event editing (fix a mistake without cancel-and-recreate) · **Agreed**
- **Jacob's report:** No option to edit an event when a mistake is made or wrong data was entered.
- **Findings:** The gap is **UI-only** — the API already supports full editing: `PATCH /api/team-events/[id]` ("edit details, move, cancel or restore", `apps/web/src/app/api/team-events/[id]/route.ts:51`) and the equivalent for practices. Mobile offers staff only cancel/restore on event cards (`event-card.tsx:225-236`) and a create-only form; web team calendar offers move (reschedule) + cancel/delete but no full details edit. Today a typo means cancel-and-recreate, which also destroys collected RSVPs.
- **Recommendation for devs:**
  - **Mobile:** add "Edit" to the staff actions on `event-card.tsx`; reuse `team/new-event.tsx` in a pre-filled edit mode (title, date/time, location, details) that PATCHes the existing endpoints. Inherits D-003's keyboard fix.
  - **Web:** extend the team calendar's move flow into a full edit form (title, time, location, notes) using the already-documented PATCH capability.
  - Preserve RSVPs on edit; notify the team of changes (the practices PATCH already emits "the team has been notified").
- **Sizing:** Medium-small — forms + wiring only; server side already exists and is integration-tested.

### W-014 · Chat file & photo sharing — endorse the planned photo feature, extend scope to documents · **Agreed (already planned in part)**
- **Jacob's question/request:** Can parents and staff upload files and photos to group chats? If not planned, add it.
- **Answer — partially planned already:** `docs/feature-backlog.md:19` — "Chat: photo sharing 💡 (owner-confirmed 2026-07-15)": image messages in team chat + DMs, consent-scoped for minors, **blocked on the object-storage decision** (no bucket yet; same gate as content-feed creator uploads). A vague "attachments — V2 later" bullet also exists (`docs/outstanding-items.md:170`). The chat screen's own header comment confirms: "Text only in v1 (photos wait on object storage)".
- **What this item adds:**
  1. **Tester endorsement** — independent tester demand for chat photo sharing is a prioritization signal for the already-confirmed backlog item.
  2. **Scope extension request: document attachments** (PDF/doc — permission forms, waivers, tournament schedules) for staff→parents distribution, which the photo-sharing item does not explicitly cover. Suggested guardrails when built: allowlisted file types + size cap, staff-only document upload at first, same consent-scoping for minors as photos.
- **Dependency:** object-storage decision (owner). No dev action possible before that lands.

### W-015 · Scorekeeping from the native app (coach can't score a game today) · **Agreed in staged form (owner-gated)**
- **Jacob's report:** No scorekeeping feature for coaches on the native app; web has a working console. Wants it added to mobile.
- **Current state:** Confirmed — the native app has zero scoring capability (all `scores` screens are view-only). This is a **known, deliberate gap**: `docs/native-parity-audit.md:32-33` lists the scoring console as "web-only by design (works in the phone browser; guest links open web)" with an explicit pending decision — "keep as deliberate difference or build native." The web console (`apps/web/src/components/scoring/scoring-console.tsx`, ~1,900 lines: assist/rebound chains, sub management, undo/void, realtime, scorekeeper authz) was designed to work in phone browsers.
- **Discussion — full native port countered as a first step:** rewriting the console natively is Large with real risk of the two scoring UIs drifting. The sharper pain Jacob surfaced is **discoverability**: a coach in the native app has no path to scoring at all — the app never links to the console that already works on their phone. Staged plan agreed:
  1. **Phase 1 (Small-Medium):** staff-gated "Score this game" entry point on native game/team screens for scheduled/live games, opening the web console in the **system browser** (an in-app WebView would violate the owner's "no webviews anywhere" rule — see W-019). The one real engineering task is the auth hand-off (native bearer tokens → web session, e.g. a single-use short-lived sign-in link) — security-sensitive.
  2. **Phase 2 (owner's priority call, per the parity audit):** full native console only if Phase-1 usage shows coaches scoring from phones heavily. Jacob's tester demand is direct input to that pending owner decision.
- **Sizing:** Phase 1 Small-Medium (entry point + token bridge); Phase 2 Large.

### W-016 · Native sign-in: land on Home after Account-tab logins — but keep return-to-origin for contextual flows · **Countered in part / Agreed for Jacob's case**
- **Jacob's suggestion:** After successful login on the native app you're directed to the profile page — redirect to the homepage instead.
- **Discussion:** Root cause understood: sign-in's `dismiss()` (`apps/mobile/src/app/sign-in.tsx:84-87`) returns to wherever sign-in was launched from; Jacob entered from the Account tab, so he "returned" to Account/profile. A **blanket homepage redirect is rejected**: sign-in has four entry points, and for "Sign in to register" on a program page (`browse/program/[type]/[id].tsx:264`) return-to-origin is essential — a parent mid-registration must land back on the camp they were registering for (this flow ends in payment; do not break it). Top-bar sign-in from browsing screens is likewise correct as return-to-origin.
- **Agreed fix (Jacob's case only):** the Account-tab entry (`account/index.tsx:117`) passes an explicit destination (e.g. `/sign-in?to=/`), and `dismiss()` prefers an explicit `to` over history — fresh generic logins land on the Home tab (your-teams rail, scoreboard: the signed-in payoff), contextual logins keep returning to origin.
- **Sizing:** Tiny — one param + one branch in `dismiss()`.

### W-017 · Native app: no way to add a player to any account — including a dead-end instruction in registration · **Agreed (confirmed; high priority)**
- **Jacob's report:** On a trainer account (asked to double-check all account types), there's no way to add a player on the native app. Confirmed positive — for **every** account type.
- **Findings:**
  - Web has the full feature: global "Add a player" in the account menu (`account-menu.tsx:162`), an "Add a player first" panel inside program signup with return-to-program behavior (`program-signup-form.tsx:243-252`), invite-accept flow, `addPlayerSchema` + players API.
  - Native has none of it: the kids list (`kids/index.tsx`) has zero add affordances, and the Account hub hides the "My kids" row entirely unless `shape.hasKids` (`account/index.tsx:76-77`) — a chicken-and-egg: accounts without players can't even see the section where players would be added.
  - **Dead-end instruction (defect-grade):** native registration tells users "Add your player under Account → My kids first, then come back to register" (`browse/program/[type]/[id].tsx:274-276`) — impossible to follow; the flow it references does not exist natively.
- **Why high priority:** this breaks the money path for app-first users — a new parent who downloads the app cannot register a child for camps/tryouts/training at all.
- **Extended scenario (Jacob, 2026-07-28) — 13+ players can't register THEMSELVES:** a 13+ player account hitting native registration gets the same parent-centric dead-end ("Add your player under Account → My kids"). Root cause traced: the shared registration viewer (`lib/registration/viewer.ts:84-88`) lists players where `parentId = userId` — and the platform's 13+ model stores self-registered players with `parentId = their own user ID`, so the query already supports self-registration with zero changes. The only missing piece is that native offers no way to create the Player record: web creates it at onboarding (Player role); native has no onboarding and no add-player flow, so the record never exists.
- **Recommendation for devs:**
  - Build a native "Add a player" form (name, DOB, gender, media consent — mirror web's `addPlayerSchema`; endpoints exist), **with two paths: "Add my child" and "This is me — I'm the player"** (self path: prefill from the account profile, enforce age ≥13 per COPPA, set `parentId = self` per the established 13+ model; under-13 must be added by a parent).
  - Entry points: (1) Account hub — show "My kids" always, with an add action (drop the `hasKids` gate; label the section persona-aware, e.g. "Players" when the account holder is one); (2) kids list header "+ Add player"; (3) replace the registration screen's dead-end text with an add-player button that returns to the program afterward (mirror web's `returnTo` pattern) — **with persona-aware copy** ("Add your player — or yourself if you're 13 or older"), not the current parent-only phrasing.
  - Once the record exists, self-registration flows through the existing "Who's playing?" list with no further changes.
- **Platform:** Native-only gap; web is the reference implementation.
- **Also flag the dead-end instruction in QA triage** — it's live broken UX, not just an absent feature.
- **Sizing:** Medium-small — one form screen + three entry points against existing API/schema.

### W-018 · Camp week picker: "W1/W2/W3" chips → "Week 1 · Jul 6" with dates (web parity) + make the full-camp discount visible · **Agreed**
- **Jacob's question:** Camp week selection shows chips labeled W1, W2, W3 — is that best, or can it look better?
- **Discussion:** Not best — parents decide weeks by *dates* ("which weeks are we away?"), and "W3" forces calendar math at the buying moment; same abbreviation-tax principle as W-001's OR/DR verdict. **Web is already correct**: its chips render "Week {n} · {date}" via a `weekLabel` helper using the documented week model (week N = startDate + (N−1)×7 days) — `program-signup-form.tsx:73-75,323`. Native shipped bare `W{n}` instead (`browse/program/[type]/[id].tsx:327`).
- **Recommendation for devs:**
  1. Native: **compact two-line chips** — "Week {n}" over "{short date}" (e.g. "Week 1" / "Jul 6"), reusing web's week-label logic. Format settled after Jacob challenged single-line labels on phone-width grounds (valid: the picker renders per kid and wraps taller with wide chips): two-line keeps 3–4 chips per row (~60% wider than today's "W1"), carries the date, and fixes the current sub-44pt tap targets as a side effect. Fee text in the running total also picks up W-004's currency formatting.
  2. Both platforms: surface the full-camp discount state — pricing silently switches to `fullCampFee` when all weeks are selected (`campTotal`), so deselecting one week can quietly cost more than it saves. Add "Full-camp rate applied ✓" when active and a "select all {n} weeks for the full-camp rate ({price})" nudge when one short.
  3. Future-proofing note: derived dates assume consecutive weeks; if camps ever skip a holiday week, the server model needs explicit per-week dates.
- **Platform:** Label fix native-only (web is the reference); discount visibility both.
- **Sizing:** Small — label reuse + a conditional line of pricing copy.

### W-019 · Native creation flows for programs (training sessions, tryouts, camps) — challenges the "editing stays on a computer" rule · **Agreed in part (owner-gated)** · leagues **Countered — open request, owner to decide**
- **Jacob's report:** A trainer can't create a training session/camp on the native app — and on checking, *no* account type can create tryouts, camps, training sessions, or leagues natively. Wants creation features added for the authorized account types, calling them key features. (Adding players = already covered by W-017.)
- **Findings:** Confirmed by full route inventory — the native app has exactly **one** creation flow (`team/new-event.tsx`, practices/team events). This is a **deliberate, documented design decision**, not an oversight: `operator.tsx` header — "native READ-ONLY dashboard… Config and editing stay on a computer; this answers 'what needs me' on the road" — and `native-parity-audit.md` #5 ("heavy admin stays web — deliberate"). The same comment records an **owner rule: no webviews anywhere** in the native app.
- **Discussion:**
  - **Agreed (high value):** phone-sized creation forms for revenue-generating programs — trainer 1-on-1/group training sessions, club tryouts, simple camps. These match the complexity of the already-shipped team-event form, and a trainer who can sell sessions but not create them from a phone is a genuine gap. Server APIs exist (web creation flows for all three).
  - **League creation — Countered, recorded as an open tester request (owner to decide).** Jacob followed up explicitly asking for league-owner creation on native (verified impossible today, same route inventory). Claude's maintained counter: creating a league is the doorway into the platform's deepest admin (seasons, divisions, schedules, venues, fees) — desktop-shaped per the owner's documented rule — and native creation without native configuration risks stranding half-created leagues between platforms; it's also a rare, deliberate action with the weakest mobile case in this doc. **Compromise option for the owner:** a light native "league shell" form (name, sport, age groups) ending in an explicit "finish setup on the web" hand-off. Decision menu: (a) no native league creation (Claude's recommendation), (b) shell + web hand-off, (c) full native creation (not recommended).
- **Recommendation for devs (staged, pending owner sign-off since this amends a documented rule):**
  1. **Now:** kill silent dead ends — operator/trainer surfaces get explicit "Manage on the web" affordances (system-browser links, NOT webviews, per the owner rule).
  2. **Owner-approved phase:** native create/edit forms for training sessions, tryouts, and simple camps, modeled on the shipped `new-event` pattern (and inheriting D-003's keyboard fix); creation entry points gated by the same role checks the web APIs enforce.
  3. League/season management remains web-only by design.
- **Sizing:** Phase 1 Small; Phase 2 Medium per program type (forms against existing APIs).

### W-020 · Native app-wide convention: every location gets a micro location-pin icon · **Agreed (refined)**
- **Jacob's request:** Anywhere a location appears in the native app — no matter the screen — put a mini location icon next to it, as a standing convention.
- **Discussion:** Agreed as an app-wide design rule (it generalizes W-005 and W-012 from per-screen fixes into policy). One refinement: applies to **structured location lines/rows** (meta lines, list rows, detail cards) — not to locations inside prose sentences (alerts, confirmations), where an inline icon reads as clutter.
- **Recommendation for devs:** Don't sprinkle `location-outline` icons call-site by call-site — build one tiny shared component (e.g. `MetaRow icon="location-outline"` or extend `ListRow`) and route every structured location line through it, so the convention is enforced by construction and new screens inherit it for free. Known surfaces to sweep: program detail + programs list (W-005), event cards/agenda + team "Coming up" (W-012), game screen venue line, club profile, offers, referee assignments (venue/window). Same muted color + fixed-width column as the W-005 icon spec. Native-only.
- **Sizing:** Small — one shared component + mechanical sweep; implement together with W-005/W-012.

### W-021 · Native calendar: "sync to your phone's calendar" (web already has it one-click; native has nothing) · **Agreed**
- **Jacob's question/request:** Can you add your SportsHub schedule to your phone's actual calendar app? If not on native, add it — recommended in a way that keeps the UI sleek.
- **Findings:** **Web has the full feature** (`apps/web/src/components/calendar/add-to-phone.tsx` + `/api/calendar/token` → tokenized `.ics` feed): one click mints a personal feed link, platform-detects, and launches Apple Calendar's `webcal://` subscribe dialog (iPhone) or Google Calendar add-by-URL (Android), with copy-link fallback. It's a **live subscription** — moves/cancellations update automatically (owner rule 2026-07-11: one click). **Native has zero trace of it** — the platform where it's most valuable.
- **Recommendation for devs (sleek by design):**
  1. One small `calendar-outline`+plus icon button in the Calendar tab's top bar — no banner/card; the screen is unchanged until wanted. (Optional second entry: a quiet row in Account.)
  2. Tap → native bottom sheet: "Sync with your phone calendar — practices, games and events stay up to date automatically" + one primary button. Mint the token via the existing API; `Linking.openURL(webcal://…)` on iOS, the Google add-by-URL link on Android — system hand-offs, complying with the no-webviews owner rule.
  3. Keep it a **subscription, not device-write**: `expo-calendar` insertion would create stale copies when events move; the web team's subscription model is correct — native inherits it.
- **Platform:** Native-only; web is the reference implementation.
- **Sizing:** Small — one button + one sheet + `Linking` against the existing token API.

### W-022 · Native profile: add profile-photo upload (+ missing state field) · **Agreed (corrected in part)**
- **Jacob's report:** Native accounts can't optimize their profile or add a profile photo.
- **Findings (correction on the first half):** basic profile editing **does** exist natively (Account → Edit profile: first/last name, phone, city — `account/profile.tsx`, PATCH `/api/user/profile`). What's missing:
  1. **Profile photo — confirmed absent natively.** Web has a complete `AvatarUploader` (settings/profile): client-side downscale to a small compressed square → saved as a data-URL via `avatarUrl` on the same profile API. **No object-storage dependency** — unlike chat photos (W-014), avatars don't wait on the bucket decision; the backend is fully ready.
  2. **Bonus gap:** native fetches the `state` field but renders no input for it — web edits it, native silently drops it.
- **Recommendation for devs:**
  - Add an avatar circle at the top of the native Edit-profile screen (current photo or Monogram fallback + "Add photo"/"Change"/"Remove"). Use `expo-image-picker` (library + camera), downscale client-side mirroring web's approach (small square, compressed), PATCH the existing `avatarUrl` field.
  - Add the missing `state` input alongside city.
  - Follow-up (separate, optional): render `avatarUrl` where Monogram initials currently show (account hub, chat senders per W-008) — display parity once upload exists.
- **Platform:** Native-only; web is the reference implementation.
- **Sizing:** Small-Medium — image picker + downscale + one field; zero backend work.

### W-023 · Native role acquisition: "Become a referee" (agreed) + club creation (owner-gated) · **Agreed in part**
- **Jacob's request:** Becoming a referee must be possible on the native app; also summarized prior asks (add a child = W-017, training/camps = W-019) and mentioned club creation — which, on checking, had **not** been logged anywhere yet.
- **Findings:** Native deliberately has no upfront role selection — `sign-up.tsx:21-23` documents the event-driven model: "Role onboarding happens naturally the first time a role-specific action needs it." That works for parent (add a kid) and staff (accept an invite) but **structurally fails for referee**: leagues can only send shift requests to existing referees, and no native action ever makes you one — the event-driven model has a hole. Web solves it via onboarding role selection (creates `RefereeProfile` through `/api/onboarding`). Native has no path at all.
- **Agreed — Become a referee (small):** an Account-hub row ("Become a referee") opening a short native form mirroring web's referee onboarding step, POSTing the existing onboarding/role API. Fits the event-driven philosophy (it IS the trigger action); referee kit tab then lights up via the existing `isRefereeing` shape.
- **Club creation — owner-gated, same posture as W-019:** becoming a ClubOwner/creating a club is a bigger flow (web ClubOwner onboarding redirects to a dedicated `/clubs/create` builder — branding, details). Options for the owner: (a) native "Start a club" entry that hands off to the web builder (system browser, no webviews) — recommended; (b) a native shell form + finish-on-web; (c) full native builder (not recommended — same deep-admin reasoning as league creation in W-019).
- **Platform:** Native-only; web is the reference.
- **Sizing:** Referee flow Small (one form against existing API); club hand-off Tiny; native club builder would be Large (not recommended).

### W-024 · Native operator game-day console: next-7-days games with ref/scorekeeper assignment + score/box access · **Agreed (owner-gated; web stays primary)**
- **Jacob's request (with web screenshot):** once creation functions land, league owners also need the game-management functions on native: the web view listing "live games and everything scheduled in the next 7 days for your leagues and clubs," where each game row offers REFS chips + "+ assign", SCOREKEEPER + "+ assign", "Box score," and "Score →". Jacob's own recommendation: web remains the primary/recommended surface; native gets it for mobility.
- **Findings:** the native operator tab is a read-only summary (counts only — `gamesThisWeek` is a number, not a list); no native surface lists an operator's upcoming games, and ref/scorekeeper assignment doesn't exist natively in any form. The web dashboard in the screenshot is the reference; its assignment APIs exist server-side.
- **Discussion:** this is the strongest candidate for an exception to the cockpit's read-only rule, because it matches the cockpit's own stated mission ("answers 'what needs me' on the road"): the canonical scenario is a ref no-show at the gym Saturday 8:55 AM — reassignment is inherently on-the-road, time-critical work, unlike league configuration. Still amends the documented read-only rule → owner sign-off required.
- **Recommendation for devs (staged):**
  1. Operator tab gains a native **next-7-days game list** for their leagues/clubs (new list endpoint behind the existing summary), each row linking to the native game screen (via W-006's fixed shared routes).
  2. **Assign refs / scorekeeper natively:** row action → native picker sheet against the existing assignment APIs (phone-sized: it's a person picker, same shape as the shipped team-event form).
  3. "Score →" rides W-015 Phase 1 (system-browser hand-off to the web console; no webviews).
- **Platform:** Native addition; web is and remains the primary surface (per Jacob).
- **Sizing:** Medium — one list endpoint + one screen + picker sheets against existing APIs; scoring access is already covered by W-015.

---

## Defects spotted during the session
_These are bugs, not wishes — migrate into the QA triage flow (`qa-triage-2026-07-23.md` or a follow-up doc) for defect-priority handling._

### D-001 · Mobile full calendar: per-player lens chips distorted / cropped on multi-kid accounts
- **Jacob's report:** On a parent account with multiple players, opening the full calendar (home → "Full calendar →") shows the per-player calendar toggle buttons distorted and cropped.
- **Code path traced:** `apps/mobile/src/app/(tabs)/index.tsx:170-171` → Calendar tab lens-chip row `apps/mobile/src/app/(tabs)/calendar.tsx:40-65` (styles at 88-107).
- **Likely causes (in order of suspicion):**
  1. Horizontal ScrollView with `showsHorizontalScrollIndicator={false}` and no fade/edge affordance — with 2+ kids plus team/league lenses the chips overflow one screen width, leaving the last chip half-sliced at the edge ("cropped") with no hint the row scrolls.
  2. Accessibility font scaling: chip text `fontSize: 12` scales with device settings but `paddingVertical: 5` doesn't — squeezed/clipped chips on enlarged-text devices (common for parents).
  3. RN horizontal-ScrollView child-stretch quirk on some devices (no explicit `alignItems`/`minHeight` on the row).
- **Fix direction:** Web parity — web's `/calendar` chips use `flex flex-wrap` (`apps/web/src/app/(platform)/calendar/my-calendar.tsx:415`) so extra players wrap to a second row; do the same on mobile (wrap, don't scroll). If the scroller stays: visible scroll affordance/fade, explicit `alignItems: "center"`, and test at 1.5–2× font scale.
- **Repro details still needed from Jacob:** device model + OS, number of kids on the account, screenshot.

### D-002 · Mobile: back button from a team page walks stale team history instead of returning home
- **Jacob's report:** As a club owner browsing teams, the back button returns to the *first team clicked* earlier in the session, not to the home page he came from.
- **Root cause (traced):** Every entry point pushes the same dynamic route `/team/[teamId]` (`lib/home.ts:124`, `kids/[playerId].tsx:170,180`, `browse/player/[id].tsx:133`, `lib/nav-links.ts:20-21`), so each team visit stacks param history on that route; the SubHeader back (`components/top-bar.tsx:126`) pops through previously-viewed teams before ever reaching home.
- **Fix direction:** Same navigation-architecture family as **W-006** — fix together. Sibling-to-sibling navigation (team → team) should `replace` rather than `push`, and/or back from a hub-reached detail should `dismissTo` the hub. Audit all dynamic detail routes under `(tabs)` for the same param-stacking pattern (game, player, club, kid screens).
- **Also migrate to QA triage.**

### D-003 · Mobile: keyboard fully covers the text input on the create-event form (and likely other forms)
- **Jacob's report:** As a club manager creating an event, tapping into the details field at the bottom of the page brings up the keyboard over the input — can't see what's being typed.
- **Root cause (traced):** `apps/mobile/src/app/(tabs)/team/new-event.tsx:143-238` renders TextInputs in a plain ScrollView with **no keyboard handling**. The chat screen already solved this exact problem (`chat/[teamId].tsx:298-303` — KeyboardAvoidingView with `behavior="padding"`, and its comment documents that edge-to-edge Android on SDK 57 no longer auto-resizes for the keyboard, so padding is required on BOTH platforms). The fix was never swept across the other forms.
- **Recommended fix:** Reuse the chat screen's proven pattern on new-event (KeyboardAvoidingView wrapper, `keyboardVerticalOffset` = safe-area top + header height, `keyboardShouldPersistTaps="handled"`, scroll-to-focused-field). Then **audit every mobile screen with TextInputs below the fold** for the same miss (chat/new, account/profile forms, sign-in/up on small phones) — this is a class of bug, not a one-off; consider a shared `FormScreen` wrapper so new forms get it for free.
- **Also migrate to QA triage.**

### D-004 · Web full calendar: referee's schedule hidden behind a wrong "No teams yet" gate (WEB-ONLY; native works)
- **Jacob's report:** Referee account: web homepage "your week" correctly shows the next reffing assignments, but the full-calendar page renders blank with "No teams yet — when your player joins a team or you start coaching one, every game, practice and event lands here." The referee has a schedule; it should render in the agenda/grid. Native app works correctly.
- **Root cause (traced):** `apps/web/src/app/(platform)/calendar/my-calendar.tsx:279` gates the whole page on `data.teams.length === 0` → early-returns the empty state. A referee-only user has zero **teams** but nonzero **items**: the shared feed (`getMyCalendar`, served by `/api/calendar/mine`) already includes refereed games under a dedicated `ref:<leagueId>` lens (`kind: "referee"`). "Has teams" is a wrong proxy for "has a schedule". Native is unaffected because its calendar screen has no teams-gate — it renders whatever items arrive (which is also proof the API data is correct).
- **Recommended fix:** Change the gate to the right signal — empty state only when `data.items.length === 0 && data.lenses.length === 0` (or equivalent). Also make the empty-state copy persona-aware: current text addresses only parents/coaches; add the referee case ("…or you get game assignments"). Verify the grid + agenda then render `ref:` items with the referee lens chip/coloring already built (lens plumbing exists at lines 314, 599).
- **Platform:** Web-only (Jacob-confirmed + code-confirmed).
- **Also migrate to QA triage.**

## Session Notes

- **Explored and kept-as-is by agreement (2026-07-28):** the guest-link scorekeeper console's plain UI. Verdict: plainness is correct for a time-pressure tool used by drafted volunteers (big targets, instant recognition, error recovery beat decoration); the console's design investment is correctly placed in tap-chains/undo/full-sheet pickers. If polish is ever spent here: a first-run orientation cue ("tap player, then action") and a visible saved/synced indicator — trust-builders, not chrome. No beautification pass.
- **Explored and dropped by agreement (2026-07-28):** color-coding calendar items by age group/division. Rejected because color already encodes event kind (native card edges) and calendar lens (web), a third meaning would overload the channel; arbitrary color→division mappings don't scale past a few divisions or stick in memory; accessibility. If busy-day division scanning ever becomes a real pain, the right tool is a small text division chip ("G8"/"U14") on game rows or grouping by division — not color.

- **All of Jacob's reports are native-app-first (stated 2026-07-28), and each item was cross-checked against web** so devs know the fix surface. Resulting platform map:
  - **Native-only fixes (web already correct / web N/A):** W-002 (bench alignment — web left-aligns; header-repeat is both), W-004 (web's `formatCurrency` is the reference), W-005, W-006, W-007, W-009, W-011 (web team page shows the name once), W-012, D-001 (web wraps chips), D-002, D-003.
  - **Both platforms:** W-003 (labels on 4 screens), W-010 (tap-to-like rework + one-reaction-per-user + staff moderation are cross-platform; picker highlight + comment delete/report are native parity with existing web UI/APIs), W-013 (native has no edit; web only "move"), W-014 (platform-wide, storage-gated).
  - **Web-only fix:** W-001 (native game screen is already all-caps; mixed-case `DReb·OReb` exists only on the web game page + demos — Jacob likely saw the website in a phone browser).
  - **Web as reference implementation:** web team chat already has day separators ("Today"/"Yesterday"), sender context, and staff badges (`team-chat.tsx:533-575`) — W-008's items 2 and 5 are native catch-up, not new design.
- **Review stance:** entries record honest verdicts — suggestions that don't survive scrutiny are marked Countered/Rejected with reasoning. Countered so far within items: OR/DR abbreviations (W-001), single combined SSO button (W-003), team-colored chat bubbles (W-008), heart-only reactions (W-010), replacing the header team name rather than the in-card one (W-011). One self-correction on the record: W-010's comment-deletion claim (see its Findings).
