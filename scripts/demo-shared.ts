/**
 * Shared demo-world constants (demo-journey plan, owner 2026-08-01) —
 * one source for the seeder scenarios, the scenario registry, and the
 * admin demo loader.
 */
export const MARKER = "NPH_DEMO_SEED"
export const EMAIL_DOMAIN = "sportshub.demo"
export const PASSWORD = "TestPass123!"

/** Tenants the journey scenario CREATES get this slug prefix so the purge
 *  can remove them without touching adopted real-import tenants. */
export const JOURNEY_SLUG_PREFIX = "nphj-"
