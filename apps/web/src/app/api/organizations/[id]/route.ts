import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"
import { seasonDefaultsSchema } from "@/lib/org/season-defaults"

export const dynamic = "force-dynamic"

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(140).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #d7282f")
    .nullable()
    .optional(),
  // Upload-lite: small data URL, same pattern as club branding
  logoUrl: z.string().max(300_000).nullable().optional(),
  // Org season rulebook (Phase A) — leagues inherit any field they leave unset
  seasonDefaults: seasonDefaultsSchema.nullable().optional(),
})

/** May this user manage the operator? Platform admin, or they own/manage a league under it. */
async function canManageOrg(userId: string, isPlatformAdmin: boolean, orgId: string) {
  if (isPlatformAdmin) return true
  const leagues = await (prisma as any).league.findMany({
    where: { organizationId: orgId },
    select: { id: true, ownerId: true },
  })
  if (leagues.some((l: any) => l.ownerId === userId)) return true
  const role = await prisma.userRole.findFirst({
    where: {
      userId,
      role: { in: ["LeagueOwner", "LeagueManager"] },
      leagueId: { in: leagues.map((l: any) => l.id) },
    },
    select: { id: true },
  })
  return !!role
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSessionUserId()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const org = await (prisma as any).organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      primaryColor: true,
      tagline: true,
      description: true,
      seasonDefaults: true,
      leagues: { select: { id: true, name: true, logoUrl: true, primaryColor: true } },
    },
  })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await canManageOrg(auth.userId, !!auth.isPlatformAdmin, params.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json({ organization: org })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await getSessionUserId()
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!(await canManageOrg(auth.userId, !!auth.isPlatformAdmin, params.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const parsed = patchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }
    await (prisma as any).organization.update({ where: { id: params.id }, data: parsed.data })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Organization update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
