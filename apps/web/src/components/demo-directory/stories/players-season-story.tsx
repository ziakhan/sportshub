"use client"

import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/components/ui/cn"
import { Crest } from "@/components/ui/crest"
import { CourtBackdropLayer } from "@/components/ui/court-backdrop"
import { PlayerMug } from "@/components/ui/player-mug"
import { accentForKey } from "@/lib/ui/player-accent"
import { TypeText } from "../motion"
import type { DemoBeat, DemoScript } from "../types"

/**
 * Chapter 7: "A player's page and stats", rebuilt to the realism standard
 * (mock-ui.tsx R1–R8) on 2026-08-19. The 08-15 cut invented a player, invented
 * a club, drew tinted stat tiles the product does not have, drew the share
 * sheet as a bottom sheet the product does not have, and stopped three screens
 * short of the states the product really lands on. None of that is left.
 *
 * THE ARGUMENT. Every other surface in this product is built for the adults
 * who run the season. This one is built for the kid it is about. She has a
 * page, every night she played is on it with the numbers she actually put up,
 * and it becomes a link she can send to her grandmother.
 *
 * ONE LIFE-SIZE HANDSET. `OWNER` the phone-demo law: a single 390 logical
 * handset at scale 1.0, nothing else on the stage. The page it shows is longer
 * than a handset, so the demo SCROLLS it the way a person does, rather than
 * shrinking the product to fit a frame.
 *
 * THE PLAYER IS REAL, AND SO IS EVERY NUMBER. `DB` Player
 * dc5d7845-692d-43fe-80a0-144e62d55987: Danielle Reyes, #20, Guard, Toronto
 * Lords Grade 10 Girls, guardian Jordan Reyes (summer-parent-lords). She is
 * the same Danielle whose week the your-week chapter runs. Her eleven
 * COMPLETED PlayerStat rows in this database are the LOG table below, verbatim
 * to the last turnover, and every average on screen is computed from them
 * rather than typed. `DB` her `photoUrl` is null and her `handle` is null, so
 * the two things this chapter does — add a photo, claim a handle — are things
 * her record is genuinely missing. `DB` her mediaConsent is UNSET and her
 * socialVisibility is PRIVATE, which is why the generated card says
 * "Danielle R." and why the share dialog's PUBLIC chip is clamped.
 *
 * `DB` Game 44744bad, Sun 26 July 2026, The Playground, North Toronto Huskies
 * Grade 10 Girls 44, Toronto Lords Grade 10 Girls 48, `potgPlayerId` = her.
 * Her line that day was 20 PTS / 3 REB / 1 AST, and she was the game's top
 * scorer. Twenty points in a four point game is the seed's own arithmetic, not
 * a script's.
 *
 * TRUTH TO THE PRODUCT, SCREEN BY SCREEN (R1: classes copied, files cited):
 *   · the page is `app/(public)/player/[id]/page.tsx`: SmartBack to "My
 *     players", `components/ui/entity-header.tsx` on the daylight floor with
 *     its `mark` slot handed a `PlayerMug` and the navy 4px baseline, the
 *     subtitle written "{team} · {ageGroup} · {club}", meta chips "#20",
 *     "Guard", "11 games", the right-aligned "Add photo" pill (page line 118)
 *     beside `components/follow-button.tsx` in its light not-following tone
 *     (bg-ink-950 text-white with the star), the team and club pills with
 *     their arrows, six `components/ui/stat-block.tsx` tiles — WHITE cards,
 *     because `tone` on a StatBlock only colours an icon and this page passes
 *     none — the "Moments" grid of shared card images, and the "Game log"
 *     `Card` with "Season totals: N PTS · N REB · N AST" over the Date /
 *     Matchup / Result / PTS / REB / AST / STL / BLK / TO / PF columns and
 *     the closing note about first name and last initial;
 *   · the photo is `app/(platform)/players/[id]/edit/page.tsx` (the target of
 *     the page's `#photo` deep link) plus
 *     `components/players/player-photo-field.tsx`: the h-20 mug beside a
 *     BORDERED "Upload photo" button, which becomes "Replace photo" once
 *     there is one, "Processing..." while it compresses, "Remove" as a plain
 *     text button, and the helper sentence word for word. There is no crop
 *     step in the product, so there is none here. The chapter does not end on
 *     the press: it ends on the edit page's own success banner, "Player
 *     updated successfully!" (edit page line 149);
 *   · the award is `app/(public)/live/[gameId]/components/score-hero.tsx` in
 *     its FINAL phone composition (league line, the Final pill, one row per
 *     team, the winner in `text-highlight` and the loser at `text-white/45`,
 *     the venue in muted small caps) over
 *     `components/potg-card.tsx` — the gold-bordered card and the ShareRow
 *     button that really says "Danielle's game card 🏀";
 *   · the share sheet is `components/social/share-card-dialog.tsx`: a CENTRED
 *     modal on black/60, not a bottom sheet; the segmented card-type control
 *     on `bg-ink-100`, the generated card image, the four template chips with
 *     "📷 Add photo" beside them, two destination checkboxes BOTH TICKED by
 *     default, the Followers/Public segment, the line about public sharing,
 *     and "Just share the image" beside "Share". It runs to the dialog's real
 *     `done` state: "Shared! The story runs for 24 hours.";
 *   · the card in the Moments grid and in the dialog preview is
 *     `lib/cards/game-card.tsx` `renderCard()` in the `bold` template, drawn
 *     at 1200x630 and scaled down — the same flex composition, the same
 *     gradient, the same #f59e0b accent, the same stat chips, the same FINAL
 *     pill and score rows, and the same `/p/<handle>` burn-in that only
 *     appears once a handle exists;
 *   · the link is `components/players/claim-handle-card.tsx`: "Player
 *     handle", the "/p/" prefix, the `trey-reyes` placeholder, "Claim
 *     handle", the play-600 link and "Copy" turning into "Copied!".
 *
 * COMPOSED FOR THE HANDSET (declared, per the your-week precedent). The real
 * page renders these differently at 390 CSS px and the demo says so rather
 * than pretending:
 *   1. no site header and no bottom tab bar above/below the page, and the
 *      container's `py-10` composed as `pt-3`: 40px of leading white on a
 *      486px stage is dead screen;
 *   2. the EntityHeader's `min-w-[15rem]` wrap rule is dropped so the mug and
 *      the name share a line. At 390 the real rule stacks them and spends
 *      225px of the screen on an identity block;
 *   3. the six StatBlocks are 3-up rather than the real `grid-cols-2`, at
 *      tighter padding. Two-up is 362px tall and the demo would spend three
 *      beats scrolling past it. The anatomy — white card, ink-100 border,
 *      soft shadow, display-face tabular value over an ink-500 label — is the
 *      component's;
 *   4. the game log is composed to fit 390 instead of scrolling sideways in
 *      its `overflow-x-auto` wrapper, because a demo cannot swipe a table.
 *      Every column the product has is on it;
 *   5. the edit form shows the photo field and the jersey number. First and
 *      last name, date of birth, gender, height, weight, position and the
 *      privacy cards sit between them on the real page. Position is left out
 *      rather than drawn because `DB` her stored position is "Guard", which
 *      matches none of the form's five options, so the real ChipGroup shows
 *      nothing selected and a drawn selection would be an invented one;
 *      the handle field is narrowed from `w-40` so the Claim button stays on
 *      its line, which the real width does not at 390;
 *   6. the score hero's quarter-by-quarter linescore strip is composed out.
 *      The Game tab's leaders pair is drawn under the tabs and the box score
 *      and play-by-play continue below the fold, as they do on a phone.
 *
 * INVENTED-CONTENT LEDGER (everything not read from the database):
 *   · the head shot. A demo may not put a real child's face on a marketing
 *     page, so the photograph is hand-drawn SVG fed through PlayerMug's real
 *     `photoUrl` branch — the swap the viewer watches is the swap the
 *     component performs in production;
 *   · the game-card font. The real renderer loads Outfit through satori; the
 *     scaled replica here uses the page's own stack;
 *   · nothing else. Names, teams, dates, scores, stat lines, the award, the
 *     missing photo and the missing handle are all `DB`, including the
 *     opposing points leader on the game page (`DB` Maya Campbell, #36, 17
 *     PTS / 7 REB / 0 AST in that game). The seed draws teammate names from
 *     its own pools per reset, so hers is a pool name rather than a fixture.
 */

