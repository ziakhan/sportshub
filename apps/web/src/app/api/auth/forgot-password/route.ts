// Request a password-reset email. ALWAYS returns 200 with the same body —
// the response must never reveal whether an account exists for the address
// (user enumeration). Lives under /api/auth, which the middleware allowlists
// for all methods (lib/public-paths.ts PUBLIC_API_ANY_METHOD_PREFIXES).

import { NextResponse } from "next/server"
import { prisma } from "@youthbasketballhub/db"
import { z } from "zod"
import { normalizedEmailSchema } from "@/lib/validations/email"
import { createPasswordResetToken } from "@/lib/auth-reset"
import { appBaseUrl, escapeHtml, sendEmail, transactionalFooter } from "@/lib/email"

const forgotSchema = z.object({
  email: normalizedEmailSchema("Invalid email address"),
})

export async function POST(request: Request) {
  const ok = NextResponse.json({ success: true })
  try {
    const body = await request.json()
    const parsed = forgotSchema.safeParse(body)
    if (!parsed.success) return ok

    const user = await prisma.user.findFirst({
      where: { email: { equals: parsed.data.email, mode: "insensitive" } },
    })
    if (!user || user.status !== "ACTIVE") return ok

    const token = createPasswordResetToken(user.id, user.passwordHash)
    const link = `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
    const greeting = user.firstName ? `Hi ${escapeHtml(user.firstName)},` : "Hi,"

    await sendEmail({
      to: user.email,
      subject: "Reset your SportsHub password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>${greeting}</p>
          <p>We received a request to reset the password for your SportsHub account. Click the button below to choose a new one.</p>
          <p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour and can only be used once. If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
          ${transactionalFooter()}
        </div>
      `,
    })

    return ok
  } catch (error) {
    // Still return the generic success body — a send failure must not leak
    // whether the account exists, and the user can simply retry.
    console.error("Forgot-password error:", error)
    return ok
  }
}
