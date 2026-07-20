---
updated: 2026-07-20
tags: [theme/streaming, type/plan, status/proposed]
---

# Live streaming per game — architecture plan

> **Status: PROPOSED (2026-07-20). Nothing built yet.** Owner request: stream 5–7 parallel
> games via a fixed pool of camera→ingest endpoints, surface each stream on the public game
> page with a "Watch Live" button, and never hand-wire cameras to games.

## The one design decision everything else falls out of

**Cameras bind to COURTS, not to games.** A camera physically lives at a court for the day.
Games already know their court and time (`Game.courtId`, `Game.venueId`, `Game.scheduledAt`,
`Game.duration`, `Game.status`). So "which camera shows which game" is not new information —
it is a *derived* fact from the schedule we already run. Nobody configures anything per game;
the auto-assigner walks the schedule and does it.

This gives exactly what was asked for:
- **Fixed endpoints.** Each channel's RTMP ingest URL + stream key and its HLS playback URL
  never change. Print them on a laminated card taped to each tripod. The camera operator
  configures their camera **once, ever** (saved preset), then just powers on.
- **Games constantly switching is free.** Three back-to-back games on Court 1 all ride the
  same continuous stream; each game page simply shows the player during that game's window.
- **Wrong-signal is structurally impossible** as long as the camera is at the court its
  channel is bound to — the only human invariant left, and the ops dashboard verifies it.

## Vendor abstraction (works with all three of the owner's options)

The platform never talks to cameras or transcoders. A `StreamChannel` row stores two URLs:

```
camera (RTMP/RTSP out) ──▶ ingestUrl + streamKey   [vendor's problem]
vendor transcodes to HLS ──▶ playbackUrl (.m3u8)    [CDN, fixed per channel]
```

Whether the third-party channel service, the software encoder route, or the CDN's live
transcoding provides this — irrelevant to us. **The only requirements to hand the vendor:**
1. N persistent channels (start with 8: 6–7 courts + 1 spare/floater).
2. Fixed RTMP ingest point per channel (RTMP push is the safest common denominator; RTSP
   pull also fine if their side supports it — the camera side decides).
3. Fixed HLS playback URL per channel that is live whenever the ingest is hot.
4. Nice-to-have, not required: LL-HLS (sub-10s latency), API for channel state, cloud
   recording with time-addressable archive (enables VOD in phase 3).

Standard HLS latency is 10–30s; parents watching remotely do not care. Do not pay extra for
WebRTC-grade latency.

## Camera hardware: XbotGo (the "X" one)

