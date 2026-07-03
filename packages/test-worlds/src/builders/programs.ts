import { prisma } from "@youthbasketballhub/db"
import { type WorldContext } from "../context"
import { daysFromNow } from "../rng"
import { createParentWithChildren, type BuiltPlayer, type BuiltUser } from "./users"

export interface BuiltTryout {
  id: string
  title: string
  /** Parent+player pairs signed up (created on demand). */
  signups: { parent: BuiltUser; player: BuiltPlayer; signupId: string }[]
}

/**
 * A tryout with N signups. `signups: 3` against `capacity: 20` is the
 * canonical "not enough players" world (catalog F1).
 */
export async function createTryout(
  ctx: WorldContext,
  opts: {
    tenantId: string
    teamId?: string
    ageGroup?: string
    capacity?: number
    signups?: number
    published?: boolean
    daysAhead?: number
    fee?: number
  }
): Promise<BuiltTryout> {
  const tryout = await prisma.tryout.create({
    data: {
      tenantId: opts.tenantId,
      teamId: opts.teamId ?? null,
      title: ctx.name(`${opts.ageGroup ?? "U12"} Tryout`),
      ageGroup: opts.ageGroup ?? "U12",
      gender: "MALE",
      location: "Test Gym, 1 Court St",
      scheduledAt: daysFromNow(opts.daysAhead ?? 14),
      duration: 120,
      fee: opts.fee ?? 0,
      maxParticipants: opts.capacity ?? 20,
      isPublished: opts.published ?? true,
      isPublic: true,
    },
  })

  const signups: BuiltTryout["signups"] = []
  for (let i = 0; i < (opts.signups ?? 0); i++) {
    const { parent, players } = await createParentWithChildren(ctx, {
      children: [{ age: 11 + (i % 3) }],
    })
    const player = players[0]
    const signup = await prisma.tryoutSignup.create({
      data: {
        tryoutId: tryout.id,
        userId: parent.id,
        playerId: player.id,
        playerName: `${player.firstName} ${player.lastName}`,
        playerAge: player.age,
        playerGender: "MALE",
        status: "CONFIRMED",
      },
    })
    signups.push({ parent, player, signupId: signup.id })
  }

  return { id: tryout.id, title: tryout.title, signups }
}

export type OfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED"

export async function createOffer(
  ctx: WorldContext,
  opts: {
    teamId: string
    playerId: string
    tryoutSignupId?: string
    status?: OfferStatus
    expiresInDays?: number
    seasonFee?: number
    jerseyPrefs?: [number, number, number]
  }
): Promise<{ id: string }> {
  const status = opts.status ?? "PENDING"
  const prefs = opts.jerseyPrefs ?? [ctx.next() % 90 + 1, ctx.next() % 90 + 1, ctx.next() % 90 + 1]
  const offer = await prisma.offer.create({
    data: {
      teamId: opts.teamId,
      playerId: opts.playerId,
      tryoutSignupId: opts.tryoutSignupId ?? null,
      status: status as any,
      seasonFee: opts.seasonFee ?? 500,
      expiresAt: daysFromNow(status === "EXPIRED" ? -1 : (opts.expiresInDays ?? 7)),
      includesUniform: false,
      includesShoes: false,
      includesTracksuit: false,
      respondedAt: status === "ACCEPTED" || status === "DECLINED" ? new Date() : null,
      ...(status === "ACCEPTED" ? { jerseyPref1: prefs[0], jerseyPref2: prefs[1], jerseyPref3: prefs[2] } : {}),
    },
  })
  if (status === "ACCEPTED") {
    await prisma.teamPlayer.upsert({
      where: { teamId_playerId: { teamId: opts.teamId, playerId: opts.playerId } },
      create: { teamId: opts.teamId, playerId: opts.playerId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    })
  }
  return { id: offer.id }
}
