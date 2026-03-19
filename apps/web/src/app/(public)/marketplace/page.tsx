import { prisma } from "@youthbasketballhub/db"
import { format } from "date-fns"
import Link from "next/link"
import { formatCurrency } from "@/lib/countries"
import { getEnabledCountries, isSingleCountryMode } from "@/lib/platform-settings"

export const metadata = {
  title: "Tryout Marketplace - Youth Basketball Hub",
  description: "Find upcoming youth basketball tryouts near you.",
}

async function getPublicTryouts(country?: string) {
  const raw = await prisma.tryout.findMany({
    where: {
      isPublished: true,
      isPublic: true,
      scheduledAt: { gte: new Date() },
      ...(country ? { tenant: { country } } : {}),
    },
    include: {
      tenant: { include: { branding: true } },
      _count: { select: { signups: true } },
    },
    orderBy: { scheduledAt: "asc" },
  })
  return raw.map((t) => ({ ...t, fee: Number(t.fee) }))
}

export default async function PublicMarketplacePage({
  searchParams,
}: {
  searchParams: { country?: string }
}) {
  const singleCountry = await isSingleCountryMode()
  const enabledCountries = await getEnabledCountries()
  const selectedCountry = searchParams.country || singleCountry || ""
  const tryouts = await getPublicTryouts(selectedCountry || undefined)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tryout Marketplace</h1>
        <p className="mt-2 text-gray-600">
          Find upcoming basketball tryouts near you
        </p>
      </div>

      {/* Country filter */}
      {!singleCountry && enabledCountries.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
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
      )}

      {tryouts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tryouts available</h3>
          <p className="text-gray-600">Check back soon for upcoming tryouts!</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tryouts.map((tryout) => (
            <Link
              key={tryout.id}
              href={`/tryout/${tryout.id}`}
              className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition hover:shadow-md"
            >
              <div
                className="px-6 py-4"
                style={{ backgroundColor: tryout.tenant.branding?.primaryColor || "#1a73e8" }}
              >
                <h3 className="text-lg font-bold text-white">{tryout.tenant.name}</h3>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-bold text-gray-900 mb-2">{tryout.title}</h4>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <div>{format(new Date(tryout.scheduledAt), "MMM d, yyyy 'at' h:mm a")}</div>
                  <div>{tryout.location}</div>
                  <div>
                    {tryout.ageGroup}{tryout.gender ? ` \u2022 ${tryout.gender}` : ""}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-2xl font-bold text-blue-600">
                    {tryout.fee === 0 ? "FREE" : formatCurrency(tryout.fee, tryout.tenant.currency)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {tryout._count.signups}{tryout.maxParticipants ? `/${tryout.maxParticipants}` : ""} signed up
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