The phone-based camera the owner half-remembered is **XbotGo** — the current model is the
**XbotGo Chameleon** (~$500–700 class, no subscription for core features). Verified fit:
- Phone mounts on an AI gimbal; on-device AI auto-tracks play (pan + zoom), basketball is a
  first-class supported sport alongside soccer, hockey, lacrosse, tennis, football, badminton
  and more (8+ sports — matches the owner's recollection).
- **Full custom RTMP output** from the XbotGo app — point it at our fixed `ingestUrl` +
  `streamKey`, save as preset per court. Also does YouTube/Facebook but we don't need those.
- Basketball-specific AI (shot detection, highlight auto-editing) — future content angle.
- One phone + one Chameleon per court = the whole capture rig. Budget option to trial with
  a single court before buying 7.

Sources: xbotgo.com product pages, Amazon listing (B0DG2DYQD8).

## Schema (runbook: add to the pending Neon batch when shipped)

```prisma
enum StreamChannelStatus { ACTIVE  DISABLED }
enum StreamAssignSource  { AUTO  MANUAL }

model StreamChannel {
  id             String  @id @default(uuid())
  name           String                    // "Central Gym — Court 1"
  ingestUrl      String                    // rtmp://ingest.vendor.com/live  (FIXED)
  streamKey      String                    // per-channel secret             (FIXED)
  playbackUrl    String                    // https://cdn.../ch1/index.m3u8  (FIXED)
  status         StreamChannelStatus @default(ACTIVE)
  courtId        String? @unique           // physical binding — the whole trick
  court          Court?  @relation(fields: [courtId], references: [id])
  provider       String?                   // freetext vendor note
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
  source    StreamAssignSource @default(AUTO)   // MANUAL rows survive re-runs
  startedAt DateTime?                           // manual go-live override
  endedAt   DateTime?                           // manual cut (OT ran long, etc.)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([channelId])
}
```

Why materialized `GameStream` rows instead of deriving at read time: manual overrides need a
place to live, the game page query becomes one join, and the rows are the future VOD index
(game X = channel Y from T1 to T2 → clip the channel archive).

## Assignment: auto with a manual escape hatch

- **Auto-assigner** (runs on schedule changes + nightly cron): for every non-cancelled game
  in the next 7 days with a `courtId` that has an ACTIVE bound channel → upsert `GameStream`
  (source AUTO). Re-runs converge; never touches MANUAL rows. Deletes AUTO rows whose game
  moved courts.
- **Overlap check**: two games on one channel with overlapping `[scheduledAt, +duration]`
  windows → warning surfaced on the ops dashboard (it's also a court double-booking, i.e. a
  schedule bug we'd want flagged anyway).
- **Manual assignment** (admin, per game): dropdown of channels on the game admin view for
  exceptions — camera moved, borrowed floater channel, venue without court rows. Sets
  source MANUAL.

## Playback window — when the button shows and the player plays

A game's stream is **watchable** when a `GameStream` exists, channel is ACTIVE, and:
- `Game.status == LIVE` (we have live scoring; scorekeeper flipping the game live is the
  strongest signal), **or**
- now ∈ `[scheduledAt − 15min, scheduledAt + duration + 30min]` and status is
  SCHEDULED/COMPLETED (fallback for games without a scorekeeper; +30min absorbs overtime).
- `startedAt`/`endedAt` on GameStream, when set, override both (manual cut for the
  "previous game ran long, don't show its tail on our page" case).

States on the game page: **Upcoming** (stream scheduled, window not open — "Live at 6:30")
→ **● WATCH LIVE** (player renders) → **Ended** (player gone; "Recording available soon"
only once phase 3 VOD exists).

## Surfaces (⚠️ ALL-PLATFORMS PARITY applies — web + mobile-web + Android + iOS in one pass)

1. **`/live/[gameId]`** (public game page — score/box/play-by-play already live-poll here):
   HLS player docked at the top. Web: hls.js (+ native HLS on Safari); phone-first sizing.
   This page becomes the single "game center": video + live score + play-by-play.
2. **Schedule rows / game cards**: red ● LIVE badge when watchable → links to game page.
3. **Native app** game screen: `expo-video` plays HLS natively; same window logic via API.
4. **Workspace → Streams** (operator ops dashboard):
   - Channel grid: name, bound court, signal health (🟢 fresh / 🔴 stale), now playing,
     up next. Copy-buttons for ingest URL + key (this is the "configure the camera" UX).
   - Health probe: cron every ~60s fetches each ACTIVE channel's HLS manifest; fresh
     segments → stamp `lastSeenLiveAt`. Channel that *should* be live (a game in window)
     but stale → red row + (later) notify.
   - Channel CRUD is platform-admin; court binding editable per channel.

## Game-day runbook (the whole point — near-zero ops)

1. Operator mounts phone + XbotGo at Court 1, opens saved "Court 1" RTMP preset, taps go.
   Camera streams continuously all day — **nobody touches it between games**.
2. Streams dashboard shows all channels green before first tip-off. A red channel with a
   game in window is the only thing anyone has to react to.
3. Scorekeepers run games as today; game pages light up and go dark on their own.

## Privacy flag (owner decision needed — minors on camera)

Streaming kids is a bigger consent surface than photos. Recommend: league-level
`streamingEnabled` toggle + per-league visibility (public / signed-in / league members),
and a consent line in season registration. Phase 1 should at minimum ship the league toggle,
default OFF, so streams only appear where the owner has consent covered. Related vault
docs: [[player-profile-privacy]], [[privacy-pipeda-casl]].

## Phases

- **Phase 1 — core (vendor-agnostic, buildable now):** schema + channel CRUD + court
  binding + auto-assigner + overlap warning + game-page player + LIVE badges + league
  toggle + native parity pass. Integration tests: assigner convergence, window logic,
  visibility.
- **Phase 2 — ops:** health probe cron + Streams dashboard live states + manual
  go-live/end + stale-channel alerting.
- **Phase 3 — value adds:** per-game VOD (clip channel archive via GameStream windows),
  score/clock overlay on the player (we own the live scoring data — overlay in the page,
  no video compositing needed), consent capture at registration, paid access via existing
  Stripe rails if the business model wants it.

## Open decisions for the owner

1. **Vendor pick** — any of the three works; hand them the 4 requirements above and get
   per-channel ingest+playback URLs. (If they ask: 8 channels, RTMP in, HLS out, recording
   optional.)
2. **Viewer gating default** — public vs signed-in vs members (privacy of minors).
3. **Channel count** to provision (recommend 8 = 7 courts + 1 floater).
4. **Recording from day 1?** Costs more with the vendor but makes phase 3 VOD retroactive.
5. Go-ahead to build Phase 1.
