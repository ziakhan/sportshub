import React from "react"

/**
 * Bare layout for the printable scoresheet: no site header/footer — the
 * sheet is a document, and browser print must capture ONLY the document.
 * Public (allowlisted by path), like the live game page.
 */
export default function SheetLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-white">{children}</div>
}
