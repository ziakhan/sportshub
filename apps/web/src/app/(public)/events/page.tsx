import { getAllPrograms } from "@/lib/queries/programs"
import { EventsBrowser } from "./events-browser"

// Server-rendered (was a client-fetch shell until 2026-07-12 — crawlers saw
// an empty page; this is the camps/tryouts/tournaments aggregate the SEO
// strategy targets). Filters/search stay client-side in EventsBrowser.
// Aggregation lives in lib/queries/programs.ts, shared with the native
// app's Browse → Programs endpoint.
export const dynamic = "force-dynamic"

export type { EventItem } from "@/lib/queries/programs"

export const metadata = {
  title: "Basketball Programs — Tryouts, Camps, House Leagues & Tournaments",
  description:
    "Browse upcoming youth basketball tryouts, summer and holiday camps, house leagues and tournaments. Dates, locations, fees and registration in one place.",
  alternates: { canonical: "/events" },
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: { type?: string }
}) {
  const events = await getAllPrograms()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-950">Find Programs &amp; Tryouts</h1>
        <p className="mt-2 text-ink-600">
          Browse tryouts, house leagues, camps, and tournaments to find the right fit for your player.
        </p>
      </div>
      <EventsBrowser events={events} initialFilter={searchParams?.type} />
    </div>
  )
}
