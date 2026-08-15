"use client"

import type { ReactNode } from "react"
import { TypeText } from "../motion"
import {
  MockAskSheet,
  MockBand,
  MockBlockChips,
  MockButton,
  MockCheck,
  MockCounter,
  MockDialog,
  MockEndCard,
  MockEntryRow,
  MockField,
  MockFinding,
  MockFraction,
  MockGamesTable,
  MockGuarantees,
  MockGymCard,
  MockJourney,
  MockPanel,
  MockPill,
  MockStepRail,
  MockStepper,
  MockTile,
  MockTopBar,
  MockWeekendCard,
  MockWeekendRow,
  PhoneGameRow,
  PhoneMonthGrid,
  PhonePushBanner,
  PhoneShell,
  type MockGame,
} from "../mock-ui"
import { Crest } from "@/components/ui/crest"
import type { DemoScript } from "../types"

/**
 * Story 3: "A season, planned to published" (owner-signed script, 2026-08-15).
 *
 * THE ARGUMENT. A league's hardest week is the one before anything exists: no
 * teams have registered, the gyms want an answer today, and the only way most
 * leagues get one is a spreadsheet somebody rebuilds every August. This story
 * is the four moments that week costs them, in order.
 *
 * THE PAINFUL DETAIL (owner's law, named for this story): THE COURT-HOURS
 * MATH AND THE FAILED FIT ARE THE PITCH, AND NEITHER GETS SOFTENED. Chapter
 * one ends on the number an operator actually reads down the phone to a gym,
 * with the subtraction shown. Chapter three fails on camera: the first
 * generate is refused by the feasibility auditor, which names the weekend, the
 * gym, the two grades, the arithmetic and the fix, and only then does the
 * schedule land. A demo where the machine never says no is a demo nobody
 * running a league believes.
 *
 * TRUTH TO THE PRODUCT. Every surface mirrors one that ships today:
 *   · the wizard — plan/page.tsx: five steps ("Teams · who's coming",
 *     "Your buildings · gyms, courts, hours", "Your calendar · we compute it",
 *     "Publish", "Schedule"), and the sticky "Next: …" nav under them;
 *   · step 1 — plan/teams-step.tsx: "How many teams do you expect?", the
 *     "Grade | Expected teams" table with its minus / count / plus control,
 *     "In this plan", "N registered", "N games", and the court-toned totals
 *     line "N teams · about N games at N games each.";
 *   · step 2 — plan/gyms-weekends-step.tsx: "When would you like to run
 *     sessions?" with "N of M weekends on", the "Home gym" and "In the pool"
 *     role chips, and "Courts left empty" with its real reasoning;
 *   · step 3 — plan/board-chrome.tsx and plan-ui.tsx: "Draw the calendar",
 *     the weekend cards with their is/of fraction chips, and the AskSheet
 *     ("What you need to book", court-days and court-hours, "Month by month",
 *     "Weekend by weekend", "needs a building");
 *   · the club entry — seasons/[seasonId]/enter/entry-form.tsx: "How many
 *     teams do you plan to enter?", the club agreement signed by typing a
 *     full name, "Submit entry", and "Entry submitted.";
 *   · the entries queue — manage/components/clubs-tab.tsx: "Club entries (N)",
 *     "planned N teams · submitted N · signed by X", "Approve entry";
 *   · divisions and generate — divisions-tab.tsx ("the division's name writes
 *     itself") and schedule-tab.tsx: the Plan / Divisions / Generate / Publish
 *     journey strip, "You're about to build the real schedule.", "Preview
 *     whole season", "Commit whole season" and its "Saved as a DRAFT" confirm;
 *   · the refusal — lib/scheduler-v2/audit.ts, finding "grade-does-not-fit",
 *     whose sentence really does read "N games need this gym, but the booking
 *     holds M … Short by K games." with "Add about N court-hours at this gym
 *     that weekend." first among its options;
 *   · publishing — the Game.publishedAt layer: the gold "Draft" badge, the
 *     "visible only to you until you publish" banner, "Publish schedule · N
 *     new", and the one notification that points at a team calendar.
 *
 * The product's own sentences use em-dashes in two places; the house copy rule
 * does not allow them, so those separators are middots here and nothing else
 * about the wording moved.
 *
 * ONE FRAME AT A TIME. Chapter two is two workspaces, not two windows: the
 * club submits on its own screen and the league answers on its, and the
 * address bar moves with them. The stage stays fixed, which is the motion law;
 * the phone slot stays reserved from the first frame and the family's phone
 * slides into it in chapter four, where the story finally has two ends at once.
 *
 * CONTINUITY. Same club, same team, same family as stories 1 and 2: Riverside
 * Ravens, U11 Girls Rep, and the Bello family, whose daughter Amara is the
 * player whose season this schedule turns out to be.
 */

/* ── Cast ────────────────────────────────────────────────────────────────── */

const LEAGUE = "Metro West Youth Basketball"
const CLUB = "Riverside Ravens"
const SEASON = "Fall 2026"

const URL_PLAN_1 = "/manage/leagues/metro-west/seasons/fall-2026/plan?step=1"
const URL_PLAN_2 = "/manage/leagues/metro-west/seasons/fall-2026/plan?step=2"
const URL_PLAN_3 = "/manage/leagues/metro-west/seasons/fall-2026/plan?step=3"
const URL_ENTER = "/seasons/fall-2026/enter"
const URL_CLUBS = "/manage/leagues/metro-west/seasons/fall-2026/manage?tab=clubs"
const URL_SCHEDULE = "/manage/leagues/metro-west/seasons/fall-2026/manage?tab=schedule"

const STEPS = [
  { label: "Teams", hint: "who's coming" },
  { label: "Your buildings", hint: "gyms, courts, hours" },
  { label: "Your calendar", hint: "we compute it" },
  { label: "Publish", hint: "post the card" },
  { label: "Schedule", hint: "when you're ready" },
]

/** The twelve candidate weekends. Halloween comes off on camera. */
const WEEKENDS = [
  "Sep 26",
  "Oct 3",
  "Oct 10",
  "Oct 17",
  "Oct 24",
  "Oct 31",
  "Nov 7",
  "Nov 14",
  "Nov 21",
  "Nov 28",
  "Dec 5",
  "Dec 12",
]

