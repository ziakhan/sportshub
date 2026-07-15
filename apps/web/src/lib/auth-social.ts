// Google sign-in → DB user mapping (2026-07-15). Adapter-less: sessions stay
// JWT, so all we need is a DB user whose id goes into the token. Linking rule:
// a Google login with a verified email attaches to the existing account with
// that address (parents already have email/password accounts); otherwise a
// new user is created with an unusable random password — they can still add
// a real one later via the reset flow.

import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"
import { prisma } from "@youthbasketballhub/db"

export async function ensureGoogleUser(input: {
  email: string
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}): Promise<{ id: string; email: string; name: string | null } | null> {
  const email = input.email.trim().toLowerCase()
  if (!email) return null

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  })
  if (existing) {
    if (existing.status !== "ACTIVE") return null
    return {
      id: existing.id,
      email: existing.email,
      name: [existing.firstName, existing.lastName].filter(Boolean).join(" ") || null,
    }
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12)
  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName || null,
      lastName: input.lastName || null,
      avatarUrl: input.avatarUrl || null,
    },
  })
  return {
    id: created.id,
    email: created.email,
    name: [created.firstName, created.lastName].filter(Boolean).join(" ") || null,
  }
}
