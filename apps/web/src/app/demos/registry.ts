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

/**
 * The gallery's solo sections, in order, under "The big stories".
 *
 * A solo demo appears in exactly ONE of these, decided by its primary
 * audience, so the grid reads as a shelf rather than the same card three
 * times. Stories keep appearing under every audience they serve, because a
 * story is the club side and the parent side of one event.
 */
export const SOLO_GROUPS: {
  audience: DemoAudience
  title: string
  blurb: string
}[] = [
  {
    audience: "parents",
    title: "For parents and players",
    blurb: "One phone, the week ahead, and the season a kid wants to show people.",
  },
  {
    audience: "clubs",
    title: "For clubs",
    blurb: "Your page, your brand, and every dollar the club is owed on one screen.",
  },
  {
    audience: "leagues",
    title: "For leagues",
    blurb: "Standings that settle themselves, a bracket that builds, waivers that chase themselves.",
  },
]

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
  /**
   * The gallery shelf this demo lives on. Only solo chapters use it, and only
   * when the first listed audience is not the one the demo is really for.
   * Defaults to `audiences[0]`.
   */
  primaryAudience?: DemoAudience
  /**
   * Chapters in the filmed script, mirrored here so the gallery can show the
   * count without importing ten scripts into the page. The intro stage still
   * reads the real chapter titles off the script.
   */
  chapterCount: number
  /**
   * Three or four concrete moments from the script, the card's selling copy.
   * Each names a painful detail the demo actually shows. No em-dashes, and no
   * volatile numbers: figures that the realism pass may change stay out.
   */
  bullets: string[]
  /**
   * Chapter titles mirrored from the script, for the card's scrubber labels.
   * The re-drive checkpoint verifies these against the script.
   */
  chapterTitles: string[]
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
    chapterCount: 5,
    bullets: [
      "A tryout posted, a family registered and paid in the same sitting",
      "Jersey sizes, tracksuit and shoes collected the moment the offer is accepted",
      "Three jersey number preferences, no group-chat chasing",
      "The roster board flips to complete: sizes, waivers, fees, all green",
    ],
    chapterTitles: [
      "Build the team",
      "Post the tryout",
      "A family signs up",
      "The offer, accepted",
      "The roster fills",
    ],
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
    chapterCount: 4,
    bullets: [
      "One gym change written once, landing on every family phone",
      "Read receipts: the club sees exactly who has not opened it yet",
      "A parent's question answered in the open, not in ten DMs",
      "A poll closes the tournament debate with a count",
    ],
    chapterTitles: ["The announcement", "Every phone at once", "The conversation", "The poll"],
    thumbEyebrow: "Story 2",
  },
  {
    slug: "season-planned-to-published",
    title: "A season, planned to published",
    promise:
      "A real league of 146 teams: fees raised on approval, a home court plus floater gyms you never have to book, a schedule that refuses the weekend that does not fit, and one publish that fills every calendar.",
    description:
      "This runs on a real league. 146 teams across 82 clubs, mid registration: the league approves a team and its 3,950 dollar entry fee appears by itself, dated by the league's own balance rule, with nobody typing an invoice. Then the buildings, and this is the part leagues have never been shown: you name the one court you own, The Playground in Burlington, and every weekend fills it first because its games cost you nothing. The other two gyms sit in a pool, rented by the court only when a weekend needs the space, and you do not have to book any of them in advance. The calendar draws itself around that, and then the system tells you what is left to go and book, in court-days and court-hours, month by month. The schedule is built, and it is REFUSED: Grade 10 needs 42 games at Six Park East that November weekend and the one date the league had booked holds 32, short by ten, with the fix priced in court-hours. They rent a third court. Two clubs asked to be finished by noon on Sundays; the league simulates what approving costs everyone else, gets nothing, and approves. Then one press, and a mother watches her son's season land on his calendar and subscribe to her phone's.",
    audiences: ["leagues", "clubs"],
    kind: "story",
    stage: "split",
    durationLabel: "3 min 31 sec",
    status: "live",
    chapterCount: 5,
    bullets: [
      "Approve a team and the 3,950 dollar fee raises itself, dated and owed, with no invoice typed",
      "Name your home court, then floater gyms you never have to book, and the system says how many court-hours it needs",
      "The schedule refuses the weekend that does not fit, and names the grade and the arithmetic",
      "A club request approved with its cost simulated first, and nobody else moved",
      "Publish once: every club, team and family calendar fills, including the phone's own",
    ],
    chapterTitles: [
      "Teams come in",
      "The buildings",
      "The commit that fails",
      "Two requests",
      "Publish once",
    ],
    thumbEyebrow: "Story 3",
  },
  {
    slug: "schedule-change",
    title: "A game moves, and everyone knows",
    promise:
      "A league moves one game and cancels another, and every family, coach and club owner on both rosters is told automatically, by notification and by email.",
    description:
      "It opens on a published weekend, which is the point: eleven games are already on somebody's calendar, so changing one is not a private act. Saturday's nine o'clock game at The Playground has to move, and the league does not pick a time out of the air. It asks for alternates, gets only slots where the court is free and neither team is already playing, and takes noon on the same day. One press, and that is the entire job. Then the demo turns the camera around: a parent with two children in the league gets the notification word for word, and Saturday's row moves to noon where it stands, on the same card, with nothing to reconcile. The beat this demo exists for comes next, the fan-out counted out loud: twenty guardian accounts, four coaches, two club owners, twenty six people told from one press and zero phone calls. Then the harder half. Sunday's game is not being played at all, so it gets cancelled, and the cancellation lands on the same phone: the row is struck through where it sits rather than vanishing, and the email carries the sentence that keeps a family off the road on a Sunday morning.",
    audiences: ["leagues", "clubs", "parents"],
    primaryAudience: "leagues",
    kind: "chapter",
    stage: "split",
    durationLabel: "1 min 42 sec",
    status: "live",
    chapterCount: 3,
    bullets: [
      "Move a game from the real schedule, with only the slots that actually fit offered",
      "The recipient list counted on camera: 20 guardians, 4 coaches, 2 club owners, 26 people",
      "One audience list feeds the notification and the email, so the two can never disagree",
      "A cancelled game stays on the family calendar struck through, so nobody drives to an empty gym",
    ],
    chapterTitles: ["The move", "Everyone knows", "The cancellation"],
    thumbEyebrow: "Chapter 11",
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
    chapterCount: 5,
    bullets: [
      "The full scoring console: makes, misses, rebounds, assists, fouls",
      "The same clock ticking on the console and the parent's phone",
      "Every basket flashes on the phone the second it is scored",
      "The referee signs off, the recap and standings write themselves",
    ],
    chapterTitles: [
      "Tip-off at the table",
      "Scoring, honestly",
      "What the family sees",
      "The buzzer and the sign-off",
      "The story writes itself",
    ],
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
    chapterCount: 3,
    bullets: [
      "Your club is probably already listed: find it and open it",
      "A six digit code goes to the contact on file, nobody hijacks a club",
      "Crest, colour and your own words live the same afternoon",
    ],
    chapterTitles: ["Find your club", "Claim it", "Make it yours"],
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
    chapterCount: 3,
    bullets: [
      "Both kids' weeks on one screen, no binder, no group chat",
      "Gym address and directions one tap from the game card",
      "A time change lands calmly: updated card, nothing missed",
    ],
    chapterTitles: ["Two kids, one calendar", "RSVP and directions", "Plans change, calmly"],
    thumbEyebrow: "Chapter 6",
  },
  {
    slug: "players-season",
    title: "The player's season",
    promise:
      "Every game, stat line, highlight and award on one page a kid is proud to share.",
    description:
      "It opens on the page the season builds for her: her team, her number, six averages written out in words, and every night she played on its own line with the numbers she put up. Last night's game is already there, because it was scored at the table rather than written on a clipboard. Then the part that matters to a kid: until somebody uploads a photo she gets a hand drawn mugshot with her jersey number on the chest, never a grey circle, and you watch the swap happen along with the one sentence the upload control carries about whose photo you may upload. The last stretch is the eighteen point night that won her Player of the Game, the share sheet with its consent line and its choice between her page and a twenty four hour story, and a handle that turns all of it into a link she can send to her grandmother.",
    audiences: ["parents", "clubs"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "1 min 11 sec",
    status: "live",
    chapterCount: 4,
    bullets: [
      "Points, rebounds and assists kept for every game she played",
      "A real photo replaces the sketched mug in one tap",
      "Player of the Game, shareable the night it happens",
    ],
    chapterTitles: ["Her season, kept", "The photo", "Player of the Game", "Share it"],
    thumbEyebrow: "Chapter 7",
  },
  {
    slug: "money-picture",
    title: "The money picture",
    promise:
      "Who has paid, who is on a plan, who is overdue, and the reminder that goes out without a spreadsheet.",
    description:
      "One screen carries every dollar the club is owed: collected, outstanding, overdue aged the way an accountant ages it, and waived, because clubs quietly carry families every season and that money should be visible. You watch the table filter to what is still open, and one family's plan open underneath itself, a deposit and three installments with two ticked, one missed and one still to come. The missed one is the honest case: not a family refusing to pay, a card that expired in October. Then the part nobody else shows you, because there is no button for it: the reminder goes out on a schedule, three days before the charge, the day after it is missed, then every four days, and you read the actual email. A card gets updated, an e-transfer taken at the door gets recorded with a note, and the four numbers at the top move last, ending with overdue at zero.",
    audiences: ["clubs"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "1 min 18 sec",
    status: "live",
    chapterCount: 3,
    bullets: [
      "Who has paid, who is on a plan, who is overdue, one screen",
      "Payment plans that record themselves, cash included",
      "The overdue reminder goes out on schedule, no club action",
    ],
    chapterTitles: [
      "Where every dollar stands",
      "One family, one plan",
      "The reminder sends itself",
    ],
    thumbEyebrow: "Chapter 8",
  },
  {
    slug: "standings-to-playoffs",
    title: "Standings to playoffs",
    promise:
      "A real division's last weekend: a forfeit recorded honestly, a final signed at the table, a tie decided by a written rule, and a bracket where every team in the grade gets a game.",
    description:
      "This runs on a real league table. The last weekend of a real Grade 10 division, eleven teams at their real records, and two games still to come. One of them never happens: a club cannot field a team, so the league records a forfeit on the game itself and the table takes a win and a loss with no points either way, which is exactly what a forfeit should be worth. The other is played and signed off at the scorer's table with the referee's own PIN, and the standings have already moved by the time you look, because they are worked out from completed games at the moment you open them rather than by a nightly job that might not have run. Then the part every league argues about in March: two teams finished level, and the order between them is an accident until somebody writes the rules down. The league writes them down in one screen, locks them, and the table re-reads itself with the rule that placed each row printed beside it. After that, who is allowed to play, taken from the scorekeeper's roll call rather than a coach's memory, with a ruling that will not save without a written reason. The last chapter is the bracket the product really draws: every team in the grade is in it, the top seeds skip the opening round, the teams beaten in it are already scheduled again the same day, and the whole weekend is checked against the gym time that is actually booked before anybody is promised anything.",
    audiences: ["leagues"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "2 min 26 sec",
    status: "live",
    chapterCount: 4,
    bullets: [
      "Standings computed on read, so a signed sheet moves the table by itself",
      "A forfeit recorded as a forfeit: a win, a loss and no points either way",
      "A tie decided by rules the league wrote down and locked, named on the row",
      "Playoff eligibility from the scorekeeper's roll call, overruled only in writing",
      "A bracket where every team in the grade plays, and the losers play again",
    ],
    chapterTitles: [
      "The last weekend",
      "The rule that decides",
      "Who can play",
      "Everybody plays",
    ],
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
    /* Everyone touches a waiver, but the league is the one that adds it and
       the one holding the compliance grid, so the card sits on their shelf. */
    primaryAudience: "leagues",
    chapterCount: 3,
    bullets: [
      "Send the waiver pack once, the roster is the recipient list",
      "Rowan's Law concussion code signed on a phone in a minute",
      "The board goes green team by team, reminders chase the rest",
    ],
    chapterTitles: ["Send once", "Sign on the phone", "Green across the board"],
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

/** The shelf a solo card sits on. */
export function primaryAudienceOf(demo: DemoEntry): DemoAudience {
  return demo.primaryAudience ?? demo.audiences[0]
}

/** Every story, in registry order. These get the wide cards up top. */
export function storyDemos(): DemoEntry[] {
  return DEMOS.filter((d) => d.kind === "story")
}

/** The solo chapters that belong to one shelf. */
export function soloDemosFor(audience: DemoAudience): DemoEntry[] {
  return DEMOS.filter((d) => d.kind !== "story" && primaryAudienceOf(d) === audience)
}

/**
 * Card text for the gallery: whole sentences off the front of the written
 * description, never a word cut in half. The full paragraph is on the demo's
 * own page, so the card can stop at a natural break.
 */
export function openingSentences(text: string, maxChars: number): string {
  const parts = text.split(/(?<=\.)\s+/)
  let out = parts[0] ?? ""
  for (let i = 1; i < parts.length; i += 1) {
    if (out.length + 1 + parts[i].length > maxChars) break
    out = `${out} ${parts[i]}`
  }
  return out
}
