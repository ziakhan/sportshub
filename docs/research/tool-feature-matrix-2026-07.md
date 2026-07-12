---
updated: 2026-07-12
tags: [theme/research, theme/gtm, type/research, status/complete]
---

# Tool × feature matrix — youth basketball club/league software (2026-07)

Every platform found in actual use by basketball clubs/leagues across the
2026-07 expansion research ([[expansion-strategy-2026-07]]), compared feature
by feature, grouped by **who uses the feature**. Sources: two research rounds
+ a dedicated feature-confirmation pass (per-claim URLs in agent transcripts;
key nuances footnoted).

**Legend:** ✓ = shipped/full · ◐ = partial, add-on, paywalled, or shallow ·
✗ = absent/not advertised · ? = unconfirmed

**Columns:** **US** = SportsHub (us) · **TL** = TeamLinkt · **RA** = RAMP
InterActive · **SE** = SportsEngine HQ (Tourney/Play noted) · **TS** =
TeamSnap for Business · **LA** = LeagueApps · **GC** = GameChanger · **EX** =
Exposure Events · **LG** = legacy tier (GoalLine, LeagueLineup, Pointstreak,
itSportsNet, eSportsDesk, OrgsOnline, BracketMaker)

## Business model

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Software price | Free front door + club tiers $249–649/season + $39/team/season league media | Free core + $425–795/yr bundles | Quote-only (paid) | $58–69/mo + fees | Subscription (quote) | $0 sub + one-time setup (~$495 rep.) | Free for coaches/staff | $2/team credit + $30 marketing credit | Free/ad-based or cheap |
| Payment take rate | **2% + $0.30** | Undisclosed %, volume-tiered | "Lowest rates" (undisclosed) | **3.25% + $2.00** [1] | ~3.25% + $1.50 [2] | ~5–5.9% (reviewer-rep.) | — (no payments) | Processor + 1% EventStore | varies/none |
| Free tier | ✓ | ✓ | ✗ | ✗ | ◐ (consumer app) | ◐ (no sub) | ✓ | ◐ (5 credits) | ✓ |
| Consumer/family subscription | $9.99/mo Family Pass | ✗ (ads instead) | ✗ | Play $9.99–19.99/mo [3] | ✗ | ✗ | $9.99/mo (or $39.99/yr!) [4] | ✗ | ✗ |

## League operator

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Auto scheduling w/ constraints | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✗ | ✓ (tourneys + season leagues) | ◐ |
| Tournament brackets/pools | ✓ | ✓ | ✗ [5] | ◐ (Tourney, separate product) | ✓ (Tournaments product) | ◐ | ✗ | ✓ (core) | ◐ (BracketMaker) |
| Auto standings + tiebreakers | ✓ (configurable) | ✓ | ✓ | ✓ | ✓ | ◐ | ✗ (team-scoped) | ✓ | ◐ |
| Officials assignment | ✓ | ✓ (+pay tracking, officials app) | ✓ | ◐ (tags + external integration) | ✗ | ✗ | ✗ | ? | ◐ |
| Team + player registration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ◐ |
| Public league site / pages | ✓ (hosted pages + customization) | ✓ (site builder) | ✓ (site builder) | ✓ (site builder) | ✓ (site builder) | ◐ (portal + add-on) | ✗ | ◐ (event sites) | ◐ |
| Compliance (waivers, checks, discipline) | ◐ (waivers, consent, audit) | ? | ◐ (governing-body flows) | ✓ (waivers + owns NCSI checks) | ◐ (waivers) | ◐ (waivers) | ✗ | ◐ (NCAA cert) | ✗ |
| Roster locks / frozen season rosters | ✓ | ? | ◐ | ◐ | ? | ? | ✗ | ◐ | ✗ |

## Club admin

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Programs (camps/tryouts/house league) | ✓ | ◐ | ◐ (forms) | ✓ | ✓ | ✓ | ✗ | ◐ (free camp marketing) | ✗ |
| Installment payment plans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ? | ✗ |
| Staff roles + invitations | ✓ | ◐ | ◐ | ✓ | ✓ | ✓ | ◐ (team staff) | ◐ | ✗ |
| Fundraising / sponsorship / shops | ✗ | ✓ (rev-share suite) | ◐ | ◐ (ClubBuy/apparel) | ? | ✗ | ✗ | ◐ (marketing) | ✗ |

## Coach / team

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Team chat | ✓ (+polls) | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ◐ | ✗ |
| RSVP / availability | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✗ | ✗ |
| Practice scheduling | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ | ✗ | ◐ |

## Family

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Family app (multi-kid) | ✓ (web; native app built, pre-launch [6]) | ✓ (500K MAU) | ✓ (team app) | ✓ | ✓ | ✓ (2025 portal) | ✓ | ◐ (event app) | ✗ |
| One-click calendar sync (iCal/webcal) | ✓ | ? | ? | ◐ | ✓ | ? | ✓ | ✗ | ✗ |
| Live scores for parents | ✓ | ✓ | ◐ (site) | ◐ | ◐ (Live!) | ✗ | ✓ | ✓ | ◐ |

