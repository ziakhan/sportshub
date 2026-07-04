import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { SUPPORTED_COUNTRIES } from "@/lib/countries"

export const dynamic = "force-dynamic"

const validCountryCodes = SUPPORTED_COUNTRIES.map((c) => c.code)

const updateSettingsSchema = z.object({
  enabledCountries: z
    .array(z.string().length(2))
    .min(1, "At least one country must be enabled")
    .refine((codes) => codes.every((c) => validCountryCodes.includes(c)), "Invalid country code")
    .optional(),
  // Platform-wide payment policy — the defaults every merchant inherits
  payOfflineAllowed: z.boolean().optional(),
  payConnectAllowed: z.boolean().optional(),
  payPlatformCollectAllowed: z.boolean().optional(),
  payDefaultOnlineMode: z.enum(["NONE", "CONNECT_DIRECT", "PLATFORM_COLLECT"]).optional(),
  payPlatformFeeBps: z.number().int().min(0).max(5000).optional(),
  payPlatformFeeFlat: z.number().min(0).optional(),
})

function serializeSettings(settings: any) {
  return {
    enabledCountries: settings.enabledCountries,
    payOfflineAllowed: settings.payOfflineAllowed,
    payConnectAllowed: settings.payConnectAllowed,
    payPlatformCollectAllowed: settings.payPlatformCollectAllowed,
    payDefaultOnlineMode: settings.payDefaultOnlineMode,
    payPlatformFeeBps: settings.payPlatformFeeBps,
    payPlatformFeeFlat: Number(settings.payPlatformFeeFlat),
  }
}

async function verifyPlatformAdmin(userId: string) {
  const role = await prisma.userRole.findFirst({
    where: { userId, role: "PlatformAdmin" },
  })
  return !!role
}

/**
 * GET /api/admin/settings
 * Get platform settings (enabled countries)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!(await verifyPlatformAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
    })

    if (!settings) {
      settings = await prisma.platformSettings.create({
        data: { id: "default", enabledCountries: ["CA"] },
      })
    }

    return NextResponse.json({
      ...serializeSettings(settings),
      availableCountries: SUPPORTED_COUNTRIES,
    })
  } catch (error) {
    console.error("Get settings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/settings
 * Update platform settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!(await verifyPlatformAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSettingsSchema.parse(body)

    const settings = await prisma.platformSettings.upsert({
      where: { id: "default" },
      create: { id: "default", enabledCountries: ["CA"], ...data },
      update: data,
    })

    return NextResponse.json({ success: true, ...serializeSettings(settings) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update settings error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
