/**
 * Six Park East's NJC/NSC weekends, applied to a season that already exists
 * (owner ruling 2026-08-02). The journey seeder marks them when it builds
 * stage 3; a world seeded before this existed needs them applied in place,
 * without a reseed.
 *
 * Marks the six known 2026-27 Saturdays "Taken: NJC/NSC" and releases the
 * gym from any weekend already wired onto them. Idempotent — run it twice
 * and the second run reports nothing newly marked. A weekend with games
 * already scheduled at that gym keeps them, and is reported instead.
 *
 *   npx tsx scripts/demo/apply-njc-defaults.ts
 *   SEASON_ID=<uuid> npx tsx scripts/demo/apply-njc-defaults.ts
 *
 * With no SEASON_ID it takes the newest season whose league name contains
 * "Showcase".
 *
 * Everything is imported dynamically on purpose: scripts/demo/ is
 * "type": "module" while scripts/ and packages/db are not, so a STATIC named
 * import fails to link under tsx ("does not provide an export named …").
 * Resolving at runtime is the price of keeping this script beside its
 * siblings.
 */

async function main() {
  const { prisma } = await import("@youthbasketballhub/db")
  const { applyNjcDefaults, SIXPARK_TAKEN_REASON, SIXPARK_TAKEN_SATS } = await import(
    "../seed-journey"
  )
  const p = prisma as any

  const wanted = process.env.SEASON_ID
  const season = wanted
    ? await p.season.findUnique({
        where: { id: wanted },
        select: { id: true, label: true, league: { select: { name: true } } },
      })
    : await p.season.findFirst({
        where: { league: { name: { contains: "Showcase", mode: "insensitive" } } },
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true, league: { select: { name: true } } },
      })

  try {
    if (!season) {
      console.error(
        wanted ? `No season ${wanted}` : 'No season found whose league name contains "Showcase"'
      )
      process.exitCode = 1
      return
    }
    console.log(`Season: ${season.league?.name ?? "?"} · ${season.label} (${season.id})`)
    console.log(
      `Marking ${SIXPARK_TAKEN_SATS.length} weekends "${SIXPARK_TAKEN_REASON}" at Six Park East`
    )

    const report = await applyNjcDefaults(season.id)
    if (report.marked.length === 0) {
      console.log("Nothing applied — this world has no venue named Six Park East.")
      return
    }
    const list = (label: string, sats: string[]) =>
      console.log(`  ${label}: ${sats.length === 0 ? "none" : sats.join(", ")}`)
    list("marked", report.marked)
    list("newly marked", report.created)
    list("released off the calendar", report.detached)
    list("kept (games already scheduled)", report.blocked)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
