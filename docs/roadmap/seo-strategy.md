---
updated: 2026-07-12
tags: [theme/growth, theme/gtm, type/plan, status/planned]
---

# SEO strategy — consumer search + club-page rankings (2026-07)

**Owner's ask:** rank for what parents search (camps, tournaments, leagues,
events) and what clubs search; make every individual club page rank for its
own name + region + offerings; let the platform's credibility lift every club
page. Metadata, keywords, links, structured data.

**Grounding:** full codebase SEO audit 2026-07-12 (below) + competitor intel
from [[tool-feature-matrix-2026-07]] / [[expansion-strategy-2026-07]].

---

## 0. Where we stand (audit summary)

**Good bones:** nearly every public page is server-rendered with real data
(club pages ~11 queries deep incl. reviews; recaps are individual slug pages;
leaders/standings/scores public). Titles/descriptions exist on most detail
pages via `generateMetadata`.

**Nothing else exists:** no `sitemap.ts`, no `robots.ts`, no `metadataBase`,
no canonicals, no OpenGraph/Twitter, no OG images, no JSON-LD anywhere, no
favicon, `public/` empty.

**Self-inflicted wounds:**
- `/p/[handle]` is missing from `PUBLIC_PAGE_PREFIXES` → crawlers (and
  logged-out parents!) get 302 → /sign-in. The marketable player URL is dead
  to search.
- `/events` (Programs) is `"use client"` + useEffect fetch → empty shell for
  crawlers. Our camps/tryouts/tournaments aggregate page is invisible.
- Club directory `getDirectoryClubs` does `.slice(0, 36)` → **152 of 188 club
  pages have no internal link path** and no sitemap → undiscoverable.
- Opaque CUID URLs for league/team/player/game/camp/tournament (only clubs,
  news, handles have slugs).
- Subdomains (`{slug}.youthbasketballhub.com`) are advertised in UI but the
  middleware header is consumed nowhere — dead promise, no dup-content risk
  yet.
- Minors: `/player/[id]` is indexable with abbreviated names ("First L.") —
  no explicit indexing policy.

**The strategic insight:** we hold two content assets no competitor in the
feature matrix has — (1) **AI recaps** = automated, unique, fresh, local
articles at game volume (the MaxPreps SEO playbook, automated), and (2)
**188 Ontario club shells** = a programmatic local directory where SEO *is*
the shell→claim→activate funnel from [[business-model-scenarios]] V2.

---

## 1. Decisions to make first (owner input)

1. **Domain before authority.** All SEO equity accrues to ONE domain forever.
   The expansion report recommends multi-sport by 2027 — if a rebrand away
   from "youthbasketballhub.com" (basketball-specific) is plausible, decide
   the permanent domain BEFORE this program starts. A later domain migration
   costs months of rankings. (Multi-sport-neutral domain + sport-scoped
   sections, e.g. `/basketball/…`, is the future-proof shape.)
2. **Paths, not subdomains.** Consolidate club pages on
   `domain.com/club/{slug}` — subdirectories concentrate domain authority;
   subdomains fragment it. Kill or 301 the subdomain promise. (Custom domains
   for Pro-tier clubs later = per-tenant canonical decision, fine.)
3. **Minors indexing policy (recommended):** the *claimed handle page*
   `/p/{handle}` is the indexable player page (claiming = family opt-in
   signal; align with the COPPA-mode work from [[expansion-strategy-2026-07]]
   §3). `/player/{id}` without a handle → `noindex, follow`. With a handle →
   301 to `/p/{handle}`. Names stay abbreviated unless mediaConsent GRANTED
   (already built).
4. **UNCLAIMED shells: enrich, don't hide.** Index shells only when they meet
   a minimum-content bar (name + city + ≥1 substantive datum: teams in a
   league, programs, venue). Below the bar → `noindex` until enriched. Every
   shell gets the "Is this your club?" claim CTA — organic search becomes
   the activation channel.

