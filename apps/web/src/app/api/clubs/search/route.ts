import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@youthbasketballhub/db"

export const dynamic = "force-dynamic"

/**
 * Search for unclaimed clubs
 * GET /api/clubs/search?q=toronto
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get("q") || ""
    if (q.length < 2) {
      return NextResponse.json({ clubs: [] })
    }

    const clubs = await prisma.tenant.findMany({
      where: {
        status: "UNCLAIMED",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        country: true,
        contactEmail: true,
        phoneNumber: true,
        website: true,
        description: true,
        clubClaims: {
          select: { id: true, status: true, userId: true },
          where: { status: { in: ["PENDING", "EMAIL_SENT", "EMAIL_VERIFIED", "APPROVED"] } },
        },
      },
      orderBy: { name: "asc" },
      take: 20,
    })

    const userId = session.user.id
    const results = clubs.map((club: any) => ({
      id: club.id,
      name: club.name,
      city: club.city,
      state: club.state,
      country: club.country,
      contactEmail: club.contactEmail ? maskEmail(club.contactEmail) : null,
      phoneNumber: club.phoneNumber ? maskPhone(club.phoneNumber) : null,
      website: club.website,
      description: club.description,
      hasPendingClaim: club.clubClaims.length > 0,
      myClaimStatus: club.clubClaims.find((c: any) => c.userId === userId)?.status || null,
    }))

    return NextResponse.json({ clubs: results })
  } catch (error) {
    console.error("Search clubs error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (!domain) return "***@***.***"
  return `${local[0]}${"*".repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}@${domain}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 4) return "***"
  return `***-***-${digits.slice(-4)}`
}
