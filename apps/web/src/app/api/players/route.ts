import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { addPlayerSchema } from "@/lib/validations/tryout-signup"

/**
 * List parent's players
 * GET /api/players
 */
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

  const players = await prisma.player.findMany({
    where: { parentId: user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      jerseyNumber: true,
    },
    orderBy: { firstName: "asc" },
  })

  return NextResponse.json({ players })
}

/**
 * Add a player (child)
 * POST /api/players
 */
export async function POST(req: Request) {
  try {
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

    const body = await req.json()
    const data = addPlayerSchema.parse(body)

    const dob = new Date(data.dateOfBirth)
    const ageInYears = Math.floor(
      (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    )

    const player = await prisma.player.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: dob,
        gender: data.gender,
        jerseyNumber: data.jerseyNumber || null,
        parentId: user.id,
        isMinor: ageInYears < 13,
        canLogin: ageInYears >= 13,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        jerseyNumber: true,
      },
    })

    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    if (error instanceof (await import("zod")).ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Add player error:", error)
    return NextResponse.json(
      { error: "Failed to add player" },
      { status: 500 }
    )
  }
}
