---
updated: 2026-08-18
tags: [theme/research, type/competitor, status/current]
---

# TeamLinkt deep-dive: how it actually works in the field (researched 2026-08-18)

> Trigger: owner named TeamLinkt (teamlinkt.com, Saskatoon) the biggest competitive threat
> among Canadian basketball clubs — it's our #2-most-common platform by census. Prior
> research already exists: [[expansion-strategy-2026-07]] §2 (target list, "hockey-first,
> weak on basketball depth" thesis), [[tool-feature-matrix-2026-07]] (13-row comparison,
> TeamLinkt column), [[competitor-tracker]]. This doc goes past marketing claims: real club
> sites from our own census, their embed/help-center docs, live app-store/review sentiment,
> and a cell-by-cell check of the landing page's TeamLinkt column against what was found.

## Executive summary

- TeamLinkt is real and growing across Canadian basketball, mostly Prairies + Atlantic —
  confirmed via 8 live club/league sites from our own census (Saskatoon, Regina, Brandon,
  Calgary, Fredericton, Miramichi). Adoption quality swings wildly: from fully custom
  sponsor-laden sites down to a literally unconfigured placeholder template still showing
  "you'll want to delete these instructions."
- **New finding, not in our prior research: they DO support embedding live schedule/
  score/standings widgets (iframe) into a club's own separate website.** Registration
  itself never embeds — it always exits to app.teamlinkt.com.
- Club→league roster sharing is real (a "Share Teams" live-linked record, not re-typing)
  but only between two orgs both on TeamLinkt that have been explicitly linked. 3 of the 8
  real sites we found pair TeamLinkt with a second vendor (RAMP or a WordPress site) for
  part of their stack — exactly where that connective tissue breaks and re-entry returns.
- **Consumer/media white-space thesis holds.** No auto game recaps, no public player
  profile/handle pages — only an optionally-public in-team stat table. Their AI ("Emi") is
  admin-productivity (scheduling, drafting posts), not content generation.
- Free tier is genuinely free, no ads on the pricing page (contrary to folklore) — but
  **referee/officials assignment and the unified multi-kid family calendar are both paywalled
  add-ons** ($425–795/yr org-side, $4.99/mo family-side), which the current landing-page
  table doesn't flag.
- Ratings are strong (4.6–4.8 across stores) but real 2025–26 complaints cluster on app
  stability, "greedy" creeping monetization of previously-free features, and scheduling
  breaking down past a few divisions.
- Confirmed scale: Saskatoon HQ, $9.7M CAD raised total ($8.3M CAD Series A, Growth Street
  Partners, closed Jul 2025), ~17 staff, 3,500+ orgs / 3.5M users as of Aug 2026 (up from
  3,000+/3M at the Series A close 13 months earlier).
- **Table check: 9 of 13 TeamLinkt cells stand. Waivers should likely downgrade** (no
  e-signature evidence found — only registration T&C text). Referee assignment, Family
  calendar, and Free to start are literally true but hide paid-tier gating worth a footnote.

---

## 1. Real-world usage — real Canadian basketball clubs/leagues on TeamLinkt

Starting point: `docs/research/raw/*.json` (prior census work) already had 13 confirmed
basketball TeamLinkt instances, none in the Ontario CSV (TeamLinkt's basketball footprint
is Prairies + Atlantic, not Ontario, where RAMP dominates). Visited 8 of them live:

