/**
 * Web link → native route mapping. Notifications (bell items and pushes)
 * carry web paths in `link`/`data.link`; everything the app renders
 * natively routes natively — nothing opens a browser (owner rule: NO
 * webviews). Unknown links land on the Alerts inbox so a tap always goes
 * somewhere sensible.
 */

const RULES: Array<{ re: RegExp; to: (m: RegExpExecArray) => string }> = [
  { re: /^\/teams\/([\w-]+)\/chat/, to: (m) => `/chat/${m[1]}` },
  { re: /^\/offers\/([\w-]+)/, to: (m) => `/offers/${m[1]}` },
  { re: /^\/live\/([\w-]+)/, to: (m) => `/browse/game/${m[1]}` },
  { re: /^\/players\/([\w-]+)/, to: (m) => `/kids/${m[1]}` },
  { re: /^\/players/, to: () => "/kids" },
  { re: /^\/calendar/, to: () => "/calendar" },
  { re: /^\/scores/, to: () => "/scores" },
  { re: /^\/account/, to: () => "/account" },
  { re: /^\/referee/, to: () => "/referee" },
  { re: /^\/clubs\/[\w-]+\/teams\/([\w-]+)/, to: (m) => `/team/${m[1]}` },
  { re: /^\/club\/([\w-]+)/, to: (m) => `/browse/club/${m[1]}` },
  { re: /^\/news\/([\w-]+)/, to: (m) => `/browse/article/${m[1]}` },
]

export function nativeRouteForLink(link: string | null | undefined): string | null {
  if (!link) return null
  for (const { re, to } of RULES) {
    const m = re.exec(link)
    if (m) return to(m)
  }
  return null
}
