# Public Site & Content Ecosystem — Detailed Plan

> **STATUS: APPROVED — P1 IN BUILD (2026-07-05).** The strategy discussion
> happened 2026-07-05; the owner approved the plan as drafted PLUS the
> amendments in §0 and the monetization model in §12. §11's three
> micro-decisions stand unchanged.

Owner brief (2026-07-05): the homepage is the public face — parents and the
general public land there. It must be a place people COME BACK to and
consume: news (huge), video highlights, stats, leaders, AI blurbs. Content
comes from creators (influencers / videographers / photographers — club,
team, or league affiliated, or independent) tagged to teams. Entity pages
(league / club / team / player / referee) carry stats and leaders. Later:
participant-gated star ratings and reviews.

Research grounding: MaxPreps (stats/scores/leaders/news as an SEO content
destination — nav is literally Stat Leaders · Photos · News · Streams),
GameChanger (auto game recaps "newspaper-style", auto highlight clips,
family subscription), youth-safety consent norms (parental media release
before ANY public image of a minor, revocable, activity-over-child framing).

---

## 0. Strategy amendments — owner-confirmed 2026-07-05

1. **Density-graceful homepage (cold start).** A destination homepage is only
   as alive as its content volume, and ours starts thin. Content sections
   render only when data exists; no feed chrome (filter chips, infinite
   scroll, follow-ranked feeds) until volume justifies it. Acquisition
   surfaces (club directory, tryouts) stay prominent while the feed is thin
   and recede as it fills. AI recaps are the self-generating volume engine.
2. **Platform-centric feed, club-branded views.** Content lives in ONE
   platform pool (Post + PostTag distribution); club/team/league pages are
   branded views into that pool. The "club content headquarters" vision is
   the dashboard-side story (composer, approval queue, later syndication) —
   NOT a per-subdomain content silo.
3. **Acquisition pages.** Dedicated `/for-clubs` and `/for-leagues` pitch
   pages; the homepage persona CTA band links to them. One site — the
   product is the marketing — but the B2B pitch gets a proper home.
4. **Creator vetting (replaces open independents).** Every creator is vetted
   either by the platform or by a club/team/league — orgs add their own
   videographers/photographers/writers and grant them upload. No open
   independent-creator signup at launch; that lifecycle waits for demand.
5. **P4 reprioritized.** The syndication hub — designed as a PAID club
   feature from day one — moves ahead of reviews. Reviews become P5.

## 1. Strategy — from tool to destination

Today the platform is a TOOL people visit to do a task (register, score,
manage). The homepage's job is to make it a DESTINATION with a reason to
return between tasks. The flywheel:

    games get scored (we have this)
      → stats + recaps + highlights are generated/posted
        → parents/kids come to consume & share
          → clubs/leagues see the audience and bring more programs
            → more games get scored

Two unfair advantages we already own:
- **The event stream.** Every scored game has play-by-play — we can
  auto-generate a GameChanger-style recap blurb for EVERY game with zero
  human effort (AI recap: lead changes, top scorers, key runs).
- **The trust graph.** We know who's a parent of whom, who played in which
  game, who coaches what — enabling participant-gated reviews and
  personalized feeds no generic CMS can do.

## 2. Audiences and their first-30-seconds job

| Visitor | They came to… | Homepage must offer |
|---|---|---|
| Parent (signed in) | see MY kid: last game, next game, stats, photos | personalized "Your teams" rail at the very top |
| Kid/player (13+) | my stats, my highlights, leaders (am I on the board?) | leaders + player pages + highlight reels |
| General public / grandparent (anonymous) | follow a team/league casually, read news | scores strip, news feed, browse without login |
| Coach/club staff | scores around the league, own team's content | scores + club/team quick links (they mostly live in dashboard) |
| Referee | schedule, assignments | a slim "officials" entry point (dashboard is their home) |
| Club/league shopper (acquisition) | "should my org use this?" | proof: live scores, real content, a "For clubs & leagues" CTA |

Principle: ONE homepage, two states. Anonymous = regional/popular content +
acquisition CTAs. Signed-in = "Your teams" feed first, general content below.
No separate marketing site — the product IS the marketing (MaxPreps model).

## 3. Homepage blueprint (section order, with why)

