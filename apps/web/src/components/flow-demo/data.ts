/**
 * One consistent story used by every scene, built from the same demo world
 * the product seeds (scripts/seed-nph-demo.ts): real club names, real venues,
 * real fee amounts, single birth years. Nothing here shows a capability the
 * product does not have.
 */

export const LEAGUE = {
  name: "NPH Summer League",
  season: "Summer 2026",
  teamFee: 3990,
  gamesGuaranteed: 10,
  startDate: "2026-05-30",
  endDate: "2026-06-28",
  registrationDeadline: "2026-05-15",
}

export const DIVISIONS = [
  { name: "Grade 8 Boys", ageGroup: "U14", teams: 8 },
  { name: "Grade 9 Boys", ageGroup: "U16", teams: 8 },
  { name: "Grade 10 Boys", ageGroup: "U16", teams: 8 },
  { name: "Grade 11 Boys", ageGroup: "U18", teams: 6 },
]

export const VENUES = [
  { name: "Pan Am Sports Centre", address: "875 Morningside Ave", city: "Toronto", courts: 2 },
  { name: "Humber Athletic Centre", address: "205 Humber College Blvd", city: "Etobicoke", courts: 2 },
  { name: "Haber Recreation Centre", address: "3040 Tim Dobbie Dr", city: "Burlington", courts: 2 },
  { name: "Paramount Fine Foods Centre", address: "5500 Rose Cherry Pl", city: "Mississauga", courts: 2 },
]

export const SESSIONS = [
  { label: "Week 1", days: ["Sat, May 30", "Sun, May 31"] },
  { label: "Week 2", days: ["Sat, Jun 6", "Sun, Jun 7"] },
  { label: "Week 3", days: ["Sat, Jun 13", "Sun, Jun 14"] },
  { label: "Week 4", days: ["Sat, Jun 20", "Sun, Jun 21"] },
  { label: "Week 5", days: ["Sat, Jun 27", "Sun, Jun 28"] },
]

export const REFS = [
  { name: "Mike Ferreira", cert: "Level 2", games: 41 },
  { name: "Sarah Whitlock", cert: "Level 3", games: 68 },
  { name: "James Okonkwo", cert: "Level 2", games: 35 },
  { name: "Priya Raman", cert: "Level 1", games: 12 },
]

export const CLUB = {
  name: "Burlington Force",
  slug: "burlington-force-elite",
  city: "Burlington",
  color: "#16a34a",
  contactHint: "in***@burlingtonforce.ca",
}

export const TEAM = {
  name: "Burlington Force Grade 10",
  ageGroup: "U16",
  gender: "Boys",
  short: "BF · G10",
}

export const STAFF = {
  headCoach: "David Okafor",
  assistant: "Anita Reid",
  managerInvite: "wendy.clarke@gmail.com",
}

export const PARENT = { name: "Maria Thompson", email: "maria.thompson@gmail.com" }

export const KID = {
  first: "Jayden",
  last: "Thompson",
  name: "Jayden Thompson",
  short: "Jayden T.",
  birthYear: 2010,
  dob: "March 14, 2010",
  position: "Shooting Guard",
  jersey: 23,
  prefs: [23, 11, 8],
  uniformSize: "Youth Large",
}

/** Full active roster after finalization — 12 players, all born 2010. */
export const ROSTER = [
  { jersey: 23, name: "Jayden Thompson", pos: "SG" },
  { jersey: 7, name: "Marcus Chen", pos: "PG" },
  { jersey: 11, name: "Malik Osei", pos: "PF" },
  { jersey: 4, name: "Ethan Patel", pos: "PG" },
  { jersey: 15, name: "Owen Campbell", pos: "SF" },
  { jersey: 21, name: "Isaiah Grant", pos: "C" },
  { jersey: 9, name: "Andre Baptiste", pos: "SG" },
  { jersey: 33, name: "Kai Nguyen", pos: "SF" },
  { jersey: 12, name: "Darius Brown", pos: "PG" },
  { jersey: 5, name: "Amir Khan", pos: "SF" },
  { jersey: 30, name: "Cole Anderson", pos: "C" },
  { jersey: 18, name: "Xavier Reid", pos: "PF" },
]

/** 13th club-roster player left off the league version (12/13 selected). */
export const EXTRA_PLAYER = { jersey: 26, name: "Theo Martinez", pos: "SF" }

export const TRYOUT = {
  title: "Spring 2026 Grade 10 Boys Tryout",
  location: "Haber Recreation Centre, 3040 Tim Dobbie Dr, Burlington",
  dateLong: "Tuesday, April 7, 2026",
  dateShort: "Apr 7, 2026",
  time: "6:30 PM",
  duration: 90,
  fee: 25,
  capacity: 40,
  signups: 21,
  checkedIn: 17,
  eligible: 18,
}

