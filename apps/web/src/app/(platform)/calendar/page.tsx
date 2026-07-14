import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import Link from "next/link"
import { MyCalendar } from "./my-calendar"
import { getNavShape } from "@/lib/queries/nav-shape"

export const dynamic = "force-dynamic"

/**
 * /calendar — My Calendar: one cross-team schedule for the signed-in user
 * (docs/roadmap/my-calendar-plan.md). Parents see every kid's team; 13+
 * players see their own; staff see the teams they run with who's-coming
 * roll-ups. RSVP inline everywhere.
 */
export default async function MyCalendarPage() {
  const auth = await getSessionUserId()
  if (!auth) redirect("/sign-in?callbackUrl=/calendar")

  // Role-aware purpose (owner ask 2026-07-14): the personal calendar means
  // something for participants, club staff (whole-club schedule) and league
  // owners (league games). Anyone else — e.g. a pure platform admin — gets
  // an explanation instead of team-flavored emptiness.
  const shape = await getNavShape(auth.userId)
  if (!shape.hasCalendar) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-ink-950 font-display text-2xl font-bold">No calendar yet</h1>
        <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm">
          Your calendar fills up when you&apos;re connected to teams — as a parent, a coach, a
          referee, a club, or a league. This account doesn&apos;t have any of those yet.
        </p>
        <Link
          href="/"
          className="bg-play-600 hover:bg-play-700 mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white transition"
        >
          Back to Home
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-ink-950 font-display text-2xl font-bold">My Calendar</h1>
        <p className="text-ink-500 mt-1 text-sm">
          Every game, practice and event across all your teams — answer Going or
          Can&apos;t go right here.
        </p>
      </div>
      <MyCalendar />
    </div>
  )
}