/* ── Cast, all read out of the seeded world ──────────────────────────────── */

/** `DB` Player dc5d7845: the accent tone is hashed from this id in production. */
const PLAYER_ID = "dc5d7845-692d-43fe-80a0-144e62d55987"
const PLAYER = "Danielle Reyes"
/** `PRODUCT` publicPlayerName(): mediaConsent UNSET, so cards carry the initial. */
const PLAYER_PUBLIC = "Danielle R."
const PARENT = "Jordan Reyes"
const JERSEY = "20"
const POSITION = "Guard"
const TEAM = "Toronto Lords Grade 10 Girls"
const AGE = "Grade 10"
const CLUB = "Toronto Lords"
const LEAGUE = "NPH Summer League"
const SEASON = "Summer 2026"
const HANDLE = "danielle-reyes"

/** `DB` Game 44744bad: the night she was Player of the Game. */
const POTG_OPPONENT = "North Toronto Huskies Grade 10 Girls"
const POTG_DATE = "Jul 26, 2026"
const POTG_VENUE = "The Playground"

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

/* ── Her season, straight out of PlayerStat ──────────────────────────────── */

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

/**
 * `DB` every COMPLETED PlayerStat row for dc5d7845, newest first, which is the
 * order `getPlayerSeasonData` returns and the order the log reads. Result and
 * score are computed the way the query computes them: her side's score first.
 * The first row is last night's game.
 */
const LOG: LogRow[] = [
  { date: "Aug 15", opponent: "Burlington Force Grade 10 Girls", result: "L", score: "44–50", pts: 16, reb: 5, ast: 1, stl: 2, blk: 0, to: 0, pf: 3 },
  { date: "Aug 9", opponent: "Burlington Force Grade 10 Girls", result: "L", score: "40–43", pts: 13, reb: 3, ast: 0, stl: 1, blk: 1, to: 4, pf: 3 },
  { date: "Jul 26", opponent: POTG_OPPONENT, result: "W", score: "48–44", pts: 20, reb: 3, ast: 1, stl: 1, blk: 0, to: 4, pf: 1 },
  { date: "Jul 12", opponent: "Mississauga Monarchs Grade 10 Girls", result: "L", score: "31–50", pts: 4, reb: 1, ast: 1, stl: 2, blk: 0, to: 2, pf: 4 },
  { date: "Jun 28", opponent: "Oakville Panthers Grade 10 Girls", result: "W", score: "55–29", pts: 6, reb: 3, ast: 1, stl: 1, blk: 3, to: 3, pf: 5 },
  { date: "Jun 14", opponent: "West United Prep Grade 10 Girls", result: "L", score: "33–48", pts: 5, reb: 3, ast: 3, stl: 4, blk: 2, to: 0, pf: 2 },
  { date: "May 31", opponent: "Burlington Force Grade 10 Girls", result: "W", score: "55–47", pts: 21, reb: 1, ast: 2, stl: 1, blk: 0, to: 2, pf: 5 },
  { date: "May 17", opponent: POTG_OPPONENT, result: "W", score: "58–42", pts: 21, reb: 2, ast: 3, stl: 0, blk: 1, to: 3, pf: 2 },
  { date: "May 3", opponent: "Mississauga Monarchs Grade 10 Girls", result: "W", score: "56–43", pts: 22, reb: 1, ast: 0, stl: 1, blk: 0, to: 2, pf: 6 },
  { date: "Apr 19", opponent: "Oakville Panthers Grade 10 Girls", result: "L", score: "33–43", pts: 7, reb: 6, ast: 2, stl: 1, blk: 1, to: 3, pf: 3 },
  { date: "Apr 5", opponent: "West United Prep Grade 10 Girls", result: "L", score: "45–48", pts: 19, reb: 5, ast: 0, stl: 1, blk: 1, to: 0, pf: 2 },
]

/** `PRODUCT` lib/stats/season aggregateSeasonStats: averages, never typed. */
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

/* ── Where the handset is scrolled ───────────────────────────────────────── */

/** Player page: the top, and the game log brought up under the header. */
const PAGE_TOP = 0
const PAGE_LOG = 296
const PAGE_MOMENTS = 300
/** Edit page: the photo field, and the handle card at the foot of the form. */
const EDIT_TOP = 0
const EDIT_HANDLE = 178
/** The card grows by a row once the handle exists, so the page moves with it. */
const EDIT_LINK = 238
/** Share dialog: the card, then the destinations and the buttons. */
const DLG_TOP = 0
const DLG_SEND = 214

/* ── Pacing ──────────────────────────────────────────────────────────────── */