export const OFFER = {
  packages: [
    { label: "New Player", fee: 3000, deposit: 750, monthly: 750 },
    { label: "Returning Player", fee: 2700, deposit: 675, monthly: 675 },
  ],
  installmentDates: ["May 1", "Jun 1", "Jul 1"],
  expires: "Apr 17, 2026",
  received: "Apr 10, 2026",
  message: "Great tryout, Jayden. We would love to have you with the Force this summer.",
}

/** Other Grade 10 division teams (real seed clubs). */
export const G10_TEAMS = [
  "Burlington Force Grade 10",
  "Royal Crown Grade 10",
  "North Toronto Huskies Grade 10",
  "West United Prep Grade 10",
  "North York Lions Grade 10",
  "City Above Elite Grade 10",
  "Oakville Panthers Grade 10",
  "Polaris Prep Grade 10",
]

/** Standings late in the regular season. Wins and losses balance. */
export const STANDINGS = [
  { team: "Burlington Force Grade 10", w: 8, l: 1, pct: ".889", gb: "-", strk: "W5" },
  { team: "Royal Crown Grade 10", w: 7, l: 2, pct: ".778", gb: "1", strk: "W2" },
  { team: "North Toronto Huskies Grade 10", w: 6, l: 3, pct: ".667", gb: "2", strk: "L1" },
  { team: "West United Prep Grade 10", w: 5, l: 4, pct: ".556", gb: "3", strk: "W1" },
  { team: "North York Lions Grade 10", w: 4, l: 5, pct: ".444", gb: "4", strk: "L2" },
  { team: "City Above Elite Grade 10", w: 3, l: 6, pct: ".333", gb: "5", strk: "L1" },
  { team: "Oakville Panthers Grade 10", w: 2, l: 7, pct: ".222", gb: "6", strk: "L4" },
  { team: "Polaris Prep Grade 10", w: 1, l: 8, pct: ".111", gb: "7", strk: "L6" },
]

/** The featured game: Week 4, Sat Jun 20, Force vs Huskies. */
export const GAME = {
  home: "Burlington Force Grade 10",
  away: "North Toronto Huskies Grade 10",
  homeShort: "BF · G10",
  awayShort: "NT · G10",
  homeMono: "BF",
  awayMono: "NT",
  homeColor: "#16a34a",
  awayColor: "#5b21b6",
  homeRecord: "8-1",
  awayRecord: "6-3",
  venue: "Haber Recreation Centre · Court 1",
  date: "Sat, Jun 20, 2:00 PM",
  referee: "Mike Ferreira",
  // Live moment shown in the demo
  liveHome: 58,
  liveAway: 54,
  livePeriod: "Q4",
  liveClock: "5:12",
  // Final
  finalHome: 62,
  finalAway: 58,
  lines: { home: [16, 14, 15, 17], away: [15, 16, 13, 14] },
}

/** Box score for the home side — points sum to 62. */
export const BOX = [
  { jersey: 23, name: "Jayden T.", min: 28, pts: 21, reb: 6, ast: 3, stl: 1, to: 2, pf: 2, starter: true, top: true },
  { jersey: 7, name: "Marcus C.", min: 26, pts: 11, reb: 2, ast: 5, stl: 0, to: 1, pf: 1, starter: true },
  { jersey: 11, name: "Malik O.", min: 25, pts: 9, reb: 8, ast: 1, stl: 0, to: 1, pf: 3, starter: true },
  { jersey: 4, name: "Ethan P.", min: 22, pts: 6, reb: 1, ast: 2, stl: 2, to: 0, pf: 2, starter: true },
  { jersey: 15, name: "Owen C.", min: 21, pts: 5, reb: 4, ast: 0, stl: 0, to: 1, pf: 4, starter: true },
  { jersey: 21, name: "Isaiah G.", min: 14, pts: 4, reb: 5, ast: 0, stl: 0, to: 0, pf: 1 },
  { jersey: 9, name: "Andre B.", min: 12, pts: 3, reb: 1, ast: 1, stl: 1, to: 1, pf: 0 },
  { jersey: 33, name: "Kai N.", min: 11, pts: 2, reb: 2, ast: 0, stl: 0, to: 0, pf: 1 },
  { jersey: 12, name: "Darius B.", min: 10, pts: 1, reb: 0, ast: 1, stl: 0, to: 0, pf: 0 },
  { jersey: 5, name: "Amir K.", min: 8, pts: 0, reb: 1, ast: 0, stl: 0, to: 1, pf: 1 },
  { jersey: 30, name: "Cole A.", min: 7, pts: 0, reb: 2, ast: 0, stl: 0, to: 0, pf: 2 },
  { jersey: 18, name: "Xavier R.", min: 6, pts: 0, reb: 0, ast: 0, stl: 0, to: 0, pf: 0 },
]

export const AWAY_LEADERS = "Noah S. 18 PTS · Lucas K. 12 PTS · Ibrahim H. 9 PTS"

