---
status: proposal
created: 2026-07-15
owner-decisions-needed: see §9
research: 8-source competitive sweep 2026-07-15 (TeamSnap, GameChanger, Hudl, MaxPreps, SportsEngine, BallerTV, vertical networks, COPPA/consent, photo economy)
---

# Content Feed Strategy — making SportsHub a place people open every day

Owner brief (2026-07-15): *"I want this to be a content-centric platform… almost
like a social network where people have their own feed based on players and
teams they follow… content creators like photographers could post and tag
players, teams, clubs… What should be on the home page? Should the home page
be different than your feed? How do we create value so people come back
multiple times a day, and generate more value for advertisers and revenue?"*

## 1. The recommendation in three sentences

**Home should BECOME the feed — but a layered one, never a pure social
stream.** The top of home stays a slim personal-utility band (actions due,
next event — the thing that already earns the daily open), and everything
below it becomes **My Feed**: a single ranked stream of cards from what you
follow, with a discover rail for what you don't yet. No separate "Feed" tab
in v1 — a second destination splits attention before the feed has earned it;
MaxPreps-style "Following/Latest" toggles can come later *inside* home.

## 2. Why (what the research actually says)

| Platform | Home surface | Lesson for us |
|---|---|---|
| TeamSnap | Schedule/tasks, no feed | Utility home gets **skipped** when incomplete — users route to the schedule tab. Reliability of "what's next for my kid" beats content variety. Their ad model (home takeovers, banners) monetizes attention WITHOUT a feed. |
| GameChanger | Team-centric: live streams from followed teams | Follow → live game content is the emotional core; family engagement (remote grandparents) is the growth loop. |
| Hudl Fan | Followed highlights feed | Feeds only work when **content supply is structural** (their film exists for coaching reasons; fan feed is a byproduct). Empty feeds kill the pattern. |
| MaxPreps | Hybrid: public "Latest" + opt-in "Following" tab | Validates the hybrid; monetizes at point of consumption (photo sales, $600/team coach analytics) — not just ads. |
| SportsEngine | Org-broadcast activity feed | Admin-authored content pushed to followers is the low-risk supply floor. |
| BallerTV | favorite player → auto-tag → notify | The follow→tag→notify loop is proven; **capture friction** is the bottleneck, not feed mechanics. |
| Strava/Untappd/Letterboxd | Home = followed feed + personal-progress anchor | Home-as-feed works **only with a utility anchor** on top. Cheap ranking (recency + hand-tuned signals + user overrides) beats black-box ML for trust. Badges raise engagement 50–100% (Untappd). B2B layer (venues/brands paying for visibility) is the money analog for us: clubs/leagues pay, families ride free. |

**Our unfair advantage vs. all of them:** content supply is already
structural. Every scored game auto-generates a recap (AI recaps are live),
scores/standings/leaders update themselves, clubs post announcements, and
the entity graph (kids → teams → clubs → leagues) means every family starts
with a warm follow graph on day one. Hudl's lesson — the feed can't be
empty — is already solved for us *without creators*. Creators make it richer;
they aren't the survival condition.

## 3. Home architecture (signed-in)

```
┌──────────────────────────────┐
│ ACTIONS BAND (slim, ≤2 rows) │  pay/RSVP/unread — never scrolls away empty
├──────────────────────────────┤
│ GAME-DAY BAND (conditional)  │  followed teams live now / final today
├──────────────────────────────┤
│ MY FEED                      │  ranked cards from follows (§4, §6)
│  …infinite scroll…           │
├──────────────────────────────┤
│ DISCOVER RAIL (every ~10     │  "near you" clubs/leagues/players to follow
│ cards, one rail)             │
└──────────────────────────────┘
```

- Anonymous users: same page minus the two personal bands — feed defaults to
  local/popular public content (recaps, finals, announcements). This is the
  content-centric landing the SEO strategy wants anyway.
- The current calendar/"your week" duplication the owner flagged resolves
  itself: the week strip shrinks into the actions band (next event + anything
  owed); the full list lives in Calendar where it belongs.
- Native app mirrors web exactly (mobile-is-mobile invariant); the app's Home
  tab renders the same feed via one `/api/feed` endpoint.

## 4. One feed, mixed media: the card grammar

One card component, seven variants — this is how video, photos, articles and
scores mix without the feed feeling like three products stapled together:

| Card | Source | Media |
|---|---|---|
| **Final score** | auto (game completed) | score hero, team colors |
| **Recap** | auto (AI recap) | headline + excerpt + hero image when present |
| **Live now** | auto (game live, followed team) | live score, pulsing badge |
| **Photo set** | creator/coach post | 1–4 image grid, "+N more" |
| **Video** | creator post / embed | poster + play (embeds v1: YouTube/Vimeo — MediaAsset already supports VIDEO_EMBED, zero storage cost) |
| **Announcement** | club/league admin | text card, club branding |
| **Milestone** | auto (standings jump, player career-high, streak) | stat chip card |