### Anonymous state
1. **Scoreboard strip** (top, horizontal scroll): today's/live games with
   live scores (LIVE badge), tap → public game page. WHY: instant proof of
   life; the single most "come back later" element. (Data exists today.)
2. **Hero / news lead**: the top story — editorial pick or hottest AI recap
   with photo. WHY: news is the owner's #1 content bet; lead with it.
3. **News & recaps feed** (main column, infinite): mix of creator posts,
   AI game recaps, league announcements. Filter chips: All · My area ·
   League · Club. WHY: the consumption engine.
4. **Stat leaders rail** (side column): league leaders (PTS/REB/AST), tab
   per league; "Full leaders →". WHY: MaxPreps' most-visited surface; kids
   check ranks obsessively.
5. **Highlights reel row**: horizontal video cards (creator clips). WHY:
   video is the highest-engagement format; also the influencer showcase.
6. **Browse rails**: leagues near you, clubs directory (188 Ontario clubs
   already imported = SEO surface), upcoming tryouts/camps (existing
   marketplace data — acquisition tie-in).
7. **Persona CTA band**: "Run a club?" / "Run a league?" / "Referee?" →
   targeted onboarding. WHY: acquisition without polluting the content top.
8. Footer: standard.

### Signed-in state (parent example)
1. **"Your teams" rail** replacing hero: per followed/child team — last
   result, next game (time/venue), kid's line from last game ("Maya: 12 PTS
   · 5 REB"), new photos/clips tagged to their team. WHY: the retention
   loop; GameChanger's family engine.
2. Scoreboard strip (their leagues first), then the general feed 3–6.

### Mechanics
- Follow model: FOLLOW any team/club/league (parents auto-follow kids'
  teams). Follows drive the feed + (later) notifications/digest emails.
- Every card deep-links to entity pages (below) — homepage is a router
  into the site's depth. All public pages = SEO pages.

## 4. Entity page hierarchy

| Page | Contains | Status |
|---|---|---|
| League (public) | standings, schedule/scores, leaders board, news tagged to league, teams | standings/schedule exist; leaders + news feed to build |
| Club | about (exists), teams, news/photos tagged, honors, reviews (later) | public club page exists; content surfaces to build |
| Team | roster (respecting privacy), schedule/results, team stats, leaders, tagged content | /team hub was UI-redesign D3 (pending) — merge into this plan |
| Player | season stat line + game log, highlights they're tagged in, (13+ self-managed; minors = consent-gated visibility) | to build; consent model first |
| Referee | profile, certifications, games officiated (reviews LATER, likely never public — owner unsure) | profile exists (private); public page deferred |
| Game (public) | already built: live page + box + play-by-play + scoresheet | done ✓ |

## 5. Content lifecycle (creators → tags → approval → distribution)

### Creator roles
New capability, not a new nav world: a **CreatorProfile** (kind:
INFLUENCER | VIDEOGRAPHER | PHOTOGRAPHER) attachable to any user.
Affiliation: club / team / league (via existing UserRole scoping pattern)
or INDEPENDENT. Affiliated creators are trusted by default; independents
publish through approval.

### Content model
- **Post**: kind (ARTICLE | PHOTO_SET | VIDEO | RECAP_AI | ANNOUNCEMENT),
  title, body (rich text), authorId/creatorProfileId, status
  (DRAFT | PENDING_REVIEW | PUBLISHED | REJECTED | TAKEN_DOWN), publishedAt.
- **MediaAsset**: image/video, storage URL, poster, duration; belongs to a
  Post.
- **PostTag**: polymorphic — teamId | clubId(tenant) | leagueId | gameId |
  playerId?. Tags are DISTRIBUTION: a post tagged to a team appears on the
  team page, its club page, its league feed, followers' homepages.

### Approval & safety (non-negotiable, minors involved)
- **Media consent per player**: `Player.mediaConsent` (GRANTED | DENIED |
  UNSET) collected from the parent (registration + settings). Player-tagged
  content requires consent = GRANTED for every tagged minor. Best practice
  (CPSU/SafeSport): consent revocable any time → revocation auto-hides
  tagged content; prefer activity-focused imagery; default to first-name +
  initial or jersey number for minors in public stats UNLESS consent grants
  full name (owner decision below).
