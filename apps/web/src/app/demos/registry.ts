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
      "A club posts a tryout, families register and pay, offers go out, and the roster locks in.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "2 min",
    status: "live",
    thumbEyebrow: "Story 1",
  },
  {
    slug: "everyone-in-the-loop",
    title: "Everyone in the loop",
    promise:
      "One announcement reaches every phone on the team, and the replies, polls and chat stay in one place.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "90 sec",
    status: "coming-soon",
    thumbEyebrow: "Story 2",
  },
  {
    slug: "season-planned-to-published",
    title: "A season, planned to published",
    promise:
      "A league plans dates and gyms, clubs submit teams, the schedule generates, and every calendar updates.",
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