Every card carries: source chip (club/team/creator), tagged entities (tap →
their page), timestamp, reactions (reuse tonight's chat-reaction primitives),
and share. Same grammar on web and native.

## 5. Follow graph & the creator role

- **Follow targets:** players (via handles — shipped), teams, clubs, leagues,
  creators. The Follow model exists; extend the target types it lacks.
- **Warm-start (the cold-start killer):** auto-follow from the entity graph —
  your kids' teams, their clubs, their leagues, teams you coach. One-tap
  unfollow. A parent's feed is useful in the first 10 seconds of v1.
- **Creator = a club-attached role** (like Staff but content-scoped):
  photographers/videographers a club vouches for. They post to the club's
  audience, tag teams/players, and their content also surfaces on tagged
  players'/teams' public pages. Club admins can revoke; every creator post
  is attributable. Independent (un-attached) creators: not v1 — the club
  attachment IS the trust/safeguarding model.

## 6. Ranking without ML (v1)

`score = recency_decay × source_weight × type_weight + boosts`, hand-tuned:

- source: followed player 4 › my kid's team 3.5 › followed team 3 › club 2 › league 1.5
- type: video 2 › photo 1.6 › recap 1.3 › milestone 1.2 › final 1 › announcement 1 (announcements ignore decay for 24h — coach words matter)
- boosts: followed-team game today pins to game-day band; first-content-about-my-kid always top.
- **User overrides, not algorithms, earn trust** (Strava's backlash lesson):
  a "favorites first" pin and a plain "newest first" toggle from day one.

Instrument everything (PublicPageView already exists) — a learned ranker is a
season-2 decision made on real data, not now.

## 7. Consent & safety (the non-negotiable layer)

The 2026 COPPA amendments (compliance deadline April 2026) make biometric
identifiers personal information — so:

1. **No face recognition / auto-face-tagging. Period (v1+).** Tagging is
   manual, by roster name, by trusted adults (staff/creators). This sidesteps
   the entire biometric consent regime that GeoSnapShot/Waldo carry.
2. **Channel-scoped media consent** (industry waiver norm): extend
   `Player.mediaConsent` from one flag to scopes — `team-only` /
   `club+league` / `public feed`. A minor tagged without public consent:
   content stays visible in team-internal surfaces, is auto-held from the
   public feed. Consent capture stays delegated to clubs at registration
   (TeamSnap's pattern) but **logged** (who attested, when, scope).
3. **First-class opt-out:** a parent can untag/pull their kid from any post
   from the post itself, no support email. Removal cascades immediately.
4. Creator uploads of minors auto-queue for club-admin approval until the
   creator earns trusted status (N approved posts).

## 8. Engagement & revenue loops

**Daily-open ladder** (in order of build):
1. Game-day live band + final-score push (exists) → open after every game.
2. "New content about ⟨kid⟩" push — the single highest-emotion notification
   in this category (BallerTV's core loop).
3. Weekly team digest push (Sunday evening: week's results, next week, best content).
4. Badges/streaks (Untappd: +50–100% engagement) — season-2, after the feed breathes.

**Revenue ladder:**
1. **Sponsored feed cards** — local brands (TeamSnap sells exactly this);
   clearly labeled, capped ~1 per 10 cards. Advertisers get what they can't
   buy elsewhere: verified local sports families.
2. **Club sponsor placements** — clubs sell their own sponsors a slot on
   their club/team pages and feed cards; SportsHub takes a listing fee or
   cut. (Untappd's B2B lesson: the org side pays, families don't.)
3. **Creator photo commerce** (needs object storage): tag-notify-purchase
   per athlete — the ONLY commercially proven photo money loop. Pixieset
   model: free creators pay ~15% commission, subscribed creators 0%; plus a
   **club/league rebate toggle** (~10% of net back to the org) because the
   rebate is what wins club exclusivity deals in the real market.
4. Premium personalization later (Letterboxd monetizes feed filters) — only
   after the free feed is loved.

## 9. Owner decisions needed before build

1. **Public feed of minors' content: in or out for v1?** Team/club-internal
   feed is a materially lower consent bar. (My reco: v1 feed defaults to
   community-visible = signed-in members of that club/league; public visibility
   only for content whose tagged players all have public-scope consent.)
2. **Object storage vendor** (photos/video uploads) — R2/S3/Backblaze; this
   gates photo sets, chat photos (backlog), creator commerce.
3. **Creator commerce take rate** (Pixieset-style 15%/0% vs flat) + whether
   the club rebate ships at launch.
4. Naming: "My Feed" vs "Home" vs "The Hub".

## 10. Build phases (once approved — NOT scheduled)

- **P1 — Feed home (2–3 nights):** `/api/feed` (existing content types only:
  recaps, finals, live, announcements, milestones), card grammar web+native,
  warm-start follows, ranking v1, discover rail, anonymous variant. Zero new
  storage. This alone makes home content-centric.
- **P2 — Creators & media (gated on storage decision):** creator role,
  photo-set posts w/ manual roster tagging, channel-scoped consent
  enforcement + opt-out, "about your kid" push, video embeds.
- **P3 — Money:** sponsored cards, club sponsor slots, photo commerce w/
  rebate toggle.

*Related: business-model.md §5 (open decisions), player-handles-plan (P2
social layer — this document subsumes its feed portions), seo-strategy
(anonymous feed = crawlable content surface). Full research briefs archived
in the session scratchpad; key sources cited inline above.*
