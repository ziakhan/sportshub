import { prisma } from "@youthbasketballhub/db"
import { getPaymentConfig, onlineReady, offlineAvailable } from "@/lib/payments/config"
import { checkEligibility, type AgePolicyValue, type Eligibility } from "./eligibility"

/**
 * Registration viewer context — everything a signup form needs to render
 * honestly, computed in ONE place and shared by the web public pages, the
 * platform tryout page, and the mobile program-detail API (owner 2026-07-23:
 * per-kid eligibility + already-registered shown BEFORE the button is
 * pressed, and payment copy that reflects the club's actual rails).
 */

export type ProgramKind = "tryout" | "camp" | "house-league" | "training"

export interface RegistrationKid {
  id: string
  firstName: string
  lastName: string
  birthYear: number
  eligibility: Eligibility
  alreadyRegistered: boolean
}

export interface RegistrationPayment {
  /** Club has a live online rail (Stripe ready). */
  online: boolean
  /** Offline methods the club accepts (empty = none configured). */
  offlineMethods: string[]
}

export interface RegistrationViewer {
  kids: RegistrationKid[]
  payment: RegistrationPayment
}

const SIGNUP_LOOKUP: Record<ProgramKind, (programId: string, playerIds: string[]) => Promise<string[]>> = {
  tryout: async (programId, playerIds) =>
    (
      await (prisma as any).tryoutSignup.findMany({
        where: { tryoutId: programId, playerId: { in: playerIds }, status: { not: "CANCELLED" } },
        select: { playerId: true },
      })
    ).map((s: any) => s.playerId),
  camp: async (programId, playerIds) =>
    (
      await (prisma as any).campSignup.findMany({
        where: { campId: programId, playerId: { in: playerIds }, status: { not: "CANCELLED" } },
        select: { playerId: true },
      })
    ).map((s: any) => s.playerId),
  "house-league": async (programId, playerIds) =>
    (
      await (prisma as any).houseLeagueSignup.findMany({
        where: { houseLeagueId: programId, playerId: { in: playerIds }, status: { not: "CANCELLED" } },
        select: { playerId: true },
      })
    ).map((s: any) => s.playerId),
  training: async (programId, playerIds) =>
    (
      await (prisma as any).trainingSessionSignup.findMany({
        where: { sessionId: programId, playerId: { in: playerIds }, status: { not: "CANCELLED" } },
        select: { playerId: true },
      })
    ).map((s: any) => s.playerId),
}

export async function getRegistrationViewer(opts: {
  userId: string | null
  kind: ProgramKind
  programId: string
  tenantId: string
  ageGroup: string | null
  agePolicy: AgePolicyValue
  gender?: string | null
}): Promise<RegistrationViewer> {
  const config = await getPaymentConfig({ tenantId: opts.tenantId })
  const payment: RegistrationPayment = {
    online: onlineReady(config),
    offlineMethods: offlineAvailable(config) ? config.offlineMethods : [],
  }

  if (!opts.userId) return { kids: [], payment }

  const players = await prisma.player.findMany({
    where: { parentId: opts.userId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, gender: true },
    orderBy: { firstName: "asc" },
  })
  if (players.length === 0) return { kids: [], payment }

  const registered = new Set(
    await SIGNUP_LOOKUP[opts.kind](
      opts.programId,
      players.map((p) => p.id)
    )
  )

  const kids: RegistrationKid[] = players.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    birthYear: new Date(p.dateOfBirth).getFullYear(),
    eligibility: checkEligibility({
      dateOfBirth: p.dateOfBirth,
      gender: p.gender,
      program: { ageGroup: opts.ageGroup, agePolicy: opts.agePolicy, gender: opts.gender ?? null },
    }),
    alreadyRegistered: registered.has(p.id),
  }))

  return { kids, payment }
}
