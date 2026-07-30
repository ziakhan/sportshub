/**
 * Backfill: recompose every Division.name from its structure (ageGroup +
 * gender + tier) — league-ia-redesign §4 (derived naming). Division names
 * become uniform ("U15 Boys · Tier 1") so standings and schedules read the
 * same everywhere. Team names are intentionally NOT touched: legacy typed
 * names persist until a club edits the team (owner ruling).
 *
 * Usage:
 *   export PATH="/usr/local/opt/node@18/bin:$PATH"
 *   npx tsx scripts/backfill-division-names.ts            # local DB
 *   DATABASE_URL="postgresql://..." npx tsx scripts/backfill-division-names.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// Mirrors apps/web/src/lib/teams/naming.ts (scripts can't import app code).
function genderLabel(gender: string | null): string | null {
  if (gender === "MALE") return "Boys"
  if (gender === "FEMALE") return "Girls"
  if (gender === "COED") return "Co-ed"
  return null
}
function composeDivisionName(d: {
  ageGroup: string
  gender: string | null
  tier: number
}): string {
  const parts = [d.ageGroup.trim()]
  const g = genderLabel(d.gender)
  if (g) parts.push(g)
  return `${parts.join(" ")} · Tier ${d.tier}`
}

async function main() {
  const divisions = await prisma.division.findMany({
    select: { id: true, name: true, ageGroup: true, gender: true, tier: true },
  })
  let changed = 0
  for (const d of divisions) {
    const composed = composeDivisionName({
      ageGroup: d.ageGroup,
      gender: d.gender,
      tier: d.tier,
    })
    if (composed !== d.name) {
      await prisma.division.update({ where: { id: d.id }, data: { name: composed } })
      console.log(`  ${d.name}  →  ${composed}`)
      changed++
    }
  }
  console.log(`Done: ${changed} of ${divisions.length} division names recomposed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
