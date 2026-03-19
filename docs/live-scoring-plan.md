# Live Game Scoring — Implementation Plan

## Vision

**Phase 1:** Manual UI-based scoring — scorekeeper at the table uses a tablet/phone to record every play in real-time. Designed for speed and accuracy with big tap targets.

**Phase 2:** AI-powered video analysis — use live video feed + computer vision to automatically detect and record stats (baskets, assists, rebounds, steals, blocks, turnovers) with human review/correction.

The manual scorer (Phase 1) doubles as a **training data labeling tool** for the AI model in Phase 2.

---

## Phase 1: Manual Scoring UI

### Design Principles
- **Fast** — tap-based, not type-based. Big buttons for common actions
- **Accurate** — easy undo, assign to correct player with jersey number
- **Complete** — capture everything the box score needs
- **Mobile-first** — tablet at the scorer's table (landscape orientation)
- **Real-time** — updates push to spectators/parents instantly

### Scoring Interface (`/games/[id]/score`)

**Layout (tablet landscape):**
```
┌─────────────────────────────────────────────────┐
│  HOME: Warriors 42     Q2  5:23     AWAY: Lions 38  │
├──────────────────────┬──────────────────────────┤
│  HOME ROSTER         │  AWAY ROSTER             │
│  #5  J. Smith  ●     │  #12 M. Jones  ●         │
│  #10 K. Brown  ●     │  #23 L. Davis  ●         │
│  #15 R. Lee    ●     │  #34 T. Wilson ●         │
│  #22 A. Clark  ○     │  #45 S. Moore  ○         │
│  #33 D. Hall   ○     │  #50 C. White  ○         │
├──────────────────────┴──────────────────────────┤
│  [2PT] [3PT] [FT+] [FT-]                        │
│  [AST] [OREB] [DREB] [STL] [BLK] [TO] [FOUL]   │
│  [SUB] [TIMEOUT] [UNDO]                         │
└─────────────────────────────────────────────────┘
```

### Flow
1. Scorekeeper selects a player (tap on roster)
2. Taps the action (2PT, 3PT, etc.)
3. Event recorded with timestamp + quarter
4. For assists: tap scorer, tap 2PT/3PT, then tap assister + AST
5. Undo button reverts last action

### Events to Track
| Event | Data Captured |
|-------|--------------|
| 2PT Made/Miss | Player, team, quarter, timestamp |
| 3PT Made/Miss | Player, team, quarter, timestamp |
| Free Throw Made/Miss | Player, team, quarter, timestamp |
| Assist | Player who assisted, linked to the basket |
| Offensive Rebound | Player, team |
| Defensive Rebound | Player, team |
| Steal | Player, team |
| Block | Player, team |
| Turnover | Player, team |
| Personal Foul | Player, team, foul count |
| Substitution | Player in, player out, team |
| Timeout | Team, type (full/30-sec) |
| Quarter Start/End | Quarter number, timestamp |

### Real-Time Display (`/games/[id]/live`)

Public page showing:
- Live score with quarter/period
- Play-by-play feed (most recent at top)
- Box score (stats per player)
- Team totals
- Auto-refreshes via polling (every 5s) or WebSocket

### Technical Architecture
- **Scoring UI:** Client component with local state + API calls
- **Storage:** Use existing `GameEvent` and `PlayerStat` models in schema
- **Real-time:** Start with polling (GET every 5s), upgrade to WebSocket later
- **Offline support:** Queue events locally if connection drops, sync when back

### Existing Schema (already in place)

```prisma
model Game {
  id            String   @id @default(uuid())
  homeTeamId    String
  awayTeamId    String
  scheduledAt   DateTime
  status        GameStatus @default(SCHEDULED) // SCHEDULED, LIVE, COMPLETED
  homeScore     Int?
  awayScore     Int?
  events        GameEvent[]
  stats         PlayerStat[]
  finalizedAt   DateTime?
}

model GameEvent {
  id            String   @id @default(uuid())
  gameId        String
  eventType     GameEventType // SCORE_2PT, SCORE_3PT, SCORE_FT, REBOUND, etc.
  teamId        String
  playerId      String?
  points        Int?
  quarter       Int?
  timestamp     DateTime
  metadata      Json?   // { assistPlayerId, shotLocation, etc. }
}

model PlayerStat {
  id            String   @id @default(uuid())
  gameId        String
  playerId      String
  points        Int @default(0)
  rebounds      Int @default(0)
  assists       Int @default(0)
  steals        Int @default(0)
  blocks        Int @default(0)
  turnovers     Int @default(0)
  fouls         Int @default(0)
  minutesPlayed Int?
}
```

---

## Phase 2: AI Video Scoring (Future)

### Concept
- Camera(s) at the court capture the game
- Video feed processed by AI model in real-time
- AI detects: ball position, player positions, baskets, passes, fouls
- Stats auto-generated and pushed to the same scoring pipeline
- Human reviewer can correct/override AI decisions

