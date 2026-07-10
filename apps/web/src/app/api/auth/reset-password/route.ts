// Redeem a password-reset token (see lib/auth-reset.ts) and set a new
// password. Public by design — the token IS the authentication. Lives under
// /api/auth so the middleware allowlist already covers it.

import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { passwordHashFragment, verifyPasswordResetToken } from "@/lib/auth-reset"

const resetSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

function invalidLink() {
  return NextResponse.json(
    { error: "This reset link is invalid or has expired. Please request a new one." },
    { status: 400 }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = resetSchema.parse(body)

    const payload = verifyPasswordResetToken(data.token)
    if (!payload) return invalidLink()

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user || user.status !== "ACTIVE") return invalidLink()

    // pwFrag binds the token to the passwordHash it was issued against —
    // if the password changed since (including via this flow), the token
    // is spent.
    if (passwordHashFragment(user.passwordHash) !== payload.pwFrag) return invalidLink()

    const passwordHash = await bcrypt.hash(data.newPassword, 12)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    // Never log the request body — it contains the new password.
    console.error("Reset-password error:", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
