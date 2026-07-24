import { prisma } from "@youthbasketballhub/db"
import { notFound } from "next/navigation"
import { Card, SmartBack } from "@/components/ui"
import { VenueMap } from "@/components/venues/venue-map"

export const dynamic = "force-dynamic"

const DOW = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

async function getVenue(id: string) {
  const venue = await prisma.venue.findUnique({
    where: { id },
    include: {
      courtList: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
      venueHours: { orderBy: { dayOfWeek: "asc" } },
    },
  })
  return venue
}

export async function generateMetadata({ params }: { params: { venueId: string } }) {
  const venue = await prisma.venue.findUnique({
    where: { id: params.venueId },
    select: { name: true, city: true, state: true },
  })
  if (!venue) return { title: "Venue not found" }
  return {
    title: `${venue.name} — ${venue.city}, ${venue.state}`,
    description: `Location, map, and hours for ${venue.name} in ${venue.city}, ${venue.state}.`,
  }
}

export default async function VenueDetailPage({
  params,
}: {
  params: { venueId: string }
}) {
  const venue = await getVenue(params.venueId)
  if (!venue) notFound()

  const fullAddress = [venue.address, venue.city, venue.state, venue.zipCode]
    .filter(Boolean)
    .join(", ")

  // Index hours by weekday for a stable Sun–Sat table
  const hoursByDay = new Map(venue.venueHours.map((h) => [h.dayOfWeek, h]))
  const hasAnyHours = venue.venueHours.some((h) => h.openTime || h.closeTime)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <SmartBack fallback="/venues" fallbackLabel="All venues" className="-ml-1 mb-3" />

      <div className="mb-6">
        <h1 className="font-condensed text-ink-950 text-3xl font-bold uppercase leading-none tracking-wide">
          {venue.name}
        </h1>
        <p className="text-ink-600 mt-2">{fullAddress}</p>
        {venue.phoneNumber && (
          <p className="text-ink-500 mt-1 text-sm">
            <a href={`tel:${venue.phoneNumber}`} className="hover:text-ink-700">
              {venue.phoneNumber}
            </a>
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a
            href={`https://maps.google.com/maps?q=${encodeURIComponent(
              venue.latitude != null && venue.longitude != null
                ? `${venue.latitude},${venue.longitude}`
                : `${venue.name}, ${fullAddress}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-play-600 hover:text-play-700 font-semibold"
          >
            Get directions &rarr;
          </a>
        </div>
      </div>

      <Card className="mb-6 overflow-hidden p-0">
        <VenueMap
          latitude={venue.latitude}
          longitude={venue.longitude}
          address={fullAddress}
          name={venue.name}
          className="h-72 w-full border-0"
        />
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="text-ink-900 mb-3 text-sm font-semibold uppercase tracking-wide">
            Hours
          </h2>
          {hasAnyHours ? (
            <table className="w-full text-sm">
              <tbody>
                {DOW.map((label, i) => {
                  const h = hoursByDay.get(i)
                  const open = h?.openTime
                  const close = h?.closeTime
                  return (
                    <tr key={i} className="border-ink-100 border-b last:border-0">
                      <td className="text-ink-600 py-1.5">{label}</td>
                      <td className="text-ink-900 py-1.5 text-right font-medium">
                        {open && close ? `${open} – ${close}` : "Closed"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-ink-500 text-sm">Hours not listed.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-ink-900 mb-3 text-sm font-semibold uppercase tracking-wide">
            Courts
          </h2>
          {venue.courtList.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {venue.courtList.map((c) => (
                <li key={c.id} className="text-ink-800 flex items-center gap-2">
                  <span className="bg-court-500 h-1.5 w-1.5 rounded-full" />
                  {c.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-500 text-sm">
              {venue.capacity
                ? `Capacity ${venue.capacity}.`
                : "No courts listed."}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