- **Approval chain**: content tagged to a team/club → that club's staff
  approve (queue in club dashboard). League-tagged → league owner. Trusted
  affiliated creators can be set to auto-publish by their org. Independents
  always queue. Platform admin = global takedown + creator suspension.
- **Report button** on all public content → moderation queue.

### Video strategy — OWNER VISION (2026-07-05): the central content hub
The end-state is bigger than hosting: **this platform becomes the club's
content headquarters** — official club/team/league creators (and possibly
platform-employed videographers) upload natively, the content LIVES here,
and a distribution dashboard **cross-posts to every linked social platform**
(YouTube, Instagram, TikTok, Snapchat, …) — "post once, everywhere," with
per-platform status. Clubs get full control of a single pipeline instead of
juggling five apps.

Staged path (owner-approved to start small):
- **P2 (PoC)**: YouTube/Vimeo embeds — proves the feed/tagging/approval
  loop with zero infra. Photos native on Vercel Blob from day one.
- **P3**: native uploads (Mux or Cloudflare Stream) — content lives here;
  ties into the AI/Film-Room vision (live-scoring-plan phase 2).
- **P4 — Syndication hub**: linked social accounts per club/creator (OAuth:
  YouTube Data API, Instagram Graph, TikTok Content Posting API, Snapchat),
  a composer that publishes a Post natively AND fans out to selected
  linked accounts, with per-platform delivery status + retry. New models:
  SocialAccount(ownerScope, platform, tokens), PostSyndication(postId,
  platform, status, externalUrl). NOTE: each platform's posting API has an
  app-review process — start those approvals EARLY when P4 nears.

## 6. News engine — three sources, one feed

1. **AI game recaps (differentiator, cheap, infinite).** On finalize, a
   worker turns the event stream into a 120–200-word recap: final, line
   score, top performers, biggest run, fouls drama. Claude API generates;
   stored as Post(kind: RECAP_AI, tags: game/teams/league). Owner decision:
   auto-publish vs draft-for-approval.
2. **Creator posts** (section 5).
3. **League/club announcements** — the existing Announcement model gets a
   `public` flag and flows into the same feed.

## 7. Stats surfaces (P1 — buildable NOW)

- **Season aggregation**: per player per season from PlayerStat +
  ATTENDANCE events (games-played denominators — built for exactly this).
  Nightly recompute or on-finalize incremental.
- **Leaders**: by league (and division): PPG/RPG/APG/SPG/BPG + totals,
  min-games threshold (e.g., played ≥50% of team games) to keep ranks fair.
- Surfaces: homepage rail → league leaders page → team stats tab → player
  page. Same fold-style pure lib + tests as scheduler/standings/fold.

## 8. Ratings & reviews (later phase, design notes)

- Review model EXISTS and is hidden behind `{false && ...}` — reuse.
- **Participation-gated**: only users provably connected in-season (parent
  of rostered player ↔ club/coach; club ↔ league) may review; enforced from
  rosters/registrations. One review per relationship per season (DB unique
  already patterned in authz-integrity SQL).
- **End-of-season prompt**: when a season completes, email/notify eligible
  parents: "rate your experience with {club} / {coach}".
- Aggregate stars public on club pages once n ≥ 3 (avoid identifying a
  single reviewer); coach ratings: aggregate-only, never public raw
  comments (owner instinct: not fully public — respected).
