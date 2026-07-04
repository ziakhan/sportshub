import bcrypt from "bcryptjs"
import { mulberry32, type Rng } from "./rng"

/**
 * WorldContext — identity + determinism for one built world.
 *
 * Every entity a world creates is namespaced by `runId` (emails end in
 * `@{runId}.world`, slugs/names carry a `w-{runId}` prefix), which is what
 * makes destroyWorld() safe and worlds mutually isolated — the same pattern
 * the phase runners proved with their `phaseN-test.local` namespaces.
 */

export const WORLD_PASSWORD = "TestPass123!"

let cachedHash: string | null = null
export async function worldPasswordHash(): Promise<string> {
  if (!cachedHash) {
    // Low cost factor — these are throwaway test credentials.
    cachedHash = await bcrypt.hash(WORLD_PASSWORD, 4)
  }
  return cachedHash
}

export interface WorldContext {
  runId: string
  seed: number
  rng: Rng
  /**
   * Realistic mode (simulation worlds): display names carry NO runId prefix
   * so the data reads like a real deployment in the UI. Teardown still works —
   * users/tenants keep namespaced emails/slugs, and destroyWorld resolves
   * venues through league linkage instead of name matching.
   */
  realistic: boolean
  /** e.g. email("owner") -> "owner@w7f3k2.world" */
  email(local: string): string
  /** e.g. slug("warriors") -> "w7f3k2-warriors" */
  slug(base: string): string
  /** Display name; prefixed with the runId unless realistic. */
  name(base: string): string
  /** Monotonic per-world counter for uniqueness. */
  next(): number
}

export interface WorldContextOptions {
  realistic?: boolean
}

export function createWorldContext(seed = 1, opts: WorldContextOptions = {}): WorldContext {
  const rng = mulberry32(seed)
  // runId derives from the seed — same seed, same namespace, same world.
  const runId = "w" + ((seed * 2654435761) >>> 0).toString(36).slice(0, 6)
  const realistic = opts.realistic ?? false
  let counter = 0
  return {
    runId,
    seed,
    rng,
    realistic,
    email: (local) => `${local}-${++counter}@${runId}.world`.toLowerCase(),
    slug: (base) => `${runId}-${base}-${++counter}`.toLowerCase(),
    name: (base) => (realistic ? base : `[${runId}] ${base}`),
    next: () => ++counter,
  }
}
