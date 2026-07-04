import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { DEFAULT_PAYMENT_CONFIG, getPaymentConfig } from "@/lib/payments/config"

export const dynamic = "force-dynamic"

/**
 * Per-club payment configuration (docs/payments-design.md).
 * GET    — club roles or platform admin.
 * PATCH  — club owner/manager set their choices (offline toggle, methods,
 *          online mode) within the admin allowlist; ONLY the platform admin
 *          may change the allowlist and platform fees.
 */

const clubFieldsSchema = z.object({
  offlineEnabled: z.boolean().optional(),
  offlineMethods: z.array(z.enum(["CASH", "ETRANSFER", "CHEQUE", "OTHER"])).optional(),
  onlineMode: z.enum(["NONE", "CONNECT_DIRECT", "PLATFORM_COLLECT"]).optional(),
})

const adminFieldsSchema = z.object({
  offlineAllowed: z.boolean().optional(),
  connectAllowed: z.boolean().optional(),
  platformCollectAllowed: z.boolean().optional(),
  platformFeeBps: z.number().int().min(0).max(5000).optional(),
  platformFeeFlat: z.number().min(0).optional(),
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

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!tenant) return NextResponse.json({ error: "Club not found" }, { status: 404 })

    if (!(await clubAccess(sessionInfo.userId, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const config = await getPaymentConfig({ tenantId: params.id })
    return NextResponse.json({ config })
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

    // Validate merchant choices against the (possibly just-updated) allowlist
    const current = await getPaymentConfig({ tenantId: params.id })
    const effective = { ...current, ...adminData }
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
    const updated = await prisma.paymentConfig.upsert({
      where: { tenantId: params.id },
      create: { tenantId: params.id, ...DEFAULT_PAYMENT_CONFIG_CREATE, ...data },
      update: data,
    })

    return NextResponse.json({
      config: { ...updated, platformFeeFlat: Number(updated.platformFeeFlat) },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Update payment config error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create-shape defaults (DEFAULT_PAYMENT_CONFIG minus resolved-only fields)
const DEFAULT_PAYMENT_CONFIG_CREATE = {
  offlineAllowed: DEFAULT_PAYMENT_CONFIG.offlineAllowed,
  connectAllowed: DEFAULT_PAYMENT_CONFIG.connectAllowed,
  platformCollectAllowed: DEFAULT_PAYMENT_CONFIG.platformCollectAllowed,
  offlineEnabled: DEFAULT_PAYMENT_CONFIG.offlineEnabled,
  onlineMode: DEFAULT_PAYMENT_CONFIG.onlineMode,
  platformFeeBps: DEFAULT_PAYMENT_CONFIG.platformFeeBps,
  platformFeeFlat: DEFAULT_PAYMENT_CONFIG.platformFeeFlat,
}
