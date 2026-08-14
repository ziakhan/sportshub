"use client"

import { CourtBackdrop } from "@/components/ui/court-backdrop"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CourtBackdrop variant="ink" fullPage contentClassName="flex justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-[28px] border border-white/12 bg-white/[0.06] p-8 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-sm">
        <p className="font-condensed text-[13px] font-black uppercase tracking-[0.28em] text-white/45">
          Something broke
        </p>
        <h1 className="mt-2 text-2xl font-bold text-white">This page did not load</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/65">
          Try it again. If it keeps happening, come back in a few minutes and we should have it
          fixed.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[11px] text-white/35">Reference {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={reset}
            className="bg-play-600 hover:bg-play-500 rounded-xl px-5 py-3 text-center text-sm font-semibold text-white transition"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-white/20 px-5 py-3 text-center text-sm font-semibold text-white/80 transition hover:bg-white/10"
          >
            Go to the home page
          </a>
        </div>
      </div>
    </CourtBackdrop>
  )
}
