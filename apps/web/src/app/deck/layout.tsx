import type { ReactNode } from "react"

/**
 * Decks are full-screen presentations sent to a named prospect, so they carry
 * none of the site chrome: no header, no footer, no nav. The route lives at the
 * top level rather than under (public) for exactly that reason, the same way
 * /launch does. `/deck` is on the public path allowlist in lib/public-paths.
 */
export default function DeckLayout({ children }: { children: ReactNode }) {
  return <div className="h-[100dvh] w-full overflow-hidden bg-[#0b1628]">{children}</div>
}
