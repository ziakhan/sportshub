import { prisma } from "@youthbasketballhub/db"
import { createWorldContext, type WorldContext } from "./context"
import { createClub, type BuiltClub, type TeamSpec } from "./builders/clubs"
import { createTryout, createOffer, type BuiltTryout } from "./builders/programs"
import { createParentWithChildren } from "./builders/users"
import { createLeague, type BuiltLeague, type SeasonSpec } from "./builders/leagues"

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
  /** League worlds: seasons with divisions, feeder teams, venue and sessions. */
  leagues?: { seasons?: SeasonSpec[] }[]
  /** Standalone parent+children (not tied to any club). */
  families?: { children: { age: number }[] }[]
}

export interface BuiltWorld {
  ctx: WorldContext
  clubs: (BuiltClub & { tryouts: BuiltTryout[] })[]
  leagues: BuiltLeague[]
}

export async function buildWorld(spec: WorldSpec = {}): Promise<BuiltWorld> {
  const ctx = createWorldContext(spec.seed ?? 1)
  // Self-heal: a previous run of this seed that died mid-build leaves rows
  // the deterministic namespace would collide with. Destroy is a no-op on a
  // clean namespace.
  await destroyWorld(ctx)
  const clubs: BuiltWorld["clubs"] = []
  const leagues: BuiltLeague[] = []

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

  for (const leagueSpec of spec.leagues ?? []) {
    leagues.push(await createLeague(ctx, { seasons: leagueSpec.seasons }))
  }

  for (const fam of spec.families ?? []) {
    await createParentWithChildren(ctx, fam)
  }

  return { ctx, clubs, leagues }
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
  const leagues = await prisma.league.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  })
  const leagueIds = leagues.map((l) => l.id)

  // Children first, parents last — mirrors the phase-runner cleanup pattern.
  // Games block team deletion (required FK, no cascade); events/stats cascade.
  await prisma.game.deleteMany({
    where: {
      OR: [
        { season: { leagueId: { in: leagueIds } } },
        { homeTeam: { tenantId: { in: tenantIds } } },
        { awayTeam: { tenantId: { in: tenantIds } } },
      ],
    },
  })
  // Before offers: invitations reference offers (offerId SetNull would also
  // work, but explicit beats implicit) and invitedById blocks user deletion.
  await prisma.playerInvitation.deleteMany({
    where: {
      OR: [
        { tenantId: { in: tenantIds } },
        { invitedById: { in: userIds } },
        { invitedUserId: { in: userIds } },
      ],
    },
  })
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
  // League cascade wipes seasons → divisions, submissions, rosters (and their
  // SeasonRosterPlayer rows, which would otherwise block player deletion),
  // sessions/days/day-venues, seasonVenues, scheduling groups.
  await prisma.league.deleteMany({ where: { id: { in: leagueIds } } })
  // World venues are global rows namespaced by display name; courts and
  // hours cascade. Must follow league deletion (day-venues reference venues).
  await prisma.venue.deleteMany({ where: { name: { startsWith: `[${ctx.runId}] ` } } })
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
