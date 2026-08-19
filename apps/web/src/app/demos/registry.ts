/**
 * The demo directory registry (owner-approved structure, 2026-08-15).
 *
 * Two kinds of demo: cross-role STORIES that hand off between a desktop
 * workspace and a family phone on one split stage, and solo CHAPTERS that stay
 * on one surface. A story is listed under every audience it serves, because the
 * point of a story is that the club side and the parent side are the same event
 * seen from two ends.
 *
 * Nothing outside this file counts the demos: the gallery's headline and its
 * empty-state button both read `DEMOS.length`, so adding an entry here is the
 * whole job.
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
    title: "From tryouts to a full team",
    promise:
      "A club builds next season's team on a phone, posts a tryout, and one accept collects the sizes, the jersey number and a payment plan the club never has to chase.",
    description:
      "Two phones, and the whole thing happens on them. The left one belongs to a club whose summer teams are done and whose fall roster does not exist yet. A team gets made in a few presses, and the product writes its name rather than letting anybody type one, because a club that types team names ends up with four spellings of the same team. The tryout goes up in the same sitting, with the gym, the evening, the fee and the cap on it, and a minute later it is sitting at the top of the public programs page on the right phone. That one belongs to a guardian with two children at that club, and the first thing the sign-up asks is which of them is playing: her son is eligible, her daughter is flagged outside the age group rather than quietly accepted. Then the offers. Five composed once and sent together, with the season fee, the kit and a deadline on each, and hers lands on her phone as a notification. She opens it and, on one screen, picks the uniform size, the tracksuit size, the shoe size, three jersey numbers in order, and reads the payment plan before she agrees to it: a deposit now and three dated installments the product worked out itself. One press pays the deposit, books the three charges and puts him on the roster, which fills in behind her with the sizes already on it.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "phone",
    durationLabel: "1 min 46 sec",
    status: "live",
    chapterCount: 5,
    /* No volatile numbers in the bullets: fees and counts move with the seed,
       and a bullet that goes stale is a bullet that lies on the card. */
    bullets: [
      "A team made on a phone, with a name the product writes so nobody types four spellings of it",
      "A tryout posted and published in the same sitting, on the public programs page a minute later",
      "One package composed once and sent to every player who tried out",
      "Sizes, tracksuit, shoes and three jersey numbers collected on the accept form",
      "A deposit and three dated installments on her screen before she agrees to anything",
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
    title: "Team messages, polls and instant updates",
    promise:
      "A coach moves one practice in two presses, every family on the roster is told by push, bell and email, and the question and the tournament are both settled in the open.",
    description:
      "Two phones. On the left a coach whose Tuesday practice has to move. There is one control for it, on the practice itself, and the first time he tries the product refuses him and says why, naming his own club's booking that is already on that floor at seven o'clock. He takes eight instead, and that is the entire job. Nobody asked him who should be told, because the roster is the audience: every guardian on it, worked out by the product, with no list typed by anybody. The right phone is a parent on the team calendar with the old time still on it. The push drops from the top of her phone, the row under it turns into eight with the answer she had already given still on it, and the same change is waiting in her bell and in her mail, all three written by one function, with the old time struck through and the new one in bold and a last line that ends the phone calls: subscribed phone calendars update themselves. She has a question, and asks it in the team thread, where the coach's answer carries a staff badge on her phone and hers carries her son's name on his, and where one answer is pinned to the top for whoever reads it late. The last chapter is a real poll on this real team, with the tournament fee in the question where it belongs. She picks hers, ticks two weekends on a question that takes any number of answers, and presses Vote once: the count moves on the coach's phone with her name under the option, which is the part only staff can see.",
    audiences: ["clubs", "parents"],
    kind: "story",
    stage: "phone",
    durationLabel: "1 min 26 sec",
    status: "live",
    chapterCount: 4,
    /* No volatile numbers in the bullets: roster sizes and vote counts move
       with the seed, and a bullet that goes stale is a bullet that lies. */
    bullets: [
      "A practice moved in two presses, with no message to write and no list to build",
      "The product refuses the wrong time and names the club's own booking that is in the way",
      "Every guardian on the roster told by push, bell and email from one function",
      "A parent's question answered once in the open, then pinned for whoever reads it later",
      "A real poll with the fee in the question, voted from her phone and counted on his",
    ],
    chapterTitles: ["The change", "Every phone", "In the open", "The poll"],
    thumbEyebrow: "Story 2",
  },
  {
    slug: "season-planned-to-published",
    title: "Planning a full league season",
    promise:
      "A real league of 146 teams: the last entries answered with their fees, a home court plus floater gyms you never have to book, a board that catches the weekend booked one court short, and one publish that fills every calendar.",
    description:
      "This runs on a real league. 146 teams across 82 clubs, and registration is nearly done: the season's own summary says four applications are waiting, and the league answers them, one on the application page where the 3,950 dollar fee appears by itself, dated by the league's own balance rule, and the rest straight from the list. Then the buildings, which is the part leagues have never been shown: the one court they own fills first because its games cost them nothing, and the other two sit in a pool, rented by the court only when a weekend needs the space, with nothing booked in advance. Grade 10 came in 42 teams deep, so it is split into four divisions on a drag board and the league says whether they may play each other. Then the board, which is what this demo is really for. The plan is complete, but one November weekend was booked one court short, and the board says so in amber. The drawer on the right names the weekend, the shortfall and the move that clears it: the league drags a whole building's games onto the next weekend, rents a third court there from that gym's own menu, and the draw fits, 730 games with none left over, read worst team first. Two clubs ask about the drive home, the cost of saying yes is priced before anyone answers, and one press puts the season on every calendar, where the games land around the practices that were already there.",
    audiences: ["leagues", "clubs"],
    kind: "story",
    stage: "split",
    durationLabel: "3 min 24 sec",
    status: "live",
    chapterCount: 6,
    bullets: [
      "The last entries answered from the list, and the 3,950 dollar fee raises itself with no invoice typed",
      "A home court that fills first, then floater gyms you never have to book",
      "A grade of 42 teams split into four divisions by dragging teams between them",
      "A weekend booked one court short, caught on the board, with the drawer writing the fix",
      "Publish once, and one notification lands on the family's phone, naming their team",
    ],
    chapterTitles: [
      "Teams come in",
      "The buildings",
      "Divisions",
      "The board",
      "Two requests",
      "Publish once",
    ],
    thumbEyebrow: "Story 3",
  },
  {
    slug: "schedule-change",
    title: "When a game moves, every phone updates instantly",
    promise:
      "A league moves one game and cancels another, and every family, coach and club owner on both rosters is told automatically, by notification and by email.",
    description:
      "It opens on a published schedule, which is the point: every game on that list is already on somebody's calendar, so changing one is not a private act. Saturday's nine o'clock game at The Playground has to move, and the league does not pick a time out of the air. It asks for alternates, gets only slots where the court is free and neither team is already playing, and takes noon on the same day. One press, and that is the entire job. Then the demo turns the camera around: a parent with two children in the league gets the push on her lock screen, the same words unread in her bell, and Saturday's row moved to noon where it stands, on the same card, with nothing to reconcile. Then the fan-out, counted out loud: twenty guardian accounts, four coaches, two club owners, twenty six people from one press. Sunday's game is not being played at all, so it gets cancelled behind the browser's own one-line warning, and the cancellation lands on the same phone: the row is struck through where it sits rather than vanishing, and the email in her inbox carries the line that keeps a family off the road.",
    audiences: ["leagues", "clubs", "parents"],
    primaryAudience: "leagues",
    kind: "chapter",
    stage: "split",
    durationLabel: "1 min 23 sec",
    status: "live",
    chapterCount: 3,
    bullets: [
      "Move a game from the real schedule, with only the slots that actually fit offered",
      "The recipient list counted on camera: 20 guardians, 4 coaches, 2 club owners, 26 people",
      "One audience list feeds the push, the bell and the email, so the three can never disagree",
      "A cancelled game stays on the family calendar struck through, so nobody drives to an empty gym",
    ],
    chapterTitles: ["The move", "Everyone knows", "The cancellation"],
    thumbEyebrow: "Chapter 11",
  },
  {
    slug: "game-day",
    title: "Scoring a game live, watching it live",
    promise:
      "A real league game kept on the scorer's phone, live on a father's phone the whole way, through the referee's signature and the paper scoresheet.",
    description:
      "Two phones, side by side, and one game running through both. The left one is the scorer's table: the game-day checklist, the roll call at the door, the two starting fives, the action pad with makes, misses, rebounds, assists and fouls, and the substitutions drawer. The right one belongs to a father who is not in the building. Every tap at the table lands on his screen while you watch: the score flashes green, a foul flashes red, a substitution flashes amber, the play-by-play line writes itself with the assist named, and one clock ticks on both phones at once. It includes a wrong entry fixed with UNDO and the phone walking the number back, then runs through the buzzer, the referee's signature at the table, the official scoresheet as a printable PDF, and the recap, the player of the game and the division table landing on his phone minutes later.",
    audiences: ["leagues", "clubs", "parents"],
    kind: "story",
    stage: "split",
    durationLabel: "2 min 50 sec",
    status: "live",
    featured: true,
    chapterCount: 5,
    bullets: [
      "Attendance, starting fives and the whole game kept on one phone",
      "The same clock ticking on the scorer's phone and the parent's",
      "Every basket flashes on the parent's phone the second it is scored",
      "Referee signature, printable scoresheet, recap and standings, all off the same sheet",
    ],
    chapterTitles: [
      "Before tip-off",
      "Two taps a play",
      "What the family sees",
      "The buzzer and the sign-off",
      "The story writes itself",
    ],
    thumbEyebrow: "Story 4",
  },
  {
    slug: "claim-your-club",
    title: "Claim your club's page",
    promise:
      "A real unclaimed listing found by name, claimed with a code that only ever goes to the contact already on file, corrected on the way in, and turned into the club's own page the same afternoon.",
    description:
      "It opens on the directory: more than a thousand Canadian clubs are already published in it, province by province, built from public league listings, and one of them is probably yours. This one is real, and so is everything wrong with it: the province is stuck on the end of the city, the phone number is ten unbroken digits and the website has no scheme, which is what an imported listing actually looks like. You watch it get searched up and opened, and the page has a button on it the club did not put there. The claim starts before anybody signs up for anything. The code goes to the contact already on file, masked on screen so the page cannot be used to harvest an address either, and you watch the email land in the club's own inbox with the six digits in it. The corrections sit right beside the code because an imported listing is usually a little wrong. Thirty minutes, five attempts. Then the careful bit: the club is reserved for fourteen days while the owner decides which account runs it, so the story goes all the way through the completion page and the account before anybody owns anything, because ownership binds to a person and not to the inbox that received the code. The last chapter is the branding screen: an unclaimed listing is never painted, whatever colour sits on its record, so the first colour that page ever wears is one a human chose.",
    audiences: ["clubs"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "1 min 45 sec",
    status: "live",
    chapterCount: 4,
    /* No volatile numbers in the bullets: the census counts move with each
       import, and a bullet that goes stale is a bullet that lies. */
    bullets: [
      "Your club is probably already listed, built from public league data",
      "A six digit code, sent only to the contact on file and masked on screen",
      "Fix what the import got wrong on the way in, applied when the claim completes",
      "Reserved while you decide which account owns it, because a club binds to a person and not to an inbox",
      "Crest, colour and your own words live the same afternoon",
    ],
    chapterTitles: ["Find your club", "Prove it", "Reserved for you", "Make it yours"],
    thumbEyebrow: "Chapter 5",
  },
  {
    slug: "your-week",
    title: "A family's week in the app",
    promise:
      "One phone, two children, and a real week from a real database: four practices, one already cancelled, a Saturday game answered in a tap, and a change that does not ask her the same question twice.",
    description:
      "One life-size phone, and every line on it is a row in the database rather than a drawing. A guardian with two children at the same club opens her week: her daughter's Monday practice, already cancelled and still sitting there with a line through it so nobody drives to it out of habit; her son's Tuesday; her daughter's Wednesday; and a Saturday game. Both children are on the same list, and it says which is which. Saturday needs an answer and asks for it on the row itself, three buttons under the game she is already looking at, and when two of her children are on the same event each one gets their own row of buttons so she is never answering for the wrong child. Then the walk to the gym address: the row, the game page, the venue page, the map, three taps that all exist today. The coach moves Tuesday's practice, and the row she already had simply says the new time, with nothing added, nothing vanished and her answer still attached, because an RSVP is tied to the game rather than to its time. The last stretch is the two things she owes, a fee installment and a waiver her daughter cannot play without, on the surfaces they really arrive on: a card on her home screen, the payment plan behind it, and a push that drops in from the top of the phone and names the child and the document. She taps it, signs with a finger, and the story ends only when the league's signed copy is on file.",
    audiences: ["parents"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "1 min",
    status: "live",
    chapterCount: 5,
    /* No volatile numbers in the bullets: the week moves with the seed. */
    bullets: [
      "Both children's week on one screen, with the gym on every line",
      "A cancelled practice stays where it was, struck through, so nobody drives to it",
      "Answer the game on the row, one row of buttons per child",
      "A practice moves and the row just says the new time, with her answer still on it",
      "The waiver lands as a push, and she signs it on the same phone",
    ],
    chapterTitles: [
      "Two kids, one week",
      "Answer it here",
      "Where the gym is",
      "Plans change",
      "Fee and waiver",
    ],
    thumbEyebrow: "Chapter 6",
  },
  {
    slug: "players-season",
    title: "A player's page and stats",
    promise:
      "Every game, stat line, highlight and award on one page a kid is proud to share.",
    description:
      "This runs on a real player. It opens on the page a real season built for her: her team, her number, six averages written out in words, and every night she played on its own line with the numbers she really put up. Last night's game is already there, because it was scored at the table rather than written on a clipboard, and you watch the averages above it move when the line lands. Then the part that matters to a kid: until somebody uploads a photo she gets a hand drawn mugshot with her jersey number on the chest, never a grey circle, and you watch the swap happen along with the one sentence the upload control carries about whose photo you may upload. The last stretch is the twenty point night that won her Player of the Game, on the game page where the award actually lives, because nothing lands on a child's page until a person chooses it. The share sheet shows the card the product draws, the choice between her page and a twenty four hour story, and the reason a public share on a private profile is clamped back to followers. Then the address: she claims a handle, and every card she shares from that moment carries the link back to her page.",
    audiences: ["parents", "clubs"],
    kind: "chapter",
    stage: "phone",
    durationLabel: "1 min 30 sec",
    status: "live",
    chapterCount: 4,
    /* No volatile numbers in the bullets: the seed's stat lines move, and a
       bullet that goes stale is a bullet that lies on the card. */
    bullets: [
      "Points, rebounds and assists kept for every game she played, straight off the scorer's phone",
      "A real photo replaces the sketched mug, saved against the child rather than a post",
      "Player of the Game shared with a decision, never landed on her page by itself",
      "One handle, and every card she shares carries the link back to her page",
    ],
    chapterTitles: ["Her season, kept", "The photo", "Player of the Game", "Share it"],
    thumbEyebrow: "Chapter 7",
  },
  {
    slug: "money-picture",
    title: "Fees, payments and who has paid",
    promise:
      "Every dollar a real club is owed on one screen, one family's plan opened underneath it, cash taken at the door and recorded, and a reminder nobody has to remember to send.",
    description:
      "This runs on a real club's real books. Four numbers at the top, worked out from the obligations themselves rather than typed into a spreadsheet: collected, outstanding, overdue aged in buckets, and waived, because a fee a club writes off is recorded rather than deleted. The overdue line is eight payments, and every dollar of it is past sixty days. Then the price list behind those numbers, five products at five different prices with five different rhythms, from a twenty five dollar tryout to a rep season carrying a deposit and three installments. One family opens underneath itself: half paid and stopped, with the cash in March and the e-transfer in April that really paid it sitting in the history, and the two installments that did not. The reminder chapter is the schedule the code keeps, three days before it is due, the day after it is missed, then every four days, stopping at ninety, with the exact notification and the exact email a family receives, on the phone where they land. The last stretch is how most of this money arrives. She hands over the rest at the gym on Saturday, the club records it as cash with a note in its own words, the obligation closes itself, the family is told without anybody writing a message, and the four numbers at the top move last.",
    audiences: ["clubs"],
    kind: "chapter",
    stage: "split",
    durationLabel: "1 min 53 sec",
    status: "live",
    chapterCount: 5,
    /* No volatile numbers in the bullets: the totals move with the seed, and a
       bullet that goes stale is a bullet that lies on the card. */
    bullets: [
      "Collected, outstanding, overdue and waived, computed from the obligations rather than kept in a spreadsheet",
      "Overdue aged in real buckets, with the lateness written on the row",
      "One family's plan with the cash and the e-transfer that really paid it",
      "Cash taken at the door, recorded with a note, and the obligation closing itself",
      "The reminder schedule the code keeps, with the exact notification and email a family gets",
    ],
    chapterTitles: [
      "Every dollar owed",
      "What it charges",
      "One family's plan",
      "The reminder",
      "Cash at the door",
    ],
    thumbEyebrow: "Chapter 8",
  },
  {
    slug: "standings-to-playoffs",
    title: "Standings and playoff brackets",
    promise:
      "A real division's last weekend: a forfeit recorded honestly, a final signed at the table, a tie decided by a written rule, and a bracket where every team in the grade gets a game.",
    description:
      "This runs on a real league table. The last weekend of a real Grade 10 division, eleven teams at their real records, and two games still to come. One of them never happens: a club cannot field a team, so the league records a forfeit on the game itself and the table takes a win and a loss with no points either way, which is exactly what a forfeit should be worth. The other is played and signed off at the scorer's table with the referee's own PIN, and the standings have already moved by the time you look, because they are worked out from completed games at the moment you open them rather than by a nightly job that might not have run. Then two teams finish level, and with no rules written down the order between them is arbitrary. The league writes them down in one screen, locks them, and the table re-reads itself with the rule that placed each row printed beside it. After that, who is allowed to play, taken from the scorekeeper's roll call, with a ruling that will not save without a written reason. The last chapter is the bracket the product really draws: every team in the grade is in it, the top seeds skip the opening round, the teams beaten in it are already scheduled again the same day, and the whole weekend is checked against the gym time that is actually booked before anybody is promised anything.",
    audiences: ["leagues"],
    kind: "chapter",
    stage: "desktop",
    durationLabel: "2 min 25 sec",
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
    slug: "team-drops-out",
    title: "When a team drops out mid-season",
    promise:
      "A club asks out of a drawn season, the league approves it, ten games come off by themselves, and the teams left short get exactly the games they were missing.",
    description:
      "It opens after the season is drawn: the teams are approved, the games are on the board, and one club writes in asking out. The league reads the reason, sees in advance what approving will cost, and presses one button. The withdrawal then executes as a single transaction: the entry goes to withdrawn while its history stays, an unpaid entry fee is cancelled with it, the club's open schedule requests close themselves, the team's future games come off the board, and every opposing club is told without anybody building a list. The schedule tab then names the teams now under the games guarantee, with each one's real count, including the one that is short by two because they were drawn against the leavers twice. The last chapter is the fix. Preview it, then add only the missing games, and the warning goes green while every game already on the board keeps its court, its time and its weekend.",
    audiences: ["leagues", "clubs"],
    primaryAudience: "leagues",
    kind: "chapter",
    stage: "desktop",
    durationLabel: "1 min 43 sec",
    status: "live",
    chapterCount: 4,
    /* No volatile numbers in the bullets: the counts move with the seed, and
       a bullet that goes stale is a bullet that lies on the card. */
    bullets: [
      "A club that is already approved cannot just leave: the league signs it off, with the reason on the record",
      "One approval withdraws the entry, kills the unpaid fee, closes their requests and cancels their future games",
      "The schedule names every team left under the games guarantee, and how short each one is",
      "The fix ADDS only the missing games, so nobody else's court, time or weekend moves",
    ],
    chapterTitles: [
      "The club asks out",
      "What approving does",
      "Who is now short",
      "Only the missing games",
    ],
    thumbEyebrow: "Chapter 12",
  },
  {
    slug: "the-referees",
    title: "Referees: booking, games and pay",
    promise:
      "A league books a whole Saturday to its referee pool at a stated rate, the first one to answer gets every game in the window, and his schedule, his pay and his calendar fill themselves.",
    description:
      "Referees are the second biggest thing a league pays for after gyms. It opens on the league's own referee desk: a pool of three, each row carrying the certification, whether it is self-declared, how many games they have worked and their own rate. The league picks a session day and the pool answers with who is free, from availability the referees declared themselves, with the one who has never said anything shown as silent rather than assumed unavailable. Then the part that matters: the league books a DAY, not a game. One shift preset, one broadcast to the whole pool, one rate on the offer, and the first referee to accept is assigned to every game that tips inside the window. The camera turns to his phone, a real screen in the app, and the offer is there with the money and the terms on it. He accepts, and eight games land on his own schedule with the court, not just the building, and what each one pays. He subscribes once and his officiating appears in the calendar app he already uses. The last chapter is the league's side of the money: games tallied per referee per session day at the rate they agreed to on accepting, and confirmed in one press.",
    audiences: ["leagues", "clubs"],
    primaryAudience: "leagues",
    kind: "chapter",
    stage: "split",
    durationLabel: "1 min 45 sec",
    status: "live",
    chapterCount: 4,
    /* No volatile numbers in the bullets: rates, counts and pool sizes move
       with the seed, and a bullet that goes stale is a bullet that lies. */
    bullets: [
      "Book a whole session day, not a game at a time, with the per-game rate stated on the offer",
      "Broadcast it to the pool and let the first referee who answers take the day",
      "Accepting assigns him to every game inside the shift window, none picked by hand",
      "His schedule, his rate and his own phone calendar all come from that one accept",
      "The league ends the session knowing what it owes, per referee, per day",
    ],
    chapterTitles: [
      "The league books a day",
      "First accept wins",
      "His games, his calendar",
      "What the day pays",
    ],
    thumbEyebrow: "Chapter 13",
  },
  {
    slug: "waivers",
    title: "Waivers, start to finish",
    promise:
      "The league's required waiver, a parent signing it on his phone in about a minute, and a compliance board that keeps its own score.",
    description:
      "It opens on the one document this league requires: Ontario's concussion code under Rowan's Law, required, version one, and carrying the badge that says it has to be signed again every year. Nobody built a recipient list, because there is no recipient picker: approving a team emails every guardian on its roster, and the season's board counts signatures rather than emails sent. One team opens to show the families behind the number, and the four who have not signed are named rather than counted. Then the phone, at life size, where a waiver is actually signed: the email the league really sends, the document, his name, who he is to the player, a signature drawn with a finger, and an acknowledgment that names his daughter rather than agreeing to nothing in particular. Her cell on the league's board turns green while you watch, with his name in it. The last stretch is the sending: re-sending leaves the families who already have an unopened link alone, and the reminders go out on their own seven days before the season and again twenty four hours before, once each, guaranteed by a ledger row, with no list built by a human being.",
    audiences: ["clubs", "parents", "leagues"],
    /* Everyone touches a waiver, but the league is the one that adds it and
       the one holding the compliance grid, so the card sits on their shelf. */
    primaryAudience: "leagues",
    chapterCount: 3,
    /* No volatile numbers in the bullets: the board's counts move with the
       seed, and a bullet that goes stale is a bullet that lies on the card. */
    bullets: [
      "One required document, versioned, and renewing every year under Rowan's Law",
      "No recipient picker anywhere: approving a team emails every guardian on its roster",
      "The whole signing flow on a life size phone, from the email to the signature",
      "A cell turns green on the league's board, and the reminders run on a clock",
    ],
    chapterTitles: ["One document", "A minute on a phone", "The board answers"],
    kind: "chapter",
    stage: "split",
    durationLabel: "2 min 2 sec",
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