function paced(b: Omit<DemoBeat, "hold"> & { hold?: number }): DemoBeat {
  if (b.hold) return b as DemoBeat
  /* Human pace (owner 2026-08-19): people click, then click again. Long
     reads only where a balloon earns one. */
  const arrive = b.cursor ? 620 : 180
  const settle = 400
  const read = b.callout ? b.callout.trim().split(/\s+/).length * 140 + 700 : 1200
  return { ...b, hold: Math.round(arrive + read + (b.callout ? settle : 0)) }
}

/* ── The script ──────────────────────────────────────────────────────────── */

export const playersSeasonStory: DemoScript = {
  presentation: "scene",
  scenePhones: true,
  desktopUrl: `/player/${PLAYER_ID}`,
  initialStage: "desktop",
  chapters: [
    { id: "season", title: "Her season, kept" },
    { id: "photo", title: "The photo" },
    { id: "potg", title: "Player of the Game" },
    { id: "share", title: "Share it" },
  ],

  beats: [
    /* ── 1. Her season, kept ──────────────────────────────────────────── */
    paced({
      id: "open",
      chapter: "season",
      caption: "The page the season builds for her: her team, her number, her position.",
      set: { screen: "player", games: 10 },
      emphasize: "hero",
      callout: "Nobody made this page. It exists because her games were scored.",
    }),
    paced({
      id: "stats",
      chapter: "season",
      caption: "Six averages, labelled in words rather than box score initials.",
      emphasize: "stats",
    }),
    paced({
      id: "log",
      chapter: "season",
      caption: "Under them, every night on its own line with the numbers she put up.",
      set: { scroll: PAGE_LOG },
      emphasize: "game-log",
    }),
    paced({
      id: "newgame",
      chapter: "season",
      caption: "Last night's game was scored at the table, so last night's line is already on it.",
      set: { games: 11 },
      emphasize: "new-row",
      callout: "The scorer's phone wrote this row. Nobody typed it twice and nobody kept a paper sheet.",
    }),
    paced({
      id: "averages",
      chapter: "season",
      caption: "And the averages above it move with it.",
      set: { scroll: PAGE_TOP },
      emphasize: "stats",
    }),

    /* ── 2. The photo ─────────────────────────────────────────────────── */
    /* Engine law (roster conversion, 2026-08-19): `set` applies at beat
       START, so a press that also swaps the screen deletes its own target.
       Every press below is its own beat; the landing is the next one. */
    paced({
      id: "add-photo",
      chapter: "photo",
      caption: "The one thing on this page that is not her is the drawing.",
      cursor: "add-photo",
      press: true,
      callout: "Until a photo exists she gets a sketch with her number on the chest, never a grey circle.",
    }),
    paced({
      id: "edit",
      chapter: "photo",
      caption: "Her photo lives on her own record, above every other field on the form.",
      set: { screen: "edit" },
    }),
    paced({
      id: "upload",
      chapter: "photo",
      caption: "One file, and no crop step, because the product does not ask for one.",
      cursor: "upload-photo",
      press: true,
    }),
    paced({
      id: "processing",
      chapter: "photo",
      caption: "It is resized on her phone before it ever leaves it.",
      set: { uploading: true },
      emphasize: "photo-field",
      callout: "The browser shrinks it to a head shot first, so no full size photo of a child is uploaded.",
    }),
    paced({
      id: "landed",
      chapter: "photo",
      caption: "The preview is the confirmation. Upload becomes Replace, and Remove appears beside it.",
      set: { uploading: false, photo: true },
      emphasize: "photo-field",
    }),
    paced({
      id: "save",
      chapter: "photo",
      caption: "Saved against the player, not against a post.",
      cursor: "save-changes",
      press: true,
    }),
    paced({
      id: "saved",
      chapter: "photo",
      caption: "Player updated successfully, in the form's own words.",
      set: { saved: true },
      emphasize: "saved-banner",
    }),
    paced({
      id: "her-face",
      chapter: "photo",
      caption: "And the page she shares has her face on it, in the frame the drawing was standing in.",
      set: { screen: "player", saved: false, scroll: PAGE_TOP },
      emphasize: "hero",
      callout: "One upload, and every roster, box score and game page she is on shows it.",
    }),

    /* ── 3. Player of the Game ────────────────────────────────────────── */
    paced({
      id: "game-page",
      chapter: "potg",
      caption: "Twenty points in a four point game got her the award, and the award is on the game.",
      set: { screen: "game" },
      emphasize: "potg",
      callout: "Nothing reaches a child's page on its own. It stays here until somebody moves it.",
    }),
    paced({
      id: "share-press",
      chapter: "potg",
      caption: "Her family can turn it into a card worth keeping.",
      cursor: "share-card",
      press: true,
    }),
    paced({
      id: "dialog",
      chapter: "potg",
      caption: "The card itself, four templates, and the award or the plain stat line.",
      set: { dialog: true },
      emphasize: "dlg-preview",
      callout: "The product draws this card, so it carries her public name rather than her full one.",
    }),
    paced({
      id: "dests",
      chapter: "potg",
      caption: "Her page, a story that runs for a day, or both. Both are ticked.",
      set: { dlgScroll: DLG_SEND },
      emphasize: "dlg-dests",
    }),
    paced({
      id: "visibility",
      chapter: "potg",
      caption: "And who is allowed to see it.",
      emphasize: "dlg-vis",
      callout: "Her profile is private, so the server clamps a public share back to followers.",
    }),
    paced({
      id: "share-confirm",
      chapter: "potg",
      caption: "Share.",
      cursor: "share-confirm",
      press: true,
    }),
    paced({
      id: "shared",
      chapter: "potg",
      caption: "Posted to her page, and the story runs for twenty four hours.",
      set: { shared: true, dlgScroll: DLG_TOP },
      emphasize: "dlg-done",
    }),
    paced({
      id: "done-press",
      chapter: "potg",
      caption: "Done.",
      cursor: "share-done",
      press: true,
    }),
    paced({
      id: "moment",
      chapter: "potg",
      caption: "And the card is on her page, under Moments, next to the season it came from.",
      set: {
        screen: "player",
        dialog: false,
        shared: false,
        dlgScroll: DLG_TOP,
        moment: true,
        scroll: PAGE_MOMENTS,
      },
      emphasize: "moments",
    }),

    /* ── 4. Share it ──────────────────────────────────────────────────── */
    paced({
      id: "handle",
      chapter: "share",
      caption: "The last piece is the address, on the same record as the photo.",
      set: { screen: "edit", editScroll: EDIT_HANDLE },
      emphasize: "handle-card",
    }),
    paced({
      id: "type-handle",
      chapter: "share",
      caption: "First come, first served, the way handles have to work.",
      cursor: "handle-field",
      type: { key: "handle", text: HANDLE },
    }),
    paced({
      id: "claim",
      chapter: "share",
      caption: "Claimed in one press.",
      cursor: "claim-handle",
      press: true,
    }),
    paced({
      id: "claimed",
      chapter: "share",
      caption: "And there is the link.",
      set: { claimed: true, editScroll: EDIT_LINK },
      emphasize: "handle-link",
    }),
    paced({
      id: "copy",
      chapter: "share",
      caption: "One tap to the clipboard, into a message, off to the people who want it.",
      cursor: "copy-link",
      press: true,
    }),
    paced({
      id: "copied",
      chapter: "share",
      caption: "Copied.",
      set: { copied: true },
      emphasize: "handle-link",
    }),
    paced({
      id: "final",
      chapter: "share",
      caption: "And from this moment the address is on every card she shares.",
      set: { screen: "player", scroll: PAGE_MOMENTS },
      emphasize: "moments",
      callout: "A card that gets forwarded still leads back to her page, which is how it finds people.",
    }),
    paced({
      id: "end-card",
      chapter: "share",
      caption:
        "Eleven games, an award, a face and an address, kept by the thing that was already keeping score.",
      hold: 4400,
      set: { endCard: true },
    }),
  ],

  /* ── Render ────────────────────────────────────────────────────────── */

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "player")
    const games = get<number>("games", 10)
    const claimed = get("claimed", false)
    const rows = LOG.slice(LOG.length - games)
    const path =
      screen === "edit"
        ? "/players/dc5d7845/edit"
        : screen === "game"
          ? "/live/44744bad"
          : claimed
            ? `/p/${HANDLE}`
            : "/player/dc5d7845"

    return {
      desktop: (
        <div className="relative flex h-full flex-col">
          <Phone
            screen={screen}
            rows={rows}
            agg={aggregate(rows)}
            photo={get("photo", false)}
            uploading={get("uploading", false)}
            saved={get("saved", false)}
            scroll={get<number>("scroll", PAGE_TOP)}
            editScroll={get<number>("editScroll", EDIT_TOP)}
            dialog={get("dialog", false)}
            dlgScroll={get<number>("dlgScroll", DLG_TOP)}
            shared={get("shared", false)}
            moment={get("moment", false)}
            claimed={claimed}
            copied={get("copied", false)}
            handleValue={
              <TypeText
                text={get<string>("handle", "")}
                typing={typingKey === "handle"}
                placeholder="trey-reyes"
              />
            }
          />
          {get("endCard", false) && <EndCard />}
        </div>
      ),
      frameLabels: { left: `${PARENT} · ${path}`, right: "" },
    }
  },
}

