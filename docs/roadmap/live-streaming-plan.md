---
updated: 2026-07-20
tags: [theme/streaming, type/plan, status/proposed]
---

# Live streaming per game — architecture plan (v2)

> **Status: PROPOSED (2026-07-20, v2 after owner review). Nothing built yet.** Owner
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
