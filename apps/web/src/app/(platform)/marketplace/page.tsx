import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { getEnabledCountries, isSingleCountryMode } from "@/lib/platform-settings"

async function getPublicTryouts(country?: string) {
  const raw = await prisma.tryout.findMany({
    where: {
      isPublished: true,
      isPublic: true,
      scheduledAt: { gte: new Date() },
      ...(country ? { tenant: { country } } : {}),
    },
    include: {
      tenant: {
        include: {
          branding: true,
        },
      },
      _count: {
        select: {
          signups: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  })
  return raw.map((t) => ({ ...t, fee: Number(t.fee) }))
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: { country?: string }
}) {
  const singleCountry = await isSingleCountryMode()
  const enabledCountries = await getEnabledCountries()
  const selectedCountry = searchParams.country || singleCountry || ""
  const tryouts = await getPublicTryouts(selectedCountry || undefined)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900">Tryout Marketplace</h1>
          <p className="mt-2 text-lg text-gray-600">
            Find the perfect basketball club for your child
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 font-semibold text-gray-900">Filters</h3>
          <div className={`grid gap-4 ${!singleCountry ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            {!singleCountry && enabledCountries.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href="/marketplace"
                    className={`rounded-full px-3 py-1 text-xs font-medium ${!searchParams.country ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    All
                  </Link>
                  {enabledCountries.map((c) => (
                    <Link
                      key={c.code}
                      href={`/marketplace?country=${c.code}`}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${searchParams.country === c.code ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      {c.code}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Age Group
              </label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="">All ages</option>
                <option value="U8">U8</option>
                <option value="U10">U10</option>
                <option value="U12">U12</option>
                <option value="U14">U14</option>
                <option value="U16">U16</option>
                <option value="U18">U18</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="">All</option>
                <option value="MALE">Boys</option>
                <option value="FEMALE">Girls</option>
                <option value="COED">Co-ed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Fee
              </label>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2">
                <option value="">Any</option>
                <option value="25">$25</option>
                <option value="50">$50</option>
                <option value="100">$100</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700">
                Apply Filters
              </button>
            </div>
          </div>
        </div>

        {/* Tryouts Grid */}
        {tryouts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
            <div className="text-4xl mb-4">🏀</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No tryouts available
            </h3>
            <p className="text-gray-600">Check back soon for upcoming tryouts!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tryouts.map((tryout) => (
              <Link
                key={tryout.id}
                href={`/tryouts/${tryout.id}`}
                className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
              >
                {/* Club header with branding */}
                <div
                  className="px-6 py-4"
                  style={{
                    backgroundColor: tryout.tenant.branding?.primaryColor || "#1a73e8",
                  }}
                >
                  <h3 className="text-lg font-bold text-white">{tryout.tenant.name}</h3>
                </div>

                <div className="p-6">
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{tryout.title}</h4>

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>{tryout.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>🎯</span>
                      <span>
                        {tryout.ageGroup}
                        {tryout.gender ? ` • ${tryout.gender}` : ""}
                      </span>
                    </div>
                  </div>

                  {tryout.description && (
                    <p className="text-sm text-gray-700 line-clamp-2 mb-4">
                      {tryout.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(tryout.fee, tryout.tenant.currency)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {tryout._count.signups}{" "}
                      {tryout.maxParticipants ? `/ ${tryout.maxParticipants}` : ""} signed up
                    </div>
                  </div>

                  <button className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-white font-semibold hover:bg-blue-700">
                    View Details & Sign Up
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
