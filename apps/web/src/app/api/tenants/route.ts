import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const createTenantSchema = z.object({
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  timezone: z.string().optional().default("America/New_York"),
  phoneNumber: z.string().min(7).max(20),
  contactEmail: z.string().email(),
  address: z.string().min(3),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zipCode: z.string().min(3).max(10),
  country: z.string().length(2).default("US"),
  currency: z.string().length(3).default("USD"),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
})

/**
 * Create a new tenant (club)
 * POST /api/tenants
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = session.user.id

    const body = await request.json()
    const validatedData = createTenantSchema.parse(body)

    // Check if slug is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: validatedData.slug },
    })

    if (existingTenant) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 409 }
      )
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Create tenant with default branding and features
    const tenant = await prisma.tenant.create({
      data: {
        name: validatedData.name,
        slug: validatedData.slug,
        description: validatedData.description,
        timezone: validatedData.timezone,
        phoneNumber: validatedData.phoneNumber,
        contactEmail: validatedData.contactEmail,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        zipCode: validatedData.zipCode,
        country: validatedData.country,
        currency: validatedData.currency,
        website: validatedData.website || null,
        plan: "FREE",
        branding: {
          create: {
            logoUrl: validatedData.logoUrl || null,
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
            maxTeams: 10,
            maxStaff: 5,
            maxVenues: 3,
          },
        },
      },
      include: {
        branding: true,
        features: true,
      },
    })

    // Create ClubOwner role for the user
    await prisma.userRole.create({
      data: {
        userId: user.id,
        role: "ClubOwner",
        tenantId: tenant.id,
      },
    })

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      subdomain: `${tenant.slug}.youthbasketballhub.com`,
      plan: tenant.plan,
      createdAt: tenant.createdAt,
    }, { status: 201 })
  } catch (error) {
    console.error("Tenant creation error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * Get current user's tenants
 * GET /api/tenants
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            tenant: {
              include: {
                branding: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ tenants: [] })
    }

    const tenants = user.roles
      .filter((role) => role.tenant !== null)
      .map((role) => ({
        id: role.tenant!.id,
        slug: role.tenant!.slug,
        name: role.tenant!.name,
        role: role.role,
        subdomain: `${role.tenant!.slug}.youthbasketballhub.com`,
        branding: role.tenant!.branding,
      }))

    return NextResponse.json({ tenants })
  } catch (error) {
    console.error("Get tenants error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
