/**
 * Space the fixed mobile tab bar owns — kept in a PLAIN module on purpose.
 *
 * These used to be exported from `bottom-tabs.tsx`, which carries "use client".
 * A server component importing a non-component value from a client module gets
 * a client-reference PROXY, not the string: both layouts rendered
 * `class="… [object Object]"`, the padding never applied, and the bar covered
 * the last rows of every page (audit 2026-08-14 — the fix looked right in the
 * diff and did nothing in the browser). Server and client both import from
 * here; nothing in this file is a component.
 */

/**
 * Space reservation for the bar. Every layout that renders a bar puts this on
 * its content wrapper, so the fix is one class in one place rather than
 * per-page padding. 4.5rem = the bar's 4rem + its border + a small gap, plus
 * the iOS home-indicator inset (the old `pb-16` was short by that inset).
 */
export const BOTTOM_TABS_PAD = "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"

/**
 * Where a floating action button must sit so it clears the bar: bar height +
 * 12px + the safe-area inset. Pair it with a desktop `lg:bottom-*`.
 */
export const BOTTOM_TABS_FLOAT_OFFSET = "bottom-[calc(4rem+12px+env(safe-area-inset-bottom))]"
