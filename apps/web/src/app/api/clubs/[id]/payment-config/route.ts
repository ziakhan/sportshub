import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getPaymentConfig, getPlatformPaymentPolicy } from "@/lib/payments/config"

export const dynamic = "force-dynamic"

/**
 * Per-club payment configuration (docs/payments-design.md).
 * GET    — club roles or platform admin. Returns the RESOLVED config plus the
 *          raw per-club overrides and the platform policy (so UIs can show
 *          which values are inherited vs overridden).
 * PATCH  — club owner/manager set their choices (offline toggle, methods,
 *          online mode) within the resolved allowlist; ONLY the platform
 *          admin may change the allowlist and platform fees. Admin fields are
 *          tri-state: true/false override the platform default, null inherits.
 */

const clubFieldsSchema = z.object({
  offlineEnabled: z.boolean().optional(),
  offlineMethods: z.array(z.enum(["CASH", "ETRANSFER", "CHEQUE", "OTHER"])).optional(),
  // null = follow the platform's default online mode
  onlineMode: z.enum(["NONE", "CONNECT_DIRECT", "PLATFORM_COLLECT"]).nullable().optional(),
})

const adminFieldsSchema = z.object({
  offlineAllowed: z.boolean().nullable().optional(),
  connectAllowed: z.boolean().nullable().optional(),
  platformCollectAllowed: z.boolean().nullable().optional(),
  platformFeeBps: z.number().int().min(0).max(5000).nullable().optional(),
  platformFeeFlat: z.number().min(0).nullable().optional(),
})

const ADMIN_FIELDS = Object.keys(adminFieldsSchema.shape)

async function clubAccess(userId: string, tenantId: string) {
  return prisma.userRole.findFirst({
    where: {
      userId,
      OR: [
        { tenantId, role: { in: ["ClubOwner", "ClubManager"] } },
        { role: "PlatformAdmin" },
      ],
    },
  })
}

async function isPlatformAdmin(userId: string) {
  return prisma.userRole.findFirst({ where: { userId, role: "PlatformAdmin" } })
}

async function configPayload(tenantId: string) {
  const [config, policy, row] = await Promise.all([
    getPaymentConfig({ tenantId }),
    getPlatformPaymentPolicy(),
    prisma.paymentConfig.findUnique({ where: { tenantId } }),
  ])
  return {
    config,
    policy,
    overrides: row
      ? {
          offlineAllowed: row.offlineAllowed,
          connectAllowed: row.connectAllowed,
          platformCollectAllowed: row.platformCollectAllowed,
          onlineMode: row.onlineMode,
          platformFeeBps: row.platformFeeBps,
          platformFeeFlat: row.platformFeeFlat === null ? null : Number(row.platformFeeFlat),
        }
      : null,
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })

    if (!(await clubAccess(sessionInfo.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(await configPayload(params.id))
  } catch (error) {
    console.error("Get payment config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = sessionInfo.userId

    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })

    if (!(await clubAccess(userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Allowlist + fee fields are platform-admin territory
    const touchesAdminFields = ADMIN_FIELDS.some((f) => f in body)
    const admin = await isPlatformAdmin(userId)
    if (touchesAdminFields && !admin) {
      return NextResponse.json(
        { error: "Only the platform admin can change the allowlist or platform fees" },
        { status: 403 }
      )
    }

    const clubData = clubFieldsSchema.parse(body)
    const adminData = touchesAdminFields ? adminFieldsSchema.parse(body) : {}

    // Validate merchant choices against the post-update effective allowlist
    const policy = await getPlatformPaymentPolicy()
    const current = await getPaymentConfig({ tenantId: params.id })
    const effective = {
      offlineAllowed:
        "offlineAllowed" in adminData
          ? adminData.offlineAllowed ?? policy.payOfflineAllowed
          : current.offlineAllowed,
      connectAllowed:
        "connectAllowed" in adminData
          ? adminData.connectAllowed ?? policy.payConnectAllowed
          : current.connectAllowed,
      platformCollectAllowed:
        "platformCollectAllowed" in adminData
          ? adminData.platformCollectAllowed ?? policy.payPlatformCollectAllowed
          : current.platformCollectAllowed,
    }
    if (clubData.offlineEnabled === true && !effective.offlineAllowed) {
      return NextResponse.json(
        { error: "Offline payments are not enabled for this club", code: "MODE_NOT_ALLOWED" },
        { status: 400 }
      )
    }
    if (
      (clubData.onlineMode === "CONNECT_DIRECT" && !effective.connectAllowed) ||
      (clubData.onlineMode === "PLATFORM_COLLECT" && !effective.platformCollectAllowed)
    ) {
      return NextResponse.json(
        { error: `${clubData.onlineMode} is not enabled for this club`, code: "MODE_NOT_ALLOWED" },
        { status: 400 }
      )
    }

    const data = { ...clubData, ...adminData }
    await prisma.paymentConfig.upsert({
      where: { tenantId: params.id },
      create: { tenantId: params.id, ...data },
      update: data,
    })

    return NextResponse.json(await configPayload(params.id))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Update payment config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
