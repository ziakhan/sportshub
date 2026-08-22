---
updated: 2026-07-20
tags: [theme/streaming, type/plan, status/proposed]
---

# Live streaming per game — architecture plan (v2)

> **Status: PHASE 1 BACKEND BUILT 2026-08-21 (commit 0637741, local + staging only, not on production).**
> Built: schema (StreamChannel, GameStream, League.streamingEnabled), the shared viewer query
> module, placement + assigner with the take-over guard, admin channel CRUD, placement API
> (PlatformAdmin or the court's scorekeeper), the public per-game stream endpoint, and
> **all three web UI surfaces** (commit 478b2c5): HLS player + preview tile, the game-page
> dock in four states, LIVE badges on four public surfaces via one batched lookup, the
> scorekeeper confirm-by-picture strip with its own secret-free candidates endpoint, and the
> Streams ops wall with the phase-2 signal probe brought forward.
>
> **NOT built:** native (iOS/Android) playback — the mobile app carries no video dependency,
> so parity is an open gap, not an oversight. No health cron (deploy-time work; the route it
> should live at is named in `lib/streaming/health.ts`). No manual go-live/end UI and no
> per-game manual override UI (`mapGameManually()` is library-only). No stale-channel
> alerting beyond the on-page red state. Phase 3 (VOD, score overlay, consent capture, paid
> access) untouched.
>
> **Held local by owner instruction (2026-08-21): nothing ships to production OR staging
> until the feature is complete and the owner has reviewed it.**
>
> Rulings made during the build, owner to confirm: a finished game reads as **ended** even
> inside its clock window (otherwise the earlier game's page plays the next game's picture);
> placement is court XOR venue; viewer policy defaults to **SIGNED_IN** via `STREAM_VIEWER_POLICY`
> in `lib/queries/game-stream.ts`; flipping it to PUBLIC also needs an entry in `lib/public-paths.ts`.
>
> Open, needs an owner ruling: **a game with no season can never stream**, because the league
> consent flag is reached through `game.season.league` — one-off games have no consent path.
>
> Original plan below, unchanged. Owner
> requirements: stream 5–7 parallel games via a small pool of cameras with fixed endpoints;
> "Watch Live" on the public game page; **fewer cameras than courts** (cameras move between
> venues — economics matter); and **deliberate human intervention** because people will put
> the wrong camera on the wrong court.

## Core model: three layers, one human touch

| Layer | What it is | How it changes |
|---|---|---|
| **Channel** (fixed) | A physical camera rig + its permanent RTMP ingest URL/key + permanent HLS playback URL | Never. Set up once per rig. |
| **Placement** (day-of) | Which court/venue that rig is sitting at right now | A human moves the camera and a human confirms it — **by looking at the picture**. |
| **Game mapping** (derived) | Which game the stream shows on the site | Automatic, from placement + the schedule. Nobody manages this. |

The v1 mistake was welding layer 2 to layer 1 (permanent court binding). With fewer cameras
than courts and multiple venues, placement is dynamic — so it gets its own layer with its
own cheap, mistake-proof human interaction.

## The human interaction: scorekeeper confirms by picture

The scorekeeper is already at the court, already signed in to score this exact game. When
they open the scoring console (and on the ops dashboard for admins), they get a stream strip:

- **Camera already placed at their court** → strip shows a small **live preview** of that
  channel: "📹 Camera B is at your court — is this your court?" One tap: ✓ confirm (or
  "wrong camera" → picker below).
- **No camera placed here** → "Is there a camera at your court? Tap its picture:" — a grid
  of live muted preview tiles, one per channel that is currently **hot** (pushing signal).
  They tap the tile showing *their* court.

Tapping a tile sets that channel's placement to this court, which instantly (re)maps this
game and the rest of today's games on this court. **Picking by picture is the anti-mistake
mechanism**: physical stickers can be swapped, labels misread — but the scorekeeper cannot
mistake someone else's gym for the court they are sitting at. The wrong-camera-on-wrong-court
error self-corrects at the first game of the day, before families ever see a wrong stream.

Guard rails:
- **The picker only offers cameras that could be in the room**: a rig with no placement at
  all, or one already placed in THIS building (at any of its courts, or at the building
  itself). `canScoreGame()` admits team managers and assistant coaches of either team, so an
  unscoped list would hand a few hundred people a playable link into every gym we film —
  including cameras filming leagues that never turned streaming on. Enforced in
  `api/games/[id]/stream/candidates`.
- A channel places at one court at a time. Claiming a channel that is currently mapped to
  another court's in-window game gets a hard warning ("Camera B is showing Court 2's live
  game at Central Gym — take it anyway?") and the take-over is audit-logged.
- Placement confirm/claim is available to the game's scorekeeper and to workspace admins
  (who see the same preview grid remotely on the Streams dashboard and can drag cameras
  between courts from the office).
- Games already COMPLETED keep their historical `GameStream` row untouched (VOD integrity).

## Camera economics

Because placement is dynamic, **any camera count works** — 2 rigs or 10. A rig covers one
court per time block; move it between venues across the week. Start with 2–3 rigs on the
marquee courts and grow only when demand shows up. (Later nicety, not phase 1: a "wants
camera" flag on games so the weekly camera placement plan writes itself.)

## Vendor abstraction (works with all three of the owner's options)

The platform never talks to cameras or transcoders. A `StreamChannel` row stores two URLs:

```
camera (RTMP out) ──▶ ingestUrl + streamKey   [vendor's problem]
vendor transcodes ──▶ playbackUrl (.m3u8)      [CDN, fixed per channel]
```

Requirements to hand the vendor: N persistent channels; fixed RTMP ingest per channel;
fixed HLS playback URL per channel, live whenever ingest is hot. Nice-to-have: LL-HLS,
channel-state API, cloud recording with time-addressable archive (enables phase-3 VOD).
Standard HLS latency (10–30s) is fine for this audience — don't pay for WebRTC latency.

## Field notes from the first real camera (2026-08-22)

Proven end to end with an XbotGo rig: camera to Cloudflare to our player, stable
(40 consecutive checks, no drops), five renditions, about 15s of latency from
two-second segments.

Three things learned the hard way, all of which will matter on game day:

1. **Cloudflare Stream Live requires purchased storage.** Live playback is served
   out of the recording pipeline, so with zero storage minutes: recording on means
   the ingest connection is refused outright, recording off means it connects but
   no manifest ever appears. $5 buys 1,000 minutes, and deleting a recording
   releases the space immediately, so a nightly cleanup keeps it permanently at
   the base tier. New channels must therefore default to recording ON.
   *Done in code:* the provider default is `automatic`, and every live input we
   create carries `deleteRecordingAfterDays: 30` — Cloudflare's own minimum, since
   1 and 7 are both refused. That caps the worst case structurally rather than
   depending on a cron; the nightly delete job is still what keeps storage near zero.
2. **Stopping the stream in the XbotGo app does NOT drop the broadcast.** The clock
   stops and the UI says stopped while packets keep flowing; only force-quitting the
   app ends it. A rig left like this keeps costing delivery and storage and keeps a
   game page showing an empty gym. Worth surfacing "streaming for 6h" on the ops
   page so a forgotten camera stands out.
3. **The score will outrun the picture.** Live scoring updates instantly while video
   trails by ~15s, so every basket is spoiled before it is seen. Options: delay the
   score to match (recommended, free), enable low-latency HLS (beta, ~3-5s), or
   accept it. Owner decision open.

## Camera hardware (researched 2026-07-20)

**How the XbotGo Chameleon works — yes, it needs a phone.** The Chameleon is a motorized
gimbal with its own dual tracking cameras + AI chip; your phone clamps into it (case off,
lenses aligned) and **the phone's camera is what records and streams**. The Chameleon's AI
watches the game and physically pans/tilts the phone. Phone requirement: Snapdragon 888+ /
Apple A12+ (i.e. iPhone XS or newer, recent Android flagships — used ones are ~$200–300).
The XbotGo app streams to **any custom RTMP URL**, no subscription for core features.
A phone-based rig has a hidden advantage: built-in LTE/5G upload when gym Wi-Fi is bad —
uplink (~5 Mbps up per camera) is usually the real constraint in venues.

Rig options, cheapest first:
1. **Trial rig (~$150–250/court): used phone + tall tripod + Larix Broadcaster (free RTMP
   app).** Fixed ultrawide shot from elevated midcourt covers a basketball court fine — no
   panning, perfectly watchable. Zero-risk way to prove demand before buying trackers.
2. **Recommended (~$700–800/court one-time, $0/mo): XbotGo Chameleon (~$500) + used
   flagship phone.** Sports-aware AI pan/zoom (basketball first-class among 8+ sports),
   custom RTMP out, no subscription.
3. **No-phone standalone ($499): OBSBOT Tail Air** — 4K PTZ camera with native RTMP/RTSP.
   But its AI is generic human-tracking, not sport/ball-aware — weaker framing for
   basketball than XbotGo. Only pick if the no-phone property really matters.
4. **Avoid at our scale — walled gardens with forever-subscriptions:** Veo Cam 3 ($1,533 +
   $109/mo + Veo Live add-on $12/mo per camera), Pixellot Air NXT (hardware + mandatory
   Pixellot subscription), Hudl Focus (sales-quoted, streams into Hudl TV). All want the
   stream living on *their* platform — they fight our fixed-RTMP architecture and cost
   more per court per year than our whole stack. (7 courts on Veo ≈ $10.7k hardware +
   ~$850/mo forever vs ~$5.5k one-time on XbotGo rigs.)

## Infrastructure cost menu (researched 2026-07-20)

Working math: ~3.5 Mbps stream ≈ 1.6 GB/hour per viewer. A typical game = 90 min × ~30
concurrent viewers ≈ **45 viewer-hours ≈ 72 GB ≈ 2,700 delivered minutes**.

| Option | Fixed cost | Per game (~30 viewers) | Notes |
|---|---|---|---|
| **A. Self-host origin + Bunny CDN** ⭐ | ~$10/mo VPS | ~$0.70 | MediaMTX (free, one binary) on a small VPS remuxes RTMP→HLS with near-zero CPU (no transcode — pass through the camera's 1080p). Bunny CDN pull zone in front at $0.01/GB (NA/EU). We mint our own stream keys → unlimited fixed channels, URLs never change, no vendor lock. Recording = MediaMTX writes segments to disk → Bunny storage ($0.01/GB) for phase-3 VOD. |
| **B. Cloudflare Stream Live** | $0 idle | ~$2.70 delivery + $0.45/mo storage per recorded game | Zero-ops managed. Ingest free, **ABR transcoding free**, unlimited live inputs, $1 per 1,000 delivered minutes, $5 per 1,000 stored minutes/mo. 3–4× option A but includes multi-quality + automatic recordings. |
| **C. Castr (flat-rate)** | $50–200/mo | $0 | Akamai CDN, embed player, paywall built in. Stream-count limits per tier — needs a sales question for 7–8 channels. Wins only if viewership grows a lot. |
| **D. AWS IVS** | — | Basic input $0.20/hr/channel + delivery | Most expensive fit for this pattern (per-channel-hour input + premium delivery). Skip. |

Monthly picture at ~60 streamed games/mo: **A ≈ $50–80** · B ≈ $170–200 · C = flat tier.
At 10 viewers/game, A is ~$25/mo all-in. Option A is also the only one where the "fixed
endpoints forever" property is fully ours (we own the origin URLs).

**Recommended cheapest stack:** XbotGo rigs → MediaMTX on a dedicated cheap VPS (NOT the
prod box — isolation) → Bunny CDN pull zone → hls.js/expo-video players. Single 1080p
rendition to start (no ABR); if LTE viewers struggle, either drop cameras to 2.5 Mbps or
move to option B, which adds ABR for free. Migration between A↔B is trivial by design —
channels are just URL pairs in `StreamChannel` rows.

## Schema (add to pending Neon runbook batch when shipped)

```prisma
enum StreamChannelStatus { ACTIVE  DISABLED }
enum StreamAssignSource  { AUTO  MANUAL }

model StreamChannel {
  id             String  @id @default(uuid())
  name           String                    // "Camera A" — matches the sticker on the rig
  ingestUrl      String                    // rtmp://ingest.vendor.com/live  (FIXED)
  streamKey      String                    // per-channel secret             (FIXED)
  playbackUrl    String                    // https://cdn.../a/index.m3u8    (FIXED)
  status         StreamChannelStatus @default(ACTIVE)
  // Placement — where the rig sits RIGHT NOW (day-of, human-set)
  currentCourtId String?
  currentCourt   Court?  @relation(fields: [currentCourtId], references: [id])
  currentVenueId String?                   // single-court venues / court-less games
  currentVenue   Venue?  @relation(fields: [currentVenueId], references: [id])
  placedAt       DateTime?
  placedById     String?                   // who confirmed (scorekeeper/admin) — audit
  provider       String?
  notes          String?
  lastSeenLiveAt DateTime?                 // stamped by the health probe
  gameStreams    GameStream[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model GameStream {
  id        String @id @default(uuid())
  gameId    String @unique
  game      Game   @relation(fields: [gameId], references: [id], onDelete: Cascade)
  channelId String
  channel   StreamChannel @relation(fields: [channelId], references: [id])
  source    StreamAssignSource @default(AUTO)  // MANUAL survives assigner re-runs
  startedAt DateTime?                          // manual go-live override
  endedAt   DateTime?                          // manual cut (OT ran long, etc.)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([channelId])
}
```

`GameStream` rows are materialized (not derived at read time) because manual overrides need
a home, the game page query is one join, and the rows are the future VOD index (game X =
channel Y from T1→T2 → clip the channel archive). Placement changes only remap games that
are still SCHEDULED/upcoming today on the affected courts.

## Assignment mechanics

- **On placement change** (scorekeeper tap or admin drag): remap today's not-yet-completed
  games on that court (and un-map them from a channel that just left). Source AUTO.
- **Assigner re-run** (schedule change + nightly): converges GameStream rows for games on
  courts with a currently-placed channel; never touches MANUAL rows; warns on overlapping
  windows for one channel (that's also a court double-booking, i.e. a schedule bug).
- **Manual per-game override** (admin): rare escape hatch; sets source MANUAL.

## Playback window — when the button shows

Watchable when a `GameStream` exists, channel ACTIVE, and: `Game.status == LIVE` (scorekeeper
signal — strongest), **or** now ∈ `[scheduledAt − 15min, scheduledAt + duration + 30min]`
(fallback; absorbs OT), with `startedAt`/`endedAt` overriding both when set. Page states:
**Upcoming** ("Live at 6:30") → **● WATCH LIVE** (player) → **Ended**.

## Surfaces (⚠️ ALL-PLATFORMS PARITY — web + mobile-web + Android + iOS in one pass)

1. **`/live/[gameId]`** public game page: HLS player docked above the existing live
   score/box/play-by-play → the single game center. Web: hls.js (native HLS on Safari).
2. **Schedule rows / game cards**: red ● LIVE badge → game page.
3. **Native app**: `expo-video` plays HLS natively; same window logic via API.
4. **Scoring console**: the stream strip (confirm/claim by picture) — the one human touch.
5. **Workspace → Streams** (admin ops): channel grid — live preview tile, signal health
   (🟢 fresh / 🔴 stale via manifest probe cron), current placement, now playing, up next;
   drag placement between courts; copy-buttons for ingest URL/key; audit trail of
   placements and take-overs.

## Game-day runbook

1. Whoever transports the rig sets it at its court, opens the saved XbotGo preset, taps go.
2. Scorekeeper opens scoring console → taps the preview that shows their court (or just
   confirms). ~5 seconds, once per court per day.
3. Everything else is automatic: game pages light up/go dark; dashboard shows green
   channels; a red channel with a game in window is the only thing needing a human.

## Privacy flag (owner decision needed — minors on camera)

Streaming kids is a bigger consent surface than photos. Recommend: league-level
`streamingEnabled` toggle (default OFF) + per-league visibility (public / signed-in /
members) + a consent line in season registration. Related: [[player-profile-privacy]],
[[privacy-pipeda-casl]].

## Viewer discovery at scale (proposed)

Owner's question: with many cameras across many venues, how does a viewer find the right
stream — all cameras, per venue, or something else?

**Recommendation: none of those. The unit of discovery is the GAME, never the camera, and
in the ordinary case there is no picker at all.** The mapping layer already answers the
question the picker would ask, so the right design is to keep spending that answer rather
than hand it back to a parent as a choice.

This is also what the category does. Of the platforms that have a real consumer app —
NFHS Network, GameChanger, Veo Live, Hudl TV — every one of them discovers by
follow-a-team plus a push notification, with a browsable schedule as the fallback and a
shared link as the shortcut. Only LiveBarn makes people pick a venue and then a camera,
and it gets away with it because its buyer is a hockey parent who already drives to that
rink every week and there is no schedule in the product to bind to. We have the schedule.
Making a parent translate "my daughter's game" into "Court 3 at Central Gym" would be
throwing away the only thing we have that LiveBarn does not.

**The three layers, and where a picker is earned.**

1. **Find the game — existing surfaces, unchanged.** Team page, `/scores`, league page,
   and the link a coach texts. The `Watch live` badge on a game card is already the
   affordance; nothing new is needed for a parent who knows whose game they want, which
   is nearly everyone. The single addition worth building is a **"Live now" rail pinned
   to the top of `/scores`**, holding only games that have a picture right now. On a
   Saturday with 200 games the board is long, and someone who came to *watch* rather than
   to check a score needs the watchable subset in one place. This is NFHS's board pattern
   and it is the correct one at our scale.
2. **Watch the game — `/live/[gameId]`, unchanged, no picker.** This is the 95% path and
   it must stay a page with one video on it.
3. **Pick only where a genuine choice exists**, which is exactly two places:
   - **A building someone wants to browse.** Not a parent — a tournament spectator, a
     club director, a scout watching "whatever is on at Central Gym". Serve them with a
     **venue live page** (`/venues/[id]/live`) listing today's games *at that building
     that have a picture*, labelled by court and matchup. It is a list of GAMES with
     court labels, not a list of cameras. Reached from the venue page only; never linked
     from a game page.
   - **More than one angle on one game.** Not possible today: `GameStream.gameId` is
     unique, so a game can hold exactly one channel. If multi-angle is ever wanted it is a
     schema change first (composite key, or a segment table), and only then a small
     segmented control **on the dock** — "Main / Baseline" — defaulting to the primary
     angle. It is never a page of its own.

**Where a picker must never appear: any public surface, as a list of cameras.** A viewer
is never shown the fleet, never shown a camera name, and never shown a court that is not
already the court of a game they were looking at. "Camera B" is an operator word; families
see a game, a court and a time. Beyond the vocabulary, a public camera list is a live
window into every gym we film, which is the failure mode the privacy section exists to
prevent.

**Rules any discovery surface must obey.**

- **One live rendition per screen, ever.** Delivery is billed per viewer-minute, so an
  eight-tile "what's on now" wall costs eight times a game and buys nothing a parent
  wanted. Discovery surfaces use a poster frame or the court motif plus a red dot —
  click-to-play, `preload="none"`, torn down off screen. Live tiles belong to the two
  operator surfaces (the ops wall and the scorekeeper's confirm strip) and nowhere else.
- **The notification is the real discovery mechanism.** The highest-value thing to build
  here is not a picker but "your team is live now" reaching the people who follow that
  team. Every mature product in the category leans on this, and it removes the browse
  problem instead of solving it.
- **Deep-link every state.** If a picker ever holds a choice, that choice lives in the URL
  (`?angle=`), so a shared link lands where the sender was.
- **Say which one is selected in words, not colour alone**, and give an empty venue live
  page the next kick-off time rather than a blank panel.

**Decision this asks of the owner:** whether the venue live page is public or signed-in.
Recommend it inherits `STREAM_VIEWER_POLICY` exactly and lists only leagues with
`streamingEnabled`, so there is one gate in the product and not two.

## Security review findings (2026-08-22) — READ BEFORE PRODUCTION

Adversarial review after the first real camera worked. Ranked. The first three are
open and block a production launch.

### CRITICAL, open

**S1. Playback URLs are public, permanent and unauthenticated.** Channels are created
with `requireSignedURLs: false` and `allowedOrigins` unset, and the URL never rotates.
Consequences: `STREAM_VIEWER_POLICY = "SIGNED_IN"` gates the PAGE, not the video; the
league consent toggle stops our site rendering a stream while the camera keeps serving
to any URL holder; a game that has ended goes dark on our page while the rig keeps
broadcasting. One leak is permanent and fleet-wide.
*Precedent, same jurisdiction:* LiveBarn's always-on arena cameras in Waterloo,
Kitchener and Cambridge livestreamed children at day camps for ~3 months in July 2025
because a schedule was not turned off. Ontario's IPC opened an investigation; Waterloo
pulled its cameras. Our combination of permanent public URLs, a camera that keeps
pushing after the app says stopped (field note 2), and a picker that hands those URLs
to hundreds of coaches (S2) is the same failure shape.
*Fix:* Cloudflare signed URLs (`requireSignedURLs` + a short-TTL token endpoint, ~1 day
of work, costs us the fixed-URL-forever property: the channel row holds an input id
instead of a URL, the health probe needs a token too, and the player must refresh on
expiry). `allowedOrigins` is the cheap partial step.

**OWNER RULING 2026-08-22: accepted risk for now, with a trigger.** While this is demo
data and one owner-controlled camera there are no real families holding links and nothing
to leak, so token minting would cost time for no benefit. The provider already supports
signed URLs with expiry natively, so this is a day of work whenever it is wanted.
**The trigger is the first real game with real children on camera** — not a date. At that
point signed URLs go in BEFORE the camera does. Until then, treat every playbackUrl as
public, and do not describe the signed-in policy or the league consent toggle to anyone as
if they protect the video: they gate the page only.

Threat model, for whoever picks this up: the risk is not an attacker, it is ordinary
leakage (a link pasted into a team chat so a parent who missed it can watch, then
forwarded). It is permanent because URLs never rotate, it is compounded by a camera that
keeps broadcasting after the app says stopped (field note 2), and the subject is minors.

**S2. The scorekeeper candidates endpoint leaks the whole fleet** and routes around
league consent: it returned every ACTIVE channel with its playbackUrl to anyone
`canScoreGame` admits (team managers, assistant coaches), including cameras filming
leagues with `streamingEnabled = false`. *Fixed 2026-08-22:* scoped to unplaced cameras
plus cameras at this game's own venue.

**S3. A newly provisioned Cloudflare camera could never show a picture** — recording
defaulted to "off", which on Cloudflare means the ingest connects but no manifest is
ever produced. *Fixed 2026-08-22:* default is "automatic".

### HIGH, open

- **Consecutive games on one court both read live for up to 45 minutes.** The window is
  `scheduledAt + duration + 30min` and knows nothing about the next game on the same
  channel, so the earlier game's page plays the later game's picture. Fix: close a
  mapping when the next game on that channel opens.
- **The assigner has no caller.** `runAssigner()` is referenced only by tests; the plan
  requires it on schedule change and nightly. Without it a rescheduled game keeps a
  stale mapping and its warnings are discarded.
- **Take-over guard only protects games that are live right now**, so an upcoming game
  can be silently un-mapped, and `force` is honoured for non-admins.
- **A camera cannot move mid-game.** `GameStream.gameId` is unique, so one game holds
  one channel forever; multi-angle and accurate VOD windows both need a schema change.

### COST

- Storage would reach ~$1,800/month by the end of a 20-week season with nothing
  deleting. *Mitigated 2026-08-22* by setting `deleteRecordingAfterDays` at creation
  (Cloudflare's floor is 30 days); a nightly delete job is still wanted to keep storage
  near zero.
- **Cloudflare bills delivered MINUTES, not bytes**, so a 240p preview tile costs the
  same as 1080p. The only lever is fewer tile-minutes: the ops wall autoplaying ~9 tiles
  costs ~$0.54/hour, and a tab left open over a weekend costs ~$26. Recommendation:
  poster frame plus signal chip, play on demand.

### Monitoring, better than what we built

Cloudflare exposes `live_input.connected` / `disconnected` / `errored` webhooks, the last
carrying `ERR_STORAGE_QUOTA_EXHAUSTED` and `ERR_MISSING_SUBSCRIPTION` — literally the two
failures that cost us an evening. Prefer webhooks with our manifest probe demoted to a
slow reconciliation backstop. Forgotten-camera detection has no vendor feature: our own
schedule is the source of truth (still connected N minutes past the last scheduled game
→ alert, then auto-disable via Cloudflare's Feb-2026 disable-live-input endpoint).

### Latency and the spoiler problem

Do NOT enable LL-HLS: it does not fix the spoiler (a 3s lead still spoils), it trades away
the buffer that absorbs gym wifi, and Cloudflare's own docs say the custom-player path is
not production ready. Cloudflare Stream Live also appears not to emit
`EXT-X-PROGRAM-DATE-TIME`, so precise sync is unavailable; the realistic fix is a
fixed-offset delayed scoreboard, held per viewer so someone checking scores without video
still gets them instantly.

## Phases

- **Phase 1 — core:** schema + channel CRUD + placement model + scorekeeper confirm-by-
  picture strip + assigner + game-page player + LIVE badges + league toggle + native parity.
  Tests: placement remap, take-over guard, window logic, visibility.
- **Phase 2 — ops:** health probe cron + Streams dashboard (previews, drag placement,
  audit) + manual go-live/end + stale-channel alerting.
- **Phase 3 — value adds:** per-game VOD (clip archive via GameStream windows), score/clock
  overlay rendered in-page from live scoring data (no video compositing), consent capture
  at registration, paid access via existing Stripe rails, "wants camera" placement planner.

## Open decisions for the owner

1. **Infra pick** — recommended: option A (self-host MediaMTX + Bunny CDN, ~$50–80/mo at
   60 games); option B (Cloudflare Stream) if zero-ops is worth 3–4×. The owner's existing
   third parties work too — the channel model is vendor-agnostic either way.
2. **Viewer gating default** — public vs signed-in vs members (minors on camera).
3. **Rig count to start** — recommend 1 trial rig (used phone + tripod) or 2–3 XbotGo
   rigs + matching channels; grow on demand.
4. **Recording from day 1?** — near-free on option A (disk + Bunny storage); makes
   phase-3 VOD retroactive.
5. Go-ahead to build Phase 1.
