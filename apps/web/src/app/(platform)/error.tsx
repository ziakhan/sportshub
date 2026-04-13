"use client"

import Link from "next/link"

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="border-ink-100 w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
        <h2 className="text-ink-900 mb-2 text-xl font-semibold">Something went wrong</h2>
        <p className="text-ink-700 mb-6 text-sm">{error.message}</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="border-ink-200 text-ink-700 hover:bg-court-50 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
