# League Management UX Audit — 2026-07-29

> Owner ask: "complete audit of things they can or cannot do or should be able to do", menu reorganization, waiver grid practicality, navigation, roster-edit clarity, stats/analytics.
> Status legend: ✅ works · 🔧 fixed THIS round (shipped) · 🟡 works but rough · 🔴 missing (backlog'd).

## 1. What a league operator CAN do today (capability inventory)
- **League level:** branding/customize page, public page, perks list, waiver documents (+ ON templates), polls (league-wide), payments + accounting exports, referee pool, messages, seasons list.
- **Season level:** full lifecycle (Draft → Registration → Closed → Finalized → In progress → Completed) with preflight checks; divisions (age/gender/tier); venues + courts + per-season hours; sessions (multi-day, venue/court allocations); scheduling settings + generation + capacity math; tiebreakers; team application review (approve/reject/withdraw) w/ payment tracking (manual/waived/Stripe); roster lock + change-request queue + audited override; waiver signing status + re-send; standings/playoffs; referee shifts/booking/settlements (league level).
- **This round added (previous sessions):** league-side team page, club grouping + club page, needs-attention dashboard, one-row triage.

## 2. Fixed THIS round 🔧
1. **Back navigation:** season tab state now lives in the URL (`?tab=`) — back from a team/club page returns to the tab you left, not Overview. SmartBack fallbacks carry the tab. (Root cause: tab was client-only state, lost on every return.)
2. **Menu reorganization:** 12 flat tabs → 5 sections with sub-tabs — Overview · Registration (Clubs/Teams) · **Season setup (Divisions/Venues/Sessions/Scheduling/Tiebreakers — the "settings on one page with tabs underneath")** · Games (Schedule/Standings/Playoffs) · Referees. Keys unchanged; deep links stable.
3. **Waiver signing grid:** teams collapsed to summary rows ("7/10 signed") that expand on demand + an "Only missing" filter — no more full-roster wall for every club.
4. **Roster editing, one story:** the duplicate "Override a team's roster" tool was REMOVED from the Teams-tab panel; each team page now owns "Edit roster" (audited, club auto-notified) plus in-place Approve/Deny of that team's change requests. The Teams-tab panel remains as policy + cross-team queue only. The "audit" wording the owner flagged was this override tool; nothing was club-requested in the sim — the demo now seeds a real PENDING request (Titans U15 call-up) so the approve beat is visible on Overview and the team page.
5. **Analytics v1:** Overview gains a per-club **Season report** (teams/approved/players/fees received/outstanding/overdue, linked to club pages + league accounting) on top of the needs-attention tiles.

## 3. Still missing / should be able to do 🔴 (prioritized)
1. **Two-level registration + operator layer** — committed design, docs/roadmap/league-operator-orgs.md (club entries w/ planned team counts, application questions, club-signed T&C, Organization branding inheritance, OrgAdmin).
2. **Deposit schedules on team fees (G2)** — no partial-payment state; Titans' paid deposit still badges "unpaid".
3. **Notifications to the league**: new application, roster-change request, entry-fee payment recorded — none push today; the dashboard shows them but nobody is pinged. Small, high value.
4. **Email the clubs from the league** (announcement to all club operators in a season) — league messages exist but not season-scoped club blasts.
5. **Reports v2**: registrations-over-time, CSV export of the season report, waiver compliance trend, per-division fill vs capacity (maxTeams is stored, unused in UI).
6. **Division management ergonomics**: assign division at approval time in one step (today: approve, then edit).
7. **Season clone / "renew for next year"** — owner's yearly-renewal model wants one-click season duplication (divisions, venues, sessions pattern, fees).
8. **Schedule change communications** — bulk reschedule notices to affected teams (policy says emergencies only; tooling absent).
9. **League-side game-day ops on native** — W-024 (owner-gated).
10. **Operator staff management UI** — arrives with the Organization layer.

## 4. Navigation rules applied
- Tab state in URL everywhere the season console is entered (`?tab=`), so browser back and SmartBack both restore context; detail pages fall back to their owning tab on cold entry. The season header itself remains the "high-level reset" (SmartBack → league page).

## 5. Analytics roadmap (owner keeps asking — treat as a track)
- v1 (shipped): needs-attention counts + per-club money/registration table.
- v2: time-series (applications/week, signatures/week), division fill gauges, CSV/QuickBooks alignment with league accounting, season-over-season compare (needs Organization layer for cross-league rollups).
- v3: cross-league operator dashboard ("NPH at a glance") — after Organization ships.
