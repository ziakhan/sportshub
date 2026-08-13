"use client"

import { useState } from "react"

/**
 * Trigger-action gate (limited-launch design §4): an interactive-looking
 * control on demo content that converts the tap into the signup+demo
 * pitch instead of a dead end. Browsing is never blocked; acting converts.
 */
export function DemoCta({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={
          className ??
          "border-ink-200 text-ink-700 hover:border-amber-400 hover:text-amber-700 rounded-xl border px-3 py-1.5 text-sm font-semibold transition"
        }
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-sm rounded-[28px] bg-white p-7 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">Preview</p>
            <h3 className="text-ink-950 mt-2 text-xl font-bold">This works with an account</h3>
            <p className="text-ink-600 mt-2 text-sm leading-6">
              Create yours free and try the full app as a parent, with demo data. When the real
              season starts this fall, your account will be ready.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => setOpen(false)}
                className="border-ink-200 text-ink-700 hover:border-ink-400 rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Not now
              </button>
              <a
                href="/demo/start?persona=parent"
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-400"
              >
                Create account &amp; try the demo
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
