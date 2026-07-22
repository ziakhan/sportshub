import { NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth-helpers"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createTrainerSchema = z.object({
  name: z.string().min(3).max(100), // public training-business name
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  bio: z.string().max(2000).optional(),
  phoneNumber: z.string().min(7).max(20).optional().or(z.literal("")),
  contactEmail: z.string().email(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  country: z.string().length(2).default("CA"),
  currency: z.string().length(3).default("CAD"),
})

/**
 * POST /api/trainers — create a solo trainer operator (batch-backlog §5).
 * A trainer is a Tenant of type TRAINER: same payments/marketplace plumbing
 * as clubs, no teams. Grants the creator the Trainer role at the tenant and
 * seeds a TrainerProfile for the 1-on-1 offering.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = createTrainerSchema.parse(body)

    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: data.slug },
      select: { id: true },
    })
    if (existingTenant) {
      return NextResponse.json({ error: "That link name is already taken" }, { status: 409 })
    }

    const tenant = await (prisma as any).tenant.create({
      data: {
        type: "TRAINER",
        name: data.name,
        slug: data.slug,
        description: data.bio || null,
        phoneNumber: data.phoneNumber || null,
        contactEmail: data.contactEmail,
        city: data.city,
        state: data.state,
        country: data.country,
        currency: data.currency,
        plan: "FREE",
        branding: {
          create: {
            primaryColor: "#1a73e8",
            secondaryColor: "#34a853",
            accentColor: "#fbbc04",
            fontFamily: "Inter",
          },
        },
        features: {
          create: {
            enableReviews: true,
            enableTournaments: false,
            enableChat: false,
            enableAnalytics: false,
            maxTeams: 0,
            maxStaff: 1,
            maxVenues: 3,
          },
        },
        trainerProfile: {
          create: { bio: data.bio || null },
        },
      },
      select: { id: true, slug: true, name: true },
    })

    await prisma.userRole.create({
      data: {
        userId: sessionInfo.userId,
        role: "Trainer" as any,
        tenantId: tenant.id,
      },
    })

    return NextResponse.json(
      { id: tenant.id, slug: tenant.slug, name: tenant.name },
      { status: 201 }
    )
  } catch (error) {
    console.error("Trainer creation error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
