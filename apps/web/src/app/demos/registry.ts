/**
 * The demo directory registry (owner-approved structure, 2026-08-15).
 *
 * Ten demos: four cross-role STORIES that hand off between a desktop workspace
 * and a family phone on one split stage, and six solo CHAPTERS that stay on one
 * surface. A story is listed under every audience it serves, because the point
 * of a story is that the club side and the parent side are the same event seen
 * from two ends.
 *
 * This file is the single source of truth for the directory: cards, filters,
 * detail pages and the "what is coming" copy all read it. Adding a demo means
 * adding an entry here and pointing `component` at its script.
 */

export type DemoAudience = "parents" | "clubs" | "leagues"

export const AUDIENCE_LABELS: Record<DemoAudience, string> = {
  parents: "Parents",
  clubs: "Clubs",
  leagues: "Leagues",
}

export interface DemoEntry {
  slug: string
  title: string
  /** One line, what the viewer will see happen. No em-dashes. */
  promise: string
  /**
   * Two or three sentences for the intro stage: what the viewer will actually
   * watch, beat by beat, in plain words. Read before pressing play, so it names
   * the moments rather than selling the feature.
   */
  description: string
  /**
   * Chapter names for a demo that is not filmed yet. Live demos take their
   * chapter list from the script instead, so this stays empty for them.
   */
  plannedChapters?: string[]
  audiences: DemoAudience[]
  /** A story hands off between surfaces; a chapter stays on one. */
  kind: "story" | "chapter"
  /** How the stage is framed, which is also the thumbnail glyph. */
  stage: "split" | "desktop" | "phone"
  durationLabel: string
  status: "live" | "coming-soon"
  /** The flagship demo gets the wide card. */
  featured?: boolean
  /** Thumbnail wordmark until real captures exist. */
  thumbEyebrow: string
}

