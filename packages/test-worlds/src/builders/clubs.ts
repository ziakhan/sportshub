import { prisma } from "@youthbasketballhub/db"
import { type WorldContext } from "../context"
import { teamName } from "../rng"
import { createUser, type BuiltUser } from "./users"

export interface TeamSpec {
  ageGroup?: string
  gender?: "MALE" | "FEMALE" | "COED"
  season?: string
  headCoach?: boolean
}

export interface BuiltTeam {
  id: string
  name: string
  ageGroup: string
  headCoach?: BuiltUser
}

export interface BuiltClub {
  tenantId: string
  slug: string
  name: string
  owner: BuiltUser
  teams: BuiltTeam[]
}

export async function createClub(
  ctx: WorldContext,
  opts: {
    owner?: BuiltUser
    status?: "ACTIVE" | "UNCLAIMED" | "SUSPENDED"
    contactEmail?: string | null
    teams?: TeamSpec[]
  } = {}
): Promise<BuiltClub> {
  const owner = opts.owner ?? (await createUser(ctx, { localPart: "owner" }))
  const name = ctx.name(teamName(ctx.rng) + " Basketball Club")
  const tenant = await prisma.tenant.create({
    data: {
      slug: ctx.slug("club"),
      name,
      status: (opts.status ?? "ACTIVE") as any,
      contactEmail: opts.contactEmail === undefined ? owner.email : opts.contactEmail,
      timezone: "America/Toronto",
      country: "CA",
      currency: "CAD",
      branding: { create: {} },
      features: { create: {} },
    },
  })
  if ((opts.status ?? "ACTIVE") === "ACTIVE") {
    await prisma.userRole.create({
      data: { userId: owner.id, role: "ClubOwner", tenantId: tenant.id },
    })
  }

  const teams: BuiltTeam[] = []
  for (const spec of opts.teams ?? []) {
    const team = await prisma.team.create({
      data: {
        tenantId: tenant.id,
        // Counter suffix: rng names have only 100 combos, and
        // Team(tenantId, name, ageGroup, season) is a natural key.
        name: ctx.name(`${teamName(ctx.rng)} ${ctx.next()}`),
        ageGroup: spec.ageGroup ?? "U12",
        gender: (spec.gender ?? "MALE") as any,
        season: spec.season ?? "Test Season",
      },
    })
    let headCoach: BuiltUser | undefined
    if (spec.headCoach) {
      headCoach = await createUser(ctx, { localPart: "coach" })
      // Product invariant (discovered in phase 5): tenant-level role first,
      // then the team-scoped role with designation.
      await prisma.userRole.create({
        data: { userId: headCoach.id, role: "Staff", tenantId: tenant.id },
      })
      await prisma.userRole.create({
        data: {
          userId: headCoach.id,
          role: "Staff",
          tenantId: tenant.id,
          teamId: team.id,
          designation: "HeadCoach" as any,
        },
      })
    }
    teams.push({ id: team.id, name: team.name, ageGroup: team.ageGroup, headCoach })
  }

  return { tenantId: tenant.id, slug: tenant.slug, name, owner, teams }
}
