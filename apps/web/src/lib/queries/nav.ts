import { prisma } from "@youthbasketballhub/db"
import { cache } from "./request-cache"
import { getViewerScope } from "@/lib/privacy/participants"
import { isTestWorldSlug } from "@/lib/demo-data"

/**
 * Personalized public-nav data (docs/site-ia-plan.md §5.3, ESPN model):
 * the viewer's leagues/clubs (participation via kids' teams + roles, plus
 * explicit follows) surface FIRST in the header dropdowns; a short list of
 * other active entities follows; the directory pages stay for browse-all.
 * Personalization reorders — it never hides.
 */

export interface NavEntry {
  id: string
  name: string
  href: string
}

export interface PublicNavData {
  myLeagues: NavEntry[]
  otherLeagues: NavEntry[]
  myClubs: NavEntry[]
  otherClubs: NavEntry[]
  /** Holds an operator role → public header shows the Manage door. */
  isOperator: boolean
  /** Parent/player household → public header shows the My Hub door. */
  isFamily: boolean
}

/** Roles whose day-to-day home is the MANAGE world (site-ia-plan §7–§8). */
export const OPERATOR_ROLES = new Set([
  "ClubOwner",
  "ClubManager",
  "Staff",
  "TeamManager",
  "LeagueOwner",
  "LeagueManager",
  "Referee",
  "Scorekeeper",
  "PlatformAdmin",
])

const MAX_MY = 5
const MAX_OTHER = 6

export const getPublicNav = cache(async (userId: string | null): Promise<PublicNavData> => {
  const [scope, roles, follows] = await Promise.all([
    getViewerScope(userId),
    userId
      ? prisma.userRole.findMany({ where: { userId }, select: { role: true } })
      : Promise.resolve([]),
    userId
      ? (prisma as any).follow.findMany({
          where: { userId },
          select: { leagueId: true, tenantId: true },
        })
      : Promise.resolve([]),
  ])

  const myLeagueIds = new Set<string>(scope.leagueIds)
  const myClubIds = new Set<string>(scope.tenantIds)
  for (const f of follows) {
    if (f.leagueId) myLeagueIds.add(f.leagueId)
    if (f.tenantId) myClubIds.add(f.tenantId)
  }

  // Leagues — hub link goes to the latest season (N2 will canonicalize URLs)
  const leagues = await (prisma as any).league.findMany({
    where: { seasons: { some: {} } },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      seasons: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 24,
  })
  const leagueEntries: Array<NavEntry & { mine: boolean }> = leagues
    .filter((l: any) => l.seasons.length > 0)
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      href: `/league/${l.seasons[0].id}`,
      mine: myLeagueIds.has(l.id),
    }))
  const myLeagues = leagueEntries.filter((l) => l.mine).slice(0, MAX_MY)
  const otherLeagues = leagueEntries.filter((l) => !l.mine).slice(0, MAX_OTHER)

  // Clubs — mine by id; others = most active public clubs
  const myClubs: NavEntry[] =
    myClubIds.size > 0
      ? (
          await (prisma as any).tenant.findMany({
            where: { id: { in: [...myClubIds] }, status: { in: ["ACTIVE", "UNCLAIMED"] } },
            select: { id: true, name: true, slug: true },
            take: MAX_MY,
          })
        ).map((t: any) => ({ id: t.id, name: t.name, href: `/club/${t.slug}` }))
      : []
  const otherClubs: NavEntry[] = (
    await (prisma as any).tenant.findMany({
      where: { status: { in: ["ACTIVE", "UNCLAIMED"] }, id: { notIn: [...myClubIds] } },
      select: { id: true, name: true, slug: true },
      orderBy: { teams: { _count: "desc" } },
      take: 40,
    })
  )
    .filter((t: any) => !isTestWorldSlug(t.slug))
    .slice(0, MAX_OTHER)
    .map((t: any) => ({ id: t.id, name: t.name, href: `/club/${t.slug}` }))

  return {
    myLeagues,
    otherLeagues,
    myClubs,
    otherClubs,
    isOperator: roles.some((r: any) => OPERATOR_ROLES.has(r.role)),
    // Parent/Player role, or simply having kids on file (roles accrue from
    // actions, so a parent who only ever signed up a kid still counts)
    isFamily:
      roles.some((r: any) => r.role === "Parent" || r.role === "Player") ||
      scope.playerIds.size > 0,
  }
})
