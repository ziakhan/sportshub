import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"

/**
 * SHIFT ASSIGNMENT, SHARED BY BOTH ENDS OF THE BOOKING (QA T-013).
 *
 * A referee accepting a shift and a league publishing its schedule are the two
 * moments a shift and its games meet, and they used to disagree: accept
 * assigned whatever games existed that day, drafts included (games the
 * referee could not see anywhere), and publish never looked at shifts at all,
 * so games published after an accept were never attached. Both routes read
 * THIS module now, so the window arithmetic and the role write can never
 * drift apart again.
 */

/**
 * Is this game inside the shift window? The local wall clock reading the
 * accept flow has always used: a shift is "09:00-18:00" on the session day,
 * and a game at 18:00 sharp is still the shift's.
 */
export function inShiftWindow(
  scheduledAt: Date | string,
  startTime: string,
  endTime: string
): boolean {
  const hhmm = new Date(scheduledAt).toTimeString().slice(0, 5)
  return hhmm >= startTime && hhmm <= endTime
}

/**
 * Put one referee on these games, skipping any they already hold. Returns how
 * many were newly assigned.
 */
export async function assignRefereeToGames(userId: string, gameIds: string[]): Promise<number> {
  let assigned = 0
  for (const gameId of gameIds) {
    const exists = await prisma.userRole.findFirst({
      where: { userId, role: "Referee", gameId },
      select: { id: true },
    })
    if (!exists) {
      await prisma.userRole.create({ data: { userId, role: "Referee", gameId } })
      assigned++
    }
  }
  return assigned
}

/**
 * THE PUBLISH SIDE OF THE RECONCILE (QA T-013b). These games were drafts a
 * moment ago and have just been stamped published. Any ACCEPTED shift on
 * their session days whose window covers them gets its referee attached, and
 * the referee hears their schedule grew, so accept-before-publish no longer
 * yields a permanently empty shift.
 *
 * Notification is best effort (notifySafe): a bell that fails must not fail
 * the publish.
 */
export async function attachAcceptedShiftsToPublishedGames(
  games: Array<{ id: string; dayId: string | null; scheduledAt: Date | string }>
): Promise<void> {
  const withDay = games.filter((g): g is { id: string; dayId: string; scheduledAt: Date | string } =>
    Boolean(g.dayId)
  )
  const dayIds = [...new Set(withDay.map((g) => g.dayId))]
  if (dayIds.length === 0) return

  const shifts = (await prisma.refereeSessionRequest.findMany({
    where: { sessionDayId: { in: dayIds }, status: "ACCEPTED", acceptedById: { not: null } },
    select: {
      id: true,
      sessionDayId: true,
      acceptedById: true,
      startTime: true,
      endTime: true,
      league: { select: { name: true } },
      sessionDay: { select: { date: true } },
    },
  })) as any[]

  for (const shift of shifts) {
    if (!shift.acceptedById) continue
    const inWindow = withDay.filter(
      (g) =>
        g.dayId === shift.sessionDayId && inShiftWindow(g.scheduledAt, shift.startTime, shift.endTime)
    )
    if (inWindow.length === 0) continue
    const added = await assignRefereeToGames(
      shift.acceptedById,
      inWindow.map((g) => g.id)
    )
    if (added === 0) continue
    await notifySafe({
      userId: shift.acceptedById,
      type: "referee_shift_games_added",
      title: "Games added to your shift",
      message: `${shift.league.name}: ${added} game${added !== 1 ? "s" : ""} on ${new Date(
        shift.sessionDay.date
      ).toLocaleDateString()} ${added !== 1 ? "are" : "is"} now on your schedule. See My games.`,
      // The referee's own schedule (QA T-012) — not the generic calendar.
      link: "/referee",
      referenceId: shift.id,
      referenceType: "RefereeSessionRequest",
    })
  }
}
