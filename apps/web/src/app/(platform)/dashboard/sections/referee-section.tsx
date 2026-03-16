import Link from "next/link"
import type { DashboardData } from "../get-dashboard-data"

interface RefereeSectionProps {
  data: NonNullable<DashboardData["referee"]>
}

export function RefereeSection({ data }: RefereeSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-2xl">🏁</span>
        <h2 className="text-xl font-bold text-gray-900">Referee Dashboard</h2>
      </div>

      {data.profile ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Profile
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Certification</span>
                <span className="font-medium text-gray-900">
                  {data.profile.certificationLevel || "Not set"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Standard Fee</span>
                <span className="font-medium text-gray-900">
                  ${String(data.profile.standardFee)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Games Refereed</span>
                <span className="font-medium text-gray-900">
                  {data.profile.gamesRefereed}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Rating</span>
                <span className="font-medium text-gray-900">
                  {data.profile.averageRating
                    ? `${data.profile.averageRating}/5`
                    : "No ratings yet"}
                </span>
              </div>
            </div>
            <Link
              href="/referee/profile"
              className="mt-4 inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Edit Profile &rarr;
            </Link>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Upcoming Games
            </h3>
            <p className="mt-3 text-sm text-gray-400">
              No upcoming games assigned.
            </p>
            <Link
              href="/referee/games"
              className="mt-4 inline-flex items-center text-sm font-medium text-orange-600 hover:text-orange-700"
            >
              Browse Available Games &rarr;
            </Link>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              Earnings
            </h3>
            <p className="mt-3 text-sm text-gray-400">
              Earnings tracking coming soon.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="mb-2 text-4xl">🏁</div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            Complete Your Referee Profile
          </h3>
          <p className="mb-4 text-gray-600">
            Set up your certification, availability, and rates to start getting
            booked for games.
          </p>
          <Link
            href="/referee/register"
            className="inline-block rounded-lg bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
          >
            Set Up Profile
          </Link>
        </div>
      )}
    </section>
  )
}
