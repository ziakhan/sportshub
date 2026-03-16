import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"

/**
 * Lookup tenant by slug or custom domain
 * GET /api/tenants/lookup?slug=warriors
 * GET /api/tenants/lookup?domain=warriorsbasketball.com
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const slug = searchParams.get("slug")
    const domain = searchParams.get("domain")

    if (!slug && !domain) {
      return NextResponse.json(
        { error: "Either slug or domain parameter is required" },
        { status: 400 }
      )
    }

    const tenant = await prisma.tenant.findFirst({
      where: slug
        ? { slug }
        : { customDomain: domain },
      include: {
        branding: true,
        features: true,
      },
    })

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      customDomain: tenant.customDomain,
      timezone: tenant.timezone,
      plan: tenant.plan,
      branding: tenant.branding,
      features: tenant.features,
    })
  } catch (error) {
    console.error("Tenant lookup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
