import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { getSessionUserId } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"

/**
 * GET /api/clubs/[id] — Club details with branding
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSessionUserId()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: { branding: true },
  })

  if (!tenant) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 })
  }

  return NextResponse.json({ club: tenant })
}

const socialsSchema = z
  .object({
    instagram: z.string().max(200).optional().nullable(),
    facebook: z.string().max(200).optional().nullable(),
    x: z.string().max(200).optional().nullable(),
    youtube: z.string().max(200).optional().nullable(),
    tiktok: z.string().max(200).optional().nullable(),
  })
  .partial()

const blockSchema = z.object({
  key: z.string().max(40),
  zone: z.enum(["main", "rail"]),
  order: z.number(),
  visible: z.boolean(),
  pinMobile: z.boolean().optional(),
})

const patchSchema = z.object({
  // Tenant fields
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and dashes")
    .min(2)
    .max(60)
    .optional(),
  timezone: z.string().max(60).optional(),
  description: z.string().max(4000).optional().nullable(),
  phoneNumber: z.string().max(40).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  contactEmail: z.string().max(200).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  // Branding fields
  logoUrl: z.string().optional().nullable(),
  bannerUrl: z.string().optional().nullable(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  tagline: z.string().max(200).optional().nullable(),
  socials: socialsSchema.optional().nullable(),
  pageLayout: z.array(blockSchema).max(50).optional().nullable(),
})

const TENANT_KEYS = [
  "name",
  "slug",
  "timezone",
  "description",
  "phoneNumber",
  "address",
  "city",
  "state",
  "zipCode",
  "contactEmail",
  "website",
] as const
const BRANDING_KEYS = [
  "logoUrl",
  "bannerUrl",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "tagline",
  "socials",
  "pageLayout",
] as const

/**
 * PATCH /api/clubs/[id] — Update club info + branding + public-page layout.
 * Owner/Manager of the club, or PlatformAdmin.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSessionUserId()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = await prisma.userRole.findFirst({
      where: {
        userId: session.userId,
        OR: [
          { tenantId: params.id, role: { in: ["ClubOwner", "ClubManager"] } },
          { role: "PlatformAdmin" },
        ],
      },
    })
    if (!role) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const data = patchSchema.parse(await request.json())

    // Slug uniqueness (exclude self)
    if (data.slug) {
      const clash = await prisma.tenant.findFirst({
        where: { slug: data.slug, id: { not: params.id } },
        select: { id: true },
      })
      if (clash) {
        return NextResponse.json(
          { error: "That handle is already taken", code: "SLUG_TAKEN" },
          { status: 409 }
        )
      }
    }

    const tenantData: Record<string, unknown> = {}
    for (const k of TENANT_KEYS) if (k in data) tenantData[k] = (data as any)[k]

    const brandingData: Record<string, unknown> = {}
    for (const k of BRANDING_KEYS) if (k in data) brandingData[k] = (data as any)[k]

    const tenant = await prisma.$transaction(async (tx: any) => {
      const t = Object.keys(tenantData).length
        ? await tx.tenant.update({ where: { id: params.id }, data: tenantData })
        : await tx.tenant.findUnique({ where: { id: params.id } })
      if (Object.keys(brandingData).length) {
        await tx.tenantBranding.upsert({
          where: { tenantId: params.id },
          create: { tenantId: params.id, ...brandingData },
          update: brandingData,
        })
      }
      return t
    })

    return NextResponse.json({ club: tenant })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Update club error:", error)
    return NextResponse.json({ error: "Failed to update club" }, { status: 500 })
  }
}