export const PLAYOFFS = {
  qualifying: 4,
  formatLabel: "Bracket of 4",
  formatDesc: "Straight knockout: 4 teams, seeded from standings.",
  altLabel: "Bracket of 4 + 3rd-place game",
  altDesc: "Knockout plus a bronze game between the semifinal losers.",
  firstRound: "2026-07-04",
  seeds: [
    { seed: 1, team: "Burlington Force Grade 10", record: "8-1" },
    { seed: 2, team: "Royal Crown Grade 10", record: "7-2" },
    { seed: 3, team: "North Toronto Huskies Grade 10", record: "6-3" },
    { seed: 4, team: "West United Prep Grade 10", record: "5-4" },
  ],
  semi1: { label: "Semifinal 1", home: "Burlington Force Grade 10", away: "West United Prep Grade 10", hs: 66, as: 52, when: "Sat, Jul 4, 1:00 PM" },
  semi2: { label: "Semifinal 2", home: "Royal Crown Grade 10", away: "North Toronto Huskies Grade 10", hs: 59, as: 55, when: "Sat, Jul 4, 3:00 PM" },
  final: { label: "Final", home: "Burlington Force Grade 10", away: "Royal Crown Grade 10", hs: 66, as: 61, when: "Sun, Jul 5, 2:00 PM" },
}

export const RECAP = {
  title: "Force edge Huskies 62-58 behind Thompson's 21",
  date: "Saturday, June 20, 2026",
  body: [
    "Burlington Force Grade 10 held off North Toronto Huskies Grade 10 62-58 at Haber Recreation Centre on Saturday, protecting first place in the Grade 10 Boys division.",
    "Jayden Thompson led all scorers with 21 points, adding 6 rebounds and 3 assists. Marcus Chen ran the floor with 11 points and 5 assists, and Malik Osei owned the glass with 8 rebounds.",
    "The Huskies cut a nine-point lead to two in the fourth behind Noah Sinclair's 18, but the Force closed it out at the line. Both teams are back on court next weekend for the final session of the regular season.",
  ],
}

export const CHAMP_RECAP = {
  title: "Burlington Force take the Grade 10 title, 66-61 over Royal Crown",
  date: "Sunday, July 5, 2026",
  body: [
    "Burlington Force Grade 10 are the NPH Summer League Grade 10 Boys champions, beating Royal Crown Grade 10 66-61 in Sunday's final at Pan Am Sports Centre.",
    "Jayden Thompson scored 19 and Isaiah Grant added 12 off the bench. Royal Crown led by four at the half before the Force took over in the third quarter.",
    "The top seed finishes the season 10-1 across the regular season and playoffs. Full box score and play-by-play are linked below.",
  ],
}

export const SIGNUPS = [
  { player: "Jayden Thompson", parent: "Maria Thompson", email: "maria.thompson@gmail.com", age: 15, in: true },
  { player: "Marcus Chen", parent: "Wei Chen", email: "wei.chen@gmail.com", age: 15, in: true },
  { player: "Malik Osei", parent: "Tunde Osei", email: "tunde.osei@gmail.com", age: 15, in: true },
  { player: "Ethan Patel", parent: "Raj Patel", email: "raj.patel@gmail.com", age: 16, in: true },
  { player: "Owen Campbell", parent: "Dana Campbell", email: "dana.campbell@gmail.com", age: 15, in: true },
  { player: "Isaiah Grant", parent: "Grace Grant", email: "grace.grant@gmail.com", age: 15, in: false },
  { player: "Andre Baptiste", parent: "Elena Baptiste", email: "elena.baptiste@gmail.com", age: 16, in: true },
  { player: "Kai Nguyen", parent: "Victor Nguyen", email: "victor.nguyen@gmail.com", age: 15, in: true },
]

export const CHAT = {
  pinned: "Practice moves to Haber Rec on Thursday, 7pm, Court 2.",
  messages: [
    { who: "David Okafor", staff: true, time: "4:12 PM", body: "Great win Saturday. Film session before Thursday practice, doors at 6:40." },
    { who: "Maria Thompson", time: "4:20 PM", body: "Jayden will be there. Is the team dinner still on after the last session?" },
    { who: "David Okafor", staff: true, time: "4:26 PM", body: "Yes, June 28 after the second game. Details coming in a poll." },
  ],
  poll: {
    question: "Team dinner spot for June 28?",
    votes: 13,
    options: [
      { label: "Boston Pizza on Fairview", count: 8, mine: true },
      { label: "The Works Burlington", count: 4 },
      { label: "Potluck at the gym", count: 1 },
    ],
  },
  typing: "Wei Chen is typing…",
}

/** Same dinner poll the chat scene votes in, seen from the Polls page right
 *  after Maria's vote lands (13 -> 14, Boston Pizza 8 -> 9). */
export const POLL_PAGE = {
  title: "Team dinner for June 28",
  desc: "Closing out the season together after the last session. Answers close Thursday.",
  by: "David Okafor",
  created: "Jun 21",
  voters: 14,
  question: "Team dinner spot for June 28?",
  multiple: false,
  options: [
    { label: "Boston Pizza on Fairview", count: 9, mine: true },
    { label: "The Works Burlington", count: 4 },
    { label: "Potluck at the gym", count: 1 },
  ],
}

export const fmt = (n: number) =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
