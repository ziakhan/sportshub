"use client"

import type { ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { PlayerMug } from "@/components/ui/player-mug"
import { TypeText } from "../motion"
import type { DemoScript } from "../types"

/**
 * Chapter 7: "The player's season" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. Every other surface in this product is built for the adults who
 * run the season. This one is built for the kid it is about. She has a page,
 * every night she played is on it with the numbers she actually put up, and it
 * is a link she can send to her grandmother. That is the whole chapter.
 *
 * THE PAINFUL DETAIL (owner's law, named for this chapter): A KID WITHOUT A
 * PHOTO IS NOT A GREY CIRCLE. Until somebody uploads one she gets the hand
 * drawn mugshot with her jersey number on the chest, which is why a roster of
 * unphotographed kids still reads like a team sheet. The demo shows the swap
 * happening, and it shows the sentence the upload control carries about whose
 * photo you are allowed to upload, because that is the part a family should
 * see before they press anything.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the page — app/(public)/player/[id]/page.tsx: EntityHeader on the
 *     daylight floor with its `mark` slot handed a PlayerMug instead of a
 *     monogram crest, the subtitle written "{team} · {ageGroup} · {club}", the
 *     meta chips "#23", the position and "N games", the team and club pill
 *     links with their arrows, six StatBlocks labelled "Points per game" down
 *     to "Games played", the "Moments" grid of shared cards, the "Game log"
 *     card with "Season totals: N PTS · N REB · N AST" and its Date / Matchup
 *     / Result / PTS / REB / AST / STL / BLK / TO / PF columns, and the
 *     closing note about first name and last initial;
 *   · the photo — components/players/player-photo-field.tsx: the mug preview
 *     beside "Upload photo", which becomes "Replace photo" once there is one,
 *     "Processing..." while it compresses, "Remove", and the helper sentence
 *     word for word. There is no crop step in the product, so there is none
 *     here: the file is compressed client side and the preview IS the
 *     confirmation, with "Player updated successfully!" from the edit page;
 *   · the award — app/(public)/live/[gameId]/components/potg-card.tsx: the
 *     "🏀 Player of the Game" eyebrow, "#23 Amara Bello", the "18 PTS · 7 REB
 *     · 4 AST" line, and the gold framed mug. Then share-card-dialog.tsx:
 *     "Share Amara's card", the card type toggle, the template chips, the
 *     photo consent note, "Post to profile" and "Add to story" with their sub
 *     copy, and Followers or Public;
 *   · the link — components/players/claim-handle-card.tsx: "Player handle",
 *     the "/p/" prefix, "Claim handle", and "Copy" turning into "Copied!".
 *
 * TWO SCRIPT CORRECTIONS THE PRODUCT FORCED (2026-08-15):
 *   1. The brief asked for a win and loss record in the season header. The
 *      player header does not carry one, and inventing it would put a team
 *      fact on a person's page. The header carries what it really carries:
 *      team, age group, club, jersey, position and games played. The record
 *      lives on the team page, one pill away.
 *   2. The brief asked for the Player of the Game card to land on her page.
 *      In the product the award card lives on the GAME page, and what reaches
 *      the player page is the shared card in the "Moments" grid, and only
 *      because somebody chose "Post to profile". So the demo shows the award
 *      where it happens, the share sheet with its consent line, and then the
 *      moment arriving. Nothing lands on a child's page without a decision.
 *
 * MOTION. One frame, no scrolling: the page is laid out to fit a handset at
 * once, and beats change what is on it rather than moving a camera over it.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const PLAYER = "Amara Bello"
const JERSEY = "23"
const TEAM = "U11 Girls Rep"
const AGE = "U11"
const CLUB = "Riverside Ravens"
const OPPONENT = "Lakeshore Lightning"
const HANDLE = "amara-bello"

/**
 * The photograph, drawn rather than borrowed: a demo may not put a real
 * child's face on a marketing page. It is fed through PlayerMug's real
 * `photoUrl` branch, so the swap the viewer watches is the same swap the
 * component performs in production.
 */
const PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#f0dcb6"/><stop offset="1" stop-color="#c99a5d"/>
</linearGradient></defs>
<rect width="100" height="100" fill="url(#g)"/>
<path d="M0 63h100" stroke="#b8873f" stroke-width="2.5" opacity=".45"/>
<circle cx="82" cy="26" r="13" fill="#e8a94a" opacity=".35"/>
<path d="M13 100c2-21 17-29 37-29s35 8 37 29z" fill="#12233d"/>
<path d="M37 72c4 10 22 10 26 0" fill="none" stroke="#f7c948" stroke-width="2.6"/>
<rect x="43" y="57" width="14" height="17" rx="6.5" fill="#8a5836"/>
<ellipse cx="50" cy="43" rx="17" ry="19.5" fill="#9c6a42"/>
<path d="M31 45c-1-21 9-27 19-27s20 6 19 27c0-9-7-14-19-14s-19 5-19 14z" fill="#241610"/>
<circle cx="50" cy="18" r="8.5" fill="#241610"/>
<ellipse cx="43.6" cy="43" rx="1.9" ry="2.1" fill="#241610"/>
<ellipse cx="56.4" cy="43" rx="1.9" ry="2.1" fill="#241610"/>
<path d="M44 51.5q6 4.5 12 0" fill="none" stroke="#5f351b" stroke-width="1.8" stroke-linecap="round"/>
</svg>`
const PHOTO = `data:image/svg+xml;utf8,${encodeURIComponent(PHOTO_SVG)}`

/* ── The season, in numbers that add up ──────────────────────────────────── */

interface LogRow {
  date: string
  opponent: string
  result: "W" | "L"
  score: string
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  to: number
  pf: number
}

/** Newest first, the way the log reads. The first row is last night's game. */
const LOG: LogRow[] = [
  { date: "Nov 14", opponent: OPPONENT, result: "W", score: "42–38", pts: 18, reb: 7, ast: 4, stl: 3, blk: 1, to: 2, pf: 1 },
  { date: "Nov 7", opponent: "Northside Nets", result: "L", score: "31–36", pts: 11, reb: 6, ast: 2, stl: 2, blk: 0, to: 3, pf: 2 },
  { date: "Oct 31", opponent: "Harbourfront Heat", result: "W", score: "45–29", pts: 14, reb: 5, ast: 5, stl: 3, blk: 1, to: 1, pf: 1 },
  { date: "Oct 24", opponent: "Parkdale Panthers", result: "W", score: "38–33", pts: 9, reb: 4, ast: 3, stl: 1, blk: 0, to: 2, pf: 3 },
  { date: "Oct 17", opponent: "Etobicoke Eagles", result: "W", score: "40–35", pts: 13, reb: 7, ast: 2, stl: 2, blk: 1, to: 1, pf: 0 },
]

/** Averages are computed, never typed: the log is the only source of truth. */
function aggregate(rows: LogRow[]) {
  const n = rows.length || 1
  const sum = (k: keyof LogRow) => rows.reduce((t, r) => t + (r[k] as number), 0)
  const pts = sum("pts")
  const reb = sum("reb")
  const ast = sum("ast")
  return {
    games: rows.length,
    pts,
    reb,
    ast,
    ppg: (pts / n).toFixed(1),
    rpg: (reb / n).toFixed(1),
    apg: (ast / n).toFixed(1),
    spg: (sum("stl") / n).toFixed(1),
    bpg: (sum("blk") / n).toFixed(1),
  }
}

export const playersSeasonStory: DemoScript = {
  desktopUrl: `/player/${HANDLE}`,
  initialStage: "phone",
  soloPhone: true,
  chapters: [
    { id: "season", title: "Her season, kept" },
    { id: "photo", title: "The photo" },
    { id: "potg", title: "Player of the Game" },
    { id: "share", title: "Share it" },
  ],

  beats: [
    /* ── 1. Her season, kept ──────────────────────────────────────────── */
    {
      id: "open",
      chapter: "season",
      caption:
        "This is the page the season builds for her. Her team, her number, her position, and the games she has actually played.",
      hold: 3200,
      stage: "phone",
      set: { screen: "player", games: 4 },
    },
    {
      id: "stats",
      chapter: "season",
      caption:
        "Six averages, written out in words rather than initials, because the person reading this is eleven and so is her grandmother's patience for box score shorthand.",
      hold: 3200,
    },
    {
      id: "log",
      chapter: "season",
      caption:
        "Under them, every night on its own line: the date, who they played, how it ended, and her line from that game.",
      hold: 3400,
      cursor: "game-log",
      hover: "game-log",
    },
    {
      id: "newgame",
      chapter: "season",
      caption:
        "Last night's game was scored at the table, so last night's line is already here. Nobody typed it in twice and nobody kept a paper sheet.",
      hold: 3600,
      set: { games: 5 },
    },

    /* ── 2. The photo ─────────────────────────────────────────────────── */
    {
      id: "add-photo",
      chapter: "photo",
      caption:
        "The one thing on this page that is not her is the drawing. Until somebody uploads a photo she gets the sketched mugshot with her number on the chest, never a grey circle and never her initials.",
      hold: 3400,
      cursor: "add-photo",
      press: true,
    },
    {
      id: "edit",
      chapter: "photo",
      caption:
        "The photo lives on her own record, next to a sentence that says whose photo you may upload. It is one line and it is the whole safeguarding conversation.",
      hold: 3400,
      set: { screen: "edit" },
    },
    {
      id: "upload",
      chapter: "photo",
      caption: "One file. There is no crop step, because the product does not ask for one.",
      hold: 2600,
      cursor: "upload-photo",
      press: true,
      set: { uploading: true },
    },
    {
      id: "landed",
      chapter: "photo",
      caption:
        "It is resized on her phone before it ever leaves it, and the preview is the confirmation. Upload becomes Replace, and Remove appears beside it.",
      hold: 3400,
      set: { uploading: false, photo: true },
    },
    {
      id: "save",
      chapter: "photo",
      caption: "Saved against the player, not against a post.",
      hold: 2600,
      cursor: "save-changes",
      press: true,
    },
    {
      id: "saved",
      chapter: "photo",
      caption:
        "And the page she shares now has her face on it, in the same frame the drawing was standing in.",
      hold: 3200,
      set: { screen: "player" },
      toast: "Player updated successfully!",
    },

    /* ── 3. Player of the Game ────────────────────────────────────────── */
    {
      id: "game-page",
      chapter: "potg",
      caption:
        "Eighteen points in a four point game got her the award, and the award is on the game page where it happened.",
      hold: 3400,
      set: { screen: "game" },
    },
    {
      id: "share-press",
      chapter: "potg",
      caption: "Family can turn it into a card worth keeping.",
      hold: 2600,
      cursor: "share-card",
      press: true,
    },
    {
      id: "dialog",
      chapter: "potg",
      caption:
        "Four templates, the award or the plain stat line, and the note that matters: a photo only appears where that player's media consent already allows it.",
      hold: 3800,
      set: { dialog: true },
    },
    {
      id: "share-confirm",
      chapter: "potg",
      caption:
        "Post to profile keeps it on her page. Add to story runs it for a day. Nothing lands on a child's page without somebody choosing it.",
      hold: 3400,
      cursor: "share-confirm",
      press: true,
    },
    {
      id: "moment",
      chapter: "potg",
      caption: "So the card arrives where she wants it, under Moments, next to the season it came from.",
      hold: 3400,
      set: { screen: "player", dialog: false, moment: true },
      toast: "Shared",
    },

    /* ── 4. Share it ──────────────────────────────────────────────────── */
    {
      id: "handle",
      chapter: "share",
      caption:
        "The last piece is the address. A page nobody can find is a page nobody sees, so she claims a handle and the page gets a link a kid can actually say out loud.",
      hold: 3400,
      set: { screen: "handle" },
    },
    {
      id: "type-handle",
      chapter: "share",
      caption: "First come, first served, the way handles have to work.",
      hold: 3000,
      cursor: "handle-field",
      type: { key: "handle", text: HANDLE },
    },
    {
      id: "claim",
      chapter: "share",
      caption: "Claimed in one press.",
      hold: 2400,
      cursor: "claim-handle",
      press: true,
    },
    {
      id: "claimed",
      chapter: "share",
      caption: "And there is the link, ready to copy.",
      hold: 2800,
      set: { claimed: true },
    },
    {
      id: "copy",
      chapter: "share",
      caption: "One tap to the clipboard, into a message, off to the people who want it.",
      hold: 2800,
      cursor: "copy-link",
      press: true,
      set: { copied: true },
    },
    {
      id: "final",
      chapter: "share",
      caption:
        "Five games, sixty five points, an award, a face and an address. Her season, kept by the thing that was already keeping score.",
      hold: 3800,
      set: { screen: "player" },
    },
    {
      id: "end-card",
      chapter: "share",
      caption: "The player's season.",
      hold: 3800,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "player")
    const games = get<number>("games", 4)
    const photo = get("photo", false)
    const uploading = get("uploading", false)
    const dialog = get("dialog", false)
    const moment = get("moment", false)
    const claimed = get("claimed", false)
    const copied = get("copied", false)
    const endCard = get("endCard", false)

    const rows = LOG.slice(0, 5).slice(LOG.length - games)
    const a = aggregate(rows)
    const mug = photo ? PHOTO : undefined

    const phone = (
      <div className="relative h-full bg-[#f6f7f9]">
        <div key={screen} className="demo-fade-in h-full">
          {screen === "player" && (
            <PlayerPage
              photoUrl={mug}
              agg={a}
              rows={rows}
              moment={moment}
              handle={claimed ? HANDLE : ""}
            />
          )}
          {screen === "edit" && (
            <EditPhotoScreen photoUrl={mug} uploading={uploading} />
          )}
          {screen === "game" && <GamePage photoUrl={mug} dialog={dialog} />}
          {screen === "handle" && (
            <HandleScreen
              claimed={claimed}
              copied={copied}
              value={
                <TypeText
                  text={get<string>("handle", "")}
                  typing={typingKey === "handle"}
                  placeholder="trey-reyes"
                />
              }
            />
          )}
        </div>

        {endCard && <PhoneEndCard />}
      </div>
    )

    return { desktop: null, phone }
  },
}

/* ── The public player page ──────────────────────────────────────────────── */

function PlayerPage({
  photoUrl,
  agg,
  rows,
  moment,
  handle,
}: {
  photoUrl?: string
  agg: ReturnType<typeof aggregate>
  rows: LogRow[]
  moment: boolean
  handle: string
}) {
  return (
    <div className="flex h-full flex-col gap-2 px-2.5 pb-2 pt-2.5">
      {/* EntityHeader: daylight floor, the mark slot carrying a face, and the
          4px navy baseline along the bottom edge. */}
      <header className="relative isolate shrink-0 overflow-hidden rounded-[20px] border border-[#e7dbc4]">
        <CourtBackdropLayer variant="daylight" intensity="band" />
        <div className="relative z-10 flex items-center gap-2.5 px-3 py-3">
          <PlayerMug
            name={PLAYER}
            accentKey={PLAYER}
            jerseyNumber={JERSEY}
            photoUrl={photoUrl}
            sizeClassName="h-[52px] w-[52px] rounded-[14px]"
            className="shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-ink-950 text-[19px] font-black leading-[1.04] tracking-[-0.02em]">
              {PLAYER}
            </h1>
            <p className="text-ink-600 mt-0.5 truncate text-[9.5px]">
              {TEAM} · {AGE} · {CLUB}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <MetaChip>#{JERSEY}</MetaChip>
              <MetaChip>Guard</MetaChip>
              <MetaChip key={agg.games}>
                <span className="demo-pulse-green rounded-full">{agg.games} games</span>
              </MetaChip>
            </div>
          </div>
        </div>
        <span aria-hidden="true" className="bg-court-900 absolute inset-x-0 bottom-0 z-10 h-[4px]" />
      </header>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          data-demo-target="add-photo"
          className={cn(
            "bg-ink-50 text-ink-700 ring-ink-200 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9.5px] font-semibold ring-1 transition-all duration-200 motion-reduce:transition-none",
            "data-[demo-hover=true]:bg-ink-100 data-[demo-hover=true]:ring-play-300",
            "data-[demo-press=true]:scale-[0.96]"
          )}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-2.5 w-2.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {photoUrl ? "Change photo" : "Add photo"}
        </span>
        <span className="border-ink-200 text-ink-700 inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-[9.5px] font-semibold">
          ☆ Follow
        </span>
        <span className="bg-ink-50 text-ink-700 ring-ink-200 ml-auto rounded-full px-2 py-1 text-[9px] font-semibold ring-1">
          {TEAM} →
        </span>
      </div>

      {/* Six StatBlocks, labels as the product writes them. */}
      <div className="grid shrink-0 grid-cols-3 gap-1">
        <Stat label="Points per game" value={agg.ppg} tone="play" />
        <Stat label="Rebounds per game" value={agg.rpg} tone="hoop" />
        <Stat label="Assists per game" value={agg.apg} tone="court" />
        <Stat label="Steals per game" value={agg.spg} tone="sky" />
        <Stat label="Blocks per game" value={agg.bpg} tone="violet" />
        <Stat label="Games played" value={String(agg.games)} tone="neutral" />
      </div>

      {moment && (
        <section className="live-row-in shrink-0">
          <h2 className="text-ink-950 mb-1 text-[11px] font-bold">Moments</h2>
          <div className="grid grid-cols-3 gap-1">
            <MomentCard photoUrl={undefined} kind="potg" />
            <MomentTile label="Stat line" meta="Oct 31" />
            <MomentTile label="Stat line" meta="Oct 17" />
          </div>
        </section>
      )}

      {/* The game log card. */}
      <section
        data-demo-target="game-log"
        className={cn(
          "border-ink-100 min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white transition-all duration-200 motion-reduce:transition-none",
          "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
        )}
      >
        <div className="border-ink-100 flex items-baseline justify-between border-b px-2.5 py-1.5">
          <h2 className="text-ink-950 text-[11.5px] font-bold">Game log</h2>
          <span key={agg.pts} className="text-ink-400 demo-pulse-green rounded text-[8.5px] tabular-nums">
            Season totals: {agg.pts} PTS · {agg.reb} REB · {agg.ast} AST
          </span>
        </div>
        <table className="w-full table-fixed">
          <thead>
            <tr className="text-ink-400 border-ink-100 border-b text-left text-[7px] uppercase tracking-tight">
              <th className="w-[28px] pl-2 pr-0.5 py-1 font-semibold">Date</th>
              <th className="px-0.5 py-1 font-semibold">Matchup</th>
              <th className="w-[38px] px-0.5 py-1 font-semibold">Result</th>
              <th className="w-[14px] px-0 py-1 text-right font-semibold">PTS</th>
              <th className="w-[14px] px-0 py-1 text-right font-semibold">REB</th>
              <th className="w-[14px] px-0 py-1 text-right font-semibold">AST</th>
              <th className="w-[14px] px-0 py-1 text-right font-semibold">STL</th>
              <th className="w-[14px] px-0 py-1 text-right font-semibold">BLK</th>
              <th className="w-[13px] px-0 py-1 text-right font-semibold">TO</th>
              <th className="w-[19px] pl-0 pr-1.5 py-1 text-right font-semibold">PF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.date}
                className={cn("border-ink-50 border-b last:border-0", i === 0 && "live-row-in")}
              >
                <td className="text-ink-500 whitespace-nowrap py-[3px] pl-2 pr-0.5 text-[8px]">
                  {r.date}
                </td>
                <td className="text-ink-950 truncate px-0.5 py-[3px] text-[8px] font-medium">
                  vs {r.opponent}
                </td>
                <td className="whitespace-nowrap px-0.5 py-[3px] text-[8px]">
                  <span
                    className={cn(
                      "font-semibold",
                      r.result === "W" ? "text-court-600" : "text-live-600"
                    )}
                  >
                    {r.result} {r.score}
                  </span>
                </td>
                <td className="text-ink-950 px-0 py-[3px] text-right text-[8px] font-semibold tabular-nums">
                  {r.pts}
                </td>
                <td className="text-ink-700 px-0 py-[3px] text-right text-[8px] tabular-nums">{r.reb}</td>
                <td className="text-ink-700 px-0 py-[3px] text-right text-[8px] tabular-nums">{r.ast}</td>
                <td className="text-ink-700 px-0 py-[3px] text-right text-[8px] tabular-nums">{r.stl}</td>
                <td className="text-ink-700 px-0 py-[3px] text-right text-[8px] tabular-nums">{r.blk}</td>
                <td className="text-ink-700 px-0 py-[3px] text-right text-[8px] tabular-nums">{r.to}</td>
                <td className="text-ink-700 py-[3px] pl-0 pr-1.5 text-right text-[8px] tabular-nums">{r.pf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-ink-400 shrink-0 text-[7.5px] leading-snug">
        {handle ? (
          <span className="text-ink-500 font-semibold">sportshubone.com/p/{handle} · </span>
        ) : null}
        Player names on public pages show first name and last initial unless a parent has opted into
        full public names.
      </p>
    </div>
  )
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="border-ink-200 text-ink-700 rounded-full border bg-white/90 px-2 py-[2px] text-[8.5px] font-semibold shadow-sm">
      {children}
    </span>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "play" | "hoop" | "court" | "sky" | "violet" | "neutral"
}) {
  const tones: Record<string, string> = {
    play: "border-play-100 bg-play-50/70 text-play-700",
    hoop: "border-hoop-100 bg-hoop-50/70 text-hoop-600",
    court: "border-court-100 bg-court-50/70 text-court-700",
    sky: "border-sky-100 bg-sky-50/70 text-sky-700",
    violet: "border-violet-100 bg-violet-50/70 text-violet-700",
    neutral: "border-ink-100 bg-white text-ink-800",
  }
  return (
    <div className={cn("rounded-xl border px-1.5 py-1", tones[tone])}>
      <p key={value} className="demo-pulse-green rounded text-[15px] font-bold leading-none tabular-nums">
        {value}
      </p>
      <p className="text-ink-500 mt-0.5 text-[7px] font-semibold uppercase leading-tight tracking-[0.06em]">
        {label}
      </p>
    </div>
  )
}

/** A shared card in the Moments grid: the award one arrives with her face. */
function MomentCard({ photoUrl, kind }: { photoUrl?: string; kind: "potg" | "stat" }) {
  return (
    <div className="border-gold-400 live-pop relative overflow-hidden rounded-xl border bg-[#0b1628]">
      <CourtBackdropLayer variant="navy" intensity="band" />
      <div className="relative z-10 flex h-[52px] flex-col items-center justify-center px-1">
        <PlayerMug
          name={PLAYER}
          accentKey={PLAYER}
          jerseyNumber={JERSEY}
          photoUrl={photoUrl ?? PHOTO}
          sizeClassName="h-[22px] w-[22px] rounded-full"
          frameClassName="border-gold-400 border"
        />
        <p className="text-gold-400 mt-0.5 text-[6px] font-bold uppercase tracking-[0.14em]">
          {kind === "potg" ? "Player of the Game" : "Stat line"}
        </p>
        <p className="text-[8px] font-bold tabular-nums text-white">18 PTS</p>
      </div>
    </div>
  )
}

function MomentTile({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="border-ink-100 flex h-[52px] flex-col items-center justify-center rounded-xl border bg-white">
      <p className="text-ink-400 text-[6px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="text-ink-500 mt-0.5 text-[8px] font-semibold">{meta}</p>
    </div>
  )
}

/* ── Edit player: the photo section ──────────────────────────────────────── */

function EditPhotoScreen({ photoUrl, uploading }: { photoUrl?: string; uploading: boolean }) {
  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-3">
      <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.16em]">Players</p>
      <h1 className="font-display text-ink-950 mt-0.5 text-[20px] font-black leading-tight">
        Edit Player
      </h1>
      <p className="text-ink-500 mt-0.5 text-[10.5px]">Update your player&apos;s information.</p>

      <section className="border-ink-100 mt-3 rounded-2xl border bg-white px-3 py-3">
        <p className="text-ink-600 text-[9.5px] font-semibold uppercase tracking-[0.1em]">
          Player photo
        </p>
        <div className="mt-2 flex items-start gap-3">
          <span className={cn("relative block", uploading && "opacity-60")}>
            <PlayerMug
              name={PLAYER}
              accentKey={PLAYER}
              jerseyNumber={JERSEY}
              photoUrl={photoUrl}
              sizeClassName="h-[68px] w-[68px] rounded-2xl"
            />
            {uploading && (
              <span className="bg-ink-900/15 absolute inset-0 animate-pulse rounded-2xl motion-reduce:animate-none" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                data-demo-target="upload-photo"
                className={cn(
                  "rounded-xl bg-[color:var(--brand,#1a73e8)] px-2.5 py-1.5 text-[10.5px] font-bold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none",
                  "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
                  "data-[demo-press=true]:scale-[0.96]"
                )}
              >
                {uploading ? "Processing..." : photoUrl ? "Replace photo" : "Upload photo"}
              </span>
              {photoUrl && !uploading && (
                <span className="border-ink-200 text-ink-600 live-pop rounded-xl border bg-white px-2.5 py-1.5 text-[10.5px] font-semibold">
                  Remove
                </span>
              )}
            </div>
            <p className="text-ink-500 mt-1.5 text-[9.5px] leading-snug">
              A head shot works best. Without one we draw the sketch on the left with the jersey
              number. Only upload a photo of your own player.
            </p>
          </div>
        </div>
      </section>

      <section className="border-ink-100 mt-2 rounded-2xl border bg-white px-3 py-2.5">
        <p className="text-ink-600 text-[9.5px] font-semibold uppercase tracking-[0.1em]">Details</p>
        <div className="mt-1.5 space-y-1">
          <FieldRow label="First name" value="Amara" />
          <FieldRow label="Position" value="Guard" />
          <FieldRow label="Birth year" value="2015" />
        </div>
      </section>

      <div className="mt-auto flex items-center gap-2 pt-3">
        <span className="border-ink-200 text-ink-600 rounded-xl border bg-white px-3 py-2 text-[11px] font-semibold">
          Cancel
        </span>
        <span
          data-demo-target="save-changes"
          className={cn(
            "flex-1 rounded-xl bg-[color:var(--brand,#1a73e8)] px-3 py-2 text-center text-[11px] font-bold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none",
            "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
            "data-[demo-press=true]:scale-[0.98]"
          )}
        >
          Save Changes
        </span>
      </div>
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 flex items-center justify-between rounded-xl border bg-white px-2.5 py-1.5">
      <span className="text-ink-400 text-[9px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-ink-900 text-[11px] font-semibold">{value}</span>
    </div>
  )
}

/* ── The game page: where the award actually lives ───────────────────────── */

function GamePage({ photoUrl, dialog }: { photoUrl?: string; dialog: boolean }) {
  return (
    <div className="relative flex h-full flex-col">
      <div
        className="flex shrink-0 items-center justify-center gap-2 px-3 py-2 text-white"
        style={{ background: "linear-gradient(120deg, #0b1628, #12233d)" }}
      >
        <Crest name={CLUB} surface="dark" sizeClassName="h-5 w-5 rounded-md text-[9px]" />
        <span className="font-condensed text-[19px] font-semibold leading-none tabular-nums">42</span>
        <span className="min-w-[70px] text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-white/75">
          Final
        </span>
        <span className="font-condensed text-[19px] font-semibold leading-none tabular-nums">38</span>
        <Crest name={OPPONENT} surface="dark" sizeClassName="h-5 w-5 rounded-md text-[9px]" />
      </div>

      <div className="min-h-0 flex-1 space-y-2 px-2.5 py-2.5">
        <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.16em]">
          {CLUB} vs {OPPONENT} · Nov 14
        </p>

        {/* potg-card.tsx, frame for frame. */}
        <div className="border-gold-400 from-gold-50 live-pop flex items-center gap-2.5 rounded-2xl border bg-gradient-to-r to-white p-2.5">
          <PlayerMug
            name={PLAYER}
            accentKey={PLAYER}
            jerseyNumber={JERSEY}
            photoUrl={photoUrl}
            sizeClassName="h-14 w-14 rounded-full"
            frameClassName="border-gold-400 bg-gold-50 border-2"
          />
          <div className="min-w-0">
            <p className="text-gold-600 text-[8px] font-bold uppercase tracking-[0.2em]">
              🏀 Player of the Game
            </p>
            <p className="text-ink-950 truncate text-[13px] font-semibold">
              #{JERSEY} {PLAYER}
            </p>
            <p className="text-ink-500 text-[9.5px] font-medium uppercase tracking-[0.08em]">
              18 PTS · 7 REB · 4 AST
            </p>
          </div>
        </div>

        <div className="border-ink-100 rounded-2xl border bg-white px-2.5 py-2">
          <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.14em]">Share</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span
              data-demo-target="share-card"
              className={cn(
                "border-ink-200 text-ink-700 rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:border-play-400 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2",
                "data-[demo-press=true]:scale-[0.96]"
              )}
            >
              Amara&apos;s game card 🏀
            </span>
            <span className="border-ink-200 text-ink-500 rounded-full border bg-white px-2.5 py-1 text-[10px] font-semibold">
              Priya&apos;s game card
            </span>
          </div>
        </div>

        <div className="border-ink-100 rounded-2xl border bg-white px-2.5 py-2">
          <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.14em]">
            Game leaders
          </p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            <Leader value="18" unit="PTS" name="A. Bello" photoUrl={photoUrl} />
            <Leader value="9" unit="REB" name="P. Nair" />
            <Leader value="5" unit="AST" name="J. Okafor" />
          </div>
        </div>
      </div>

      {dialog && <ShareDialog photoUrl={photoUrl} />}
    </div>
  )
}

function Leader({
  value,
  unit,
  name,
  photoUrl,
}: {
  value: string
  unit: string
  name: string
  photoUrl?: string
}) {
  return (
    <div className="border-ink-100 flex items-center gap-1.5 rounded-xl border bg-white px-1.5 py-1">
      <PlayerMug
        name={name}
        accentKey={name}
        photoUrl={photoUrl}
        sizeClassName="h-6 w-6 rounded-full"
      />
      <div className="min-w-0">
        <p className="text-ink-950 text-[12px] font-bold leading-none tabular-nums">
          {value} <span className="text-ink-400 text-[7.5px] font-semibold">{unit}</span>
        </p>
        <p className="text-ink-500 truncate text-[8px]">{name}</p>
      </div>
    </div>
  )
}

/** share-card-dialog.tsx at phone size: the choices, and the consent line. */
function ShareDialog({ photoUrl }: { photoUrl?: string }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-[#0b1628]/45">
      <div className="live-pop rounded-t-3xl bg-white px-3 pb-5 pt-3 shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.5)]">
        <span className="bg-ink-200 mx-auto mb-2.5 block h-1 w-9 rounded-full" />
        <h3 className="text-ink-900 text-[14px] font-bold">Share Amara&apos;s card</h3>

        <div className="mt-2 flex gap-1.5">
          <span className="border-play-500 bg-play-50 text-ink-900 flex-1 rounded-lg border px-2 py-1 text-center text-[9.5px] font-bold">
            🏀 Player of the Game
          </span>
          <span className="border-ink-200 text-ink-500 flex-1 rounded-lg border px-2 py-1 text-center text-[9.5px] font-semibold">
            📊 Stat line
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="border-gold-400 relative h-[54px] w-[86px] shrink-0 overflow-hidden rounded-lg border bg-[#0b1628]">
            <CourtBackdropLayer variant="navy" intensity="band" />
            <span className="relative z-10 flex h-full flex-col items-center justify-center">
              <PlayerMug
                name={PLAYER}
                accentKey={PLAYER}
                jerseyNumber={JERSEY}
                photoUrl={photoUrl}
                sizeClassName="h-6 w-6 rounded-full"
              />
              <span className="text-gold-400 mt-0.5 text-[5.5px] font-bold uppercase tracking-[0.14em]">
                Player of the Game
              </span>
              <span className="text-[8px] font-bold text-white">18 PTS · 7 REB</span>
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1">
              {["bold", "clean", "court", "night"].map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-full border px-1.5 py-[2px] text-[8.5px] font-semibold capitalize",
                    i === 0
                      ? "border-play-500 bg-play-50 text-play-700"
                      : "border-ink-200 text-ink-500 bg-white"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="text-ink-400 mt-1 text-[8px] leading-snug">
              Photos are checked automatically and only show where the player&apos;s media consent
              allows.
            </p>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <DestRow checked label="Post to profile" sub="Stays on the player page" />
          <DestRow label="Add to story" sub="Visible for 24 hours" />
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className="border-play-500 bg-play-50 text-play-700 rounded-full border px-2 py-[3px] text-[9px] font-bold">
            Followers
          </span>
          <span className="border-ink-200 text-ink-500 rounded-full border bg-white px-2 py-[3px] text-[9px] font-semibold">
            Public
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="border-ink-200 text-ink-600 rounded-xl border bg-white px-2.5 py-2 text-[10px] font-semibold">
            Just share the image
          </span>
          <span
            data-demo-target="share-confirm"
            className={cn(
              "flex-1 rounded-xl bg-[color:var(--brand,#1a73e8)] px-3 py-2 text-center text-[11px] font-bold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
              "data-[demo-press=true]:scale-[0.98]"
            )}
          >
            Share
          </span>
        </div>
      </div>
    </div>
  )
}

function DestRow({ checked, label, sub }: { checked?: boolean; label: string; sub: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5",
        checked ? "border-play-300 bg-play-50/60" : "border-ink-200 bg-white"
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2",
          checked ? "border-play-600 bg-play-600" : "border-ink-300 bg-white"
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2 w-2">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block text-[10.5px] font-semibold">{label}</span>
        <span className="text-ink-400 block text-[8.5px]">{sub}</span>
      </span>
    </div>
  )
}

/* ── The handle: the page gets an address ────────────────────────────────── */

function HandleScreen({
  claimed,
  copied,
  value,
}: {
  claimed: boolean
  copied: boolean
  value: ReactNode
}) {
  return (
    <div className="flex h-full flex-col px-3 pb-3 pt-3">
      <p className="text-ink-400 text-[9px] font-bold uppercase tracking-[0.16em]">Players</p>
      <h1 className="font-display text-ink-950 mt-0.5 text-[20px] font-black leading-tight">
        Edit Player
      </h1>

      <section className="border-ink-100 mt-3 rounded-2xl border bg-white px-3 py-3">
        <h2 className="text-ink-950 text-[12.5px] font-bold">Player handle</h2>
        <p className="text-ink-500 mt-1 text-[9.5px] leading-snug">
          Claim a unique handle, it becomes this player&apos;s shareable page link. First come,
          first served.
        </p>

        <div className="mt-2.5 flex items-center gap-1.5">
          <span
            data-demo-target="handle-field"
            className={cn(
              "border-ink-200 flex min-h-[32px] min-w-0 flex-1 items-center gap-0.5 rounded-xl border bg-white px-2.5 text-[11px] transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:border-play-300 data-[demo-hover=true]:ring-play-100 data-[demo-hover=true]:ring-2"
            )}
          >
            <span className="text-ink-400 shrink-0 font-semibold">/p/</span>
            {value}
          </span>
          <span
            data-demo-target="claim-handle"
            className={cn(
              "shrink-0 rounded-xl bg-[color:var(--brand,#1a73e8)] px-2.5 py-2 text-[10.5px] font-bold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:brightness-110 data-[demo-hover=true]:shadow-md",
              "data-[demo-press=true]:scale-[0.96]"
            )}
          >
            {claimed ? "Change" : "Claim handle"}
          </span>
        </div>

        {claimed && (
          <div className="border-court-200 bg-court-50 live-pop mt-2.5 flex items-center gap-1.5 rounded-xl border px-2 py-2">
            <span className="text-court-900 min-w-0 flex-1 truncate text-[9px] font-semibold">
              sportshubone.com/p/{HANDLE}
            </span>
            <span
              data-demo-target="copy-link"
              className={cn(
                "shrink-0 rounded-lg border border-white/70 bg-white px-2 py-1 text-[10px] font-bold transition-all duration-200 motion-reduce:transition-none",
                copied ? "text-court-700" : "text-ink-700",
                "data-[demo-hover=true]:border-play-300",
                "data-[demo-press=true]:scale-[0.94]"
              )}
            >
              {copied ? "Copied!" : "Copy"}
            </span>
          </div>
        )}
      </section>

      <section className="border-ink-100 mt-2 rounded-2xl border bg-white px-3 py-2.5">
        <h2 className="text-ink-950 text-[12.5px] font-bold">Who can see her page</h2>
        <div className="mt-1.5 space-y-1">
          <DestRow checked label="Followers you approve" sub="Family, coaches, teammates" />
          <DestRow label="Anyone with the link" sub="Full name stays hidden" />
        </div>
      </section>
    </div>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function PhoneEndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#0b1628]">
      <CourtBackdropLayer variant="navy" intensity="immersive" />
      <div className="live-pop relative z-10 px-6 text-center">
        <p className="text-gold-400 text-[9.5px] font-bold uppercase tracking-[0.2em]">
          Chapter 7 of 10
        </p>
        <h2 className="font-display mt-1.5 text-[24px] font-extrabold leading-[1.06] tracking-tight text-white">
          The player&apos;s season
        </h2>
        <p className="mt-2 text-[11.5px] leading-relaxed text-white/65">
          Every game she played, the numbers she put up, the night she was Player of the Game, and a
          link she can send to her grandmother.
        </p>
        <span className="bg-gold-400 mt-4 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[11px] font-bold text-[#0b1628]">
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch the next: The money picture
        </span>
      </div>
    </div>
  )
}