| Club / league | URL | What's actually there |
|---|---|---|
| Saskatoon Minor Basketball Assn (SMBA) | leagues.teamlinkt.com/smba (aliased at smbayxe.ca) | Fully branded as SMBA, not TeamLinkt. Nav: Home / General Info / League Schedules / Registration / Fall-Winter & Spring-Summer programs / Coach & Referee Development / Rules / Resources. Registration routes to `app.teamlinkt.com/register/find/smba`. Footer: small "Powered By" + TeamLinkt logo. TeamLinkt's own marketing site references SMBA as a named case study subject. |
| Regina Community Basketball Assn (RCBA) | rcba.ca | Custom domain, full site: programs Jr. Cougars→High School, policies/codes of conduct, sponsors, merch, gym locations. Register/Coaches/Refs-and-Supervisors buttons on the homepage. Footer credits TeamLinkt with a link to their marketing page. |
| Westman Youth Basketball Assn (WYBA) | wyba.ca | Custom domain, Brandon MB. Standard, lightly-customized TeamLinkt template — schedule section (real U18/U15 results visible), news section, photo gallery. Footer "Powered By TeamLinkt." |
| SKY Basketball / Saskatchewan Youth Basketball (Jr. NBA) | skybasketball.ca | "Powered by TeamLinkt" in **both** header and footer — heaviest visible TeamLinkt branding of the set. Per-community registration across 7 named regions (Melfort, Parkland, North Battleford, Outlook, Swift Current, Weyburn, Yorkton). |
| Saskatoon Shadow Basketball Club | app.teamlinkt.com/register/go/saskatoonshadowbasketballclub/73399 | Not a club website at all — a pure registration form living on TeamLinkt's own domain. No history/team info/content, just the form (currently gated as a "Restricted Form"), plus a TeamLinkt Plus upsell shown on the registration page itself. |
| Miramichi River Hoops (NB) | leagues.teamlinkt.com/miramichiriverhoops | A generic, **unconfigured** app shell — placeholder logo and literal leftover setup-instruction text still visible. Real evidence that in-the-wild adoption quality varies enormously, not every "TeamLinkt-powered" listing is a polished site. |
| Fredericton Fusion / FYBA | leagues.teamlinkt.com/fybafrederictonfusion | Minimalist site built around the Fusion Winter Classic tournament. Per our prior census research, Fusion's *main* site (frederictonfusion.com) runs on RAMP (CMS + registration) while tournament ops run on this separate TeamLinkt instance — i.e. this club pays for and runs two platforms at once. |
| Calgary Minor Basketball Assn (CMBA) | cmba.ab.ca (RAMP) + leagues.teamlinkt.com/calgaryminorbasketballassociation | Confirmed hybrid: the main org site is "Website by RAMP InterActive" (rampcms.com admin links) for policy/admin content, while zone/league standings and schedules for at least one CMBA program run on a separate TeamLinkt leagues portal. Another real two-vendor org. |

**Pattern:** every real site, regardless of polish, carries a visible "Powered by TeamLinkt"
credit and routes registration out to `app.teamlinkt.com`. Adoption splits into three tiers:
(1) fully custom-domain, content-rich sites (RCBA, SKY, SMBA), (2) thin templated sites with
just schedule + registration (WYBA, Fredericton Fusion), (3) essentially abandoned/default
templates (Miramichi). **At least 3 of the 8 real orgs found (CMBA, Fredericton Fusion, and
per prior census work also RYCBL with its separate WordPress front site) run TeamLinkt
alongside a second, unconnected platform** — the "one connected ecosystem" story does not
hold uniformly in practice.

Sources: `docs/research/raw/continuation-manifest.json`, `continuation-results.json`,
`teamcount-prep.json`, `followup-args.json` (prior census); live fetches of each URL above,
2026-08-18.

## 2. Third-party website integration