/* ── The handset ─────────────────────────────────────────────────────────── */

function Phone({
  screen,
  rows,
  agg,
  photo,
  uploading,
  saved,
  scroll,
  editScroll,
  dialog,
  dlgScroll,
  shared,
  moment,
  claimed,
  copied,
  handleValue,
}: {
  screen: string
  rows: LogRow[]
  agg: ReturnType<typeof aggregate>
  photo: boolean
  uploading: boolean
  saved: boolean
  scroll: number
  editScroll: number
  dialog: boolean
  dlgScroll: number
  shared: boolean
  moment: boolean
  claimed: boolean
  copied: boolean
  handleValue: ReactNode
}) {
  const mug = photo ? PHOTO : undefined
  return (
    <div className="relative flex h-full flex-col bg-[#faf8f4]">
      <div key={screen} className="demo-fade-in relative min-h-0 flex-1 overflow-hidden">
        {screen === "player" && (
          <PlayerPage
            photoUrl={mug}
            agg={agg}
            rows={rows}
            moment={moment}
            handle={claimed ? HANDLE : null}
            scroll={scroll}
          />
        )}
        {screen === "edit" && (
          <EditPage
            photoUrl={mug}
            uploading={uploading}
            saved={saved}
            scroll={editScroll}
            claimed={claimed}
            copied={copied}
            handleValue={handleValue}
          />
        )}
        {screen === "game" && <GamePage photoUrl={mug} />}
      </div>

      {/* `share-card-dialog.tsx` is `fixed inset-0`: it covers the handset. */}
      {dialog && <ShareDialog scroll={dlgScroll} shared={shared} handle={claimed ? HANDLE : null} />}
    </div>
  )
}

/* ── /player/[id] ────────────────────────────────────────────────────────── */

