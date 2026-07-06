/**
 * Generated matchup covers — branded 16:9 SVG data-URIs for recap posts, so
 * every game story has an image even before clubs upload photos/logos.
 * Two-tone diagonal split in the clubs' colors, monogram crests, final score.
 * Self-contained (no external hosting), a few KB each.
 */

export interface MatchupCoverInput {
  homeName: string
  awayName: string
  homeColor?: string | null
  awayColor?: string | null
  homeScore: number
  awayScore: number
  label?: string | null // e.g. "OYBL · Winter 2026"
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

/** "416 United U14 Boys" → "4U" / "Windsor Suns" → "WS" */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .split(/\s+/)
    .filter((w) => w && !/^U\d+$/i.test(w) && !/^(boys|girls)$/i.test(w))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export function buildMatchupCover(input: MatchupCoverInput): string {
  const hc = input.homeColor || "#4f46e5"
  const ac = input.awayColor || "#0d9488"
  const homeWon = input.homeScore >= input.awayScore
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" font-family="Avenir Next,Segoe UI,Arial,sans-serif">
  <defs>
    <linearGradient id="h" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${hc}"/><stop offset="1" stop-color="${hc}" stop-opacity="0.72"/>
    </linearGradient>
    <linearGradient id="a" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ac}"/><stop offset="1" stop-color="${ac}" stop-opacity="0.72"/>
    </linearGradient>
  </defs>
  <rect width="800" height="450" fill="#141317"/>
  <path d="M0 0 H460 L340 450 H0 Z" fill="url(#h)"/>
  <path d="M460 0 H800 V450 H340 Z" fill="url(#a)"/>
  <path d="M462 0 L342 450 h-14 L448 0 Z" fill="#141317" opacity="0.85"/>
  <circle cx="150" cy="150" r="64" fill="#ffffff" opacity="0.95"/>
  <text x="150" y="172" text-anchor="middle" font-size="56" font-weight="800" fill="${hc}">${esc(monogram(input.homeName))}</text>
  <circle cx="650" cy="150" r="64" fill="#ffffff" opacity="0.95"/>
  <text x="650" y="172" text-anchor="middle" font-size="56" font-weight="800" fill="${ac}">${esc(monogram(input.awayName))}</text>
  <text x="150" y="268" text-anchor="middle" font-size="26" font-weight="700" fill="#ffffff">${esc(shorten(input.homeName))}</text>
  <text x="650" y="268" text-anchor="middle" font-size="26" font-weight="700" fill="#ffffff">${esc(shorten(input.awayName))}</text>
  <text x="150" y="356" text-anchor="middle" font-size="88" font-weight="800" fill="#ffffff" opacity="${homeWon ? 1 : 0.55}">${input.homeScore}</text>
  <text x="650" y="356" text-anchor="middle" font-size="88" font-weight="800" fill="#ffffff" opacity="${homeWon ? 0.55 : 1}">${input.awayScore}</text>
  <text x="400" y="240" text-anchor="middle" font-size="30" font-weight="800" fill="#ffffff" opacity="0.9">FINAL</text>
  ${input.label ? `<text x="400" y="418" text-anchor="middle" font-size="18" font-weight="600" fill="#ffffff" opacity="0.6">${esc(input.label)}</text>` : ""}
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function shorten(name: string): string {
  return name.length > 24 ? `${name.slice(0, 23)}…` : name
}
