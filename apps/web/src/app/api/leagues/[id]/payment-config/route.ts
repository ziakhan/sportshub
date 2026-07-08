import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getPaymentConfig, getPlatformPaymentPolicy } from "@/lib/payments/config"

export const dynamic = "force-dynamic"

/**
 * Per-league payment configuration (payments v2 Stage H). League owner/
 * manager set offline + online mode within the platform allowlist; the
 * allowlist + fees stay platform-admin territory (unchanged here). Mirrors
 * the club config route keyed on leagueId.
 */
const fieldsSchema = z.object({
  offlineEnabled: z.boolean().optional(),
  offlineMethods: z.array(z.enum(["CASH", "ETRANSFER", "CHEQUE", "OTHER"])).optional(),
  onlineMode: z.enum(["NONE", "CONNECT_DIRECT", "PLATFORM_COLLECT"]).nullable().optional(),
})

async function leagueAccess(userId: string, leagueId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { ownerId: true },
  })
  if (league?.ownerId === userId) return true
  return !!(await prisma.userRole.findFirst({
    where: { userId, leagueId, role: { in: ["LeagueOwner", "LeagueManager"] } },
  }))
}

async function configPayload(leagueId: string) {
  const [config, policy, row] = await Promise.all([
    getPaymentConfig({ leagueId }),
    getPlatformPaymentPolicy(),
    prisma.paymentConfig.findUnique({ where: { leagueId } }),
  ])
  return {
    config,
    policy,
    overrides: row ? { onlineMode: row.onlineMode } : null,
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await leagueAccess(sessionInfo.userId, params.id, !!sessionInfo.isPlatformAdmin))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json(await configPayload(params.id))
  } catch (error) {
    console.error("Get league payment config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await leagueAccess(sessionInfo.userId, params.id, !!sessionInfo.isPlatformAdmin))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const data = fieldsSchema.parse(await request.json())
    await prisma.paymentConfig.upsert({
      where: { leagueId: params.id },
      create: { leagueId: params.id, ...data },
      update: data,
    })
    return NextResponse.json(await configPayload(params.id))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid settings" }, { status: 400 })
    }
    console.error("Patch league payment config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
