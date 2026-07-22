---
updated: 2026-07-22
status: committed
tier: 1
area: social
effort: XL
source: owner
tags: [theme/social, type/plan, status/committed]
---

# Social feed & player moments — consolidated plan

> Consolidates the 2026-07-21 media-network discussion with the owner's
> 2026-07-22 additions (player moments: stat cards, Player of the Game,
> clipping). Companion docs: [[player-handles-plan]] (P0 shipped),
> [[live-streaming-plan]] (clipping depends on it).

## Owner rulings (LOCKED)

1. **Players never author free-form posts.** No open text/photo/video
   composer for players. Creators (clubs, leagues, media role) TAG players
   in their content. (Ruled 2026-07-22, confirming the 2026-07-21
   recommendation.)
2. **Players CAN share system-generated moments.** A player (or their
   parent) can push generated, game-data-backed content to their feed:
   their per-game stat card, their Player of the Game card, and later
   their clips. Publicly or privately. This is not authoring — the content
   is rendered by us from verified game data, so the moderation surface
   stays near zero.
3. **Basketball only, video highlights only** (2026-07-21, unchanged).
4. **Tag ≠ placement** (2026-07-21, unchanged): appearing on a tagged
   page needs standing affiliation or per-post collab approval; a parent
   approves placement on a player's page.
5. **Posts get likes and comments; PUBLIC posts can be reposted.**

## New requirements (owner, 2026-07-22)

- **R1 — Clipping (FUTURE, blocked on live streaming):** users clip
  segments from the live feed or the recorded game feed into shareable
  highlight clips; clips are postable. Build once the streaming plan
  ships a feed. DO NOT FORGET — also recorded in session memory.
- **R2 — Stat share:** on a finished game page, a player sees a
  "Share my stats" button → we auto-generate a unique-looking stat card →
  one tap shares it to their feed, publicly or privately.
- **R3 — Feed post types:** picture · video · stat-card share · Player of
  the Game card (+ CLIP later).
- **R4 — Player of the Game:** at the end of the game, before finalizing,
  the scorekeeper selects a Player of the Game. The top scorer is
  auto-suggested; the scorekeeper can override. Optionally snap a photo of
  the player right at the table.
- **R5 — POTG card:** landscape image; one half = player photo + their
  stat line, other half = the final score. Replaces the current game
  summary card. The player is auto-tagged in the content, and the game
  summary/recap records who was awarded POTG.
- **R6 — POTG self-post:** the awarded player can post their POTG card
  (photo + stats) to their own feed publicly or privately.

## Gap analysis (Claude's calls — flag if you want different)

| Gap | Call |
|---|---|
| "Players don't post" vs "players share cards" | Resolved by ruling 2: no free-form composer; system-generated cards/clips only. |
| Minors & who taps Share | 13+ players share from their own account. Under-13s have no accounts (COPPA): the PARENT gets the same share button on their kid's stat line and posts on the child's behalf. |
| Photo on POTG card | The table photo is stored at finalize regardless, but it only RENDERS on cards/pages when the player's `mediaConsent` is GRANTED. No consent → card uses initials/jersey avatar. |
| "Privately" means | Private = visible only to the player's approved followers. Public = anyone, and eligible for tagged-page placement per ruling 4. |
| "Friends" repost | We have follows, not friendships: any signed-in user can repost a PUBLIC post. Private posts are never repostable. |
| Game with no per-player stats (score-only leagues) | POTG picker still offered, just without a suggestion; card renders score half only. |
| Tie for top scorer | Suggest the tied leaders; scorekeeper picks. |
| Card rendering tech | Server-rendered image (satori/@vercel/og, 1200×630 landscape). Doubles as the game page's dynamic OG image — kills SEO backlog item #2 at the same time. |
| Feed vs existing homepage | The signed-in homepage rail stays; the social feed is a new surface fed by Follow (needs `Follow.playerId`). |

## Phases

**Phase 1 — Player of the Game at the whistle (BUILD NOW)**
- Schema: `Game.potgPlayerId` (+ relation), `Game.potgPhotoUrl` (data-URL,
  capped, house pattern like referee signature).
- Finalize API accepts `potgPlayerId` + `potgPhotoUrl`; validates the
  player actually played (fold lines) or is rostered on either team.
- Console review screen: POTG panel — suggested top scorer pre-selected,
  tap to change (both teams' lines), optional photo capture
  (`<input capture>`), skippable.
- Game page + scoresheet + recap show the award (photo gated on consent).
- Final-score notification mentions the POTG.

**Phase 2 — Cards (stat card + POTG card + share-out)**
- satori/@vercel/og renderer: `/api/games/[id]/card` (POTG landscape:
  photo+stats | score) and `/api/games/[id]/stat-card/[playerId]`
  (unique-looking per-player design).
- Replaces the current game summary card; becomes the game page OG image.
- "Share my stats" button on the game page for players/parents of players
  in that game: download / native share sheet (works BEFORE the feed
  exists — watermark + /p/handle link per player-handles-plan P2).

**Phase 3 — Feed foundations**
- Schema: `Like`, `Comment`, `Repost` (or self-referential Post), 
  `Post.visibility` (PUBLIC | FOLLOWERS), PostKind + STAT_CARD,
  PLAYER_OF_GAME, CLIP; `Follow.playerId`.
- Share buttons from Phase 2 now also create feed posts (system-generated
  kinds only for players; parent acts for under-13).
- Feed page + FeedCard component (image/video/stat-card/POTG renderers).

**Phase 4 — Engagement + creators**
- Likes/comments/reposts UI + notifications.
- Media role + MediaAffiliation + collab approval/placement states (the
  2026-07-21 sequence, unchanged — runs parallel/after Phase 3).

**Phase 5 — Clipping (FUTURE, gated on live-streaming-plan)**
- Clip editor over live/recorded feeds → CLIP posts. Revisit when
  MediaMTX/Bunny pipeline ships.

## Acceptance (Phase 1)
- Scorekeeper finalizes a game with stats → sees suggested POTG (top
  scorer), can override/skip, can snap a photo → game page and scoresheet
  show "Player of the Game: #23 Trey J." (photo only with consent), and
  the final bell mentions it.
