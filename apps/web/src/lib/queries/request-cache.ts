import * as React from "react"

/**
 * React.cache when it exists (the Next.js server runtime), identity
 * otherwise (vitest node env, where React ships without it). Identity is
 * also what tests want — per-request memoization would leak stale query
 * results across test cases in the same process.
 */
export const cache: <T extends (...args: any[]) => any>(fn: T) => T =
  (React as any).cache ?? ((fn: any) => fn)
