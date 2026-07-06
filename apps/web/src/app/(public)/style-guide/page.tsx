import {
  Card,
  Badge,
  SectionHeader,
  StatBlock,
  EntityHeader,
  Tabs,
  ScoreCard,
  StandingsTable,
  NewsCard,
  MediaTile,
} from "@/components/ui"

export const metadata = { title: "Style guide — SportsHub", robots: { index: false } }

// Internal design-system preview. Renders every shared component with sample
// data so we can verify the system visually. Safe to delete or gate later.
export default function StyleGuidePage() {
  const usersIcon = (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  )

  const standings = [
    { rank: 1, name: "Riverside Raptors", color: "#e33612", wins: 8, losses: 2, pct: 0.8, gamesBack: "—", streak: "W3" },
    { rank: 2, name: "Metro Hawks", color: "#4f46e5", wins: 7, losses: 3, pct: 0.7, gamesBack: 1, streak: "W1" },
    { rank: 3, name: "Lakeside Kings", color: "#16a34a", wins: 5, losses: 5, pct: 0.5, gamesBack: 3, streak: "L2" },
  ]

  return (
    <div className="bg-ink-50 min-h-screen py-12">
      <div className="container mx-auto max-w-5xl space-y-14 px-4 sm:px-6">
        <div>
          <h1 className="font-display text-ink-950 text-4xl font-bold">Design system</h1>
          <p className="text-ink-500 mt-2">Shared components — the evolve-brand UI kit.</p>
        </div>

        <section className="space-y-5">
          <SectionHeader
            eyebrow="Foundation"
            title="Badges & section headers"
            description="Status pills pair color with text/dot — never color alone."
            accent="play"
          />
          <Card>
            <div className="flex flex-wrap gap-2">
              <Badge tone="live" dot>Live</Badge>
              <Badge tone="play">Upcoming</Badge>
              <Badge tone="court">Open</Badge>
              <Badge tone="gold">Featured</Badge>
              <Badge tone="hoop">Tryout</Badge>
              <Badge tone="danger">Full</Badge>
              <Badge tone="warning">Default</Badge>
              <Badge tone="neutral">Final</Badge>
            </div>
          </Card>
        </section>

        <section className="space-y-5">
          <SectionHeader eyebrow="Dashboards" title="Stat blocks" accent="court" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock label="Users" value="1,284" icon={usersIcon} tone="play" trend={{ dir: "up", value: "12%" }} />
            <StatBlock label="Clubs" value="188" icon={usersIcon} tone="court" />
            <StatBlock label="Teams" value="42" icon={usersIcon} tone="hoop" trend={{ dir: "down", value: "3%" }} />
            <StatBlock label="Open tryouts" value="17" icon={usersIcon} tone="gold" />
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader eyebrow="Hub pages" title="Entity header + tabs" accent="hoop" />
          <EntityHeader
            name="Riverside Raptors"
            subtitle="Metro League · U14 Boys"
            meta={["8–2", "2nd in East", "Riverside Basketball Club"]}
            primaryColor="#e33612"
            crestText="R"
            action={
              <button className="rounded-2xl bg-white/95 px-4 py-2 text-sm font-semibold text-ink-950">
                Follow
              </button>
            }
          />
          <Tabs
            items={[
              {
                key: "schedule",
                label: "Schedule",
                content: (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ScoreCard
                      status="FINAL"
                      away={{ name: "Wolves", color: "#4f46e5", score: 68 }}
                      home={{ name: "Riverside Raptors", color: "#e33612", score: 72 }}
                      venue="Maple Gym · Court 2"
                      highlightsHref="#"
                    />
                    <ScoreCard
                      status="LIVE"
                      away={{ name: "Kings", color: "#16a34a", score: 41 }}
                      home={{ name: "Riverside Raptors", color: "#e33612", score: 39 }}
                      venue="Central HS"
                    />
                    <ScoreCard
                      status="SCHEDULED"
                      away={{ name: "Hawks", color: "#4f46e5" }}
                      home={{ name: "Riverside Raptors", color: "#e33612" }}
                      dateLabel="Sat · 2:00 PM"
                      venue="Maple Gym · Court 1"
                    />
                  </div>
                ),
              },
              {
                key: "standings",
                label: "Standings",
                content: <StandingsTable rows={standings} />,
              },
              {
                key: "media",
                label: "Media",
                count: 3,
                content: (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MediaTile type="PHOTO" thumbnail="https://placehold.co/400x400/e33612/fff?text=Game" caption="Season opener" />
                    <MediaTile type="VIDEO" thumbnail="https://placehold.co/400x400/4f46e5/fff?text=Clip" src="" caption="Buzzer beater" />
                    <MediaTile type="PHOTO" thumbnail="https://placehold.co/400x400/16a34a/fff?text=Team" />
                  </div>
                ),
              },
            ]}
          />
        </section>

        <section className="space-y-5">
          <SectionHeader eyebrow="Content" title="News cards" accent="gold" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <NewsCard title="Raptors clinch playoff spot" excerpt="A 72–68 win over the Wolves locks up second seed in the East division." dateLabel="Jun 6" author="Coach Lee" href="#" />
            <NewsCard title="Spring camp registration open" excerpt="Three weeks of skills development for U10–U14, starting July." dateLabel="Jun 2" href="#" coverUrl="https://placehold.co/640x360/4f46e5/fff?text=Camp" />
            <NewsCard title="Photo gallery: Championship weekend" dateLabel="May 28" href="#" />
          </div>
        </section>
      </div>
    </div>
  )
}
