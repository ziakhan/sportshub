/** Why does flattenSplitLoads reject every candidate the brute force accepts?
 *  Same loops, with rejection-reason counters. */
import { PrismaClient } from "@prisma/client"
import { TRAVEL_MIN_GAP_SLOTS, type ProposedGame } from "../../apps/web/src/lib/scheduler/generate"

const S = "160b2f09-a95a-4a64-9b90-03793cae105b"
const prisma = new PrismaClient()
const slotMs = 75 * 60000
const dkOf = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

async function main() {
  const rows = await (prisma as any).game.findMany({
    where: { seasonId: S, phase: "REGULAR", status: { not: "CANCELLED" } },
    select: { sessionId: true, dayId: true, dayVenueId: true, courtId: true, venueId: true, homeTeamId: true, awayTeamId: true, scheduledAt: true, duration: true },
  })
  const games: ProposedGame[] = rows.map((r: any) => ({ ...r, scheduledAt: new Date(r.scheduledAt).toISOString(), unitKey: "" }))
  const teamsOfG = (g: ProposedGame): [string, string] => [g.homeTeamId, g.awayTeamId]
  let byTd = new Map<string, number[]>()
  const reindex = () => {
    byTd = new Map()
    for (let i = 0; i < games.length; i++) {
      const dk = dkOf(games[i].scheduledAt)
      for (const id of teamsOfG(games[i])) {
        const k = `${id}|${dk}`
        if (!byTd.has(k)) byTd.set(k, [])
        byTd.get(k)!.push(i)
      }
    }
  }
  const dayProfile = (id: string, dk: string) => {
    const list = (byTd.get(`${id}|${dk}`) ?? []).map((i) => games[i]).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    const split = new Set(list.map((g) => g.venueId)).size > 1 ? 1 : 0
    let tight = 0, waitPts = 0
    for (let i = 1; i < list.length; i++) {
      const gap = (new Date(list[i].scheduledAt).getTime() - new Date(list[i - 1].scheduledAt).getTime()) / slotMs - 1
      if (list[i].venueId !== list[i - 1].venueId) { if (gap < TRAVEL_MIN_GAP_SLOTS) tight++; continue }
      if (gap <= 0) waitPts += 5; else if (gap > 4) waitPts += 8; else if (gap > 2) waitPts += 2
    }
    return { split, tight, waitPts }
  }
  const seasonSplits = (id: string) => {
    let n = 0
    for (const [k, idxs] of byTd) { if (!k.startsWith(`${id}|`)) continue; if (new Set(idxs.map((i) => games[i].venueId)).size > 1) n++ }
    return n
  }
  const SLOT_FIELDS = ["sessionId", "dayId", "dayVenueId", "courtId", "venueId", "scheduledAt"] as const
  const swapSlots = (i: number, j: number) => { for (const f of SLOT_FIELDS) { const t = (games[i] as any)[f]; (games[i] as any)[f] = (games[j] as any)[f]; (games[j] as any)[f] = t } }

  reindex()
  const rej: Record<string, number> = {}
  const bump = (r: string) => { rej[r] = (rej[r] ?? 0) + 1 }
  const donors = [...new Set(games.flatMap(teamsOfG))].map((id) => ({ id, load: seasonSplits(id) })).filter((d) => d.load >= 2).sort((a, b) => b.load - a.load || a.id.localeCompare(b.id))
  console.log("donors:", donors.length)
  let accepted = 0
  for (const donor of donors) {
    for (const [k, idxs] of [...byTd.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (!k.startsWith(`${donor.id}|`)) continue
      const dk = k.split("|")[1]
      if (new Set(idxs.map((i) => games[i].venueId)).size < 2) continue
      const sameDay = [...new Set([...byTd.entries()].filter(([kk]) => kk.endsWith(`|${dk}`)).flatMap(([, v]) => v))]
      for (const gi of idxs) {
        for (const gj of sameDay) {
          if (gj === gi) continue
          const A = games[gi], B = games[gj]
          if (A.sessionId !== B.sessionId) { bump("session"); continue }
          if (A.venueId === B.venueId && A.scheduledAt === B.scheduledAt) { bump("sameSlot"); continue }
          const at = teamsOfG(A), bt = teamsOfG(B)
          if (at.some((x) => (bt as string[]).includes(x))) { bump("sharedTeam"); continue }
          const clash = sameDay.some((ix) => {
            if (ix === gi || ix === gj) return false
            const g2 = games[ix], g2t = teamsOfG(g2)
            return ((g2.scheduledAt === B.scheduledAt && g2t.some((x) => (at as string[]).includes(x))) ||
                    (g2.scheduledAt === A.scheduledAt && g2t.some((x) => (bt as string[]).includes(x))))
          })
          if (clash) { bump("clash"); continue }
          const affected = [...new Set([...at, ...bt])]
          const before = affected.map((id) => dayProfile(id, dk))
          swapSlots(gi, gj); reindex()
          const after = affected.map((id) => dayProfile(id, dk))
          const sum = (xs: any[], f: string) => xs.reduce((acc, x) => acc + x[f], 0)
          const donorAfter = seasonSplits(donor.id)
          const recipAfter = Math.max(0, ...bt.map((id) => seasonSplits(id)))
          let reason = ""
          if (!(donorAfter < donor.load)) reason = "donorNotHealed"
          else if (!(sum(after, "split") <= sum(before, "split"))) reason = "splitsUp"
          else if (!(sum(after, "tight") <= sum(before, "tight"))) reason = "newTight"
          else if (!(sum(after, "waitPts") - sum(before, "waitPts") <= 16)) reason = "waitsUp"
          else if (!(recipAfter < donor.load)) reason = "recipTooLoaded"
          if (reason === "") { accepted++; bump("ACCEPT(kept)"); swapSlots(gi, gj); reindex(); continue }
          bump(reason)
          swapSlots(gi, gj); reindex()
        }
      }
    }
  }
  console.log("rejections:", JSON.stringify(rej, null, 0))
  console.log("acceptable trades found:", accepted)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