---

## 2. Phase T — Technical floor (days of work, do immediately)

Everything else is wasted until these ship:

1. `robots.ts` + segmented `sitemap.ts` (Next.js sitemap generateSitemaps):
   `sitemap/clubs` (all 188 by slug + lastmod), `sitemap/news` (recap slugs),
   `sitemap/leagues+teams`, `sitemap/programs` (camps/tryouts/HL/tournaments),
   `sitemap/players` (claimed handles only, per policy above).
2. `metadataBase` (env-driven) + `alternates.canonical` on every public page.
3. Fix `/p` in `PUBLIC_PAGE_PREFIXES` (one-line, also a product bug — parents
   can't share handle links today).
4. Server-render `/events` (it's an API-composition page; move fetches into
   the server component).
5. Per-page metadata for `/` home ("Youth basketball clubs, leagues, camps &
   live scores in {region} | {Brand}") and `/tryout/[id]`.
6. Favicon/icons/manifest; `next/image` for club logo/banner (CWV).
7. De-slice the directory: paginated, crawlable `/club?city=…` +
   `/club/region/{city}` listing ALL clubs (see Phase P).
8. Default OG/Twitter config in root layout.

## 3. Phase E — Entity optimization (club pages rank for name+region+offer)

**Title/description templates** (per entity, keyword-bearing):
- Club: `{Name} — Youth Basketball Club in {City}, {Prov} | {Brand}` ·
  description auto-composed from offerings: "Tryouts, rep teams U10–U18,
  summer camps. Schedules, standings and verified reviews."
- Camp: `{Camp Name} — {Type} Basketball Camp in {City} ({Dates}) | {Brand}`
- League: `{League} — Standings, Scores & Leaders {Season}`
- Recap: already slugged; add `NewsArticle` metadata + OG image.

**JSON-LD (the credibility transfer mechanism):**
- Club page: `SportsOrganization` + `LocalBusiness` (address, geo, phone,
  URL) + **`AggregateRating` + `Review`** (data already server-rendered —
  this is star ratings in the SERP, the single highest-CTR win available).
- Camps/tryouts/house-leagues/tournaments: `SportsEvent`/`Event` with
  `startDate`, `location` (venue → Place), **`offers` (price)** → event rich
  results ("Events near me" surfaces).
- Recaps: `NewsArticle` (headline, datePublished, about → teams).
- Games: `SportsEvent` with scores on `/live/{id}`.
- Everywhere: `BreadcrumbList` (Home → {City} → {Club} → {Program}).
- Site: `Organization` + `WebSite` (+SearchAction sitelinks box).

**Dynamic OG images** (`ImageResponse`): club card (logo + name + city +
rating), recap card (score + teams), live game card (live score). These drive
social CTR and the share-out kit (P2 handles plan) reuses them.

**Slugs for the rest:** `/league/{slug}-{shortid}`, `/team/{slug}-{shortid}`,
`/camp/{slug}-{shortid}` (slug prefix + immutable short id suffix; old CUID
URLs 301). Keyword-bearing URLs without rename-breakage.

**Internal-link mesh** (how platform credibility reaches club pages):
- Recaps → link both clubs + teams + league (each recap is a fresh page
  voting for its entities).
- Leaders → player handles → team → club.
- Directory city pages → clubs; club pages → their programs; programs →
  venue pages.
- Home surfaces rotating "featured clubs/near-you cities" (already partially
  built).

## 4. Phase P — Programmatic consumer pages (what parents type)

Landing-page matrix generated from data we already hold (188 clubs' cities,
venues, programs, league schedules):

- `/basketball/{city}` — city hub: clubs, active leagues, upcoming
  camps/tryouts, latest recaps. Title: `Youth Basketball in {City} — Clubs,
  Leagues, Camps & Scores`.
- `/camps/{city}` (+`/camps/{city}/summer`, `march-break` — CampType exists
  in schema) · `/tryouts/{city}` (+ `{year}` freshness) · `/leagues/{city}` ·
  `/tournaments/{city}`.
- **Thin-content guard:** publish a page only when ≥3 live items; otherwise
  the city hub absorbs it (`noindex` empty leaves). Programmatic SEO dies by
  doorway-page penalty — the guard is not optional.
- FAQ blocks with `FAQPage` schema ("How much do basketball camps in {city}
  cost?" — we have real price data).
- Seasonality: tryouts pages peak Aug–Sep, camps Mar–Jun — cron-refreshed
  content + `lastmod` so Google re-crawls in season.

Target queries (consumer): `basketball camps {city}` · `summer basketball
camp {city}` · `youth basketball league {city}` · `basketball tryouts {city}
{year}` · `{club name}` · `{club name} reviews/tryouts/fees` · `basketball
tournaments ontario` · long-tail via recaps and player handles.

## 5. Phase B — B2B pages (what club/league operators type)

- Feature pages: `/for-clubs` + `/for-leagues` exist — add
  `/features/live-scoring`, `/features/registration-payments`,
  `/features/league-scheduling` targeting "basketball league scheduling
  software", "club registration software Canada".
- Comparison pages straight from [[tool-feature-matrix-2026-07]] (we hold
  verified receipts): "RAMP alternative", "TeamLinkt vs {Brand}",
  "SportsEngine alternative for basketball clubs", "GameChanger for leagues?"
  — honest, matrix-backed, footnoted. (Jersey Watch built its funnel on
  exactly this content play.)
- Pricing page (public, simple) — "how much does {Brand} cost" searches
  convert.

## 6. Phase A — Authority loops (links without link-buying)

1. **Embeddable widgets** (standings/schedule/scores iframe+script embed with
   a branded backlink) — clubs and leagues paste them into their existing
   RAMP/Wix sites → hundreds of relevant local backlinks. This is P2
   rung 1 of [[player-handles-plan]] — same build, SEO is the second payoff.
2. **Share-out kit** watermarks (`/p/{handle}` burned in) → branded-search
   volume + direct visits (both ranking signals).
3. **Claim-your-club outreach** (we hold enriched contacts from GTM
   research): claimed clubs link their new page from their socials/site.
4. Local citations: Basketball Ontario club listings, league sites, city
   sport directories — the 188-club import came *from* these sources; ask for
   the reciprocal link on claim.
5. AI recaps syndication hooks: let local sports blogs/news embed recaps with
   attribution (the content-ripple plan).

## 6b. SEO as product — floor vs ceiling (owner discussion 2026-07-12)

**Principle: the platform owns the FLOOR, clubs buy the CEILING.** Baseline
optimization (titles, schema/stars, sitemap, canonicals, internal links) is
automatic and free for every club — a platform asset; a badly-optimized free
page hurts US. Clubs pay for insight, control, and amplification:

| Layer | Free / Starter | Plus ($249/season) | Pro ($649/season) |
|---|---|---|---|
| **Insight** | Teaser stat (30d views); health score | Full traffic dashboard (trends, organic split, per-program, referrers; GSC queries later) | + competitor/city benchmarks |
| **Control** | Templated title/desc/slug (guardrailed defaults) | Search-preview editor (title/desc override, validated), custom OG image, one-time slug rename w/ 301, FAQ block | — |
| **Amplification** | Standard directory listing; embed widgets (free — each embed backlinks US) | — | Featured placement (isFeatured exists) in directory/city pages, AI-written page copy, custom domain mapping |

- **Unclaimed clubs:** their traffic number is used AT them in the claim
  pitch ("412 families found you from Google last month") — tracking already
  built (`e9d7db2`, /dashboard/admin/seo).
- **SEO health score** on club admin = the engagement engine: free checklist
  items (description, photos, reviews, announcements) are our content
  enrichment done for us (and push shells over the noindex bar); paid items
  sit greyed in the same list with upgrade tags.
- Headings/page structure stay platform-controlled at every tier — that's
  how the floor is guaranteed. Outgoing links (website/socials) free.
- No separate SEO plan — these strengthen the existing club tiers.
- BUILD ORDER: health score + teaser stat (free tier, drives enrichment) →
  club-facing analytics page (Plus gate via hasFeature()) → search-preview
  editor → featured/city placement (with Phase P) → AI copy → custom domains.

## 7. Measurement & guardrails

- Google Search Console from day one (verify domain, submit segmented
  sitemaps, watch coverage per segment).
- Rank tracking on the city×program matrix + "{club name}" for top-50 clubs.
- KPIs: indexed pages per segment · organic sessions → registration starts ·
  organic → claim requests (ties SEO to the activation funnel) · SERP CTR on
  club pages before/after star ratings.
- Guardrails: thin-content guard (§4) · minors policy (§1.3) · one canonical
  host, force-redirect the rest · `force-dynamic` pages are fine for
  freshness but add `revalidate` where data allows (crawl-budget kindness) ·
  never index search-result permutations (`?city=` canonicalizes to the city
  page).

## 8. Sequencing & effort (recommended)

| Order | What | Effort | Why first |
|---|---|---|---|
| 1 | Phase T (technical floor) | ~2-3 dev-days | Everything else is invisible without it; includes 2 live product bugs (/p blocked, /events shell) |
| 2 | Club JSON-LD + star ratings + OG images | ~2 days | Highest-CTR win; uses data already rendered |
| 3 | Directory de-slice + city pages (Phase P core) | ~3-4 days | Unlocks 152 orphan club pages + the parent-search layer |
| 4 | Event schema on programs + /events SSR | ~2 days | Rich results for camps/tryouts = the owner's headline ask |
| 5 | Slug migration (league/team/program URLs) | ~2-3 days | Do before scale; 301s get costlier later |
| 6 | Phase B comparison pages | content work | Matrix already wrote them |
| 7 | Phase A widgets/embeds | shared w/ P2 handles plan | Double-payoff build |

**Do-nothing-else-first rule:** no content or link work until Phase T ships —
today Google cannot even enumerate our pages.

## 9. Open questions for the owner

**Answered 2026-07-12:** one domain confirmed; ESPN-style public sport
sections (`/basketball/...`) confirmed — nav model recorded in
[[site-ia-plan]] §5.5; homepage = cross-sport mix + "lock my default
homepage" preference; logged-in users don't get the sport-link nav
(seam design deferred). Phase T build STARTED 2026-07-12.

1. ~~Permanent domain/brand~~ **DECIDED 2026-07-12: build with placeholder
   (everything is env-driven), but the permanent name is DUE AT GO-LIVE** —
   once production is indexed and widgets/watermarks spread the URL, it's
   locked. Start the name hunt now.
2. ~~Minors indexing~~ **DECIDED: index everything (status quo)** — player
   pages stay indexable with abbreviated names; kept OUT of the sitemap
   (crawlable via links, not promoted). Revisit at US entry (COPPA mode).
3. ~~UNCLAIMED shells~~ **DECIDED: index enriched shells** — min-content bar
   (name + city + ≥1 substantive datum) gates a `noindex` on truly-empty
   shells; build the gate in Phase E.
4. ~~Comparison pages~~ **DECIDED: yes, name competitors** with discipline:
   CONFIRMED matrix cells only, cited sources, "last verified" dates,
   quarterly re-verification, names never logos, no unsubstantiated
   superlatives. One-hour marketing-lawyer review before publish.
5. GSC access / domain registrar (owner-side, needed at go-live).

⬅ [[expansion-strategy-2026-07]] · [[tool-feature-matrix-2026-07]] · [[player-handles-plan]] · [[business-model]]
