import { prisma } from "@youthbasketballhub/db"
import { createWorldContext, type WorldContext } from "./context"
import { createClub, type BuiltClub, type TeamSpec } from "./builders/clubs"
import { createTryout, createOffer, type BuiltTryout } from "./builders/programs"
import { createParentWithChildren } from "./builders/users"

/**
 * buildWorld — one call, one reproducible universe.
 * destroyWorld — removes everything the runId touched, in FK order.
 */

export interface WorldSpec {
  seed?: number
  clubs?: {
    teams?: TeamSpec[]
    tryouts?: { teamIndex?: number; capacity?: number; signups?: number; published?: boolean }[]
    /** PENDING offers from team[0] to fresh parent+child pairs. */
    pendingOffers?: number
  }[]
  /** Standalone parent+children (not tied to any club). */
  families?: { children: { age: number }[] }[]
}

export interface BuiltWorld {
  ctx: WorldContext
  clubs: (BuiltClub & { tryouts: BuiltTryout[] })[]
}

export async function buildWorld(spec: WorldSpec = {}): Promise<BuiltWorld> {
  const ctx = createWorldContext(spec.seed ?? 1)
  const clubs: BuiltWorld["clubs"] = []

  for (const clubSpec of spec.clubs ?? []) {
    const club = await createClub(ctx, { teams: clubSpec.teams })
    const tryouts: BuiltTryout[] = []
    for (const t of clubSpec.tryouts ?? []) {
      tryouts.push(
        await createTryout(ctx, {
          tenantId: club.tenantId,
          teamId: t.teamIndex !== undefined ? club.teams[t.teamIndex]?.id : club.teams[0]?.id,
          capacity: t.capacity,
          signups: t.signups,
          published: t.published,
        })
      )
    }
    for (let i = 0; i < (clubSpec.pendingOffers ?? 0); i++) {
      const { players } = await createParentWithChildren(ctx, { children: [{ age: 12 }] })
      await createOffer(ctx, { teamId: club.teams[0].id, playerId: players[0].id })
    }
    clubs.push({ ...club, tryouts })
  }

  for (const fam of spec.families ?? []) {
    await createParentWithChildren(ctx, fam)
  }

  return { ctx, clubs }
}

/** Delete everything namespaced by this world's runId. FK-safe order. */
export async function destroyWorld(ctx: WorldContext): Promise<void> {
  const emailDomain = `${ctx.runId}.world`
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${emailDomain}` } },
    select: { id: true },
  })
  const userIds = users.map((u) => u.id)
  const tenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: `${ctx.runId}-` } },
    select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)

  // Children first, parents last — mirrors the phase-runner cleanup pattern.
  await prisma.offer.deleteMany({
    where: { OR: [{ player: { parentId: { in: userIds } } }, { team: { tenantId: { in: tenantIds } } }] },
  })
  await prisma.tryoutSignup.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { tryout: { tenantId: { in: tenantIds } } }] },
  })
  await prisma.teamPlayer.deleteMany({
    where: { OR: [{ player: { parentId: { in: userIds } } }, { team: { tenantId: { in: tenantIds } } }] },
  })
  await prisma.tryout.deleteMany({ where: { tenantId: { in: tenantIds } } })
  await prisma.player.deleteMany({ where: { parentId: { in: userIds } } })
  await prisma.offerTemplate.deleteMany({ where: { tenantId: { in: tenantIds } } })
  await prisma.staffInvitation.deleteMany({ where: { tenantId: { in: tenantIds } } })
  await prisma.userRole.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { tenantId: { in: tenantIds } }] },
  })
  await prisma.team.deleteMany({ where: { tenantId: { in: tenantIds } } })
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}
