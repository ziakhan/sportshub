import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = signupSchema.parse(body)

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        status: "ACTIVE",
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0].message },
        { status: 400 }
      )
    }
    console.error("Signup error:", err)
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    )
  }
}
