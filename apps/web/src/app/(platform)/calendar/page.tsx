import { redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { MyCalendar } from "./my-calendar"

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
