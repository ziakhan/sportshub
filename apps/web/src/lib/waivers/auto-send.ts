// League waiver auto-send (owner's headline flow, 2026-07-20): when a team's
// submission to a league season is APPROVED, every parent on the submitted
// roster gets an email with a tokenized signing link for each of the league's
// required waivers. Skips players who already hold a valid signature of the
// current version, and players with a live (unconsumed, unexpired) request so
// repeated approvals never re-blast inboxes.

import { prisma } from "@youthbasketballhub/db"
import { sendWaiverSignEmail, appBaseUrl } from "@/lib/email"
import { hasLiveSignRequest, mintWaiverSignRequest } from "@/lib/waivers/tokens"

export interface WaiverSendResult {
  sent: number
  alreadySigned: number
  alreadyRequested: number
  noParentEmail: number
}

export async function sendWaiversForApprovedSubmission(
  submissionId: string
): Promise<WaiverSendResult> {
  const result: WaiverSendResult = {
    sent: 0,
    alreadySigned: 0,
    alreadyRequested: 0,
    noParentEmail: 0,
  }

  const submission = await (prisma as any).teamSubmission.findUnique({
    where: { id: submissionId },
    select: {
      seasonId: true,
      team: { select: { name: true } },
      season: {
        select: {
          id: true,
          label: true,
          leagueId: true,
          league: { select: { id: true, name: true } },
        },
      },
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
                  parent: {
                    select: { id: true, email: true, firstName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!submission?.roster || !submission.season) return result

  const waivers = await (prisma as any).waiverDocument.findMany({
    where: {
      leagueId: submission.season.leagueId,
      active: true,
      required: true,
    },
    select: { id: true, title: true, version: true },
  })
  if (waivers.length === 0) return result

  const players = submission.roster.players
    .map((rp: any) => rp.player)
    .filter((p: any) => p && !p.deletedAt)
  if (players.length === 0) return result

  // One query: every valid current-version signature for this player × waiver set
  const signatures = await (prisma as any).waiverSignature.findMany({
    where: {
      playerId: { in: players.map((p: any) => p.id) },
      waiverId: { in: waivers.map((w: any) => w.id) },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { playerId: true, waiverId: true, waiverVersion: true },
  })
  const signedKeys = new Set(
    signatures
      .filter((s: any) => {
        const w = waivers.find((w: any) => w.id === s.waiverId)
        return w && s.waiverVersion === w.version
      })
      .map((s: any) => `${s.waiverId}:${s.playerId}`)
  )

  const base = appBaseUrl()

  for (const player of players) {
    const parentEmail = player.parent?.email
    for (const waiver of waivers) {
      if (signedKeys.has(`${waiver.id}:${player.id}`)) {
        result.alreadySigned++
        continue
      }
      if (!parentEmail) {
        result.noParentEmail++
        continue
      }
      if (
        await hasLiveSignRequest({
          waiverId: waiver.id,
          playerId: player.id,
          seasonId: submission.season.id,
        })
      ) {
        result.alreadyRequested++
        continue
      }
      const { token } = await mintWaiverSignRequest({
        waiverId: waiver.id,
        playerId: player.id,
        seasonId: submission.season.id,
        emailedTo: parentEmail,
      })
      try {
        await sendWaiverSignEmail({
          to: parentEmail,
          parentName: player.parent?.firstName ?? null,
          playerName: `${player.firstName} ${player.lastName}`,
          orgName: submission.season.league.name,
          waiverTitle: waiver.title,
          seasonLabel: submission.season.label,
          teamName: submission.team.name,
          link: `${base}/waivers/sign/${encodeURIComponent(token)}`,
        })
        result.sent++
      } catch (error) {
        // Email failure must never fail (or roll back) an approval; the
        // request row stays and the league can re-send from the status page.
        console.error("Waiver email failed:", parentEmail, error)
      }
    }
  }

  return result
}
