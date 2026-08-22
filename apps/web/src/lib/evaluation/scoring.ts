/**
 * Consolidating a tryout: the maths, and the limits of it.
 *
 * THE PROBLEM THIS SOLVES. With 60 kids and 4 coaches, not every coach sees
 * every kid. Each player's average is therefore taken over a DIFFERENT set of
 * evaluators. One coach runs generous, another runs hard, and a kid scored by
 * the generous one outranks a better kid scored by the hard one. The table
 * looks authoritative while being wrong.
 *
 * THE FIX. Normalise each evaluator against their own mean and spread before
 * combining. Both numbers are always returned: coaches will not trust an
 * adjusted figure whose working they cannot see.
 *
 * THE LIMIT, and it is written here so nobody mistakes this for more than it
 * is: normalisation corrects SYSTEMATIC generosity or harshness. It does NOT
 * correct targeted sandbagging, which is the behaviour that actually worries
 * the owner — a coach who scores everyone fairly except the one player they
 * want has a perfectly normal mean and spread. `evaluatorDeviations` below is
 * what surfaces that shape, and it surfaces it to a human rather than acting
 * on it.
 */

export interface RatingInput {
  playerId: string
  evaluatorId: string
  categoryKey: string
  score: number
}

export interface CategoryWeight {
  key: string
  label: string
  weight: number
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

const stdDev = (xs: number[]): number => {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/**
 * An evaluator needs a few scores before their personal scale means anything.
 * Below this we leave their numbers alone rather than amplifying noise into
 * a confident-looking adjustment.
 */
const MIN_RATINGS_TO_NORMALISE = 5

/** One evaluator's weighted overall for one player. */
function weightedOverall(
  rows: RatingInput[],
  weights: Map<string, number>
): number | null {
  let num = 0
  let den = 0
  for (const r of rows) {
    const w = weights.get(r.categoryKey) ?? 1
    num += r.score * w
    den += w
  }
  return den > 0 ? num / den : null
}

export interface CategoryBreakdown {
  key: string
  label: string
  average: number
  count: number
}

export interface EvaluatorScore {
  evaluatorId: string
  overall: number
}

export interface PlayerReport {
  playerId: string
  /** How many evaluators actually saw this player. */
  evaluatorCount: number
  /** Weighted across categories, averaged across evaluators, unadjusted. */
  overall: number | null
  /** The same, after each evaluator is normalised to their own scale. */
  adjusted: number | null
  /** Lowest and highest evaluator overall. Disagreement is a finding, not noise. */
  spreadLow: number | null
  spreadHigh: number | null
  /** Evaluators disagree enough that a human should look again. */
  contested: boolean
  /** Fewer than two evaluators is a confidence flag, not a score. */
  lowConfidence: boolean
  perCategory: CategoryBreakdown[]
  perEvaluator: EvaluatorScore[]
}

/** Two full points between the kindest and harshest read is worth a second look. */
const CONTESTED_SPREAD = 2

export function consolidate(
  ratings: RatingInput[],
  categories: CategoryWeight[]
): PlayerReport[] {
  const weights = new Map(categories.map((c) => [c.key, c.weight]))
  const labels = new Map(categories.map((c) => [c.key, c.label]))

  // Each evaluator's own scale, measured across everything they scored.
  const byEvaluator = new Map<string, number[]>()
  for (const r of ratings) {
    if (!byEvaluator.has(r.evaluatorId)) byEvaluator.set(r.evaluatorId, [])
    byEvaluator.get(r.evaluatorId)!.push(r.score)
  }
  const evaluatorMean = new Map<string, number>()
  const evaluatorSd = new Map<string, number>()
  for (const [id, xs] of byEvaluator) {
    evaluatorMean.set(id, mean(xs))
    evaluatorSd.set(id, stdDev(xs))
  }
  // The group's scale, so adjusted numbers land back on something readable
  // rather than on z-scores no coach can interpret.
  const groupMean = mean(ratings.map((r) => r.score))
  const groupSd = stdDev(ratings.map((r) => r.score))

  const normalise = (r: RatingInput): number => {
    const n = byEvaluator.get(r.evaluatorId)?.length ?? 0
    const sd = evaluatorSd.get(r.evaluatorId) ?? 0
    if (n < MIN_RATINGS_TO_NORMALISE || sd === 0 || groupSd === 0) return r.score
    const z = (r.score - (evaluatorMean.get(r.evaluatorId) ?? 0)) / sd
    return groupMean + z * groupSd
  }

  const byPlayer = new Map<string, RatingInput[]>()
  for (const r of ratings) {
    if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, [])
    byPlayer.get(r.playerId)!.push(r)
  }

  const reports: PlayerReport[] = []
  for (const [playerId, rows] of byPlayer) {
    const evaluatorIds = [...new Set(rows.map((r) => r.evaluatorId))]

    const perEvaluator: EvaluatorScore[] = []
    const adjustedOveralls: number[] = []
    for (const evaluatorId of evaluatorIds) {
      const mine = rows.filter((r) => r.evaluatorId === evaluatorId)
      const raw = weightedOverall(mine, weights)
      if (raw === null) continue
      perEvaluator.push({ evaluatorId, overall: round1(raw) })
      const adj = weightedOverall(
        mine.map((r) => ({ ...r, score: normalise(r) })),
        weights
      )
      if (adj !== null) adjustedOveralls.push(adj)
    }

    const overalls = perEvaluator.map((e) => e.overall)
    const perCategory: CategoryBreakdown[] = categories
      .map((c) => {
        const xs = rows.filter((r) => r.categoryKey === c.key).map((r) => r.score)
        return { key: c.key, label: labels.get(c.key) ?? c.key, average: round1(mean(xs)), count: xs.length }
      })
      .filter((c) => c.count > 0)

    const low = overalls.length ? Math.min(...overalls) : null
    const high = overalls.length ? Math.max(...overalls) : null

    reports.push({
      playerId,
      evaluatorCount: evaluatorIds.length,
      overall: overalls.length ? round1(mean(overalls)) : null,
      adjusted: adjustedOveralls.length ? round1(mean(adjustedOveralls)) : null,
      spreadLow: low,
      spreadHigh: high,
      contested: low !== null && high !== null && high - low >= CONTESTED_SPREAD,
      lowConfidence: evaluatorIds.length < 2,
      perCategory,
      perEvaluator,
    })
  }

  return reports.sort((a, b) => (b.adjusted ?? b.overall ?? 0) - (a.adjusted ?? a.overall ?? 0))
}

export interface EvaluatorDeviation {
  evaluatorId: string
  playerId: string
  /** Their overall for this player, minus what everyone else said. */
  delta: number
  /** How far this delta sits from their own usual delta. */
  unusualness: number
}

/**
 * Targeted scoring, surfaced for a human to read.
 *
 * Systematic bias is a CONSTANT offset across all of an evaluator's players,
 * and `consolidate` already removes it. What this looks for is the other
 * shape: an evaluator who tracks consensus everywhere except on one or two
 * players. That is the shape the owner described, where a coach knows who
 * picks first and scores accordingly.
 *
 * It is deliberately advisory. Nothing here excludes a rating or accuses
 * anybody, because a coach may simply have seen what the others missed, and
 * that is the entire reason for having several evaluators.
 */
export function evaluatorDeviations(
  reports: PlayerReport[],
  minUnusualness = 1.5
): EvaluatorDeviation[] {
  const deltasByEvaluator = new Map<string, { playerId: string; delta: number }[]>()

  for (const rep of reports) {
    if (rep.perEvaluator.length < 3) continue // no meaningful consensus to differ from
    for (const e of rep.perEvaluator) {
      const others = rep.perEvaluator.filter((x) => x.evaluatorId !== e.evaluatorId).map((x) => x.overall)
      const delta = e.overall - mean(others)
      if (!deltasByEvaluator.has(e.evaluatorId)) deltasByEvaluator.set(e.evaluatorId, [])
      deltasByEvaluator.get(e.evaluatorId)!.push({ playerId: rep.playerId, delta })
    }
  }

  const out: EvaluatorDeviation[] = []
  for (const [evaluatorId, deltas] of deltasByEvaluator) {
    if (deltas.length < 3) continue
    // Their own habitual offset. Subtracting it is what separates "this coach
    // runs hard" from "this coach did something to this one player".
    const typical = mean(deltas.map((d) => d.delta))
    for (const d of deltas) {
      const unusualness = Math.abs(d.delta - typical)
      if (unusualness >= minUnusualness) {
        out.push({
          evaluatorId,
          playerId: d.playerId,
          delta: round1(d.delta),
          unusualness: round1(unusualness),
        })
      }
    }
  }

  return out.sort((a, b) => b.unusualness - a.unusualness)
}
