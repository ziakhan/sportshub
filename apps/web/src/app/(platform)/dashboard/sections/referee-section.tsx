import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface RefereeSectionProps {
  data: NonNullable<DashboardData["referee"]>
}

export function RefereeSection({ data }: RefereeSectionProps) {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Referee dashboard</h2>
        <p className="text-ink-500 mt-1 text-sm">
          Your certification, assignments, and officiating performance.
        </p>
      </div>

      {data.profile ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Certification"
              value={data.profile.certificationLevel || "Not set"}
              tone="bg-play-50 text-play-700"
              icon={<IconBadge className="h-4 w-4" />}
            />
            <MetricCard
              label="Games refereed"
              value={String(data.profile.gamesRefereed)}
              tone="bg-court-50 text-court-700"
              icon={<IconWhistle className="h-4 w-4" />}
            />
            <MetricCard
              label="Average rating"
              value={data.profile.averageRating ? `${data.profile.averageRating}/5` : "No ratings"}
              tone="bg-hoop-50 text-hoop-700"
              icon={<IconStar className="h-4 w-4" />}
            />
            <MetricCard
              label="Standard fee"
              value={`$${String(data.profile.standardFee)}`}
              tone="bg-ink-100 text-ink-700"
              icon={<IconCard className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-ink-950 text-lg font-semibold">
                  Profile snapshot
                </h3>
                <Link
                  href="/referee/profile"
                  className="text-play-600 hover:text-play-700 text-sm font-semibold"
                >
                  Edit
                </Link>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail
                  label="Certification"
                  value={data.profile.certificationLevel || "Not set"}
                />
                <Detail label="Games refereed" value={String(data.profile.gamesRefereed)} />
                <Detail
                  label="Average rating"
                  value={
                    data.profile.averageRating
                      ? `${data.profile.averageRating}/5`
                      : "No ratings yet"
                  }
                />
                <Detail label="Standard fee" value={`$${String(data.profile.standardFee)}`} />
              </dl>
            </div>

            <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
              <h3 className="font-display text-ink-950 text-lg font-semibold">Next assignments</h3>
              <p className="text-ink-500 mt-3 text-sm">No upcoming games assigned yet.</p>
              <Link
                href="/browse-leagues"
                className="bg-play-600 hover:bg-play-700 mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
              >
                Browse opportunities
              </Link>
            </div>
          </div>
        </>
      ) : (
        <div className="border-ink-300 shadow-soft rounded-2xl border border-dashed bg-white p-8 text-center">
          <div className="bg-ink-50 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl">
            <IconFlag className="text-ink-500 h-5 w-5" />
          </div>
          <h3 className="font-display text-ink-950 text-xl font-semibold">
            Complete your referee profile
          </h3>
          <p className="text-ink-500 mx-auto mb-5 mt-2 max-w-xl text-sm">
            Add certification level, rate, and availability so leagues can discover and assign you
            to games.
          </p>
          <Link
            href="/referee/profile"
            className="bg-play-600 hover:bg-play-700 inline-flex rounded-xl px-6 py-3 text-sm font-semibold text-white transition"
          >
            Set up profile
          </Link>
        </div>
      )}
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: string
  tone: string
  icon: JSX.Element
}) {
  return (
    <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
        <div className="text-ink-400 text-xs font-semibold uppercase tracking-[0.14em]">
          {label}
        </div>
      </div>
      <div className="font-display text-ink-950 text-xl font-bold">{value}</div>
    </div>
  )
}

function IconBadge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="m8 14-2 8 6-3 6 3-2-8" />
    </svg>
  )
}

function IconWhistle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="7" cy="14" r="4" />
      <path d="M11 14h5a4 4 0 0 0 0-8h-2" />
      <circle cx="16" cy="8" r="1" />
    </svg>
  )
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.2 18.2 21 12 17.7 5.8 21 7 14.2 2 9.3 8.9 8.3 12 2" />
    </svg>
  )
}

function IconCard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink-100 bg-ink-50 rounded-xl border p-4">
      <dt className="text-ink-400 text-xs uppercase tracking-[0.12em]">{label}</dt>
      <dd className="text-ink-900 mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}

function IconFlag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}
