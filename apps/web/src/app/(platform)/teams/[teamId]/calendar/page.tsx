import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUserId } from "@/lib/auth-helpers"
import { getChatMembership } from "@/lib/teams/chat-access"
import { TeamCalendar } from "./team-calendar"

/**
 * Team calendar — practices + games in one live agenda. Members see the
 * schedule and subscribe their phone's calendar; staff manage practice
 * days, announce the schedule, and move/cancel single practices (which
 * notifies everyone).
 */
export default async function TeamCalendarPage({ params }: { params: { teamId: string } }) {
  const auth = await getSessionUserId()
  if (!auth)
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/teams/${params.teamId}/calendar`)}`)

  const membership = await getChatMembership(params.teamId, auth.userId, auth.isPlatformAdmin)
  if (!membership) notFound()

  const isStaffSide = membership.role !== "family"

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-ink-900 truncate text-xl font-bold">{membership.teamName}</h2>
          <p className="text-ink-500 truncate text-sm">{membership.clubName} • Calendar</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/teams/${membership.teamId}/chat`}
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            Team Chat
          </Link>
          <Link
            href={
              isStaffSide
                ? `/clubs/${membership.tenantId}/teams/${membership.teamId}/dashboard`
                : `/team/${membership.teamId}`
            }
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-3 py-1.5 text-xs font-semibold"
          >
            {isStaffSide ? "Team Dashboard" : "Team Page"}
          </Link>
        </div>
      </div>

      <TeamCalendar teamId={membership.teamId} isStaff={isStaffSide} />
    </div>
  )
}