export const DEMOS: DemoEntry[] = [
  {
    slug: "roster-story",
    title: "Build a team, fill the roster",
    promise:
      "A club creates a team, posts a tryout, a family registers and pays, the offer is accepted with sizes and number, and the roster fills.",
    description:
      "It starts on an empty club workspace: the U11 girls team gets made, a coach is assigned, and the roster behind it has nobody on it. The tryout goes up with its date, gym and fee, and a parent finds it on her phone, picks which of her two kids is trying out and pays the fee there. Then the part clubs chase families for all season: she accepts the offer and, on the same screen, picks the uniform size, the tracksuit size, the shoe size, her jersey number with a fallback, and the payment plan with its schedule written out. The last chapter is the club roster filling in, sizes and waivers already recorded, until it reads ten of ten.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "1 min 35 sec",
    status: "live",
    thumbEyebrow: "Story 1",
  },
  {
    slug: "everyone-in-the-loop",
    title: "Everyone in the loop",
    promise:
      "One gym change reaches twelve families at once, the club sees who has read it, and the question and the decision both land in the open.",
    description:
      "A club writes one message about a Saturday gym change, and the first thing it picks is who gets it: the whole club is one option, this one goes to a single team. Then the part nobody else shows you, the read count climbing to eleven of twelve with the twelfth family named on screen and a nudge next to the name. A parent taps the notification, asks her question in the team thread instead of texting the coach privately, and gets the answer where all twelve families can read it. The last stretch is a poll for the team dinner: two options, a vote on the phone, the bars filling on the club side, and the result pinned to the thread so nobody has to scroll back through a week to find it.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "1 min 25 sec",
    status: "live",
    thumbEyebrow: "Story 2",
  },
  {
    slug: "season-planned-to-published",
    title: "A season, planned to published",
    promise:
      "A league plans dates and gyms, clubs submit teams, the schedule generates, and every calendar updates.",
    description:
      "A league sets the season window, adds the gyms it has booked and opens team submissions. Clubs send their teams in, the schedule generates in one pass, and the two conflicts it finds get flagged before anything goes public. The last stretch publishes the season, and the same games appear on a parent calendar.",
    plannedChapters: [
      "Set the season",
      "Clubs submit teams",
      "Generate the schedule",
      "Publish to calendars",
    ],
    audiences: ["leagues", "clubs"],
    kind: "story",
    stage: "split",
    durationLabel: "2 min",
    status: "coming-soon",
    thumbEyebrow: "Story 3",
  },
  {
    slug: "game-day",
    title: "Game day, both sides at once",
    promise:
      "The full scoring console on one side, a parent watching live on the other, through to the referee sign off and the recap.",
    description:
      "One side is the scoring console at the scorer table, running the clock, the fouls and the substitutions as the game goes. The other side is a parent stuck at work, watching the same game update play by play on her phone. The demo runs through the final buzzer, the referee sign off, and the recap that posts to the team page minutes later.",
    plannedChapters: [
      "Tip off at the table",
      "A parent follows live",
      "Final buzzer and sign off",
      "The recap posts",
    ],
    audiences: ["leagues", "clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "3 min",
    status: "coming-soon",
    featured: true,
    thumbEyebrow: "Story 4",
  },
  {
    slug: "claim-your-club",
    title: "Claim your club and make it yours",
    promise:
      "Find your club page, claim it with the contact already on file, then set colours, crest and staff.",
    description:
      "You search the directory and find a club page that already exists, built from public league listings. The claim goes to the contact on file, verification comes back, and the page unlocks. From there the club sets its colours, uploads the crest and adds two staff, and the public page changes as each one is saved.",
    plannedChapters: ["Find your club", "Verify the contact", "Colours, crest and staff"],
    audiences: ["clubs"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "60 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 5",
  },
  {
    slug: "your-week",
    title: "Your week",
    promise:
      "A parent opens the app and sees exactly what is happening, for both kids, with the gym address in one tap.",
    description:
      "A parent opens the app on a Tuesday morning and gets the week for two kids on one screen. Practice tonight, a game Saturday, and the gym address one tap from directions. A fee reminder and an unsigned waiver are sitting in the same week, and both get handled without leaving it.",
    plannedChapters: ["Open the week", "Two kids, one screen", "Directions in one tap"],
    audiences: ["parents"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "60 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 6",
  },
  {
    slug: "players-season",
    title: "The player's season",
    promise:
      "Every game, stat line, highlight and award on one page a kid is proud to share.",
    description:
      "The page opens on a player header with the season record, the team and the photo. You move down through the game log, where every night has its own stat line, then to a highlight clip and the player of the game award that came with it. The last beat shares the page as a link, which is the version a kid actually sends to family.",
    plannedChapters: [
      "The season header",
      "Game log and stats",
      "Highlight and award",
      "Share the page",
    ],
    audiences: ["parents", "clubs"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "75 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 7",
  },
  {
    slug: "money-picture",
    title: "The money picture",
    promise:
      "Who has paid, who is on a plan, who is overdue, and the reminder that goes out without a spreadsheet.",
    description:
      "A club treasurer opens the money view and sees paid, on a plan and overdue in one table. You watch her filter to the overdue families, open one account to read its installment history, and send a reminder from the same screen. A payment lands while she is there, and the row moves without anyone touching a spreadsheet.",
    plannedChapters: ["Who has paid", "Open an account", "Send the reminder"],
    audiences: ["clubs"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "90 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 8",
  },
  {
    slug: "standings-to-playoffs",
    title: "Standings to playoffs",
    promise:
      "Results roll into standings and tiebreakers, then the bracket builds itself and publishes.",
    description:
      "A final score is confirmed and the standings recalculate in front of you, with the tiebreaker rule shown for the two teams level at the top. The league then builds the playoff bracket from those seeds and checks gym availability for each round. The last beat publishes the bracket to the public league page.",
    plannedChapters: [
      "A result comes in",
      "Standings and tiebreakers",
      "Build the bracket",
      "Publish it",
    ],
    audiences: ["leagues"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "75 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 9",
  },
  {
    slug: "waivers",
    title: "Waivers, start to finish",
    promise:
      "Send the waiver, a parent signs it on their phone, and the roster shows who is cleared to play.",
    description:
      "A club sends the season waiver to every family on the roster in one action. A parent opens it on her phone, reads it, signs with a finger, and the confirmation comes straight back. On the club roster the cleared to play column turns green as signatures arrive, and the two families still outstanding get a reminder.",
    plannedChapters: ["Send the waiver", "Sign on the phone", "Cleared to play"],
    audiences: ["clubs", "parents"],
    kind: "chapter",
    stage: "split",
    durationLabel: "60 sec",
    status: "coming-soon",
    thumbEyebrow: "Chapter 10",
  },
]

export function getDemo(slug: string): DemoEntry | undefined {
  return DEMOS.find((d) => d.slug === slug)
}

export function demosForAudience(audience: DemoAudience | "all"): DemoEntry[] {
  if (audience === "all") return DEMOS
  return DEMOS.filter((d) => d.audiences.includes(audience))
}
