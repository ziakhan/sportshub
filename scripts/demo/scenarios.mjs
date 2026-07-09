// Demo scenario definitions. Device framing per persona:
//   parents/players → mobile · owners/league/e-commerce → desktop · scoring → tablet.
// `auth` = the persona to pre-authenticate (session cached; clip starts signed-in).
// IDs are the current seed (regenerate on reseed — refetch if you re-seed).

export const C = {
  season: "8d1b540d-f28c-42be-abe2-26d21893fd55",
  league: "cf910ab9-f5cc-4ae9-80db-3c5507013b50",
  lordsClub: "660fedfb-e4bc-4bde-8f4b-cf772bfed077",
  huskiesClub: "1995bfdf-5750-470c-abd0-251f9c04aa8b",
  lordsG9Team: "30678448-33c0-483d-95dd-ecb6209058e7",
  liveGame: "69b13ed0-e8f9-49e7-9569-273aee04bf04",
  recap: "wysmp16-eastside-kings-5-vs-wysmp16-riverside-wolves-10-20260708-0299fa71",
  miles: "0cc33b47-6ee7-4759-91c8-6bb2f505454a",
}

// name, title, device, auth?, run(page, h)
export const SCENARIOS = [
  // ───────────────── MOBILE · Parents & players ─────────────────
  {
    name: "pa-01-club-mobile",
    title: "Parent — your club in your pocket",
    device: "mobile",
    async run(page, h) {
      await h.goto("/club/north-toronto-huskies", "Your club — branded, in your pocket")
      await h.scroll(360); await h.cap("Announcements — no group text, no Instagram")
      await h.scroll(420); await h.cap("Open programs — register right here")
      await h.scroll(460); await h.cap("Teams, live scores, contact — one app, not five")
      await h.scroll(420); await h.beat(600)
    },
  },
  {
    name: "pa-02-register-mobile",
    title: "Parent — register a player, no Google Form",
    device: "mobile",
    auth: "parent@sportshub.demo",
    async run(page, h) {
      await h.goto("/club/north-toronto-huskies", "Signed in — let's register for a camp")
      await h.scroll(760)
      await h.click(page.getByRole("link", { name: /Winter Break Skills Camp/i }))
      await h.cap("The whole camp — pricing, dates, register")
      await h.scroll(520); await h.cap("Pick your child and register — in the app")
      await h.beat(700)
    },
  },
  {
    name: "pa-03-dashboard-mobile",
    title: "Parent — every kid, registration & payment in one place",
    device: "mobile",
    auth: "parent@sportshub.demo",
    async run(page, h) {
      await h.goto("/dashboard", "Every player, one dashboard")
      await h.scroll(340); await h.cap("Registrations — tryouts, camps, house leagues")
      await h.scroll(420); await h.cap("Chat, polls, calendar — tied to the team")
      await h.scroll(360); await h.beat(600)
    },
  },
  {
    name: "pa-04-scores-mobile",
    title: "Parent — follow every game live",
    device: "mobile",
    async run(page, h) {
      await h.goto(`/league/${C.season}`, "Follow the league live — no GameChanger")
      await h.scroll(420); await h.cap("Live, upcoming, finals — always current")
      await h.scroll(520); await h.cap("Standings update themselves — nobody re-types scores")
      await h.scroll(460); await h.beat(600)
    },
  },
  {
    name: "pa-05-chat-mobile",
    title: "Parent — the team chat that knows the roster",
    device: "mobile",
    auth: "parent@sportshub.demo",
    async run(page, h) {
      await h.goto(`/teams/${C.lordsG9Team}/chat`, "Team chat — replaces WhatsApp + TeamSnap")
      await h.beat(700); await h.cap("It lives with the roster, schedule & payments")
      await h.scroll(300); await h.beat(700)
    },
  },
  {
    name: "pl-06-player-mobile",
    title: "Player — your own profile & stats",
    device: "mobile",
    async run(page, h) {
      await h.goto(`/player/${C.miles}`, "Every player gets a profile")
      await h.scroll(360); await h.cap("Real stats from real scored games")
      await h.scroll(420); await h.beat(600)
    },
  },

  // ───────────────── DESKTOP · Owners, league, e-commerce ─────────────────
  {
    name: "co-07-overview-desktop",
    title: "Club owner — the whole club on one screen",
    device: "desktop",
    auth: "owner-huskies@sportshub.demo",
    async run(page, h) {
      await h.goto(`/clubs/${C.huskiesClub}`, "Your whole club — not a spreadsheet per team")
      await h.scroll(280); await h.cap("The system tells me what needs attention")
      await h.scroll(360); await h.cap("Offer pipeline & quick actions — all connected")
      await h.scroll(320); await h.beat(600)
    },
  },
  {
    name: "co-08-ordersheet-desktop",
    title: "Club owner — the equipment order sheet writes itself",
    device: "desktop",
    auth: "owner-lords@sportshub.demo",
    async run(page, h) {
      await h.goto(`/clubs/${C.lordsClub}/offers/summary`, "Accepted offers → an equipment order sheet")
      await h.scroll(300); await h.cap("Uniforms, tracksuits, shoes — totalled by size")
      await h.scroll(380); await h.cap("Export CSV — I never re-typed a name or a size")
      await h.scroll(320); await h.beat(600)
    },
  },
  {
    name: "co-09-customize-desktop",
    title: "Club owner — a branded website, no designer",
    device: "desktop",
    auth: "owner-huskies@sportshub.demo",
    async run(page, h) {
      await h.goto(`/clubs/${C.huskiesClub}/customize`, "Brand your club page — no web designer")
      await h.scroll(320); await h.cap("Colors, logo, socials — your brand")
      await h.scroll(420); await h.cap("Drag blocks to arrange — live from real data")
      await h.scroll(320); await h.beat(600)
    },
  },
  {
    name: "lg-10-console-desktop",
    title: "League owner — run the season from one console",
    device: "desktop",
    auth: "owner-nph@sportshub.demo",
    async run(page, h) {
      await h.goto(`/manage/leagues/${C.league}`, "Run the whole league from one console")
      await h.scroll(320); await h.cap("Divisions, team entries, schedule, standings")
      await h.scroll(380); await h.cap("Clubs submit here — no Exposure Events, no reconciliation")
      await h.scroll(320); await h.beat(600)
    },
  },
  {
    name: "lg-11-public-desktop",
    title: "League — publishes itself",
    device: "desktop",
    async run(page, h) {
      await h.goto(`/league/${C.season}`, "The league's branded public home")
      await h.scroll(360); await h.cap("Scores & schedule — live from the games")
      await h.scroll(520); await h.cap("Standings & leaders — always current")
      await h.scroll(520); await h.beat(600)
    },
  },
  {
    name: "lg-12-recap-desktop",
    title: "League — every final writes its own recap",
    device: "desktop",
    async run(page, h) {
      await h.goto(`/news/${C.recap}`, "Every final writes its own recap")
      await h.scroll(360); await h.cap("Box score + AI recap — nobody posting to IG at 11pm")
      await h.scroll(460); await h.beat(600)
    },
  },

  // ───────────────── TABLET · Game-day scoring ─────────────────
  {
    name: "sk-13-scoring-tablet",
    title: "Scorekeeper — score the game, no GameChanger",
    device: "tablet",
    auth: "owner-nph@sportshub.demo",
    async run(page, h) {
      await h.goto(`/games/${C.liveGame}/score`, "Score the game on a tablet")
      await h.beat(1200); await h.cap("Box score, standings & recap flow from here")
      await h.scroll(240); await h.beat(700)
    },
  },
  {
    name: "sk-14-live-tablet",
    title: "Fans — follow the live game",
    device: "tablet",
    async run(page, h) {
      await h.goto(`/live/${C.liveGame}`, "The public live game — play-by-play")
      await h.scroll(320); await h.cap("Box score & scoring, live — on the same platform")
      await h.scroll(360); await h.beat(600)
    },
  },
]