function PlayerPage({
  photoUrl,
  agg,
  rows,
  moment,
  handle,
  scroll,
}: {
  photoUrl?: string
  agg: ReturnType<typeof aggregate>
  rows: LogRow[]
  moment: boolean
  handle: string | null
  scroll: number
}) {
  return (
    <div className="h-full overflow-hidden">
      <div
        className="px-4 pt-3 transition-transform duration-[700ms] ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-scroll}px)` }}
      >
        {/* `SmartBack fallback="/players" fallbackLabel="My players"`. */}
        <span className="text-ink-600 -ml-1 mb-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl py-2 pl-1 pr-3 text-sm font-semibold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          My players
        </span>

        {/* `entity-header.tsx`: daylight floor, the mark slot carrying a face,
            the navy 4px baseline along the bottom edge. */}
        <header
          data-demo-target="hero"
          className="relative isolate mb-3 overflow-hidden rounded-[28px] border border-[#e7dbc4]"
        >
          <CourtBackdropLayer variant="daylight" intensity="band" />
          <div className="relative z-10 flex items-center gap-4 p-4 pb-5">
            <PlayerMug
              name={PLAYER}
              accentKey={PLAYER_ID}
              jerseyNumber={JERSEY}
              photoUrl={photoUrl}
              sizeClassName="h-16 w-16 rounded-2xl"
              className="shadow-lg"
            />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-ink-950 text-[26px] font-black leading-[1.04] tracking-[-0.02em]">
                {PLAYER}
              </h1>
              <p className="text-ink-600 mt-1 text-[13px] leading-snug">
                {TEAM} · {AGE} · {CLUB}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <MetaChip>#{JERSEY}</MetaChip>
                <MetaChip>{POSITION}</MetaChip>
                <MetaChip key={agg.games}>
                  <span className="demo-pulse-green rounded-full">{agg.games} games</span>
                </MetaChip>
              </div>
            </div>
          </div>
          <span aria-hidden="true" className="bg-navy-900 absolute inset-x-0 bottom-0 z-10 h-1" />
        </header>

        {/* page lines 114 to 134: the Add photo pill and the Follow button. */}
        <div className="mb-3 flex items-center justify-end gap-2">
          <span
            data-demo-target="add-photo"
            className={cn(
              "bg-ink-50 text-ink-700 ring-ink-200 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold ring-1 transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:bg-ink-100 data-[demo-hover=true]:ring-play-300",
              "data-[demo-press=true]:scale-[0.96]"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {photoUrl ? "Change photo" : "Add photo"}
          </span>
          {/* `follow-button.tsx`, light variant, not following. */}
          <span className="bg-ink-950 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
            </svg>
            Follow
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <PillLink>{TEAM} &rarr;</PillLink>
          <PillLink>{CLUB} &rarr;</PillLink>
        </div>

        {/* Six `stat-block.tsx` tiles. The page passes no icon, so `tone`
            never renders and all six are the component's white card. */}
        <div data-demo-target="stats" className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="Points per game" value={agg.ppg} />
          <Stat label="Rebounds per game" value={agg.rpg} />
          <Stat label="Assists per game" value={agg.apg} />
          <Stat label="Steals per game" value={agg.spg} />
          <Stat label="Blocks per game" value={agg.bpg} />
          <Stat label="Games played" value={String(agg.games)} />
        </div>

        {moment && (
          <div data-demo-target="moments" className="live-row-in mb-4">
            <h2 className="text-ink-950 mb-2 text-lg font-bold">Moments</h2>
            <div className="grid grid-cols-1 gap-3">
              <GameCard width={358} handle={handle} />
            </div>
          </div>
        )}

        {/* `Card` (ui/card.tsx) with `overflow-hidden p-0`. */}
        <section className="border-ink-100 shadow-soft overflow-hidden rounded-[28px] border bg-white">
          <div
            data-demo-target="game-log"
            className="border-ink-100 flex items-center justify-between border-b px-4 py-3"
          >
            <h2 className="text-ink-950 text-lg font-bold">Game log</h2>
            <span key={agg.pts} className="text-ink-400 demo-pulse-green rounded text-[10px] tabular-nums">
              Season totals: {agg.pts} PTS · {agg.reb} REB · {agg.ast} AST
            </span>
          </div>
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="text-ink-400 border-ink-100 border-b text-left text-[8.5px] uppercase">
                <th className="w-[42px] py-1.5 pl-2.5 pr-0 font-semibold">Date</th>
                <th className="pl-1.5 pr-0 py-1.5 font-semibold">Matchup</th>
                <th className="w-[54px] pl-1.5 pr-0 py-1.5 font-semibold">Result</th>
                <th className="w-[22px] px-0 py-1.5 text-right font-semibold">PTS</th>
                <th className="w-[22px] px-0 py-1.5 text-right font-semibold">REB</th>
                <th className="w-[22px] px-0 py-1.5 text-right font-semibold">AST</th>
                <th className="w-[22px] px-0 py-1.5 text-right font-semibold">STL</th>
                <th className="w-[22px] px-0 py-1.5 text-right font-semibold">BLK</th>
                <th className="w-[18px] px-0 py-1.5 text-right font-semibold">TO</th>
                <th className="w-[26px] py-1.5 pl-0 pr-2.5 text-right font-semibold">PF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.date}
                  data-demo-target={i === 0 ? "new-row" : undefined}
                  className={cn("border-ink-50 border-b last:border-0", i === 0 && "live-row-in")}
                >
                  <td className="text-ink-500 whitespace-nowrap py-[5px] pl-2.5 pr-0 text-[11px]">
                    {r.date}
                  </td>
                  <td className="text-ink-950 truncate py-[5px] pl-1.5 pr-0 text-[11px] font-medium">
                    vs {r.opponent}
                  </td>
                  <td className="whitespace-nowrap py-[5px] pl-1.5 pr-0 text-[11px]">
                    <span
                      className={cn(
                        "font-semibold",
                        r.result === "W" ? "text-court-600" : "text-live-600"
                      )}
                    >
                      {r.result} {r.score}
                    </span>
                  </td>
                  <LogNum value={r.pts} lead />
                  <LogNum value={r.reb} />
                  <LogNum value={r.ast} />
                  <LogNum value={r.stl} />
                  <LogNum value={r.blk} />
                  <LogNum value={r.to} />
                  <td className="text-ink-700 py-[5px] pl-0 pr-2.5 text-right text-[11px] tabular-nums">
                    {r.pf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="text-ink-400 mt-4 pb-4 text-xs leading-snug">
          Player names on public pages show first name and last initial unless a parent has opted
          into full public names. Signed-in league and club participants see full names.
        </p>
      </div>
    </div>
  )
}

function LogNum({ value, lead }: { value: number; lead?: boolean }) {
  return (
    <td
      className={cn(
        "px-0 py-[5px] text-right text-[11px] tabular-nums",
        lead ? "text-ink-950 font-semibold" : "text-ink-700"
      )}
    >
      {value}
    </td>
  )
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="border-ink-200 text-ink-700 rounded-full border bg-white/90 px-2.5 py-0.5 text-xs font-semibold shadow-sm">
      {children}
    </span>
  )
}

function PillLink({ children }: { children: ReactNode }) {
  return (
    <span className="bg-ink-50 text-ink-700 ring-ink-200 rounded-full px-3 py-1.5 text-xs font-semibold ring-1">
      {children}
    </span>
  )
}

/** `stat-block.tsx` with no icon and no trend: the white card and its type. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-2.5">
      <div
        key={value}
        className="font-display text-ink-950 demo-pulse-green rounded text-[22px] font-bold leading-none tabular-nums"
      >
        {value}
      </div>
      <div className="text-ink-500 mt-1 text-[10.5px] leading-tight">{label}</div>
    </div>
  )
}

/* ── The generated card ──────────────────────────────────────────────────── */

/**
 * `lib/cards/game-card.tsx` `renderCard()`, `bold` template, drawn at its real
 * 1200x630 and scaled to the caller's width — the same flex composition the
 * OG renderer builds, so the Moments grid and the dialog preview show the
 * image the product would actually serve.
 */
const CARD = {
  leftBg: "linear-gradient(135deg, #1e2d4d 0%, #0b1628 100%)",
  leftFg: "#ffffff",
  eyebrow: "#fbbf24",
  accent: "#f59e0b",
  rightBg: "#ffffff",
  rightFg: "#0f172a",
  sub: "#64748b",
}

const CARD_STATS: Array<[string, number]> = [
  ["PTS", 20],
  ["REB", 3],
  ["AST", 1],
]

const CARD_ROWS: Array<[string, number, boolean]> = [
  [POTG_OPPONENT, 44, false],
  [TEAM, 48, true],
]

function GameCard({ width, handle }: { width: number; handle: string | null }) {
  const s = width / 1200
  const chip: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 22px",
    borderRadius: 18,
    background: "rgba(148, 163, 184, 0.18)",
  }
  return (
    <div
      className="border-ink-100 overflow-hidden rounded-xl border"
      style={{ width, height: Math.round(630 * s) }}
    >
      <div
        style={{
          display: "flex",
          width: 1200,
          height: 630,
          transform: `scale(${s})`,
          transformOrigin: "top left",
        }}
      >
        {/* Left: the player */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 560,
            padding: "0 48px",
            background: CARD.leftBg,
            color: CARD.leftFg,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: CARD.eyebrow }}>
            PLAYER OF THE GAME
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 24 }}>
            {/* `loadCardData` only puts a photo on this card with GRANTED
                media consent, and hers is UNSET, so it draws the number. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 170,
                height: 170,
                borderRadius: 999,
                background: CARD.accent,
                color: "#ffffff",
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              #{JERSEY}
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
                {PLAYER_PUBLIC}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 36 }}>
            {CARD_STATS.map(([label, value]) => (
              <div key={label} style={chip}>
                <span style={{ fontSize: 44, fontWeight: 800 }}>{value}</span>
                <span style={{ fontSize: 20, fontWeight: 600, color: CARD.eyebrow }}>{label}</span>
              </div>
            ))}
          </div>
          {handle && (
            <span
              className="live-pop"
              style={{ fontSize: 24, fontWeight: 600, marginTop: 34, color: CARD.eyebrow }}
            >
              sportshubone.com/p/{handle}
            </span>
          )}
        </div>

        {/* Right: the final */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            background: CARD.rightBg,
            color: CARD.rightFg,
          }}
        >
          <span
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 6,
              padding: "8px 28px",
              borderRadius: 999,
              background: CARD.accent,
              color: "#ffffff",
            }}
          >
            FINAL
          </span>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 40, width: 480 }}>
            {CARD_ROWS.map(([name, score, won], i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 0",
                  borderBottom: i === 0 ? `2px solid ${CARD.sub}33` : "none",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: won ? 800 : 600,
                    opacity: won ? 1 : 0.65,
                    maxWidth: 360,
                  }}
                >
                  {name}
                </span>
                <span style={{ fontSize: 64, fontWeight: 800, opacity: won ? 1 : 0.65 }}>
                  {score}
                </span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 22, color: CARD.sub, marginTop: 28 }}>
            {LEAGUE} · {SEASON} · {POTG_DATE}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 40 }}>
            <span style={{ fontSize: 26, fontWeight: 800 }}>
              Sports<span style={{ color: CARD.accent }}>Hub</span> One
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── /players/[id]/edit ──────────────────────────────────────────────────── */

