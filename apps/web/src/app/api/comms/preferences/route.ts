import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@youthbasketballhub/db"
import { getSessionUserId } from "@/lib/auth-helpers"
import {
  listConsents,
  grantExpressConsent,
  withdrawConsent,
  type ConsentScope,
} from "@/lib/comms/consent"

export const dynamic = "force-dynamic"

/**
 * GET /api/comms/preferences — the session user's marketing-consent rows,
 * enriched with org names so /settings/communications can render
 * human-readable rows (TENANT → tenant name, LEAGUE → league name).
 */
export async function GET() {
  const auth = await getSessionUserId()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const consents = await listConsents(auth.userId)

    const tenantIds = consents
      .filter((c: any) => c.scope === "TENANT" && c.tenantId)
      .map((c: any) => c.tenantId as string)
    const leagueIds = consents
      .filter((c: any) => c.scope === "LEAGUE" && c.leagueId)
      .map((c: any) => c.leagueId as string)

    const [tenants, leagues] = await Promise.all([
      tenantIds.length > 0
        ? prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      leagueIds.length > 0
        ? prisma.league.findMany({
            where: { id: { in: leagueIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ])

    const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]))
    const leagueNameById = new Map(leagues.map((l) => [l.id, l.name]))

    const rows = consents.map((c: any) => {
      const orgId: string | null =
        c.scope === "TENANT" ? c.tenantId : c.scope === "LEAGUE" ? c.leagueId : null
      const orgName =
        c.scope === "TENANT"
          ? (tenantNameById.get(c.tenantId) ?? null)
          : c.scope === "LEAGUE"
            ? (leagueNameById.get(c.leagueId) ?? null)
            : null
      return {
        id: c.id,
        scope: c.scope as ConsentScope,
        orgId,
        orgName,
        status: c.status as "IMPLIED" | "EXPRESS" | "WITHDRAWN",
        lastEngagedAt: c.lastEngagedAt,
        withdrawnAt: c.withdrawnAt,
      }
    })

    return NextResponse.json({ consents: rows })
  } catch (err) {
    console.error("Preferences GET error:", err)
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 })
  }
}

const patchSchema = z
  .object({
    scope: z.enum(["PLATFORM", "TENANT", "LEAGUE"]),
    orgId: z.string().min(1).nullable().optional(),
    action: z.enum(["grant", "withdraw"]),
  })
  .refine((v) => (v.scope === "PLATFORM" ? !v.orgId : !!v.orgId), {
    message: "orgId is required for TENANT/LEAGUE scope and must be omitted for PLATFORM",
    path: ["orgId"],
  })

/**
 * PATCH /api/comms/preferences — grant or withdraw marketing consent for the
 * SESSION user only. Body: { scope, orgId, action: "grant" | "withdraw" }.
 */
export async function PATCH(request: Request) {
  const auth = await getSessionUserId()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { scope, orgId, action } = patchSchema.parse(body)
    const normalizedOrgId = scope === "PLATFORM" ? null : (orgId as string)

    if (action === "grant") {
      await grantExpressConsent(auth.userId, scope, normalizedOrgId, "preferences-page")
    } else {
      await withdrawConsent(auth.userId, scope, normalizedOrgId, "preferences-page")
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error("Preferences PATCH error:", err)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
