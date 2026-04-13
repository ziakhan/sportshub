"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border bg-white px-3 py-1.5 text-sm font-medium transition"
    >
      Sign Out
    </button>
  )
}
