import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getSessionUserId } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(7).max(20).optional(),
  country: z.string().length(2).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
})

export async function GET() {
  const sessionInfo = await getSessionUserId()
  if (!sessionInfo) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = sessionInfo.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      phoneNumber: true,
      email: true,
      country: true,
      city: true,
      state: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PATCH(req: Request) {
  try {
    const sessionInfo = await getSessionUserId()
    if (!sessionInfo) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = sessionInfo.userId

    const body = await req.json()
    const data = updateProfileSchema.parse(body)

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        firstName: true,
        lastName: true,
        phoneNumber: true,
        email: true,
        city: true,
        state: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Profile update error:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
