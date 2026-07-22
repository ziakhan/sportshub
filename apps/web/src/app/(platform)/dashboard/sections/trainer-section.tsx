import Link from "next/link"

interface TrainerTenant {
  id: string
  name: string
  slug: string
  publishedSessions: number
  upcomingBookings: number
}

/** Trainer dashboard card (batch-backlog §5) — one card per trainer tenant. */
export function TrainerSection({ data }: { data: { tenants: TrainerTenant[] } }) {
  return (
    <section className="border-ink-100 shadow-soft rounded-[30px] border bg-white p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-ink-950 text-xl font-bold">Training</h2>
      </div>

      {data.tenants.length === 0 ? (
        <div className="border-ink-200 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-ink-700 font-medium">Set up your trainer profile</p>
          <p className="text-ink-500 mt-1 text-sm">
            Create your training business to publish programs and take 1-on-1 bookings.
          </p>
          <Link
            href="/trainers/create"
            className="bg-play-600 hover:bg-play-700 mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
          >
            Get started
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.tenants.map((t) => (
            <div key={t.id} className="border-ink-100 rounded-2xl border p-5">
              <p className="text-ink-900 font-semibold">{t.name}</p>
              <p className="text-ink-500 mt-1 text-sm">
                {t.publishedSessions} live program{t.publishedSessions !== 1 ? "s" : ""} ·{" "}
                {t.upcomingBookings} upcoming 1-on-1{t.upcomingBookings !== 1 ? "s" : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                <Link href={`/clubs/${t.id}`} className="text-play-700 hover:text-play-800">
                  Workspace
                </Link>
                <Link
                  href={`/clubs/${t.id}/training`}
                  className="text-play-700 hover:text-play-800"
                >
                  Programs
                </Link>
                <Link
                  href={`/clubs/${t.id}/one-on-one`}
                  className="text-play-700 hover:text-play-800"
                >
                  1-on-1
                </Link>
                <Link href={`/club/${t.slug}`} className="text-ink-500 hover:text-ink-700">
                  Public page
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
