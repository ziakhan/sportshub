/**
 * Equipment order roll-up — aggregates accepted offers into the order a club
 * places with its supplier: item totals with size breakdowns per team.
 *
 * Counts are driven by what the offer INCLUDES, not by whether a size is on
 * file — an accepted offer with a missing size still needs an item ordered,
 * so it lands in the `missing` bucket instead of vanishing from the total.
 * (Sizes are required at accept time, so `missing` only surfaces legacy or
 * admin-created rows.)
 */

export interface OrderableOffer {
  includesBall: boolean
  includesBag: boolean
  includesShoes: boolean
  includesUniform: boolean
  includesTracksuit: boolean
  uniformSize: string | null
  shoeSize: string | null
  tracksuitSize: string | null
}

export interface SizedItemRollup {
  /** Offers that include this item — the quantity to order. */
  total: number
  /** Size → count, sorted smallest-first. */
  bySize: [string, number][]
  /** Included but no size on file. */
  missing: number
}

export interface OrderRollup {
  players: number
  uniforms: SizedItemRollup
  tracksuits: SizedItemRollup
  shoes: SizedItemRollup
  balls: number
  bags: number
  /** True when no accepted offer includes any orderable item. */
  isEmpty: boolean
}

// Apparel sizes as they appear on Offer (YS..AXL). Unknown values sort last, alphabetically.
const APPAREL_SIZE_ORDER = ["YXS", "YS", "YM", "YL", "YXL", "AXS", "AS", "AM", "AL", "AXL", "AXXL"]

function apparelSizeRank(size: string): number {
  const rank = APPAREL_SIZE_ORDER.indexOf(size.toUpperCase())
  return rank === -1 ? APPAREL_SIZE_ORDER.length : rank
}

function sortApparelSizes(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort(
    ([a], [b]) => apparelSizeRank(a) - apparelSizeRank(b) || a.localeCompare(b)
  )
}

function sortShoeSizes(counts: Map<string, number>): [string, number][] {
  return [...counts.entries()].sort(([a], [b]) => {
    const na = parseFloat(a)
    const nb = parseFloat(b)
    if (isNaN(na) && isNaN(nb)) return a.localeCompare(b)
    if (isNaN(na)) return 1
    if (isNaN(nb)) return -1
    return na - nb
  })
}

export function rollUpOrders(offers: OrderableOffer[]): OrderRollup {
  const uniformSizes = new Map<string, number>()
  const tracksuitSizes = new Map<string, number>()
  const shoeSizes = new Map<string, number>()
  const uniforms: SizedItemRollup = { total: 0, bySize: [], missing: 0 }
  const tracksuits: SizedItemRollup = { total: 0, bySize: [], missing: 0 }
  const shoes: SizedItemRollup = { total: 0, bySize: [], missing: 0 }
  let balls = 0
  let bags = 0

  for (const offer of offers) {
    if (offer.includesUniform) {
      uniforms.total++
      if (offer.uniformSize) {
        uniformSizes.set(offer.uniformSize, (uniformSizes.get(offer.uniformSize) || 0) + 1)
      } else {
        uniforms.missing++
      }
    }
    if (offer.includesTracksuit) {
      tracksuits.total++
      if (offer.tracksuitSize) {
        tracksuitSizes.set(offer.tracksuitSize, (tracksuitSizes.get(offer.tracksuitSize) || 0) + 1)
      } else {
        tracksuits.missing++
      }
    }
    if (offer.includesShoes) {
      shoes.total++
      if (offer.shoeSize) {
        shoeSizes.set(offer.shoeSize, (shoeSizes.get(offer.shoeSize) || 0) + 1)
      } else {
        shoes.missing++
      }
    }
    if (offer.includesBall) balls++
    if (offer.includesBag) bags++
  }

  uniforms.bySize = sortApparelSizes(uniformSizes)
  tracksuits.bySize = sortApparelSizes(tracksuitSizes)
  shoes.bySize = sortShoeSizes(shoeSizes)

  return {
    players: offers.length,
    uniforms,
    tracksuits,
    shoes,
    balls,
    bags,
    isEmpty: uniforms.total + tracksuits.total + shoes.total + balls + bags === 0,
  }
}

/** "3 YL, 5 AM" (+ " 2 size TBD" when sizes are missing) — the demo one-liner. */
export function formatSizeBreakdown(item: SizedItemRollup): string {
  const parts = item.bySize.map(([size, count]) => `${count} ${size}`)
  if (item.missing > 0) parts.push(`${item.missing} size TBD`)
  return parts.join(", ")
}
