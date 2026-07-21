import { prisma } from "@youthbasketballhub/db"
import Link from "next/link"
import { Card } from "@/components/ui"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Venues",
  description: "Gyms and facilities used by clubs and leagues on SportsHub One.",
}

async function getVenues() {
  const venues = await prisma.venue.findMany({
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: { id: true, name: true, address: true, city: true, state: true },
    take: 500,
  })
  // Group by city for a scannable directory
  const byCity = new Map<string, typeof venues>()
  for (const v of venues) {
    const key = v.city || "Other"
    const list = byCity.get(key) ?? []
    list.push(v)
    byCity.set(key, list)
  }
  return Array.from(byCity.entries()).sort(([a], [b]) => a.localeCompare(b))
}

export default async function VenuesDirectoryPage() {
  const cities = await getVenues()
  const total = cities.reduce((n, [, list]) => n + list.length, 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
        Venues
      </h1>
      <p className="text-ink-600 mt-2 mb-6">
        {total} {total === 1 ? "facility" : "facilities"} used by clubs and leagues.
      </p>

      {cities.length === 0 ? (
        <Card>
          <p className="text-ink-500 text-sm">No venues yet.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {cities.map(([city, list]) => (
            <section key={city}>
              <h2 className="text-ink-500 mb-2 text-xs font-semibold uppercase tracking-[0.1em]">
                {city}
              </h2>
              <Card className="divide-ink-100 divide-y p-0">
                {list.map((v) => (
                  <Link
                    key={v.id}
                    href={`/venues/${v.id}`}
                    className="hover:bg-ink-50 flex items-center justify-between px-4 py-3 transition"
                  >
                    <div>
                      <p className="text-ink-900 font-medium">{v.name}</p>
                      <p className="text-ink-500 text-sm">
                        {v.address}
                        {v.state ? `, ${v.state}` : ""}
                      </p>
                    </div>
                    <span className="text-ink-300">&rarr;</span>
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
