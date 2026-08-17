// Copy-law data sweep (owner law: zero em-dashes user-facing). Replaces
// " — " (and tight em-dashes) with ", " across every column that reaches a
// screen. Idempotent; run with DATABASE_URL set. First run on the box:
// deploy 2026-08-17 (local DB was swept progressively through the arc).
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const TARGETS = [
  ["Post", "body"],
  ["Post", "title"],
  ["Announcement", "content"],
  ["Announcement", "title"],
  ["TeamMessage", "body"],
  ["Notification", "title"],
  ["Notification", "message"],
  ["Tenant", "description"],
  ["Tenant", "name"],
  ["League", "description"],
  ["League", "name"],
  ["Season", "label"],
  ["Team", "name"],
  ["Team", "description"],
  ["Team", "programDescription"],
  ["Organization", "name"],
  ["Venue", "name"],
]

async function main() {
  let grand = 0
  for (const [table, col] of TARGETS) {
    let total = 0
    for (;;) {
      let rows
      try {
        rows = await prisma.$queryRawUnsafe(
          `SELECT id, "${col}" AS v FROM "${table}" WHERE "${col}" LIKE '%—%' LIMIT 200`
        )
      } catch {
        console.log(`${table}.${col}: skipped (no such column here)`)
        rows = null
      }
      if (!rows || !rows.length) break
      for (const r of rows) {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${col}" = $1 WHERE id = $2`,
          r.v.replace(/ *— */g, ", "),
          r.id
        )
      }
      total += rows.length
    }
    if (total) console.log(`${table}.${col}: ${total} rows cleaned`)
    grand += total
  }
  console.log(`done. ${grand} rows cleaned.`)
}

main().finally(() => prisma.$disconnect())
