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
      "It opens on a league with 24 clubs and not one registered team, planning anyway because the gyms want an answer this week. The estimates go in grade by grade, the weekends and the two buildings go in after them, and the plan answers the question every league guesses at: the season needs 315 court-hours, the buildings hold 286, so 29 are still to book, month by month and weekend by weekend. Then the clubs enter, four teams in one press with the agreement signed, and the league approves them until 23 of 24 are in. The third chapter is the one nobody else shows you: the first generate is refused, and the refusal names the weekend, the gym, both grades and the six games that do not fit, with the fix priced in court-hours. The league books the Sunday, generates again, and 210 games land with no back-to-backs, no five-hour waits, every grade in one building and nothing double-booked. The last stretch is the draft nobody can see, one publish, and a parent's calendar filling with her daughter's season.",
    audiences: ["leagues", "clubs"],
    kind: "story",
    stage: "split",
    durationLabel: "2 min 8 sec",
    status: "live",
    thumbEyebrow: "Story 3",
  },
  {
    slug: "game-day",
    title: "Game day, both sides at once",
    promise:
      "The full scoring console on one side, a parent watching live on the other, through to the referee sign off and the recap.",
    description:
      "One side is the scoring console at the scorer's table: the game clock, the two starting fives, the action pad, the substitutions drawer. The other side is a mother stuck at work with the same game on her phone, and the two are locked together. Every tap at the table lands on her screen while you watch: the score flashes green, a foul flashes red, a substitution flashes amber, the play-by-play line writes itself with the assist named, and one clock ticks on both screens at once. It includes the part nobody demos, a wrong entry fixed with UNDO and the phone walking the number back, then runs through the buzzer, the referee's signature at the table, and the recap, the player of the game and the standings landing on her phone minutes later.",
    audiences: ["leagues", "clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "2 min 25 sec",
    status: "live",
    featured: true,
    thumbEyebrow: "Story 4",
  },
  {
    slug: "claim-your-club",
    title: "Claim your club and make it yours",
    promise:
      "Find your club page, claim it with the contact already on file, then give it your colour, your crest and your words.",
    description:
      "It opens in the public directory, where your club is probably already listed: a page built from public league listings, with the city right and nothing else. You watch it get searched up, opened, and claimed, and the claim is the part worth watching. The code goes to the contact already on file, masked on screen, so nobody can type their way into somebody else's club, and the corrections sit next to it because an imported listing is usually a little wrong. Six digits, a fourteen day reservation, and the page unlocks. The last chapter is the branding screen: a colour picked, a crest uploaded, a tagline and a paragraph typed, one save, and the same public page reloading with the club's own mark on the crest, its colour on the baseline stripe, and no claim button left on it.",
    audiences: ["clubs"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "1 min 6 sec",
    status: "live",
    thumbEyebrow: "Chapter 5",
  },
  {
    slug: "your-week",
    title: "Your week",
    promise:
      "A parent opens the app and sees exactly what is happening, for both kids, with the gym address in one tap.",
    description:
      "Tuesday morning, one phone, two kids on two teams. Practice tonight, Noah's practice tomorrow, a game Saturday, and every line carries the gym, because the gym is the thing families get wrong. She answers Saturday with one tap and opens directions from the row itself. Then the week breaks the way weeks do: a gym change lands on the game she has already answered, and this is the part worth watching, because the row updates where it stands and her Going survives it. Nobody asks her a second time whether her daughter is playing. A fee installment and an unsigned waiver are sitting in the same week, and both get handled without leaving it.",
    audiences: ["parents"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "1 min 1 sec",
    status: "live",
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
      "A league adds the season waiver, a parent signs it on her phone, and the compliance grid goes green without anybody chasing anybody.",
    description:
      "A league adds Ontario's concussion code from a template, reads the real text on screen, and the demo stops on the detail that costs leagues a season: it renews yearly, so last year's signature is not an answer. There is no recipient picker, because the roster is the recipient list and the emails go out the moment a team is approved. Then the parent side, on the phone, from the email: the document, her name, who she is signing as, a signature drawn with a finger, and an acknowledgment that names her daughter rather than agreeing to nothing in particular. Her cell on the league's grid turns green while you watch. The last stretch is the part nobody demos: two families still outstanding, both named, and the reminders that go out on their own at seven days and twenty four hours, until a hundred and ten of a hundred and ten are signed before the first whistle.",
    audiences: ["clubs", "parents", "leagues"],
    kind: "chapter",
    stage: "split",
    durationLabel: "1 min 14 sec",
    status: "live",
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
