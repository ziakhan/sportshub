import { prisma } from "@youthbasketballhub/db"
import { type WorldContext, worldPasswordHash } from "../context"
import { personName, dobForAge } from "../rng"

export interface BuiltUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

export async function createUser(
  ctx: WorldContext,
  opts: {
    localPart?: string
    roles?: { role: string; tenantId?: string; teamId?: string; leagueId?: string }[]
    onboarded?: boolean
  } = {}
): Promise<BuiltUser> {
  const { firstName, lastName } = personName(ctx.rng)
  const user = await prisma.user.create({
    data: {
      email: ctx.email(opts.localPart ?? firstName.toLowerCase()),
      passwordHash: await worldPasswordHash(),
      firstName,
      lastName,
      status: "ACTIVE",
      onboardedAt: opts.onboarded === false ? null : new Date(),
    },
  })
  for (const r of opts.roles ?? []) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: r.role as any,
        tenantId: r.tenantId ?? null,
        teamId: r.teamId ?? null,
        leagueId: r.leagueId ?? null,
      },
    })
  }
  return { id: user.id, email: user.email, firstName, lastName }
}

export interface BuiltPlayer {
  id: string
  firstName: string
  lastName: string
  age: number
}

/** A parent User plus N children (Player rows). Ages default 10–14. */
export async function createParentWithChildren(
  ctx: WorldContext,
  opts: { children: { age: number; gender?: "MALE" | "FEMALE" }[]; localPart?: string } = {
    children: [{ age: 12 }],
  }
): Promise<{ parent: BuiltUser; players: BuiltPlayer[] }> {
  const parent = await createUser(ctx, {
    localPart: opts.localPart ?? "parent",
    roles: [{ role: "Parent" }],
  })
  const players: BuiltPlayer[] = []
  for (const child of opts.children) {
    const { firstName, lastName } = personName(ctx.rng)
    const isMinor = child.age < 13
    const player = await prisma.player.create({
      data: {
        firstName,
        lastName,
        dateOfBirth: dobForAge(child.age),
        gender: (child.gender ?? "MALE") as any,
        parentId: parent.id,
        isMinor,
        canLogin: !isMinor,
        parentalConsentGiven: isMinor ? true : null,
        consentGivenAt: isMinor ? new Date() : null,
      },
    })
    players.push({ id: player.id, firstName, lastName, age: child.age })
  }
  return { parent, players }
}