- Referees/leagues reviewable? OPEN — owner undecided. Recommendation:
  leagues rateable by club owners only (they're the customers); referees
  internal-only feedback to the league (assignment quality), never public.

## 9. Data model sketch (new)

```
CreatorProfile(id, userId, kind, bio, portfolioUrl,
               tenantId?/teamId?/leagueId?  → null = independent,
               trusted Boolean, status)
Post(id, kind, title, slug, body, coverAssetId?, authorId,
     creatorProfileId?, status, publishedAt, aiModel?)
MediaAsset(id, postId, type IMAGE|VIDEO_EMBED|VIDEO_NATIVE, url,
           posterUrl?, durationS?, width?, height?)
PostTag(id, postId, teamId?, tenantId?, leagueId?, gameId?, playerId?)
Follow(id, userId, teamId?/tenantId?/leagueId?)
Player.mediaConsent  MediaConsent @default(UNSET)
Announcement.public  Boolean @default(false)
```

## 10. Phasing

| Phase | Scope | Est. |
|---|---|---|
| **P1 — Stats + skeleton home** | Season aggregation lib + leaders (league/team/player surfaces); homepage v1: scoreboard strip, leaders rail, news feed seeded by AI recaps + public announcements; Follow model + "Your teams" rail; player pages w/ consent-gated naming; `/for-clubs` + `/for-leagues` pitch pages; `hasFamilyPass()` entitlement stub | 2–3 sessions |
| **P2 — Creator content** | CreatorProfile (org-vetted per §0.4) + MediaAsset; photo upload (Vercel Blob) + YouTube embeds; approval queues in club/league dashboards; report/takedown; homepage highlights row + full feed | 2–3 sessions |
| **P3 — Native video + Family Pass launch** | Mux/Cloudflare Stream uploads; creator public profiles & credits; digest emails ("your week in {league}"); real-time "your kid" notifications; premium gating flips on (§12) | 2 sessions |
| **P4 — Syndication hub (paid club add-on)** | Linked social accounts (OAuth), post-once-distribute-everywhere composer, per-platform delivery status (§5); start platform app-reviews EARLY | 2–3 sessions |
| **P5 — Reviews** | Un-hide Review system, participation gating, season-end prompts, club star aggregates | 1–2 sessions |

P1 has zero dependencies and directly extends this weekend's work (it IS
the "season stats" recommendation, now framed as the homepage's engine).

## 11. Owner decisions — CONFIRMED 2026-07-05

1. **Minor privacy default**: ✅ "first name + last initial" on all public
   stats/rosters/leaders; full names visible to signed-in participants of
   that league/club; parents opt INTO public full names via media consent.
2. **AI recaps**: ✅ auto-publish on finalize (league owners get
   edit/takedown).
3. **Video**: ✅ start with embeds as proof of concept, but the committed
   direction is the central content hub with social syndication (§5) —
   native hosting, then post-once-distribute-everywhere.
4. Reviews scope confirmation when the reviews phase nears (leagues?
   referees? — §8 recommendation stands until then).

## 12. Monetization model — owner-confirmed 2026-07-05

Principle: **the record is free, the relationship is premium.** The public
record of the game — scores, box totals, standings, leaders, AI recaps,
schedules — is always free; it is the flywheel, the SEO surface, and the
viral loop (kids checking ranks). Depth about YOUR kid is the premium
**Family Pass** (GameChanger-proven ~$10/mo price anchor):

| Free (the flywheel) | Family Pass (the relationship) |
|---|---|
| Live scores, box totals, standings | Real-time "your kid scored" push/text + live game thread |
| AI recaps incl. top performers | Personalized post-game recap: full line, per-quarter splits, season trends |
| League leader boards | Full game log & season history, efficiency, percentile vs. league |
| Highlight thumbnail + short preview | Full clips featuring your kid: watch, download, share |
| Team schedule, roster, team page | Full-depth player profile; shareable/printable player card |
| — | End-of-season keepsake: auto-generated season report / highlight reel |

- **Teaser mechanics**: free surfaces advertise locked depth in-context at
  the emotional peak (right after a game): "Maya's season: 8 games,
  trending ↗ — see her full game log 🔒". Card already on file from
  registration payments → one-tap unlock; our funnel is shorter than
  GameChanger's.
- **Keepsakes as one-time purchases** ($15–25 at season end) monetize
  non-subscribing families; zero extra content cost.
- **Club-bundled Family Pass**: clubs can bundle the pass into season fees
  via the obligation engine at a discounted per-family rate — the club is
  the hero ("all our families get live alerts and highlights"), we get
  predictable per-roster revenue, and it defuses club resentment of
  direct-to-parent upsell. Direct subscription remains for unbundled clubs.
- **Full revenue stack**: clubs/leagues pay for management (existing
  payments platform) → families pay Family Pass + keepsakes → coaches pay
  recruiting tools (later, once player profiles have depth) → syndication
  hub as a paid club add-on (P4).
- **Sequencing**: everything FREE through P1/P2 — build the habit and learn
  from usage which surfaces parents hit hardest, then draw the paywall from
  evidence. Premium launches with P3 (native video + notifications make the
  right column real). P1 ships a `hasFamilyPass()` entitlement helper that
  returns true for everyone, so flipping premium on is a policy change, not
  a refactor.
