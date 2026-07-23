/**
 * Backfill User.handle for accounts that predate universal handles (owner
 * 2026-07-23: every account reserves one; new signups get a default
 * automatically — this covers the existing rows). Idempotent: only touches
 * handle IS NULL. Run: npx tsx scripts/backfill-user-handles.ts
 * (DATABASE_URL decides the target DB — same care as any data script.)
 */
import { PrismaClient } from "@prisma/client"
import { defaultHandleCandidates } from "../apps/web/src/lib/handles"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { handle: null },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  })
  console.log(`${users.length} users without a handle`)

  let done = 0
  for (const user of users) {
    const candidates = defaultHandleCandidates({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    })
    // Last-resort candidates so the loop always terminates.
    for (let i = 0; i < 50; i++) candidates.push(`player${Math.floor(Math.random() * 1_000_000)}`)

    for (const candidate of candidates) {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { handle: candidate } })
        done++
        break
      } catch (e: any) {
        if (e?.code === "P2002") continue // unique collision → next candidate
        throw e
      }
    }
  }
  console.log(`backfilled ${done}/${users.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
