import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const updateRefereeSchema = z.object({
  certificationLevel: z.enum(["Level 1", "Level 2", "Level 3"]).optional(),
  standardFee: z.number().min(0).optional(),
  availableRegions: z.array(z.string()).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const profile = await prisma.refereeProfile.findUnique({
    where: { userId: user.id },
    select: {
      certificationLevel: true,
      standardFee: true,
      availableRegions: true,
      gamesRefereed: true,
      averageRating: true,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: "Referee profile not found" }, { status: 404 })
  }

  return NextResponse.json(profile)
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const data = updateRefereeSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const profile = await prisma.refereeProfile.update({
      where: { userId: user.id },
      data,
      select: {
        certificationLevel: true,
        standardFee: true,
        availableRegions: true,
      },
    })

    return NextResponse.json(profile)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Referee profile update error:", error)
    return NextResponse.json(
      { error: "Failed to update referee profile" },
      { status: 500 }
    )
  }
}
