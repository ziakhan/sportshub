"use client"

import { signOut } from "next-auth/react"

export function SignOutRow() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex min-h-[48px] w-full items-center gap-3 px-4 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </svg>
      Sign out
    </button>
  )
}
