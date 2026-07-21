// Manual per-player waiver reminder (owner 2026-07-20): no hard block on game
// day — instead staff tap an unsigned player on a roster and the family gets a
// push + email with a fresh signing link RIGHT NOW. Deliberate staff action,
// so unlike the cron there is no send-once ledger.

import { prisma } from "@youthbasketballhub/db"
import { notifySafe } from "@/lib/notifications"
import { sendWaiverSignEmail, appBaseUrl } from "@/lib/email"
import { mintWaiverSignRequest } from "@/lib/waivers/tokens"

export interface ManualReminderResult {
  sent: number
  waiverTitles: string[]
  reason?: "no_parent_email" | "nothing_outstanding"
}

/**
 * Send push + email signing links to the player's family for every
 * outstanding required waiver in ONE context: a league season (seasonId) or
 * a club (tenantId).
 */
export async function sendManualWaiverReminder(opts: {
  playerId: string
  seasonId?: string
  tenantId?: string
}): Promise<ManualReminderResult> {
  const player = await (prisma as any).player.findFirst({
    where: { id: opts.playerId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parent: { select: { id: true, email: true, firstName: true } },
    },
  })
  if (!player) return { sent: 0, waiverTitles: [] }

  let waivers: { id: string; title: string; version: number }[] = []
  let orgName = "SportsHub"
  let seasonLabel: string | null = null
  let seasonId: string | null = null

  if (opts.seasonId) {
    const season = await (prisma as any).season.findUnique({
      where: { id: opts.seasonId },
      select: { id: true, label: true, leagueId: true, league: { select: { name: true } } },
    })
    if (!season) return { sent: 0, waiverTitles: [] }
    orgName = season.league.name
    seasonLabel = season.label
    seasonId = season.id
    waivers = await (prisma as any).waiverDocument.findMany({
      where: { leagueId: season.leagueId, active: true, required: true },
      select: { id: true, title: true, version: true },
    })
  } else if (opts.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: opts.tenantId },
      select: { name: true },
    })
    if (!tenant) return { sent: 0, waiverTitles: [] }
    orgName = tenant.name
    waivers = await (prisma as any).waiverDocument.findMany({
      where: { tenantId: opts.tenantId, active: true, required: true },
      select: { id: true, title: true, version: true },
    })
  }
  if (waivers.length === 0) return { sent: 0, waiverTitles: [], reason: "nothing_outstanding" }

  const signatures = await (prisma as any).waiverSignature.findMany({
    where: {
      playerId: player.id,
      waiverId: { in: waivers.map((w) => w.id) },
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    select: { waiverId: true, waiverVersion: true },
  })
  const signed = new Set(
    signatures
      .filter((s: any) => {
        const w = waivers.find((w) => w.id === s.waiverId)
        return w && s.waiverVersion === w.version
      })
      .map((s: any) => s.waiverId)
  )
  const outstanding = waivers.filter((w) => !signed.has(w.id))
  if (outstanding.length === 0) return { sent: 0, waiverTitles: [], reason: "nothing_outstanding" }
  if (!player.parent?.email) {
    return { sent: 0, waiverTitles: outstanding.map((w) => w.title), reason: "no_parent_email" }
  }

  const base = appBaseUrl()
  const playerName = `${player.firstName} ${player.lastName}`
  let sent = 0
  for (const waiver of outstanding) {
    const { token } = await mintWaiverSignRequest({
      waiverId: waiver.id,
      playerId: player.id,
      seasonId,
      emailedTo: player.parent.email,
    })
    await notifySafe({
      userId: player.parent.id,
      type: "waiver_reminder",
      title: "Signature needed to play",
      message: `${orgName}: ${playerName} still needs "${waiver.title}" signed. Tap to sign now, it takes a minute.`,
      link: `/waivers/sign/${encodeURIComponent(token)}`,
      referenceId: waiver.id,
      referenceType: "WaiverDocument",
    })
    try {
      await sendWaiverSignEmail({
        to: player.parent.email,
        parentName: player.parent.firstName ?? null,
        playerName,
        orgName,
        waiverTitle: waiver.title,
        seasonLabel,
        teamName: null,
        link: `${base}/waivers/sign/${encodeURIComponent(token)}`,
      })
    } catch (error) {
      console.error("Manual waiver reminder email failed:", player.parent.email, error)
    }
    sent++
  }
  return { sent, waiverTitles: outstanding.map((w) => w.title) }
}