/**
 * The arithmetic, done once here so every screen quotes the same numbers.
 *
 * 30 teams at 14 games each is 210 games. A game slot is 90 minutes, so the
 * season needs 315 court-hours. Riverside CC is the league's own building:
 * 3 courts with 1 held back, 10 hours every Saturday, 11 weekends, which is
 * 220. Northside HS is rented by the court: 1 court, 6 hours, 11 weekends,
 * which is 66. 286 held against 315 needed leaves 29 court-hours to find, and
 * at 90 minutes a game that is 20 games with no building yet.
 */
const SEASON_HOURS = 315
const HELD_HOURS = 286
const SHORT_HOURS = SEASON_HOURS - HELD_HOURS

const ASK_MONTHS = [
  { label: "September", courtDays: "2.9", courtHours: "29", weekends: "1 weekend to rent" },
  { label: "October", courtDays: "11.4", courtHours: "114", weekends: "4 weekends to rent" },
  { label: "November", courtDays: "11.4", courtHours: "114", weekends: "4 weekends to rent" },
  { label: "December", courtDays: "5.8", courtHours: "58", weekends: "2 weekends to rent" },
]

const ASK_BLOCKS: {
  key: string
  weekend: string
  gym: string
  status: "needed" | "assumed" | "confirmed"
}[] = [
  { key: "w1", weekend: "Sep 26", gym: "Northside HS", status: "confirmed" },
  { key: "w2", weekend: "Oct 3", gym: "Northside HS", status: "confirmed" },
  { key: "w3", weekend: "Oct 17", gym: "Northside HS", status: "assumed" },
  { key: "w4", weekend: "Nov 7", gym: "", status: "needed" },
  { key: "w6", weekend: "Dec 12", gym: "Northside HS", status: "assumed" },
]

/** The board after the draw. Nov 7 is the weekend that will not fit. */
const BOARD = [
  { date: "Sep 26", gym: "Riverside CC", grades: ["U9", "U11"], is: 14, of: 20, tone: "fits" },
  { date: "Oct 3", gym: "Riverside CC", grades: ["U13", "U15"], is: 16, of: 20, tone: "fits" },
  { date: "Oct 10", gym: "Riverside CC", grades: ["U11", "U13"], is: 18, of: 20, tone: "tight" },
  { date: "Oct 17", gym: "Riverside CC +1", grades: ["U9", "U15"], is: 12, of: 24, tone: "fits" },
  { date: "Oct 24", gym: "Riverside CC", grades: ["U11", "U15"], is: 14, of: 20, tone: "fits" },
  { date: "Nov 7", gym: "Riverside CC", grades: ["U11", "U13"], is: 18, of: 12, tone: "over" },
  { date: "Nov 14", gym: "Riverside CC +1", grades: ["U9", "U13"], is: 16, of: 24, tone: "fits" },
  { date: "Nov 21", gym: "Riverside CC", grades: ["U11", "U15"], is: 14, of: 20, tone: "fits" },
] as const

/**
 * The four teams Riverside Ravens enters, all from story one's club. Two at
 * U11 and two at U13, which is exactly what the plan's estimate was short of:
 * the league guessed 8 and 10, and with this entry it lands on 8 and 10.
 */
const CLUB_TEAMS = [
  { id: "u11g", label: "U11 Girls Rep", meta: "10 players" },
  { id: "u11b", label: "U11 Boys Rep", meta: "10 players" },
  { id: "u13g", label: "U13 Girls Rep", meta: "12 players" },
  { id: "u13b", label: "U13 Boys Rep", meta: "11 players" },
]

const DIVISIONS = [
  { name: "U9 Mixed Tier 1", meta: "U9 • Co-ed", teams: 6 },
  { name: "U11 Girls Tier 1", meta: "U11 • Girls", teams: 4 },
  { name: "U11 Boys Tier 1", meta: "U11 • Boys", teams: 4 },
  { name: "U13 Girls Tier 1", meta: "U13 • Girls", teams: 3 },
  { name: "U13 Boys Tier 1", meta: "U13 • Boys", teams: 4 },
  { name: "U15 Mixed Tier 1", meta: "U15 • Co-ed", teams: 6 },
]
const NEW_DIVISION = { name: "U13 Girls Tier 2", meta: "U13 • Girls", teams: 3 }

/** The refusal, word for word in the auditor's own shape. */
const FIT_MESSAGE =
  "Weekend of Nov 7 · 8: U11 Girls: 8, U13 Girls: 10 · 18 games need this gym, but the booking holds 12 (12 + 0 slots by day, 1 court held back). Short by 6 games."
const FIT_OPTIONS = [
  "Add about 9 court-hours at this gym that weekend.",
  "Move a grade to a gym with more room that weekend.",
  "Lower the weekend target from 2 games per team to 1 in Planning.",
]

const GUARANTEES = [
  { label: "Back-to-backs, any team", value: "0" },
  { label: "Waits of 5 hours or more", value: "0" },
  { label: "Grades split across two gyms in a weekend", value: "0" },
  { label: "Double-booked teams or courts", value: "0" },
]

const GAMES: MockGame[] = [
  {
    when: "Sat Nov 7 · 9:00 AM",
    division: "U11 Girls T1",
    home: "Riverside Ravens",
    away: "Lakeshore Lightning",
    venue: "Riverside CC, Court 1",
  },
  {
    when: "Sat Nov 7 · 9:00 AM",
    division: "U11 Girls T1",
    home: "Northside Nighthawks",
    away: "Eastview Eagles",
    venue: "Riverside CC, Court 2",
  },
  {
    when: "Sat Nov 7 · 10:30 AM",
    division: "U13 Girls T1",
    home: "Riverside Ravens",
    away: "Westport Wolves",
    venue: "Riverside CC, Court 1",
  },
  {
    when: "Sat Nov 7 · 12:00 PM",
    division: "U13 Girls T2",
    home: "Lakeshore Lightning",
    away: "Harbour Heat",
    venue: "Riverside CC, Court 2",
  },
  {
    when: "Sun Nov 8 · 9:00 AM",
    division: "U11 Girls T1",
    home: "Eastview Eagles",
    away: "Riverside Ravens",
    venue: "Riverside CC, Court 1",
  },
  {
    when: "Sun Nov 8 · 10:30 AM",
    division: "U13 Girls T1",
    home: "Harbour Heat",
    away: "Northside Nighthawks",
    venue: "Riverside CC, Court 2",
  },
  {
    when: "Sat Nov 14 · 9:00 AM",
    division: "U11 Girls T1",
    home: "Riverside Ravens",
    away: "Harbour Heat",
    venue: "Northside HS, Court 1",
  },
  {
    when: "Sat Nov 14 · 10:30 AM",
    division: "U9 Mixed T1",
    home: "Westport Wolves",
    away: "Lakeshore Lightning",
    venue: "Riverside CC, Court 1",
  },
]

