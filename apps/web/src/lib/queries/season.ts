import { cache } from "./request-cache"
import { prisma } from "@youthbasketballhub/db"
import { applyEffectiveConfig } from "@/lib/org/season-defaults"

/**
 * Public season detail (league, divisions, team submissions, counts).
 * Shared by /api/seasons/[id] GET and the public /league/[id] page.
 * All Prisma Decimals are coerced to Number so the result is JSON-safe.
 */
export const getPublicSeason = cache(async (id: string): Promise<any | null> => {
  const season = await (prisma as any).season.findUnique({
    where: { id },
    include: {
      league: {
        select: {
          id: true,
          name: true,
          description: true,
          ownerId: true,
          perks: true,
          perksNote: true,
          // Additive (native league/season screen rebuild, 2026-07-25) — the
          // web page's branded hero fetches these via a second query; folding
          // them in here means the mobile route (the other caller) gets them
          // for free with no shape change for existing fields.
          logoUrl: true,
          bannerUrl: true,
          tagline: true,
          primaryColor: true,
          socials: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              bannerUrl: true,
              tagline: true,
              primaryColor: true,
              socials: true,
              seasonDefaults: true,
            },
          },
        },
      },
      divisions: { orderBy: { ageGroup: "asc" } },
      teamSubmissions: {
        include: {
          team: {
            select: {
              id: true,
              name: true,
              ageGroup: true,
              gender: true,
              tenant: { select: { id: true, name: true, slug: true } },
            },
          },
          division: { select: { id: true, name: true } },
        },
      },
      _count: { select: { teamSubmissions: true, games: true, sessions: true } },
    },
  })

  if (!season) return null

  // Operator inheritance (owner 2026-07-29): a league without its own
  // branding wears its Organization's — applied HERE so every consumer
  // (web hero, mobile route) inherits identically. League overrides win.
  const org = season.league?.organization ?? null
  // primaryColor has a schema DEFAULT (#1a73e8) so it is never null — the
  // default counts as "not set" for inheritance purposes.
  const LEAGUE_COLOR_DEFAULT = "#1a73e8"
  const ownColor =
    season.league?.primaryColor && season.league.primaryColor !== LEAGUE_COLOR_DEFAULT
      ? season.league.primaryColor
      : null
  const league = season.league
    ? {
        ...season.league,
        logoUrl: season.league.logoUrl ?? org?.logoUrl ?? null,
        bannerUrl: season.league.bannerUrl ?? org?.bannerUrl ?? null,
        tagline: season.league.tagline ?? org?.tagline ?? null,
        primaryColor: ownColor ?? org?.primaryColor ?? season.league.primaryColor,
        socials: season.league.socials ?? org?.socials ?? null,
        organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      }
    : season.league

  // Season-config inheritance (Phase A, same pattern as branding above):
  // resolve season → org seasonDefaults → system here, so EVERY consumer
  // (console, public page, mobile route) reads effective values with no
  // shape change. configSources says where each value came from — the
  // settings UI renders "Inherited from <org>" off it.
  const resolved = applyEffectiveConfig(
    { ...season, teamFee: season.teamFee ? Number(season.teamFee) : null },
    org?.seasonDefaults
  )

  return {
    ...resolved,
    league,
    teamSubmissions: await attachFeeProgress(season),
  }
})

/**
 * Fee progress per submission (owner 2026-07-29 deposit schedules): how much
 * of the entry fee has actually arrived, so badges can say "deposit paid"
 * instead of a flat lying "unpaid". Additive fields on each submission:
 * feeAmount, feePaid, feeOverdue.
 */
async function attachFeeProgress(season: any) {
  const ids = season.teamSubmissions.map((t: any) => t.id)
  const obligations = ids.length
    ? await (prisma as any).paymentObligation.findMany({
        where: { referenceType: "TeamSubmission", referenceId: { in: ids } },
        select: {
          referenceId: true,
          amount: true,
          status: true,
          dueDate: true,
          payments: { where: { status: "SUCCEEDED" }, select: { amount: true } },
        },
      })
    : []
  const byId = new Map(obligations.map((o: any) => [o.referenceId, o]))
  const now = Date.now()
  return season.teamSubmissions.map((t: any) => {
    const o: any = byId.get(t.id)
    const feePaid = o ? o.payments.reduce((a: number, pm: any) => a + Number(pm.amount), 0) : 0
    return {
      ...t,
      registrationFee: t.registrationFee ? Number(t.registrationFee) : null,
      feeAmount: o ? Number(o.amount) : null,
      feePaid,
      feeOverdue: !!(o && o.status !== "PAID" && o.dueDate && new Date(o.dueDate).getTime() < now),
    }
  })
}
