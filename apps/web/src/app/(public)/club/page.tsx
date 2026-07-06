import Link from "next/link"
import { prisma } from "@youthbasketballhub/db"
import { isTestWorldSlug } from "@/lib/demo-data"
import { ClubSearch } from "../club-search"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Find a Basketball Club - Youth Basketball Hub",
  description: "Search and discover youth basketball clubs near you.",
}

/** Browseable directory (audit GAP-024): search on top, but never a blank
 *  page — the most active clubs render immediately, grouped by city. */
async function getDirectoryClubs() {
  const clubs = await (prisma as any).tenant.findMany({
    where: { status: { in: ["ACTIVE", "UNCLAIMED"] } },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      status: true,
      branding: { select: { primaryColor: true } },
      _count: { select: { teams: true, tryouts: true } },
    },
    orderBy: [{ teams: { _count: "desc" } }, { name: "asc" }],
    take: 140,
  })
  return clubs.filter((c: any) => !isTestWorldSlug(c.slug)).slice(0, 36)
}

export default async function ClubDirectoryPage() {
  const clubs = await getDirectoryClubs()

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-ink-950 mb-2">
          Basketball Club Directory
        </h1>
        <p className="text-ink-600 max-w-xl mx-auto">
          Search by club name or city — or browse the most active clubs below.
        </p>
      </div>
      <ClubSearch />

      {clubs.length > 0 && (
        <div className="mt-12">
          <h2 className="text-ink-400 mb-4 text-xs font-bold uppercase tracking-[0.16em]">
            Most active clubs
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club: any) => (
              <Link
                key={club.id}
                href={`/club/${club.slug}`}
                className="card-lift border-ink-100 shadow-soft group flex items-center gap-4 rounded-2xl border bg-white p-4"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: club.branding?.primaryColor || "#4f46e5" }}
                >
                  {club.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-950 group-hover:text-play-600 block truncate font-semibold transition-colors">
                    {club.name}
                  </span>
                  <span className="text-ink-500 block truncate text-xs">
                    {[club.city, club.state].filter(Boolean).join(", ") || "Ontario"}
                    {club._count.teams > 0 && ` · ${club._count.teams} teams`}
                    {club._count.tryouts > 0 && ` · ${club._count.tryouts} tryouts`}
                  </span>
                </span>
                {club.status === "UNCLAIMED" && (
                  <span className="bg-ink-50 text-ink-500 ring-ink-200 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1">
                    Open profile
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
