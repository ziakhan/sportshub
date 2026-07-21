// Waiver reminders (owner 2026-07-20): if a league's required waivers are
// still unsigned as the season approaches, the parent gets a bell + PUSH +
// email with a fresh signing link — once at 7 days out, once at 24 hours out.
// Runs from /api/cron/waiver-reminders daily; WaiverReminder rows make each
// (player, waiver, season, window) send-once, so a late-set startDate or a
// missed cron day never double-sends.

import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { sendWaiverSignEmail, appBaseUrl } from "@/lib/email"
import { mintWaiverSignRequest } from "@/lib/waivers/tokens"

const DAY_MS = 24 * 60 * 60 * 1000

export interface WaiverReminderResult {
  seasonsChecked: number
  sent: number
  skippedAlreadyReminded: number
  skippedNoParentEmail: number
}

export async function sendWaiverReminders(
  now: Date = new Date()
): Promise<WaiverReminderResult> {
  const result: WaiverReminderResult = {
    seasonsChecked: 0,
    sent: 0,
    skippedAlreadyReminded: 0,
    skippedNoParentEmail: 0,
  }

  // Seasons starting within the widest window. startDate is nullable and set
  // late in real life — the send-once ledger makes late arrivals safe.
  const seasons = await (prisma as any).season.findMany({
    where: {
      startDate: { gt: now, lte: new Date(now.getTime() + 7 * DAY_MS) },
      teamSubmissions: { some: { status: "APPROVED" } },
    },
    select: {
      id: true,
      label: true,
      startDate: true,
      leagueId: true,
      league: { select: { name: true } },
    },
  })

  for (const season of seasons) {
    const waivers = await (prisma as any).waiverDocument.findMany({
      where: { leagueId: season.leagueId, active: true, required: true },
      select: { id: true, title: true, version: true },
    })
    if (waivers.length === 0) continue
    result.seasonsChecked++

    // The narrowest applicable window wins; sending "24h" also marks "7d"
    // so a season first seen inside 24 hours gets exactly one reminder.
    const within24h = season.startDate.getTime() - now.getTime() <= DAY_MS
    const window = within24h ? "24h" : "7d"

    const submissions = await (prisma as any).teamSubmission.findMany({
      where: { seasonId: season.id, status: "APPROVED" },
      select: {
        team: { select: { name: true } },
        roster: {
          select: {
            players: {
              select: {
                player: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    deletedAt: true,
                    parent: { select: { id: true, email: true, firstName: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    const entries: { player: any; teamName: string }[] = []
    for (const s of submissions) {
      for (const rp of s.roster?.players ?? []) {
        if (rp.player && !rp.player.deletedAt) {
          entries.push({ player: rp.player, teamName: s.team.name })
        }
      }
    }
    if (entries.length === 0) continue

    const signatures = await (prisma as any).waiverSignature.findMany({
      where: {
        playerId: { in: entries.map((e) => e.player.id) },
        waiverId: { in: waivers.map((w: any) => w.id) },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { playerId: true, waiverId: true, waiverVersion: true },
    })
    const signed = new Set(
      signatures
        .filter((s: any) => {
          const w = waivers.find((w: any) => w.id === s.waiverId)
          return w && s.waiverVersion === w.version
        })
        .map((s: any) => `${s.waiverId}:${s.playerId}`)
    )

    const base = appBaseUrl()
    for (const { player, teamName } of entries) {
      for (const waiver of waivers) {
        if (signed.has(`${waiver.id}:${player.id}`)) continue
        if (!player.parent?.email) {
          result.skippedNoParentEmail++
          continue
        }

        // Send-once claim: creating the ledger row IS the lock. A unique
        // violation means another window/run already covered it.
        try {
          await (prisma as any).waiverReminder.create({
            data: {
              playerId: player.id,
              waiverId: waiver.id,
              seasonId: season.id,
              parentUserId: player.parent.id,
              window,
            },
          })
          if (window === "24h") {
            // Suppress a later out-of-order 7d send for the same ask
            await (prisma as any).waiverReminder
              .create({
                data: {
                  playerId: player.id,
                  waiverId: waiver.id,
                  seasonId: season.id,
                  parentUserId: player.parent.id,
                  window: "7d",
                },
              })
              .catch(() => undefined)
          }
        } catch {
          result.skippedAlreadyReminded++
          continue
        }

        const { token } = await mintWaiverSignRequest({
          waiverId: waiver.id,
          playerId: player.id,
          seasonId: season.id,
          emailedTo: player.parent.email,
        })
        const link = `${base}/waivers/sign/${encodeURIComponent(token)}`
        const playerName = `${player.firstName} ${player.lastName}`
        const whenText = window === "24h" ? "starts tomorrow" : "starts soon"

        await notifySafe({
          userId: player.parent.id,
          type: "waiver_reminder",
          title: window === "24h" ? "Sign before the first game" : "Waiver still unsigned",
          message: `${season.league.name} ${whenText}: ${playerName} can't play until you sign "${waiver.title}". Tap to sign, it takes a minute.`,
          link: `/waivers/sign/${encodeURIComponent(token)}`,
          referenceId: waiver.id,
          referenceType: "WaiverDocument",
        })

        try {
          await sendWaiverSignEmail({
            to: player.parent.email,
            parentName: player.parent.firstName ?? null,
            playerName,
            orgName: season.league.name,
            waiverTitle: waiver.title,
            seasonLabel: season.label,
            teamName,
            link,
          })
        } catch (error) {
          console.error("Waiver reminder email failed:", player.parent.email, error)
        }
        result.sent++
      }
    }
  }

  return result
}