/** Amara's own games, which is what all of this was for. */
const HER_GAMES = [
  { day: "Sat 7", title: "vs Lakeshore Lightning", meta: "9:00 AM · Riverside CC, Court 1" },
  { day: "Sun 8", title: "at Eastview Eagles", meta: "9:00 AM · Riverside CC, Court 1" },
  { day: "Sat 14", title: "vs Harbour Heat", meta: "9:00 AM · Northside HS, Court 1" },
  { day: "Sat 21", title: "at Westport Wolves", meta: "11:00 AM · Westport DS, Court 2" },
]
const HER_GAME_DAYS = [7, 8, 14, 21, 28]

export const seasonStory: DemoScript = {
  desktopUrl: URL_PLAN_1,
  initialStage: "desktop",
  chapters: [
    { id: "plan", title: "Plan before it exists" },
    { id: "entries", title: "Clubs come in" },
    { id: "generate", title: "Divisions and the generate" },
    { id: "publish", title: "Draft, then publish once" },
  ],

  beats: [
    /* ── 1. Plan before it exists ─────────────────────────────────────── */
    {
      id: "plan-open",
      chapter: "plan",
      caption:
        "Metro West runs 24 clubs and has not one team registered yet. The gyms want an answer this week, so planning starts anyway.",
      hold: 2800,
      set: { screen: "plan1", step: 1 },
    },
    {
      id: "games-each",
      chapter: "plan",
      caption: "First the promise every team is being sold: fourteen games.",
      hold: 2600,
      cursor: "games-each",
      type: { key: "gamesEach", text: "14" },
    },
    {
      id: "u11",
      chapter: "plan",
      caption: "Then the estimate, grade by grade. Eight U11 teams.",
      hold: 2400,
      cursor: "grade-u11",
      press: true,
      set: { u11: 8 },
    },
    {
      id: "u13",
      chapter: "plan",
      caption: "Ten at U13, which is the grade that grew last year.",
      hold: 2600,
      cursor: "grade-u13",
      press: true,
      set: { u13: 10 },
    },
    {
      id: "totals",
      chapter: "plan",
      caption:
        "Thirty teams, two hundred and ten games. Nobody has registered. These are the league's numbers and the plan runs on them.",
      hold: 2600,
    },
    {
      id: "to-buildings",
      chapter: "plan",
      caption: "Next comes the part every league does in a spreadsheet.",
      hold: 2400,
      cursor: "rail-2",
      press: true,
      url: URL_PLAN_2,
      set: { screen: "plan2", step: 2 },
    },
    {
      id: "weekends",
      chapter: "plan",
      caption:
        "The season window is twelve weekends. Halloween comes off, so it is eleven.",
      hold: 2800,
      cursor: "wk-Oct 31",
      press: true,
      set: { halloween: false },
    },
    {
      id: "home-gym",
      chapter: "plan",
      caption:
        "Riverside CC is the league's own building. It fills first, at full capacity, because that time costs nothing.",
      hold: 2400,
      cursor: "gym-riverside",
      hover: "gym-riverside",
    },
    {
      id: "add-gym",
      chapter: "plan",
      caption:
        "Everything else is rented by the court. One court at Northside, six hours a Saturday.",
      hold: 2600,
      cursor: "add-gym",
      press: true,
      set: { pool: true },
    },
    {
      id: "to-calendar",
      chapter: "plan",
      caption: "Teams, buildings, hours. That is everything the calendar needs.",
      hold: 2200,
      cursor: "rail-3",
      press: true,
      url: URL_PLAN_3,
      set: { screen: "plan3", step: 3 },
    },
    {
      id: "draw",
      chapter: "plan",
      caption:
        "It fills the home gym first, then rents as few gyms as possible, as full as possible.",
      hold: 2600,
      cursor: "draw-calendar",
      press: true,
      set: { drawn: true },
    },
    {
      id: "ask",
      chapter: "plan",
      caption:
        "And here is the answer nobody gets in August. The season needs 315 court-hours. The buildings hold 286.",
      hold: 4200,
      cursor: "ask-toggle",
      press: true,
      set: { askOpen: true },
    },
    {
      id: "ask-hold",
      chapter: "plan",
      caption:
        "Twenty-nine court-hours short, twenty games with no building yet, and the months and weekends they fall in. That is the phone call, written out.",
      hold: 3400,
    },

    /* ── 2. Clubs come in ─────────────────────────────────────────────── */
    {
      id: "club-open",
      chapter: "entries",
      caption:
        "Entries open. This is the club side now, and Riverside Ravens are entering four teams.",
      hold: 2800,
      url: URL_ENTER,
      set: { screen: "enter", picked: 3 },
    },
    {
      id: "pick-team",
      chapter: "entries",
      caption:
        "Including the U11 girls team from the first demo, the one whose roster filled ten of ten.",
      hold: 2400,
      cursor: "team-u11g",
      press: true,
      set: { picked: 4 },
    },
    {
      id: "planned",
      chapter: "entries",
      caption:
        "The count goes straight into the league's plan. This is how an estimate turns into a fact.",
      hold: 2200,
    },
    {
      id: "sign",
      chapter: "entries",
      caption: "The club agreement is signed by typing a name, on behalf of the club.",
      hold: 3000,
      cursor: "sign-field",
      type: { key: "signature", text: "Dana Michaels" },
    },
    {
      id: "submit",
      chapter: "entries",
      caption: "One press for the whole club.",
      hold: 2200,
      cursor: "submit-entry",
      press: true,
      set: { dialog: "entry" },
    },
    {
      id: "confirm-entry",
      chapter: "entries",
      caption: "Four teams, one entry, no email thread.",
      hold: 2400,
      cursor: "confirm-entry",
      press: true,
      toast: "Entry submitted",
    },
    {
      id: "entered",
      chapter: "entries",
      caption:
        "The club is told what happens next, which is that the league reviews it and each team is approved on its own.",
      hold: 2600,
      set: { dialog: "", screen: "entered" },
    },
    {
      id: "queue",
      chapter: "entries",
      caption:
        "On the league side it lands in the queue with the application attached and the agreement already signed.",
      hold: 2800,
      url: URL_CLUBS,
      set: { screen: "clubs" },
    },
    {
      id: "approve",
      chapter: "entries",
      caption: "The league approves it.",
      hold: 2400,
      cursor: "approve-riverside",
      press: true,
      toast: "Riverside Ravens are in",
    },
    {
      id: "counter",
      chapter: "entries",
      caption:
        "Twenty-three of twenty-four clubs in, the one still out named rather than counted, and thirty teams against a plan that estimated thirty.",
      hold: 3000,
      set: { approved: true, clubsIn: 23 },
    },

    /* ── 3. Divisions and the generate ────────────────────────────────── */
    {
      id: "divisions",
      chapter: "generate",
      caption:
        "Registration closes and the grades become divisions, by grade and tier. The name writes itself the same way every time.",
      hold: 2600,
      url: URL_SCHEDULE,
      set: { screen: "schedule" },
    },
    {
      id: "add-division",
      chapter: "generate",
      caption: "U13 grew enough to need a second tier, so it gets one.",
      hold: 2600,
      cursor: "add-division",
      press: true,
      set: { extraDivision: true },
    },
    {
      id: "gate",
      chapter: "generate",
      caption:
        "The league is warned before it starts, because this is the real schedule and not a sandbox.",
      hold: 2400,
    },
    {
      id: "generate-1",
      chapter: "generate",
      caption: "Generate.",
      hold: 2200,
      cursor: "preview",
      press: true,
      set: { run: 1 },
    },
    {
      id: "fit-fail",
      chapter: "generate",
      caption:
        "And it refuses. Not a crash and not a shrug: the weekend, the gym, both grades, and the arithmetic that does not work.",
      hold: 4200,
      set: { fit: "block" },
    },
    {
      id: "options",
      chapter: "generate",
      caption:
        "Eighteen games need Riverside CC that Saturday. The booking holds twelve. Six games short, and three ways out.",
      hold: 2800,
      cursor: "fix-hours",
      hover: "fix-hours",
    },
    {
      id: "fix",
      chapter: "generate",
      caption:
        "The league takes the first one and books the Sunday morning it was already going to have to ask for.",
      hold: 2800,
      cursor: "fix-hours",
      press: true,
      toast: "Sunday Nov 8 added at Riverside CC · 8 more game slots",
    },
    {
      id: "generate-2",
      chapter: "generate",
      caption: "Generate again.",
      hold: 2400,
      cursor: "preview",
      press: true,
      set: { run: 2, fixed: true, fit: "" },
    },
    {
      id: "pass",
      chapter: "generate",
      caption:
        "Two hundred and ten games, none unplaced, in one pass. Now the part a spreadsheet cannot promise.",
      hold: 3000,
      set: { fit: "clear", g: 0 },
    },
    {
      id: "g1",
      chapter: "generate",
      caption: "No team plays two games with no rest between them. Not one, all season.",
      hold: 2200,
      set: { g: 1 },
    },
    {
      id: "g2",
      chapter: "generate",
      caption: "Nobody waits five hours at a gym for their second game.",
      hold: 2200,
      set: { g: 2 },
    },
    {
      id: "g3",
      chapter: "generate",
      caption:
        "A grade stays in one building on a weekend, so a family with two kids drives to one address.",
      hold: 2200,
      set: { g: 3 },
    },
    {
      id: "g4",
      chapter: "generate",
      caption: "And no court and no team is ever booked twice. That one is a hard rule, not a preference.",
      hold: 2400,
      set: { g: 4 },
    },
    {
      id: "commit",
      chapter: "generate",
      caption: "Committing it saves it. It does not release it.",
      hold: 2200,
      cursor: "commit",
      press: true,
      set: { dialog: "commit" },
    },
    {
      id: "commit-ok",
      chapter: "generate",
      caption: "Clubs and families still see nothing.",
      hold: 2600,
      cursor: "confirm-commit",
      press: true,
      toast: "Saved as a draft · 210 games",
    },

    /* ── 4. Draft, then publish once ──────────────────────────────────── */
    {
      id: "draft",
      chapter: "publish",
      caption:
        "Two hundred and ten draft games, every one wearing the badge. Nothing here is public yet.",
      hold: 3000,
      stage: "split",
      set: { dialog: "", committed: true },
    },
    {
      id: "phone-empty",
      chapter: "publish",
      caption:
        "Which is exactly what Amara's mother sees on her phone: a season that has not started. The league can still change anything.",
      hold: 2600,
    },
    {
      id: "publish",
      chapter: "publish",
      caption: "One press, once, when the league is ready.",
      hold: 2200,
      cursor: "publish",
      press: true,
      set: { dialog: "publish" },
    },
    {
      id: "publish-ok",
      chapter: "publish",
      caption:
        "Two hundred and ten games go live, and every club and family gets one notification, not two hundred and ten.",
      hold: 2600,
      cursor: "confirm-publish",
      press: true,
      toast: "Schedule published · 210 games are live",
    },
    {
      id: "push",
      chapter: "publish",
      caption: "It reaches the phone before the league has closed the tab.",
      hold: 2600,
      set: { dialog: "", published: true, push: true },
    },
    {
      id: "tap",
      chapter: "publish",
      caption: "She taps it and lands on her daughter's calendar.",
      hold: 2400,
      cursor: "phone-push",
      press: true,
    },
    {
      id: "cal",
      chapter: "publish",
      caption: "The month fills in with the season.",
      hold: 2800,
      set: { push: false, calFilled: true },
    },
    {
      id: "rows",
      chapter: "publish",
      caption:
        "Every game, with the gym and the court on it. No PDF, no group chat, no parent retyping dates into a phone calendar.",
      hold: 2800,
      set: { rows: true },
    },
    {
      id: "address",
      chapter: "publish",
      caption:
        "The same games are now on the league page, the club page, the team page and this calendar, because they were always one set of games.",
      hold: 2600,
    },
    {
      id: "end-card",
      chapter: "publish",
      caption:
        "A season planned before it existed, entered by the clubs, solved in one pass, and published once.",
      hold: 4200,
      set: { endCard: true },
    },
  ],

  render: ({ get, typingKey }) => {
    const screen = get<string>("screen", "plan1")
    const dialog = get<string>("dialog", "")
    const step = get("step", 1)
    const endCard = get("endCard", false)
    const onClub = screen === "enter" || screen === "entered"

    const typed: Typed = (key, placeholder) => (
      <TypeText text={get<string>(key, "")} typing={typingKey === key} placeholder={placeholder} />
    )

    const u11 = get("u11", 0)
    const u13 = get("u13", 0)
    const teams = 6 + u11 + u13 + 6
    const gamesEach = Number(get<string>("gamesEach", "0")) || 0
    const games = Math.round((teams * gamesEach) / 2)

    const halloween = get("halloween", true)
    const weekendsOn = halloween ? 12 : 11

    const picked = get("picked", 3)
    const fit = get<string>("fit", "")
    const published = get("published", false)

    /* ── Desktop ──────────────────────────────────────────────────────── */

    const desktop = (
      <div className="relative flex h-full flex-col">
        <MockTopBar
          workspace={onClub ? CLUB : LEAGUE}
          tabs={
            onClub
              ? ["Dashboard", "Teams", "Programs", "Leagues"]
              : ["Overview", "Clubs", "Divisions", "Schedule", "Plan"]
          }
          activeTab={
            onClub
              ? "Leagues"
              : screen === "clubs"
                ? "Clubs"
                : screen === "schedule"
                  ? "Schedule"
                  : "Plan"
          }
        />

        <div key={screen} className="demo-fade-in flex min-h-0 flex-1 flex-col">
          {(screen === "plan1" || screen === "plan2" || screen === "plan3") && (
            <PlanScreen
              step={step}
              screen={screen}
              typed={typed}
              teams={teams}
              gamesEach={gamesEach}
              games={games}
              u11={u11}
              u13={u13}
              halloween={halloween}
              weekendsOn={weekendsOn}
              pool={get("pool", false)}
              drawn={get("drawn", false)}
              askOpen={get("askOpen", false)}
            />
          )}
          {(screen === "enter" || screen === "entered") && (
            <EnterScreen done={screen === "entered"} picked={picked} typed={typed} />
          )}
          {screen === "clubs" && (
            <ClubsScreen approved={get("approved", false)} clubsIn={get("clubsIn", 22)} />
          )}
          {screen === "schedule" && (
            <ScheduleScreen
              extraDivision={get("extraDivision", false)}
              run={get("run", 0)}
              fit={fit}
              fixed={get("fixed", false)}
              guarantees={get("g", 0)}
              committed={get("committed", false)}
              published={published}
            />
          )}
        </div>

        <MockDialog
          open={dialog === "entry"}
          title={`Enter ${SEASON} with 4 teams?`}
          subtitle={`${LEAGUE} · entries close 4 September`}
          footer={
            <>
              <MockButton tone="quiet" size="sm">
                Cancel
              </MockButton>
              <MockButton id="confirm-entry" size="sm">
                Submit entry
              </MockButton>
            </>
          }
        >
          <div className="border-ink-100 rounded-2xl border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Crest name={CLUB} size="sm" />
              <div className="min-w-0">
                <p className="text-ink-900 text-[13px] font-bold">{CLUB}</p>
                <p className="text-ink-500 text-[11px]">
                  U11 Girls Rep · U11 Boys Rep · U13 Girls Rep · U13 Boys Rep
                </p>
              </div>
            </div>
            <p className="text-ink-500 border-ink-100 mt-2.5 border-t pt-2.5 text-[11.5px]">
              Signed on behalf of the club by Dana Michaels. The league reviews the application,
              then each team is approved on its own.
            </p>
          </div>
        </MockDialog>

        <MockDialog
          open={dialog === "commit"}
          title="Save the whole season's schedule?"
          subtitle="All existing unplayed games are replaced."
          footer={
            <>
              <MockButton tone="quiet" size="sm">
                Cancel
              </MockButton>
              <MockButton id="confirm-commit" tone="court" size="sm">
                Commit whole season
              </MockButton>
            </>
          }
        >
          <div className="border-gold-200 bg-gold-50 rounded-2xl border px-4 py-3">
            <p className="text-gold-900 text-[13px] font-bold">
              Saved as a draft. Clubs and families see nothing until you publish.
            </p>
            <p className="text-gold-800/80 mt-1 text-[11.5px]">
              210 games · 7 divisions · 24 clubs. Regenerate as often as you like until the day you
              publish.
            </p>
          </div>
        </MockDialog>

        <MockDialog
          open={dialog === "publish"}
          title="Publish the schedule?"
          subtitle="210 draft games go live."
          footer={
            <>
              <MockButton tone="quiet" size="sm">
                Cancel
              </MockButton>
              <MockButton id="confirm-publish" size="sm">
                Publish
              </MockButton>
            </>
          }
        >
          <div className="border-ink-100 rounded-2xl border px-4 py-3">
            <p className="text-ink-900 text-[13px] font-bold">
              Clubs and families get one notification pointing at their team calendar.
            </p>
            <p className="text-ink-500 mt-1 text-[11.5px]">
              Not one for each game. The league page, every club page, every team page and every
              family calendar are reading the same 210 games from this moment.
            </p>
          </div>
        </MockDialog>

        {endCard && (
          <MockEndCard
            eyebrow="Story 3 of 10"
            title="A season, planned to published"
            line="Court-hours answered before a team registered, entries in one press, a schedule that refused the weekend that did not fit, and one publish that filled every calendar."
            next="Game day, both sides at once"
          />
        )}
      </div>
    )

    /* ── Phone ────────────────────────────────────────────────────────── */

    const phoneNode = (
      <div className="relative h-full">
        <PhoneShell title="Amara · U11 Girls Rep" subtitle="Bello family" activeTab="Calendar">
          <CalendarScreen filled={get("calFilled", false)} rows={get("rows", false)} />
        </PhoneShell>
        {get("push", false) && (
          <PhonePushBanner
            id="phone-push"
            title={`${LEAGUE}: the ${SEASON} schedule is out`}
            body="U11 Girls Rep has 14 games. Tap to see them on Amara's calendar."
          />
        )}
      </div>
    )

    return { desktop, phone: phoneNode }
  },
}