## Player

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| **Public player profile page** | **✓ /p/handle** | ◐ (in-league profile) | ◐ (stats on league site) | ✗ (private by design) | ✗ | ✗ | ◐ [7] | ◐ (team pages) | ✗ |
| Season stats history + leaders | ✓ | ◐ | ◐ | ✓ | ◐ (manual entry) | ✗ | ◐ (no basketball career stats [7]) | ◐ (via add-ons) | ◐ (Pointstreak) |
| Highlights / media on profile | ◐ (P2 planned) | ✗ | ✗ | ◐ (Play) | ◐ | ✓ (auto clips) | ✗ | ✗ | ✗ |

## Referee

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Self-serve availability | ✓ | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Assignment + game feed | ✓ | ✓ | ✓ | ◐ | ✗ | ✗ | ✗ | ? | ◐ |
| Digital sign-off (PIN/signature) | ✓ | ◐ (gamesheet) | ◐ (gamesheet) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## Fan / content

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Live play-by-play (basketball) | ✓ native, basketball-deep | ◐ [8] | ◐ (gamesheets, hockey-first) | ◐ (Score Live) | ◐ (Live!, shallow) | ✗ | ✓ (deepest competitor) | ◐ (paid 3rd-party [9]) | ✗ |
| Full box scores (basketball) | ✓ | ◐ [8] | ◐ | ◐ | ✗ | ✗ | ✓ | ◐ (iScore) | ✗ |
| Official scoresheet output | ✓ (printable) | ◐ | ✓ (gamesheets) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Streaming | ✗ (AI-stream pilot planned Y2) | ✗ | ✗ | ◐ (Play $, no stats link [3]) | ✓ (free) | ✗ | ✓ (free viewing for basketball) | ✗ | ✗ |
| **AI / auto game recaps** | **✓ (auto, public)** | ◐ (AI-assisted admin writing) | ✗ | ✗ | ✗ | ✗ | ✓ but gated [10] | ✗ | ✗ |
| News feed / follow / leaders pages | ✓ | ◐ (site news) | ◐ (site news) | ◐ (CMS) | ✗ | ✗ | ◐ (team feed) | ✗ | ✗ |

## Platform

| Feature | US | TL | RA | SE | TS | LA | GC | EX | LG |
|---|---|---|---|---|---|---|---|---|---|
| Native mobile apps | ◐ (built, pre-launch [6]) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (+$299 branded) | ✗ |
| Offline scoring | ✗ | ? | ✓ (gamesheets) | ? | ✗ | ✗ | ? | ◐ | ✗ |
| Sports covered | Basketball (volleyball next) | 20+ | ~40 | All | All | 9 | 5 (baseball-first) | Basketball-first | varies |
| Canada-native / French | CA / EN only | CA / multi-currency | CA (EN) | US-first | US-first (Live! has FR) | US | US | US | Kreezee = FR-first (QC) |

## Footnotes

1. SportsEngine 3.25% + $2.00 confirmed first-party (help.sportsengine.com
   management-fees article). The earlier 3.75%+$1.75 figure did not survive
   verification.
2. TeamSnap ~3.25% + $1.50 is third-party-sourced (CheckThat.ai), not
   first-party confirmed.
3. SportsEngine Play is a separate subscription (Premier $9.99/mo,
   All-Access $19.99/mo) with **no stats integration**.
4. GameChanger's $39.99/yr annual is far below 12× monthly — watch this as
   the Family Pass anchor; consider our annual price point.
5. "RAMP lacks built-in tournaments" comes from TeamLinkt's comparison page —
   biased source; treat as probable, not certain.
6. Our Expo native app (chat/offers/payments/push) is built and on EAS but
   dormant pending owner-side env/app-store steps.
7. GameChanger athlete profiles are shareable but **career stats are
   baseball/softball only** (nothing for basketball) and sharing is gated
   behind Premium.
8. TeamLinkt's scoring engine is real, but its basketball leagues in the wild
   (e.g. Saskatoon Minor Basketball) run standings-only; templates are
   hockey-first.
9. Exposure has no native play-by-play — organizers pay for NBN23 /
   HoopStats / iScore integrations.
10. GameChanger auto-recaps exist for basketball but are readable only by
    team staff and paying subscribers — not public content. And GC has **no
    league layer at all** (no registration, payments, cross-team standings,
    websites, officials).

## What the matrix says (read this bit)

1. **Nobody owns the full picture.** Full-stack admin (SE HQ, TeamSnap,
   TeamLinkt) is weak on basketball game-day depth; the game-day leader (GC)
   has zero league/club administration; the basketball-events leader
   (Exposure) rents its live scoring. We are the only column with native
   play-by-play + league ops + payments + public content in one product.
2. **Public player pages are confirmed white space** — every incumbent is
   ✗ or ◐ (private, in-app, or paywalled). This validates the /p/handle bet.
3. **Public AI recaps are near-white space** — only GC generates recaps and
   they're paywalled + team-scoped. Ours are public league content (SEO,
   follow feeds) — a distribution asset, not a feature.
4. **Referee self-serve is a sleeper differentiator** — only we do
   availability + booking + digital sign-off end-to-end.
5. **Our gaps, honestly:** streaming (TeamSnap/GC give it free — our Y2
   AI-stream pilot matters), fundraising/sponsorship suite (TeamLinkt
   monetizes it), offline scoring (RAMP has it; gyms have bad wifi),
   app-store presence (built, not launched), French (blocks Quebec).

⬅ [[expansion-strategy-2026-07]] · [[competitor-tracker]] · [[business-model]]
