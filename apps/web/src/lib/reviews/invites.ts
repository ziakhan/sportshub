import { prisma } from "@youthbasketballhub/db"
import { notifyMany } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"

/**
 * Season-conclude review invites (owner 2026-07-18): when a season hits
 * COMPLETED, every participating family gets a time-boxed invitation to
 * review their club. Trigger policy = PlatformSettings.reviewInvitePolicy
 * (AUTO default) with a per-club Tenant.reviewInviteOverride the admin may
 * grant. Clubs get a heads-up either way — reviews are the marketplace's
 * credibility layer, so the platform, not the club, guarantees the ask.
 */

export async function sendSeasonReviewInvites(seasonId: string): Promise<{
  invited: number
  clubs: number
  skippedByPolicy: number
}> {
  const settings = await (prisma as any).platformSettings.findFirst({
    select: { reviewInvitePolicy: true, reviewWindowDays: true },
  })
  const defaultPolicy = settings?.reviewInvitePolicy ?? "AUTO"
  const windowDays = settings?.reviewWindowDays ?? 30

  const season = await (prisma as any).season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      label: true,
      league: { select: { id: true, name: true } },
      teamSubmissions: {
        where: { status: "APPROVED" },
        select: {
          team: {
            select: {
              id: true,
              tenantId: true,
              tenant: {
                select: { id: true, name: true, slug: true, reviewInviteOverride: true },
              },
              players: {
                where: { status: "ACTIVE" },
                select: { player: { select: { parentId: true } } },
              },
            },
          },
        },
      },
    },
  })
  if (!season) return { invited: 0, clubs: 0, skippedByPolicy: 0 }

  // Fold: tenant → parent userIds (deduped)
  const byTenant = new Map<
    string,
    { tenant: { id: string; name: string; slug: string | null }; parents: Set<string> }
  >()
  let skippedByPolicy = 0
  for (const sub of season.teamSubmissions) {
    const t = sub.team?.tenant
    if (!t) continue
    const policy = t.reviewInviteOverride ?? defaultPolicy
    if (policy === "OFF") {
      skippedByPolicy++
      continue
    }
    const bucket = byTenant.get(t.id) ?? { tenant: t, parents: new Set<string>() }
    for (const tp of sub.team.players) {
      if (tp.player?.parentId) bucket.parents.add(tp.player.parentId)
    }
    byTenant.set(t.id, bucket)
  }

  const expiresAt = new Date(Date.now() + windowDays * 24 * 3600_000)
  let invited = 0

  for (const { tenant, parents } of byTenant.values()) {
    if (parents.size === 0) continue
    const userIds = [...parents]
    await (prisma as any).reviewInvite.createMany({
      data: userIds.map((userId) => ({
        seasonId: season.id,
        tenantId: tenant.id,
        userId,
        expiresAt,
      })),
      skipDuplicates: true,
    })
    const reviewLink = tenant.slug ? `/club/${tenant.slug}?review=1` : `/clubs/find`
    await notifyMany(prisma, userIds, {
      type: "review_invite",
      title: `How was ${season.label} with ${tenant.name}?`,
      message: `The season has wrapped — share a review to help other families. Open for ${windowDays} days.`,
      link: reviewLink,
    })
    // Email (best-effort; the bell is the guaranteed channel)
    const users = await (prisma as any).user.findMany({
      where: { id: { in: userIds } },
      select: { email: true, firstName: true },
    })
    for (const u of users) {
      if (!u.email) continue
      sendEmail({
        to: u.email,
        subject: `How was ${season.label} with ${tenant.name}?`,
        html: `<p>Hi ${u.firstName ?? "there"},</p><p>${season.label} with <b>${tenant.name}</b> has wrapped up. Families like yours are how other parents find credible programs — would you leave a quick review?</p><p><a href="https://ysportshub.com${reviewLink}">Review ${tenant.name}</a> (open for ${windowDays} days)</p>`,
        text: `${season.label} with ${tenant.name} has wrapped. Review them (open ${windowDays} days): https://ysportshub.com${reviewLink}`,
      }).catch(() => {})
    }
    invited += userIds.length
  }

  // Heads-up to club owners/managers (no veto — informational)
  const tenantIds = [...byTenant.keys()]
  if (tenantIds.length > 0) {
    const owners = await (prisma as any).userRole.findMany({
      where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { userId: true },
      distinct: ["userId"],
    })
    await notifyMany(
      prisma,
      owners.map((o: { userId: string }) => o.userId),
      {
        type: "review_invite_heads_up",
        title: `Review invitations sent for ${season.label}`,
        message: `Families from the concluded season were invited to review your club. Reviews appear after moderation.`,
        link: `/clubs/find`,
      }
    )
  }
  return { invited, clubs: byTenant.size, skippedByPolicy }
}

/** A user may review this tenant only inside a live invite window. */
export async function hasLiveReviewInvite(userId: string, tenantId: string): Promise<boolean> {
  const invite = await (prisma as any).reviewInvite.findFirst({
    where: { userId, tenantId, expiresAt: { gte: new Date() } },
    select: { id: true },
  })
  return !!invite
}