### Technical Approach
- **Computer Vision:** Player tracking via jersey number detection + pose estimation
- **Event Detection:** Ball trajectory analysis for shots, pass patterns for assists
- **Training Data:** Every manually scored game (Phase 1) becomes labeled training data
- **Model:** Start with open-source models (YOLO for detection, custom classifier for events)
- **Infrastructure:** Video processing can run on edge (local GPU) or cloud (GPU instances)

### Challenges
- Multiple camera angles needed for accurate tracking
- Jersey number OCR at distance and speed
- Distinguishing offensive vs defensive rebounds
- Detecting assists (subjective — requires pass → score within time window)
- Gym lighting and camera quality variability

### Why Manual First Matters
1. **Training data** — every game scored manually creates labeled data for the AI
2. **Ground truth** — AI predictions need something to validate against
3. **Fallback** — AI will never be 100%, manual correction is always needed
4. **Revenue** — can charge for the feature before AI is ready
5. **User feedback** — learn what stats matter most to coaches/parents

---

## Competitive Analysis: How Others Do Live Scoring

### Exposure Events (Current Market Leader)

Exposure Events does NOT build their own scoring app. They integrate with third-party scorekeeping apps:

**Integration Architecture:**
```
[NBN23 InGame / iScore / HoopStats] → [Exposure Events API] → [Event Page Display]
        (scorekeeper app)                  (aggregator)            (fans view)
```

**Supported Integrations:**
| App | Platform | Price | How It Connects |
|-----|----------|-------|-----------------|
| NBN23 InGame | Android + iOS | Free | API integration, auto-sync |
| iScore | iOS only | Free | File upload + live scorecast |
| HoopStats | iOS only | $4.99 | Live sync to Exposure |
| StatCrew | Windows | Paid | FTP-based file transfer |
| MyStatsOnline | Web | Free | Manual entry |

**What Exposure does with the data:**
- Displays live scores on the event page
- Auto-updates standings when game finishes
- Auto-propagates bracket winners
- Generates downloadable scoresheets

### NBN23 (FIBA-Endorsed, Most Relevant)

**Products:**
- **InGame** — scorekeeper app (FIBA-compliant digital scoresheet)
- **Swish** — fan viewer app (live scores, play-by-play, box scores, shot charts)

**How InGame works:**
1. Tournament director creates games in their platform
2. Games sync to InGame app on scorer's tablet
3. Scorekeeper taps to record each play
4. Data streams live to NBN23 cloud
5. Fans see live stats in Swish app
6. Game ends → final scoresheet auto-uploads to platform

**Pricing:**
- InGame: Free
- Swish: Free (basic) or $2.99/mo / $29.99/yr (GOLD — advanced stats)
- Federation/league licensing: Custom pricing (not public)

**API:** Not publicly documented. Requires partnership/business relationship.

### iScore Basketball

**How it works:**
1. Scorekeeper uses iScore on iPad
2. Records every play with court location (shot charts)
3. Generates live iScorecast web link
4. After game: exports PDF reports
5. Can upload to Exposure Events, MaxPreps

**Stats tracked:** Minutes played, shot tracking with location, offensive/defensive rebounds, assists, steals, blocks, deflections, turnovers, fouls, charges, +/-

**Pricing:** Free (app), $1.99/mo or $19.99/yr (Central viewer)

### HoopStats

**How it works:**
1. Scorekeeper uses HoopStats on iPhone/iPad
2. Tracks all stats with shot chart locations
3. Syncs to Exposure Events for live display
4. Exports via email (HTML/Excel/PDF)

**Pricing:** $4.99 one-time

### Known Problems with Current Solutions (NPH League Experience)

Based on user feedback from the NPH Showcase League (which uses Exposure Events):
- **Assists are frequently missed or incorrectly recorded** — scorekeepers don't always catch the pass before the basket
- **Rebounds are often inaccurate** — hard to distinguish offensive vs defensive in real-time
- **Steals and blocks are inconsistently tracked** — depends on scorekeeper attention
- **Substitutions often not recorded** — minutes played data is unreliable
- These problems stem from the difficulty of one person tracking everything simultaneously

### Our Advantage

By building our own scorer:
1. **Optimized UI** — design specifically for the stats that matter, with smart defaults
2. **Assisted entry** — e.g., when a basket is scored, auto-prompt "Assist by?" with likely passers
3. **Validation** — flag unlikely events (e.g., 3PT from center, 50+ points)
4. **Post-game review** — coaches can edit/correct stats after the game with video reference
5. **Training data pipeline** — every correction improves future AI accuracy

---

## Implementation Sequence

1. **Game management API** — create, schedule, update games (schema exists)
2. **Scoring UI** — tablet-optimized interface for scorekeepers
3. **Live viewer** — public page showing real-time score + play-by-play
4. **Box score generation** — auto-calculate PlayerStat from GameEvents
5. **Season standings** — aggregate game results into league standings
6. **Post-game editing** — coaches review and correct stats
7. **Shot charts** — visual court display of shot locations
8. **AI video scoring** — computer vision pipeline (Phase 2, future)