const LABEL = "block text-sm font-medium text-ink-700"
const INPUT =
  "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-ink-900 text-sm shadow-sm"

function EditPage({
  photoUrl,
  uploading,
  saved,
  scroll,
  claimed,
  copied,
  handleValue,
}: {
  photoUrl?: string
  uploading: boolean
  saved: boolean
  scroll: number
  claimed: boolean
  copied: boolean
  handleValue: ReactNode
}) {
  return (
    <div className="h-full overflow-hidden">
      <div
        className="p-3 transition-transform duration-[700ms] ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-scroll}px)` }}
      >
        <div className="mb-2">
          <span className="text-ink-600 -ml-1 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl py-2 pl-1 pr-3 text-sm font-semibold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Players
          </span>
        </div>

        <div className="border-ink-100 rounded-3xl border bg-white p-4 shadow-[0_16px_50px_-34px_rgba(15,23,42,0.45)]">
          <h1 className="text-ink-900 mb-1 text-2xl font-semibold">Edit Player</h1>
          <p className="text-ink-600 mb-3 text-sm">Update your player&apos;s information.</p>

          {saved && (
            <div
              data-demo-target="saved-banner"
              className="bg-court-50 text-court-700 live-pop mb-3 rounded-md border border-green-200 p-3 text-sm"
            >
              Player updated successfully!
            </div>
          )}

          {/* id="photo": the target of the player page's Add photo deep link. */}
          <div data-demo-target="photo-field" className="border-ink-100 mb-4 rounded-2xl border p-3">
            <span className={`${LABEL} mb-2`}>Player photo</span>
            {/* `player-photo-field.tsx`, verbatim. */}
            <div className="flex items-start gap-3">
              <span className={cn("relative block", uploading && "opacity-60")}>
                <PlayerMug
                  name={PLAYER}
                  accentKey={PLAYER_ID}
                  jerseyNumber={JERSEY}
                  photoUrl={photoUrl}
                  sizeClassName="h-20 w-20 rounded-2xl"
                />
                {uploading && (
                  <span className="bg-ink-900/15 absolute inset-0 animate-pulse rounded-2xl motion-reduce:animate-none" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <span
                    data-demo-target="upload-photo"
                    className={cn(
                      "border-ink-200 text-ink-700 inline-flex min-h-[40px] items-center rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all duration-200 motion-reduce:transition-none",
                      "data-[demo-hover=true]:bg-ink-50 data-[demo-hover=true]:border-play-300",
                      "data-[demo-press=true]:scale-[0.96]",
                      uploading && "opacity-50"
                    )}
                  >
                    {uploading ? "Processing..." : photoUrl ? "Replace photo" : "Upload photo"}
                  </span>
                  {photoUrl && !uploading && (
                    <span className="text-ink-500 live-pop inline-flex min-h-[40px] items-center rounded-xl px-3 py-1.5 text-sm font-semibold">
                      Remove
                    </span>
                  )}
                </div>
                <p className="text-ink-400 mt-1.5 text-xs leading-snug">
                  A head shot works best. Without one we draw the sketch on the left with the jersey
                  number. Only upload a photo of your own player.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <span className={LABEL}>
              Jersey Number <span className="text-ink-400">(optional)</span>
            </span>
            <span className={`${INPUT} block`}>{JERSEY}</span>
          </div>

          <div className="flex gap-3 pt-1">
            <span className="border-ink-200 text-ink-700 rounded-xl border bg-white px-4 py-2 text-sm font-semibold shadow-sm">
              Cancel
            </span>
            <span
              data-demo-target="save-changes"
              className={cn(
                "bg-play-600 flex-1 rounded-xl px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:bg-play-700",
                "data-[demo-press=true]:scale-[0.98]"
              )}
            >
              Save Changes
            </span>
          </div>

          {/* `claim-handle-card.tsx`, mounted under the form. */}
          <div className="mt-5">
            <div data-demo-target="handle-card" className="border-ink-100 rounded-2xl border bg-white p-4">
              <h2 className="text-ink-950 text-base font-bold">Player handle</h2>
              <p className="text-ink-500 mt-1 text-sm leading-snug">
                Claim a unique handle, it becomes this player&apos;s shareable page link. First come,
                first served.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  data-demo-target="handle-field"
                  className={cn(
                    "border-ink-200 flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-sm transition-all duration-200 motion-reduce:transition-none",
                    "data-[demo-hover=true]:border-play-500"
                  )}
                >
                  <span className="text-ink-400">/p/</span>
                  <span className="text-ink-900 ml-0.5 w-[118px]">{handleValue}</span>
                </span>
                <span
                  data-demo-target="claim-handle"
                  className={cn(
                    "bg-play-600 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all duration-200 motion-reduce:transition-none",
                    "data-[demo-hover=true]:bg-play-700",
                    "data-[demo-press=true]:scale-[0.96]"
                  )}
                >
                  {claimed ? "Change" : "Claim handle"}
                </span>
              </div>
              {claimed && (
                <div
                  data-demo-target="handle-link"
                  className="live-pop mt-2 flex items-center gap-2 text-sm"
                >
                  <span className="text-play-600 font-semibold">sportshubone.com/p/{HANDLE}</span>
                  <span
                    data-demo-target="copy-link"
                    className={cn(
                      "text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
                      copied ? "text-court-700" : "text-ink-400",
                      "data-[demo-hover=true]:text-ink-700",
                      "data-[demo-press=true]:scale-[0.92]"
                    )}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="h-6" />
      </div>
    </div>
  )
}

/* ── /live/[gameId], the final ───────────────────────────────────────────── */

/** `score-hero.tsx` line 105: the navy stage, lit from above. */
const STAGE_BG = {
  backgroundImage:
    "radial-gradient(120% 150% at 50% -20%, rgba(255,255,255,0.10) 0%, transparent 60%), linear-gradient(135deg, #16233a, #0b1628)",
}
const META = "text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/55"

function HeroTeamRow({ name, score, won }: { name: string; score: number; won: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Crest name={name} surface="dark" sizeClassName="h-11 w-11 rounded-xl text-[15px]" className="shadow-lg" />
      <p className="min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-tight text-white">
        {name}
      </p>
      <p
        className={cn(
          "font-condensed min-w-[62px] text-right text-[42px] font-semibold leading-none tracking-[-0.01em] tabular-nums",
          won ? "text-highlight" : "text-white/45"
        )}
      >
        {score}
      </p>
    </div>
  )
}

function GamePage({ photoUrl }: { photoUrl?: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 px-4 pb-4 pt-3 text-white" style={STAGE_BG}>
        <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          <span className="text-highlight">{LEAGUE}</span> · {SEASON}
        </p>
        <div className="mt-2.5 flex items-center justify-center">
          <span className="text-ink-950 rounded-full bg-white px-3 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.18em]">
            Final
          </span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          <HeroTeamRow name={POTG_OPPONENT} score={44} won={false} />
          <HeroTeamRow name={TEAM} score={48} won />
        </div>
        <p className={`mt-2 text-center ${META}`}>{POTG_VENUE}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 px-4 pt-4">
        {/* `potg-card.tsx`, frame for frame. */}
        <div
          data-demo-target="potg"
          className="border-gold-300 from-gold-50 flex items-center gap-4 rounded-2xl border bg-gradient-to-r to-white p-4"
        >
          <PlayerMug
            name={PLAYER}
            accentKey={PLAYER_ID}
            jerseyNumber={JERSEY}
            photoUrl={photoUrl}
            sizeClassName="h-16 w-16 rounded-full"
            frameClassName="border-gold-400 bg-gold-50 border-2"
          />
          <div className="min-w-0">
            <p className="text-gold-700 text-[10.5px] font-bold uppercase tracking-[0.2em]">
              🏀 Player of the Game
            </p>
            <p className="text-ink-950 block truncate text-[17px] font-semibold">
              #{JERSEY} {PLAYER}
            </p>
            <p className="text-ink-500 text-[12px] font-medium uppercase tracking-[0.08em]">
              20 PTS · 3 REB · 1 AST
            </p>
          </div>
        </div>

        {/* `potg-card.tsx` ShareRow: the family of a player who appeared. */}
        <div className="border-ink-100 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3">
          <span className="text-ink-500 text-xs font-semibold uppercase tracking-[0.14em]">
            Share
          </span>
          <span
            data-demo-target="share-card"
            className={cn(
              "border-play-200 bg-play-50 text-play-700 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 motion-reduce:transition-none",
              "data-[demo-hover=true]:bg-play-100 data-[demo-hover=true]:border-play-400",
              "data-[demo-press=true]:scale-[0.96]"
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            Danielle&apos;s game card 🏀
          </span>
        </div>

        {/* Game | Team stats | Play-by-play, then the Game tab under it. */}
        <div className="border-ink-100 flex gap-1 rounded-2xl border bg-white p-1.5 shadow-sm">
          {[
            ["Game", true],
            ["Team stats", false],
            ["Play-by-play", false],
          ].map(([label, on]) => (
            <span
              key={String(label)}
              className={cn(
                "min-h-[44px] flex-1 whitespace-nowrap rounded-xl px-2.5 py-2.5 text-center text-[13px] font-semibold",
                on ? "bg-play-600 text-white shadow-sm" : "text-ink-500"
              )}
            >
              {label}
            </span>
          ))}
        </div>

        {/* `game-leaders.tsx`: the head-to-head pair, phone layout (label on
            top, no third column at 390). The box score runs below the fold. */}
        <section>
          <h3 className="text-ink-800 mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.18em]">
            Game leaders
          </h3>
          <div className="border-ink-100 flex flex-col gap-1 rounded-2xl border bg-white p-1.5">
            <span className="text-ink-600 w-full shrink-0 pt-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.18em]">
              Points
            </span>
            <div className="flex min-w-0 gap-1.5">
              <LeaderCell
                id="51f15a35-febb-4893-824c-afc6f6081ea1"
                name="Maya C."
                jersey="36"
                value={17}
                sub="7 REB · 0 AST"
              />
              <LeaderCell
                id={PLAYER_ID}
                name={PLAYER_PUBLIC}
                jersey={JERSEY}
                value={20}
                sub="3 REB · 1 AST"
                photoUrl={photoUrl}
                won
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/** `game-leaders.tsx` LeaderCell: the player's own accent as the card wash. */
function LeaderCell({
  id,
  name,
  jersey,
  value,
  sub,
  photoUrl,
  won,
}: {
  id: string
  name: string
  jersey: string
  value: number
  sub: string
  photoUrl?: string
  won?: boolean
}) {
  const accent = accentForKey(id)
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl p-2"
      style={{ backgroundColor: won ? accent.washSoft : accent.washFaint }}
    >
      <PlayerMug
        name={name}
        accentKey={id}
        jerseyNumber={jersey}
        photoUrl={photoUrl}
        sizeClassName="h-9 w-9 rounded-full"
        frameClassName="bg-white shadow-md ring-2 ring-inset ring-ink-100"
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink-950 block truncate text-[13px] font-semibold leading-tight">{name}</p>
        <div className="mt-0.5 flex items-end gap-1">
          <span className="font-condensed text-ink-950 text-[1.7rem] font-semibold leading-[0.85] tracking-[-0.01em] tabular-nums">
            {value}
          </span>
          <span className="text-ink-500 pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em]">
            PTS
          </span>
        </div>
        <p className="text-ink-500 mt-0.5 truncate text-[10.5px] font-medium uppercase tracking-[0.08em]">
          {sub}
        </p>
      </div>
    </div>
  )
}

/* ── share-card-dialog.tsx ───────────────────────────────────────────────── */

function ShareDialog({
  scroll,
  shared,
  handle,
}: {
  scroll: number
  shared: boolean
  handle: string | null
}) {
  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-black/60 p-4">
      <div
        className="live-pop w-full rounded-2xl bg-white p-4 shadow-2xl transition-transform duration-[600ms] ease-out motion-reduce:transition-none"
        style={{ transform: `translateY(${-scroll}px)` }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-ink-950 text-lg font-bold">Share Danielle&apos;s card</h3>
          <span className="text-ink-400 p-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
        </div>

        {shared ? (
          <div data-demo-target="dlg-done" className="mt-4 space-y-3 text-center">
            <p className="text-court-700 bg-court-50 rounded-xl p-3 text-sm font-semibold">
              Shared! The story runs for 24 hours.
            </p>
            <span className="border-ink-200 text-ink-700 block w-full rounded-xl border px-4 py-2.5 text-sm font-semibold">
              Also share the image (Instagram, chat…)
            </span>
            <span
              data-demo-target="share-done"
              className={cn(
                "bg-play-600 block w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 motion-reduce:transition-none",
                "data-[demo-hover=true]:bg-play-700",
                "data-[demo-press=true]:scale-[0.98]"
              )}
            >
              Done
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="bg-ink-100 flex rounded-xl p-1">
              <span className="text-ink-950 flex-1 rounded-lg bg-white px-2 py-1.5 text-center text-xs font-semibold shadow-sm">
                🏀 Player of the Game
              </span>
              <span className="text-ink-500 flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold">
                📊 Stat line
              </span>
            </div>

            <div data-demo-target="dlg-preview">
              <GameCard width={326} handle={handle} />
            </div>

            <div className="flex gap-1.5">
              {["bold", "clean", "court", "night"].map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "flex-1 rounded-lg border px-1 py-1.5 text-center text-xs font-semibold capitalize",
                    i === 0
                      ? "border-play-500 bg-play-50 text-play-700"
                      : "border-ink-200 text-ink-600 bg-white"
                  )}
                >
                  {t}
                </span>
              ))}
              <span className="border-ink-200 text-ink-600 rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold">
                📷 Add photo
              </span>
            </div>

            <div data-demo-target="dlg-dests" className="space-y-2">
              <DestRow label="Post to profile" sub="Stays on the player page" />
              <DestRow label="Add to story" sub="Visible for 24 hours" />
            </div>

            <div data-demo-target="dlg-vis">
              <div className="bg-ink-100 flex rounded-xl p-1">
                <span className="text-ink-950 flex-1 rounded-lg bg-white px-2 py-1.5 text-center text-xs font-semibold shadow-sm">
                  Followers
                </span>
                <span className="text-ink-500 flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-semibold">
                  Public
                </span>
              </div>
              <p className="text-ink-400 mt-2 text-xs leading-snug">
                Public sharing applies only when the player&apos;s profile is set to public.
              </p>
            </div>

            <div className="flex gap-2">
              <span className="border-ink-200 text-ink-700 flex-1 rounded-xl border px-3 py-2.5 text-center text-sm font-semibold">
                Just share the image
              </span>
              <span
                data-demo-target="share-confirm"
                className={cn(
                  "bg-play-600 flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white transition-all duration-200 motion-reduce:transition-none",
                  "data-[demo-hover=true]:bg-play-700",
                  "data-[demo-press=true]:scale-[0.98]"
                )}
              >
                Share
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The dialog's destination checkboxes, both ticked, as the product ships. */
function DestRow({ label, sub }: { label: string; sub: string }) {
  return (
    <span className="border-ink-200 flex items-center gap-3 rounded-xl border p-2.5">
      <span className="border-play-600 bg-play-600 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="h-2.5 w-2.5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="text-ink-900 block font-semibold">{label}</span>
        <span className="text-ink-500 block text-xs">{sub}</span>
      </span>
    </span>
  )
}

/* ── End card ────────────────────────────────────────────────────────────── */

function EndCard() {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b1628] px-8 text-white">
      <div className="live-pop max-w-[340px] text-center">
        <p className="text-gold-400 text-[15px] font-bold uppercase tracking-[0.18em]">
          A parent chapter
        </p>
        <h3 className="font-display mt-2 text-[26px] font-extrabold leading-tight">
          A player&apos;s page and stats
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-white/75">
          Eleven real games with the numbers she really put up, a sketch that became her face in one
          upload, the night she was Player of the Game shared with her own decision, and an address
          she can say out loud.
        </p>
        <p className="mt-4 text-[14px] font-semibold text-white/50">Next: the money picture</p>
      </div>
    </div>
  )
}