**Confirmed and new to our research: TeamLinkt supports iframe embedding.** Help Center
article ["Embed TeamLinkt Widgets on an External Website"](https://help.teamlinkt.com/en/articles/4938768-embed-teamlinkt-widgets-on-an-external-website)
documents copying an iFrame snippet (from *Website > Builder > Widgets* in the admin
dashboard) for **Schedule, Scores, Standings, and Locations** widgets, to paste into a
club's own separately-hosted website. So a club that already has its own WordPress/
Squarespace/custom site does **not** have to abandon it for a TeamLinkt-built one — it can
keep its own site and drop in live schedule/score/standings panels. Related articles confirm
calendar sync too: ["Adding and Syncing Events with an iCal"](https://help.teamlinkt.com/en/articles/4938620-add-a-syncing-schedule-events)
and ["Subscribe to your TeamLinkt Calendar"](https://help.teamlinkt.com/en/articles/4938653-subscribe-to-your-teamlinkt-calendar)
(webcal/iCal feed).

**What does NOT embed:** registration/payment. Every real club site found (RCBA, WYBA, SMBA,
SKY) sends "Register" clicks to a full-page redirect on `app.teamlinkt.com` — never an
in-page checkout widget. This matches the RYCBL pattern from our prior census
(`leagues.teamlinkt.com/rycbl` for league ops + a separate WordPress front site for
everything else, `reginayouthclubbasketball.com`).

**No public/developer API was found.** No API reference, no developer docs, nothing on the
marketing site or help center beyond the iframe widget mechanism — this is a one-way,
platform-controlled embed, not something a third party (like us) could build an integration
against.

## 3. The connected-ecosystem question — data flow end to end

- **Family registration → club roster:** native, one system, when a club fully adopts
  TeamLinkt for both. `Add Players`, `Import Roster Members` (CSV, or a free white-glove
  import via help@teamlinkt.com) confirm registrants land straight in the roster.
- **Club roster → league schedule:** the key finding. TeamLinkt supports org-to-org
  linking — clubs and leagues are separate "organization" accounts that can be **linked**
  ("this can be arranged by the governing body and TeamLinkt Support" per the docs), after
  which a club admin can use *Teams > Actions > Share Teams* to push a specific team into a
  season/division of the linked league org. Per the help article
  (["Sharing your Teams with Another Organization"](https://help.teamlinkt.com/en/articles/6974614-sharing-your-teams-with-another-organization)):
  *"the team will now exist in your account, as well as the organization you shared it with.
  This is the same team in both accounts."* That's a live shared record, not a re-typed
  duplicate — a genuine answer to "do they have club-to-league roster submission": **yes, if
  both sides are TeamLinkt orgs that have been explicitly linked.**
- **The structural limit:** this is org-to-org linking between separate tenants, not one
  unified multi-tenant database — nothing in the docs suggests a family/player record is a
  single row visible automatically end-to-end without that link being set up first. And in
  practice (§1) at least 3 of 8 real orgs found run TeamLinkt next to a disconnected second
  vendor (RAMP or WordPress), where this sharing mechanism can't apply at all and re-entry
  is the likely reality.
- **Gamesheet/scoring → standings:** real and automatic once a league runs fully on
  TeamLinkt. [`Submitting Stats through the TeamLinkt App`](https://help.teamlinkt.com/en/articles/6244997-submitting-stats-through-the-teamlinkt-app)
  documents in-app score/stat entry during or after games; our own prior census work
  independently observed this live — harvested team counts directly off `leagues.teamlinkt.com/smba`'s
  `getStandings` API, division by division (`docs/research/raw/province-team-counts.json`).
- **What families see:** schedule, live score updates, standings, chat, roster — via the
  team/family app or the club's TeamLinkt-built site. Confirmed live (WYBA's schedule page
  shows real U18/U15 results).
- **Where re-entry actually happens:** (a) any org pairing TeamLinkt with a second vendor
  (3 of 8 examples here); (b) governing-body/PSO sanctioning data. TeamLinkt has a dedicated
  **hockey-specific** integration, `teamlinkt.com/hcr-teamlinkt/` (Hockey Canada Registry) —
  its existence as a named, sport-specific product page signals real registry sync for
  hockey. **No equivalent was found for basketball's governing bodies** (Basketball Canada
  or provincial associations) — basketball registration data on TeamLinkt appears to stay
  TeamLinkt-only, with no confirmed PSO membership sync, unlike hockey.

## 4. Consumer/media layer — verify or refute our thesis

**Thesis holds: this layer is confirmed white space for TeamLinkt.**

- **Player pages:** the "Player Statistics" feature (help.teamlinkt.com/en/articles/4938681)
  is real but scoped as a stat-tracking table tied to live-game entry, optionally surfaced
  "on Public Website" if the org enables "Public Rosters." No evidence of a dedicated public
  player profile page, a stable public handle/URL, or cross-season career history — matches
  our existing ◐ rating exactly (in-league profile, not a real public player page).
- **Auto recaps / news generation:** no evidence of automatic narrative recap generation
  tied to final box scores. Their AI assistant **Emi** (launched Oct 2024, per BusinessWire)
  is scoped to admin productivity — auto-generating balanced schedules, drafting
  communications/announcements to team members, answering admin FAQs, and helping compose
  team "posts." That's AI-assisted admin writing, not sports-journalism-style recaps derived
  from a box score — consistent with, and no stronger than, our existing internal note.
- **News/follow feeds:** club sites do have a "News" section (seen live on WYBA and
  Miramichi) but it's manually admin-authored announcement content (e.g. "2nd Annual 3x3
  Huddle Tournament"), not auto-generated recap articles, and there's no cross-club follow
  feed product.
- **Net:** nothing found in this pass moves the needle — public sports-media-style content
  (recaps, player pages, follow feeds) remains a real gap for TeamLinkt.

## 5. Pricing + model — how is it "free"?

Free core is genuinely free — **"$0 forever," no credit card required**
([teamlinkt.com/pricing](https://teamlinkt.com/pricing)) — covering registration + payments
(custom forms, installment plans), group chat/DMs/push, schedule generation + calendar sync,
free iOS/Android team apps, roster/division management, real-time score tracking + standings,
a website builder, and reporting. **Ads are not mentioned as part of the free tier's
monetization on the pricing page** — this contradicts the "ad-supported" folklore as a
first-party claim, though see the app-review evidence below (§6) that at least one paying
customer describes "intrusive ads" in practice, so ads likely exist somewhere in the free
consumer app even if pricing marketing doesn't lead with it.

Actual monetization mechanics:
1. **Payment processing take rate on registrations** — rate still undisclosed/"scales with
   your organization," unchanged from our July finding.
2. **Two optional paid annual org-side add-ons:** "Operations" $425/yr (tournaments/
   brackets, **officials and scorekeeper assignment**, advanced scheduling automation) and
   "Revenue" $425/yr (fundraising, sponsorship/ad management, online store) — or "Full
   Platform" $795/yr bundling both + priority support.
3. **Consumer subscription — TeamLinkt Plus, CA$4.99/mo:** ad-free for up to 5 family
   members, **unified "view all team schedules at once" calendar**, attendance reports,
   20-min video upload/download, custom team colours, partner offers, 14-day trial
   ([teamlinkt.com/pricing/teamlinkt-plus](https://teamlinkt.com/pricing/teamlinkt-plus),
   [help.teamlinkt.com/en/articles/8944856](https://help.teamlinkt.com/en/articles/8944856-what-is-teamlinkt-plus)).

**Important nuance for our table:** referee/officials assignment sits inside the paid
$425–795/yr "Operations" add-on, **not** the free core. And the unified multi-kid family
calendar view is explicitly a **TeamLinkt Plus** feature — the base free app appears to be
single-team-at-a-time, not a consolidated family calendar out of the box. A 2025 App Store
review corroborates the free/paid line moving in practice: *"I really enjoyed the old
version... now I just hate how greedy they got"* about previously-free features going behind
a paywall.

## 6. Sentiment

Aggregated ratings (Aug 2026 snapshot, independent sources):

| Source | Rating | Volume |
|---|---|---|
| App Store (iOS) | 4.8/5 | 5,300 ratings ([listing](https://apps.apple.com/us/app/teamlinkt-sports-team-app/id1271528394)) |
| Google Play | 4.6/5 | 1,800 reviews (self-reported on teamlinkt.com/compare) |
| Capterra | 4.7/5 | 127 reviews — sub-scores: ease-of-use 4.5, support 4.7, value 4.9, functionality 4.4 |
| SoftwareAdvice | 4.7/5 | same underlying review pool as Capterra |

**Praise themes:** customer support responsiveness ("a quick call and some troubleshooting
got me back on track"), fast league setup, described as "one of the best decisions" by a
volunteer board president, strong perceived value vs. paid incumbents.

**Complaint themes, roughly by frequency:**
1. **Stability/reliability bugs** — random "no internet connection" errors that force
   restarts, notification bugs (flagged new messages that aren't there), a lineup feature
   reported as "doesn't even save your changes."
2. **Creeping monetization** — multiple 2025 reviews specifically call out previously-free
   features moving behind TeamLinkt Plus ("now I just hate how greedy they got").
3. **Scheduling breaks down at scale** — a Minor Ball Coordinator on Capterra: "Scheduling
   doesn't work for multiple divisions/diamonds/associations" — directly consistent with our
   own finding that basketball leagues in the wild (SMBA and others) mostly exercise
   standings, not the full multi-division scheduler.
4. **No admin mobile app** — "everything for us has to be done via website" (Digital Media
   Director) — back-office work is desktop-web-only; the mobile app serves teams/families.
5. **Mandatory payment rails** — a Treasurer wanted simple accounting-system invoicing
   interfacing and couldn't get it; a separate org serving lower-income families objected to
   being pushed onto TeamLinkt's payment processing when "we don't use banking for our teams
   much."
6. **Ads intrude on navigation** — a Commissioner review: "Intrusive ads prevent screen
   navigation," independently corroborating an ads-in-free-app reality the pricing page
   doesn't foreground.

No Canadian-basketball-specific Reddit/forum threads surfaced in this pass — searches
returned only aggregator review sites (Capterra/SoftwareAdvice/GetApp/G2), not organic forum
discussion. Treat "no basketball-specific complaint corpus found" as a research gap, not
evidence complaints don't exist among basketball admins specifically.

## 7. Scale

- **HQ:** Saskatoon, Saskatchewan — confirmed independently by [BetaKit](https://betakit.com/teamlinkt-scores-8-3-million-cad-series-a-to-expand-sports-administration-platform-across-north-america/),
  [PR Newswire](https://www.prnewswire.com/news-releases/teamlinkt-an-ai-powered-all-in-one-sports-management-platform-announces-strategic-growth-investment-from-growth-street-partners-302520803.html),
  and third-party data aggregators (office listed at 129-116 Research Dr, Saskatoon).
- **Founder/CEO:** Jay Maharaj (BetaKit). Legal entity is QuickLinkt Solutions Inc. (per
  teamlinkt.com footer).
- **Founding year — unresolved discrepancy:** GetLatka says 2015; BetaKit's Series A
  coverage frames it as "app launched 2018, back-office platform rolled out 2020." Treat the
  exact year as unconfirmed; the product clearly predates its 2025 Series A by years either
  way.
- **Employees:** BetaKit's Series A piece (tied to the actual funding announcement, most
  trustworthy single data point) states **17 employees**, with a stated target of 50+ within
  3–5 years. Third-party aggregators disagree wildly (2–27 depending on source/date) — normal
  noise for a small private company.
- **Funding:** **$8.3M CAD Series A** (~US$6M+), closed **late July 2025**, led by **Growth
  Street Partners** (San Francisco growth-equity firm; TeamLinkt is their first Canadian
  portfolio company) — brings total funding to **$9.7M CAD**. Independently confirmed by
  BetaKit, PR Newswire, Newswire.ca, and BusinessWire. Note: GetLatka separately lists
  TeamLinkt as "bootstrapped, $0 outside funding" — that figure is stale (pre-dates the
  Series A) and should not be used.
- **Revenue:** GetLatka's third-party *estimate* (not company-disclosed): ~$2.9M ARR in
  2024, up from $2.4M (2023) and $1.2M (2019). Treat as directional only, not verified.
  ACV cited at ~$12 by the same source (plausibly a per-registrant unit, not per-org — the
  figure looks too low to be a per-organization number given the $425–795/yr add-on pricing;
  flagging as unreliable rather than resolving it).
- **Customers/users:** at their Series A close (mid-2025) they cited **3,000+ organizations,
  3M total users, 500K+ monthly active app users**, "hundreds of millions" in payment volume
  processed. Their **current (Aug 2026) homepage/compare page now says 3,500+ organizations
  and 3.5M+ mobile app users** — real ~13-month growth, consistent with the trajectory noted
  in our 2026-07 research.
- **Sports coverage:** 20+ sports (basketball, hockey, baseball, soccer, ball hockey,
  cheerleading, cricket, dance, esports, football, gymnastics, lacrosse, martial arts, rugby,
  slo-pitch, softball, swimming, volleyball, multi-sport, non-sport programs). Hockey is the
  clear flagship — it's the only sport with a named governing-body registry integration
  (HCR) found anywhere in their product lineup; basketball has no equivalent sport-specific
  investment evident.

---

## Implications for the comparison table

Checked against the landing page's current TeamLinkt column
(`apps/web/src/app/dev/home-preview/preview.tsx`, `COMPARE_ROWS`, index 2 of each `cells`
array). **9 of 13 stand as published; 1 should likely downgrade; 3 are literally true but
hide paid-tier gating this research surfaced.**

| Row | Current | Verdict | Why |
|---|---|---|---|
| Registration and payments | y | **Stands** | Confirmed repeatedly — pricing page + every real club site. |
| Payment plans | y | **Stands** | "Installment plans" explicit on the pricing page. |
| Auto scheduling | y | **Stands (capability real)** | But real-world caveat: their own reviewers report it breaking down past a few divisions/facilities, and basketball leagues in our census mostly only exercise standings, not the full scheduler. Worth a footnote, not a cell change. |
| Standings and playoffs | y | **Stands, strongly** | Directly confirmed live — our own census harvested SMBA's `getStandings` API division by division. |
| Referee assignment | y | **Flag** | The feature is real (dedicated "Assigning Officials" help doc) but lives inside the **paid** $425–795/yr "Operations" add-on, not the free core. Recommend a footnote noting it's add-on-gated, since "Free to start: y" sits in the same table. |
| Live scoring and box scores | PARTIAL | **Stands, more strongly evidenced** | Real-time tracking is native; basketball-specific depth is thin in the wild (standings-only usage observed directly), templates are hockey-first. |
| Chat and polls | y | **Stands** | Group chat/DMs/push confirmed on the pricing page. (Reliability caveat from reviews — notification bugs — is a quality issue, not a truth-value one.) |
| Family calendar | y | **Flag** | Base free tier gives per-team schedule + iCal sync. The actual **unified multi-kid "view all schedules at once"** calendar is explicitly a TeamLinkt Plus ($4.99/mo) feature per their own pricing/help pages — not free. Recommend a footnote, mirroring the existing footnote 11 that already covers TeamLinkt Plus. |
| Waivers | y | **Downgrade candidate** | This pass found **no evidence of a dedicated e-signature/consent waiver product** — only registration-form "Terms and Conditions" / "Refund Policy" notice text (an acknowledgment, not a tracked e-signature record). LeagueApps' Waivers cell was specifically upgraded to ✓ in the August addendum for "true e-signatures, April 2025" — TeamLinkt has no equivalent evidence found here. Recommend ◐ pending a stronger source. |
| Auto game recaps | PARTIAL | **Stands (if anything, generous)** | Emi drafts admin posts/announcements and schedules; no evidence of narrative recaps generated from box scores. |
| Player pages | PARTIAL | **Stands** | Stat table tied to live-game entry, optionally shown on the public site — not a dedicated public player profile/handle/career-history page. |
| Club and league pages | y | **Stands, strongly** | Every real club found has one — capability is uniformly real, even though *quality* swings from full custom sites to an unconfigured placeholder (Miramichi). |
| Free to start | y | **Stands literally, flag the framing** | The $0 core is genuinely real, no card required. But several *other* rows in this same table (Referee assignment, Family calendar, and — not in this table — tournament brackets) are only free-in-name; they require a paid org add-on or a paid family subscription. Reading "Free to start: y" next to "Referee assignment: y" could reasonably (but wrongly) imply free officials assignment. Recommend a shared footnote on which TeamLinkt rows are paid-tier-gated. |

**Bottom line:** no cell needs an outright flip from y to n or vice versa. The one clear
downgrade candidate is **Waivers** (y → ◐, no e-signature evidence found). The bigger,
table-wide issue is that **TeamLinkt's real monetization model gates several "y" features
behind paid add-ons** ($425–795/yr org-side, $4.99/mo family-side) that the current table
doesn't surface — a shared footnote would keep every individual cell defensible while being
honest about what "free to start" actually buys a club day one.
