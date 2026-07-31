/**
 * Draft/publish visibility (Schedule Studio P0, owner 2026-07-31).
 *
 * A Game with `publishedAt: null` is a DRAFT: the operator committed it from
 * the scheduler (or added it manually) but has not published yet. Drafts are
 * visible ONLY in the operator console — every public, club, family, and
 * mobile surface must spread PUBLISHED_GAME into its Game where-clause.
 * Publishing (POST /api/seasons/[id]/schedule/publish) stamps the timestamp
 * and sends the single schedule fanout.
 */
export const PUBLISHED_GAME = { publishedAt: { not: null } } as const

export function isDraftGame(game: { publishedAt?: Date | string | null }): boolean {
  return !game.publishedAt
}
