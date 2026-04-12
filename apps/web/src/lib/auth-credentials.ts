import { prisma } from "@youthbasketballhub/db"
import bcrypt from "bcryptjs"

type CredentialInput = {
  email?: string
  password?: string
}

export async function authorizeCredentials(credentials?: CredentialInput) {
  if (!credentials?.email || !credentials?.password) {
    return null
  }

  const normalizedEmail = credentials.email.trim().toLowerCase()

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: "insensitive",
      },
    },
  })

  if (!user || user.status !== "ACTIVE") {
    return null
  }

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

  if (!isValid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
  }
}