/* ── Desktop screens ──────────────────────────────────────────────────────── */

function PlanScreen({
  step,
  screen,
  typed,
  teams,
  gamesEach,
  games,
  u11,
  u13,
  halloween,
  weekendsOn,
  pool,
  drawn,
  askOpen,
}: {
  step: number
  screen: string
  typed: Typed
  teams: number
  gamesEach: number
  games: number
  u11: number
  u13: number
  halloween: boolean
  weekendsOn: number
  pool: boolean
  drawn: boolean
  askOpen: boolean
}) {
  return (
    <>
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Plan your season"
        description="Five steps: teams, buildings, calendar, publish, schedule."
        action={<MockPill tone="play">Sep 26 to Dec 12</MockPill>}
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        <MockStepRail step={step} steps={STEPS} idPrefix="rail" />

        <div className="mt-3">
          {screen === "plan1" && (
            <MockPanel
              title="How many teams do you expect?"
              meta="Registrations inform the numbers, they never decide them."
              action={
                <MockButton id="next-buildings" size="sm" tone="quiet">
                  Next: Your buildings →
                </MockButton>
              }
            >
              <div className="grid grid-cols-[minmax(0,1fr)_240px] gap-5 px-4 py-3">
                <table className="w-full">
                  <thead>
                    <tr className="text-ink-500 text-[10px] font-bold uppercase tracking-wide">
                      <th className="pb-1.5 text-left">Grade</th>
                      <th className="pb-1.5 text-left">Expected teams</th>
                      <th className="pb-1.5 text-left" />
                    </tr>
                  </thead>
                  <tbody>
                    <GradeRow label="U9" value={6} history="6 last season" gamesEach={gamesEach} />
                    <GradeRow
                      id="grade-u11"
                      label="U11"
                      value={u11}
                      history="7 last season"
                      growing={u11 > 7}
                      gamesEach={gamesEach}
                    />
                    <GradeRow
                      id="grade-u13"
                      label="U13"
                      value={u13}
                      history="8 last season"
                      growing={u13 > 8}
                      gamesEach={gamesEach}
                    />
                    <GradeRow label="U15" value={6} history="6 last season" gamesEach={gamesEach} />
                  </tbody>
                </table>

                <div className="space-y-2.5">
                  <MockField
                    id="games-each"
                    label="Games each"
                    hint="The guarantee every team is sold."
                  >
                    {typed("gamesEach", "14")}
                  </MockField>
                  <div className="border-court-200 bg-court-50 rounded-xl border px-3 py-2.5">
                    <p className="text-court-900 text-[12.5px] font-bold">
                      {teams} teams
                      {games > 0 ? ` · about ${games} games` : ""}
                    </p>
                    <p className="text-court-900/80 mt-0.5 text-[11.5px]">
                      {games > 0 ? `At ${gamesEach} games each. ` : ""}
                      Next you will name the buildings that hold them.
                    </p>
                  </div>
                </div>
              </div>
            </MockPanel>
          )}

          {screen === "plan2" && (
            <MockPanel
              title="Your buildings"
              meta="The home gym fills first, at full capacity, before anything is rented."
              action={
                <MockButton id="next-calendar" size="sm" tone="quiet">
                  Next: Your calendar →
                </MockButton>
              }
            >
              <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-5 px-4 py-3">
                <MockWeekendRow
                  idPrefix="wk"
                  on={weekendsOn}
                  weekends={WEEKENDS.map((w) => ({
                    key: w,
                    label: w,
                    on: w === "Oct 31" ? halloween : true,
                  }))}
                />

                <div className="space-y-2">
                  <MockGymCard
                    id="gym-riverside"
                    name="Riverside CC"
                    city="Metro West"
                    home
                    courts="3 courts, 1 held back"
                    hours="Saturdays 8:00 AM to 6:00 PM"
                    note="Yours. 20 court-hours a weekend, at no cost."
                  />
                  {pool && (
                    <MockGymCard
                      name="Northside HS"
                      city="Metro West"
                      courts="1 court"
                      hours="Saturdays 9:00 AM to 3:00 PM"
                      note="Rented by the court. 6 court-hours a weekend."
                      fresh
                    />
                  )}
                  {/* The add control stays where it is once a gym lands under
                      it, which is what the real step does and what keeps the
                      pointer pressing something that is still there. */}
                  <MockButton id="add-gym" tone="quiet" size="sm">
                    + Add a gym
                  </MockButton>
                  <p className="text-ink-500 text-[11px] leading-snug">
                    <span className="text-ink-800 font-bold">Courts left empty: 1.</span> At every
                    gym, every day. Games run long and teams turn up late, so a court held back is a
                    court you still have.
                  </p>
                </div>
              </div>
            </MockPanel>
          )}

          {screen === "plan3" && (
            <MockPanel
              title="Your calendar"
              meta={drawn ? "Every change saves on its own." : "We compute it."}
              action={
                <MockButton id="draw-calendar" size="sm">
                  {drawn ? "Redraw calendar" : "Draw the calendar"}
                </MockButton>
              }
            >
              <div className="px-4 py-3">
                {drawn ? (
                  /* The board and the ask sit side by side, because the ask is
                     what the board is FOR and the frame never scrolls. */
                  <div className="grid grid-cols-[minmax(0,1fr)_400px] gap-4">
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-4 gap-1.5">
                        {BOARD.map((w, i) => (
                          <MockWeekendCard
                            key={w.date}
                            date={w.date}
                            gym={w.gym}
                            grades={[...w.grades]}
                            is={w.is}
                            of={w.of}
                            tone={w.tone}
                            fresh
                            delay={i * 70}
                          />
                        ))}
                      </div>
                      {askOpen && <MockBlockChips blocks={ASK_BLOCKS} />}
                    </div>
                    <MockAskSheet
                      toggleId="ask-toggle"
                      open={askOpen}
                      season={`31.5 court-days · ${SEASON_HOURS} court-hours`}
                      headline={`You still need to book ${SHORT_HOURS} court-hours.`}
                      supply={[
                        { label: "Needs", value: `${SEASON_HOURS}` },
                        { label: "buildings hold", value: `${HELD_HOURS}` },
                        { label: "games unhoused", value: "20" },
                      ]}
                      months={ASK_MONTHS}
                    />
                  </div>
                ) : (
                  <div className="border-ink-300 rounded-2xl border border-dashed px-6 py-8 text-center">
                    <p className="text-ink-900 text-[14px] font-bold">
                      Eleven weekends, two buildings, thirty teams.
                    </p>
                    <p className="text-ink-500 mt-1 text-[12px]">
                      The planner fills your chosen weekends from your gyms. Nothing is booked or
                      saved until you say so.
                    </p>
                  </div>
                )}
              </div>
            </MockPanel>
          )}
        </div>
      </div>
    </>
  )
}

