/**
 * Shared onboarding constants — no server imports, safe in client bundles.
 */

/**
 * Set once the member has seen the first-run /welcome checklist (by skipping,
 * finishing, or clicking into a step). Its presence stops /post-login from
 * auto-routing them back through the soft gate; the top-nav pill and dashboard
 * card carry ongoing guidance from there. One year, path-wide.
 */
export const ONBOARDING_DISMISS_COOKIE = "gs-onboarding-dismissed"
export const ONBOARDING_DISMISS_MAX_AGE = 60 * 60 * 24 * 365
