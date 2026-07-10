// Computed re-engagement audiences (docs/season-continuity-plan.md §4).
//
// Audiences are DERIVED from engagement data — never manual lists. Resolution
// here only builds candidate userId lists; marketing consent is enforced
// per-recipient at SEND time (lib/comms/consent.ts hasMarketingConsent), so
// nothing in this file is a compliance gate.
//
// Kinds:
//   TENANT   team:{teamId}          — roster families (ACTIVE + INACTIVE;
//                                     archived teams valid — that IS the
//                                     re-engagement case)
//            camp:{campId}          — past registrants (registering parent)
//            houseleague:{hlId}     — past registrants
//            tryout:{tryoutId}      — past registrants
//            all-engaged            — union of all the above across the club
//                                     + parents with any offer at the club
//   LEAGUE   past-clubs             — ClubOwners/Managers of every tenant with
//                                     a TeamSubmission in ANY season of the
//                                     league (owner decision: no team staff)
//   PLATFORM all-users              — all non-deleted users

import { prisma } from "@youthbasketballhub/db"
import type { ConsentScope } from "./consent"

export interface AudienceOption {
  kind: string
  label: string
  recipientCount: number
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

// ---------------------------------------------------------------------------
// Authorization — who may compose/send for an org. Shared by both comms API
// routes so the audiences endpoint and the send endpoint can never drift.
// ---------------------------------------------------------------------------

export async function canSendOrgComms(
  scope: ConsentScope,
  orgId: string | null,
  userId: string,
  isPlatformAdmin: boolean
): Promise<boolean> {
  if (isPlatformAdmin) return true
  if (scope === "PLATFORM") return false // PlatformAdmin only

  if (scope === "TENANT") {
    if (!orgId) return false
    const role = await prisma.userRole.findFirst({
      where: { userId, tenantId: orgId, role: { in: ["ClubOwner", "ClubManager"] } },
      select: { id: true },
    })
    return !!role
  }

  // LEAGUE — the league owner, or a league-scoped LeagueOwner/LeagueManager.
  if (!orgId) return false
  const league = await prisma.league.findUnique({
    where: { id: orgId },
    select: { ownerId: true },
  })
  if (!league) return false
  if (league.ownerId === userId) return true
  const role = await prisma.userRole.findFirst({
    where: { userId, leagueId: orgId, role: { in: ["LeagueOwner", "LeagueManager"] } },
    select: { id: true },
  })
  return !!role
}

// ---------------------------------------------------------------------------
// Per-kind resolvers → distinct userId[]
// ---------------------------------------------------------------------------

/** Distinct parents of a team's roster (ACTIVE + INACTIVE — past-season
 *  families are exactly who re-engagement targets). */
async function teamFamilies(teamId: string): Promise<string[]> {
  const rows = await prisma.teamPlayer.findMany({
    where: { teamId, status: { in: ["ACTIVE", "INACTIVE"] } },
    select: { player: { select: { parentId: true } } },
  })
  return unique(rows.map((r: any) => r.player.parentId))
}

/** Distinct registering parents of a camp (any signup status — they engaged). */
async function campRegistrants(campId: string): Promise<string[]> {
  const rows = await prisma.campSignup.findMany({
    where: { campId },
    select: { userId: true },
  })
  return unique(rows.map((r: any) => r.userId))
}

async function houseLeagueRegistrants(houseLeagueId: string): Promise<string[]> {
  const rows = await prisma.houseLeagueSignup.findMany({
    where: { houseLeagueId },
    select: { userId: true },
  })
  return unique(rows.map((r: any) => r.userId))
}

async function tryoutRegistrants(tryoutId: string): Promise<string[]> {
  const rows = await prisma.tryoutSignup.findMany({
    where: { tryoutId },
    select: { userId: true },
  })
  return unique(rows.map((r: any) => r.userId))
}

/** Everyone who ever engaged with the club: roster families + camp/HL/tryout
 *  registrants + parents holding any offer at the tenant. */
async function allEngagedAtTenant(tenantId: string): Promise<string[]> {
  const [rosters, camps, houseLeagues, tryouts, offers] = await Promise.all([
    prisma.teamPlayer.findMany({
      where: { team: { tenantId }, status: { in: ["ACTIVE", "INACTIVE"] } },
      select: { player: { select: { parentId: true } } },
    }),
    prisma.campSignup.findMany({
      where: { camp: { tenantId } },
      select: { userId: true },
    }),
    prisma.houseLeagueSignup.findMany({
      where: { houseLeague: { tenantId } },
      select: { userId: true },
    }),
    prisma.tryoutSignup.findMany({
      where: { tryout: { tenantId } },
      select: { userId: true },
    }),
    prisma.offer.findMany({
      where: { team: { tenantId } },
      select: { player: { select: { parentId: true } } },
    }),
  ])
  return unique([
    ...rosters.map((r: any) => r.player.parentId),
    ...camps.map((r: any) => r.userId),
    ...houseLeagues.map((r: any) => r.userId),
    ...tryouts.map((r: any) => r.userId),
    ...offers.map((r: any) => r.player.parentId),
  ])
}

/** ClubOwners/Managers of every tenant that submitted a team to ANY season of
 *  the league. Org-to-org — owner decision 2026-07-09: no team staff. */
async function leaguePastClubs(leagueId: string): Promise<string[]> {
  const submissions = await prisma.teamSubmission.findMany({
    where: { season: { leagueId } },
    select: { team: { select: { tenantId: true } } },
  })
  const tenantIds = unique(submissions.map((s: any) => s.team.tenantId))
  if (tenantIds.length === 0) return []
  const roles = await prisma.userRole.findMany({
    where: { tenantId: { in: tenantIds }, role: { in: ["ClubOwner", "ClubManager"] } },
    select: { userId: true },
  })
  return unique(roles.map((r: any) => r.userId))
}

async function allPlatformUsers(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true },
  })
  return users.map((u: any) => u.id)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an audience kind to candidate userIds. Returns null for an unknown
 * kind or an entity that does not belong to the org (so a caller can never
 * blast another club's team by guessing ids).
 */
export async function resolveAudience(
  scope: ConsentScope,
  orgId: string | null,
  kind: string
): Promise<string[] | null> {
  if (scope === "PLATFORM") {
    return kind === "all-users" ? allPlatformUsers() : null
  }

  if (scope === "LEAGUE") {
    if (!orgId) return null
    return kind === "past-clubs" ? leaguePastClubs(orgId) : null
  }

  // TENANT
  if (!orgId) return null
  if (kind === "all-engaged") return allEngagedAtTenant(orgId)

  const [prefix, entityId] = kind.split(":")
  if (!entityId) return null

  switch (prefix) {
    case "team": {
      const team = await prisma.team.findFirst({
        where: { id: entityId, tenantId: orgId },
        select: { id: true },
      })
      return team ? teamFamilies(entityId) : null
    }
    case "camp": {
      const camp = await prisma.camp.findFirst({
        where: { id: entityId, tenantId: orgId },
        select: { id: true },
      })
      return camp ? campRegistrants(entityId) : null
    }
    case "houseleague": {
      const hl = await prisma.houseLeague.findFirst({
        where: { id: entityId, tenantId: orgId },
        select: { id: true },
      })
      return hl ? houseLeagueRegistrants(entityId) : null
    }
    case "tryout": {
      const tryout = await prisma.tryout.findFirst({
        where: { id: entityId, tenantId: orgId },
        select: { id: true },
      })
      return tryout ? tryoutRegistrants(entityId) : null
    }
    default:
      return null
  }
}

/** All audience options for an org's composer, with live recipient counts. */
export async function listAudiences(
  scope: ConsentScope,
  orgId: string | null
): Promise<AudienceOption[]> {
  if (scope === "PLATFORM") {
    const ids = await allPlatformUsers()
    return [{ kind: "all-users", label: `All platform users (${ids.length})`, recipientCount: ids.length }]
  }

  if (scope === "LEAGUE") {
    if (!orgId) return []
    const ids = await leaguePastClubs(orgId)
    return [
      {
        kind: "past-clubs",
        label: `Clubs from past seasons (${ids.length})`,
        recipientCount: ids.length,
      },
    ]
  }

  // TENANT — one option per team / camp / house league / tryout + the union.
  if (!orgId) return []
  const [teams, camps, houseLeagues, tryouts] = await Promise.all([
    prisma.team.findMany({
      where: { tenantId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.camp.findMany({
      where: { tenantId: orgId },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.houseLeague.findMany({
      where: { tenantId: orgId },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.tryout.findMany({
      where: { tenantId: orgId },
      select: { id: true, title: true },
      orderBy: { scheduledAt: "desc" },
    }),
  ])

  const options: AudienceOption[] = []

  const [teamCounts, campCounts, hlCounts, tryoutCounts, everyone] = await Promise.all([
    Promise.all(teams.map((t: any) => teamFamilies(t.id))),
    Promise.all(camps.map((c: any) => campRegistrants(c.id))),
    Promise.all(houseLeagues.map((h: any) => houseLeagueRegistrants(h.id))),
    Promise.all(tryouts.map((t: any) => tryoutRegistrants(t.id))),
    allEngagedAtTenant(orgId),
  ])

  teams.forEach((t: any, i: number) => {
    const n = teamCounts[i].length
    options.push({ kind: `team:${t.id}`, label: `Team — ${t.name} families (${n})`, recipientCount: n })
  })
  camps.forEach((c: any, i: number) => {
    const n = campCounts[i].length
    options.push({ kind: `camp:${c.id}`, label: `Camp — ${c.name} registrants (${n})`, recipientCount: n })
  })
  houseLeagues.forEach((h: any, i: number) => {
    const n = hlCounts[i].length
    options.push({
      kind: `houseleague:${h.id}`,
      label: `House league — ${h.name} registrants (${n})`,
      recipientCount: n,
    })
  })
  tryouts.forEach((t: any, i: number) => {
    const n = tryoutCounts[i].length
    options.push({
      kind: `tryout:${t.id}`,
      label: `Tryout — ${t.title} registrants (${n})`,
      recipientCount: n,
    })
  })
  options.push({
    kind: "all-engaged",
    label: `Everyone engaged with the club (${everyone.length})`,
    recipientCount: everyone.length,
  })

  return options
}