function GradeRow({
  id,
  label,
  value,
  history,
  growing,
  gamesEach,
}: {
  id?: string
  label: string
  value: number
  history: string
  growing?: boolean
  gamesEach: number
}) {
  return (
    <tr className="border-ink-100 border-t">
      <td className="text-ink-900 py-1.5 pr-3 text-[13px] font-bold">{label}</td>
      <td className="py-1.5 pr-3">
        <MockStepper id={id} value={value} />
      </td>
      <td className="py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <MockPill tone={value > 0 ? "court" : "neutral"}>
            {value > 0 ? "In this plan" : "Not in the plan yet"}
          </MockPill>
          {value > 0 && gamesEach > 0 && (
            <MockPill tone="neutral">{Math.round((value * gamesEach) / 2)} games</MockPill>
          )}
          <span className="text-ink-400 text-[11px]">
            {history}
            {growing ? " · growing" : ""}
          </span>
        </div>
      </td>
    </tr>
  )
}

function EnterScreen({
  done,
  picked,
  typed,
}: {
  done: boolean
  picked: number
  typed: Typed
}) {
  return (
    <>
      <MockBand
        eyebrow={`${CLUB} · club workspace`}
        title={`Enter ${SEASON}`}
        description={`${LEAGUE} · entries close 4 September`}
        action={<MockPill tone="play">{picked} teams selected</MockPill>}
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        {done ? (
          <div className="border-court-200 bg-court-50 live-pop rounded-2xl border px-5 py-5">
            <p className="text-court-800 text-[16px] font-bold">Entry submitted.</p>
            <p className="text-ink-700 mt-1 text-[13px]">
              The league will review your application. Once approved, register each team from your
              club dashboard. Rosters, divisions and fees flow from there.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <MockPill tone="play">U11 Girls Rep</MockPill>
              <MockPill tone="play">U11 Boys Rep</MockPill>
              <MockPill tone="play">U13 Girls Rep</MockPill>
              <MockPill tone="play">U13 Boys Rep</MockPill>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-5">
            <div>
              <p className="text-ink-800 text-[12.5px] font-bold">
                Which teams are you entering?
              </p>
              <div className="mt-2 space-y-1.5">
                {CLUB_TEAMS.map((t, i) => (
                  <MockCheck
                    key={t.id}
                    id={`team-${t.id}`}
                    checked={i === 0 ? picked >= 4 : true}
                    label={t.label}
                    meta={t.meta}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <MockField label="How many teams do you plan to enter?" hint="Helps the league plan courts and sessions. You can register more or fewer, and each team is approved individually.">
                <span className="text-ink-900 font-bold tabular-nums">{picked}</span>
              </MockField>

              <div className="border-ink-200 rounded-xl border bg-white p-3">
                <p className="text-ink-900 text-[12.5px] font-bold">
                  {LEAGUE} club agreement
                </p>
                <p className="text-ink-500 mt-1 text-[11px] leading-snug">
                  Gym conduct, referee payment terms, withdrawal notice and the shared calendar
                  rules for {SEASON}.
                </p>
                <p className="text-ink-600 mt-2 text-[11px] font-semibold">
                  Type your full name to sign on behalf of your club
                </p>
                <div className="mt-1">
                  <MockField id="sign-field" label="">
                    {typed("signature", "Full name")}
                  </MockField>
                </div>
              </div>

              <MockButton id="submit-entry">Submit entry</MockButton>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function ClubsScreen({ approved, clubsIn }: { approved: boolean; clubsIn: number }) {
  return (
    <>
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Clubs"
        description="Who has entered, what they planned, and what actually came in."
        action={<MockButton size="sm" tone="quiet">Message clubs</MockButton>}
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-4">
        <div className="grid grid-cols-4 gap-3">
          <MockTile
            compact
            label="Clubs in"
            value={
              <>
                <MockCounter value={clubsIn} /> of 24
              </>
            }
            tone="court"
          />
          <MockTile
            compact
            label="Teams entered"
            value={<MockCounter value={approved ? 30 : 26} />}
          />
          <MockTile compact label="Plan expected" value="30" tone="play" />
          <MockTile compact label="Entries to review" value={approved ? "2" : "3"} tone="hoop" />
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_290px] gap-3">
          <MockPanel
            title={`Club entries (${approved ? 2 : 3})`}
            meta="Applications and signed agreements"
          >
            <MockEntryRow
              club={CLUB}
              meta="planned 4 teams · submitted 4 · signed by Dana Michaels"
              status={approved ? "approved" : "submitted"}
              approveId="approve-riverside"
              fresh
            />
            <MockEntryRow
              club="Harbour Heat"
              meta="planned 3 teams · submitted 3 · signed by Priya Raman"
              status="submitted"
            />
            <MockEntryRow
              club="Westport Wolves"
              meta="planned 5 teams · submitted 4 · agreement NOT signed"
              status="submitted"
            />
            <MockEntryRow
              club="Eastview Eagles"
              meta="planned 4 teams last season · nothing submitted yet"
              status="waiting"
            />
          </MockPanel>

          {/* Registration against the plan, the way step 5 of the wizard
              watches it: the estimate from chapter one, and what really came. */}
          <MockPanel title="Registration vs plan" meta="live">
            <div className="space-y-2 px-3 py-2.5">
              {[
                { grade: "U9", planned: 6, actual: 6 },
                { grade: "U11", planned: 8, actual: approved ? 8 : 6 },
                { grade: "U13", planned: 10, actual: approved ? 10 : 8 },
                { grade: "U15", planned: 6, actual: 6 },
              ].map((r) => (
                <div key={r.grade}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-ink-900 text-[11.5px] font-bold">{r.grade}</span>
                    <span className="text-ink-500 text-[11px] font-semibold tabular-nums">
                      {r.actual} of {r.planned} expected
                    </span>
                  </div>
                  <div className="bg-ink-100 mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none ${
                        r.actual > r.planned ? "bg-gold-400" : "bg-court-500"
                      }`}
                      style={{ width: `${Math.min(100, (r.actual / r.planned) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-ink-400 pt-0.5 text-[10.5px] leading-snug">
                Planning ran on the estimates. Teams past a grade&apos;s estimate show up here, and
                the league decides whether to raise the number.
              </p>
            </div>
          </MockPanel>
        </div>
      </div>
    </>
  )
}

function ScheduleScreen({
  extraDivision,
  run,
  fit,
  fixed,
  guarantees,
  committed,
  published,
}: {
  extraDivision: boolean
  run: number
  fit: string
  fixed: boolean
  guarantees: number
  committed: boolean
  published: boolean
}) {
  const divisions = extraDivision ? [...DIVISIONS, NEW_DIVISION] : DIVISIONS
  return (
    <>
      <MockBand
        eyebrow={`${LEAGUE} · ${SEASON}`}
        title="Generate the schedule"
        description="Built on plan Fall 2026 v3 · 24 clubs · 30 teams"
        action={
          published ? (
            <MockPill tone="court">Published</MockPill>
          ) : committed ? (
            <MockButton id="publish" size="sm">
              Publish schedule · 210 new
            </MockButton>
          ) : fit === "clear" ? (
            /* Nothing is committable until a preview has come back clean,
               which is the order the real console enforces too. */
            <MockButton id="commit" tone="court" size="sm">
              Commit whole season
            </MockButton>
          ) : (
            <MockPill tone="neutral">Nothing generated yet</MockPill>
          )
        }
      />
      <div className="bg-ink-50/60 min-h-0 flex-1 px-6 py-3.5">
        <MockJourney
          stages={["Plan", "Divisions", "Generate", "Publish"]}
          at={committed ? 3 : run > 0 ? 2 : 1}
        />

        {!committed ? (
          <div className="mt-3 grid grid-cols-[300px_minmax(0,1fr)] gap-4">
            <MockPanel
              title="Divisions"
              meta={`${divisions.length}`}
              action={
                <MockButton id="add-division" size="sm" tone="quiet">
                  Add Division
                </MockButton>
              }
            >
              <div className="max-h-[300px] px-3 py-2">
                {divisions.map((d) => (
                  <div
                    key={d.name}
                    className={`border-ink-50 flex items-center gap-2 border-b py-[3px] last:border-b-0 ${
                      d.name === NEW_DIVISION.name ? "live-row-in" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-ink-900 block truncate text-[12px] font-semibold">
                        {d.name}
                      </span>
                      <span className="text-ink-400 block text-[10.5px]">{d.meta}</span>
                    </span>
                    <MockPill tone="neutral">{d.teams} teams</MockPill>
                  </div>
                ))}
              </div>
              {!extraDivision && (
                <p className="text-ink-400 border-ink-50 border-t px-3 py-2 text-[11px]">
                  Will be named{" "}
                  <span className="text-ink-800 font-semibold">{NEW_DIVISION.name}</span>
                </p>
              )}
            </MockPanel>

            <div className="space-y-2.5">
              {run === 0 && (
                <div className="border-play-200 bg-play-50 rounded-2xl border px-4 py-3">
                  <p className="text-ink-900 text-[13px] font-bold">
                    You are about to build the real schedule.
                  </p>
                  <p className="text-ink-700 mt-1 text-[11.5px] leading-relaxed">
                    Make sure registration is closed and team counts are final. Big grades can run
                    as divisions: set them up first, then generate. You can change divisions and
                    regenerate freely until you publish.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <MockButton id="preview" size="sm">
                  Preview whole season
                </MockButton>
                {fixed && (
                  <MockPill tone="court">Sunday Nov 8 booked · 8 more game slots</MockPill>
                )}
              </div>

              {fit === "block" && (
                <MockFinding
                  severity="block"
                  title="This weekend does not fit at Riverside CC"
                  message={FIT_MESSAGE}
                  options={FIT_OPTIONS}
                  optionId="fix-hours"
                />
              )}

              {fit === "clear" && (
                <>
                  <MockFinding
                    severity="clear"
                    title="Preview: 210 games · 0 unscheduled"
                    message="No trade-offs. Every rule held: shares, rest days, rematch spacing, court rotation. Slots used: 210 of 236."
                  />
                  <MockPanel title="What the schedule promises" meta="Every team, all season">
                    <MockGuarantees items={GUARANTEES} shown={guarantees} />
                  </MockPanel>
                </>
              )}

              {run === 0 && fit === "" && (
                <MockPanel title="Nothing generated yet" meta="Draft only">
                  <p className="text-ink-500 px-4 py-4 text-[12px]">
                    The schedule is built from one plan: its gyms, weekends and hours. Everything it
                    produces is a draft until you publish it.
                  </p>
                </MockPanel>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div
              className={`rounded-2xl border px-4 py-2.5 ${
                published
                  ? "border-court-200 bg-court-50"
                  : "border-gold-300 bg-gold-50"
              }`}
            >
              <p
                className={`text-[12.5px] font-bold ${
                  published ? "text-court-900" : "text-gold-900"
                }`}
              >
                {published
                  ? "210 games are live. Clubs and families were notified once."
                  : "210 draft games. Visible only to you until you publish."}
              </p>
              <p
                className={`mt-0.5 text-[11px] ${
                  published ? "text-court-900/75" : "text-gold-800/80"
                }`}
              >
                {published
                  ? "The league page, every club page, every team page and every family calendar read the same games."
                  : "Review below, regenerate freely, then publish once."}
              </p>
            </div>
            <div className="border-ink-100 mt-2.5 overflow-hidden rounded-2xl border bg-white">
              <MockGamesTable games={GAMES} published={published} cascade />
            </div>
            <p className="text-ink-400 mt-1.5 text-[11px]">
              Showing 8 of 210 games · Nov 7 to Nov 14
            </p>
          </div>
        )}
      </div>
    </>
  )
}

/* ── Phone screen ─────────────────────────────────────────────────────────── */

function CalendarScreen({ filled, rows }: { filled: boolean; rows: boolean }) {
  return (
    <div className="space-y-2">
      <PhoneMonthGrid month="November 2026" days={HER_GAME_DAYS} filled={filled} />
      {filled ? (
        <div className="space-y-1.5">
          <p className="text-ink-500 text-[10px] font-semibold uppercase tracking-[0.12em]">
            {rows ? "U11 Girls Rep · 14 games" : "U11 Girls Rep"}
          </p>
          {(rows ? HER_GAMES : HER_GAMES.slice(0, 1)).map((g, i) => (
            <PhoneGameRow
              key={g.day}
              day={g.day}
              title={g.title}
              meta={g.meta}
              fresh
              delay={i * 90}
            />
          ))}
        </div>
      ) : (
        <div className="border-ink-200 rounded-2xl border border-dashed bg-white px-4 py-6 text-center">
          <p className="text-ink-900 text-[12.5px] font-bold">Nothing scheduled yet</p>
          <p className="text-ink-500 mt-1 text-[11px] leading-snug">
            Metro West posts the Fall 2026 schedule once it is set. You will get one notification.
          </p>
        </div>
      )}
    </div>
  )
}

/* ── Bits ─────────────────────────────────────────────────────────────────── */

/** Renders one state key as text that types itself when the beat says so. */
type Typed = (key: string, placeholder?: string) => ReactNode
