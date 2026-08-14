"use client"

import { useEffect, useState } from "react"

/**
 * The kitchen-table half of family linking (parent-child linking arc,
 * 2026-08-13): six characters a parent reads out loud while their kid signs
 * up, instead of an email round trip nobody is waiting on.
 *
 * Contract (apps/web/src/app/api/family/link-code/route.ts):
 *   GET  200 { code, expiresAt, direction, playerId } | { code: null }
 *   POST 201 { code, expiresAt, direction, playerId }   body {} is enough:
 *        the server decides the direction from who is asking, never the client.
 */

type LinkCode = {
  code: string
  expiresAt: string
  direction: "PARENT_INVITES_CHILD" | "CHILD_INVITES_PARENT"
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

export function FamilyCodeCard() {
  const [active, setActive] = useState<LinkCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/family/link-code")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.code) setActive(d as LinkCode)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function mint() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch("/api/family/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "We couldn't make a code just now")
      setActive(d as LinkCode)
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't make a code just now")
    } finally {
      setBusy(false)
    }
  }

  const forChild = active?.direction !== "CHILD_INVITES_PARENT"

  return (
    <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#101c36] via-[#1b2a4a] to-[#0d1526] p-6 text-white shadow-[0_30px_80px_-45px_rgba(2,6,23,0.9)] sm:p-7">
      <svg
        className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 opacity-[0.45]"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="sh-ball-familycode" cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#9a3412" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="90" fill="url(#sh-ball-familycode)" />
        <g fill="none" stroke="#7c2d12" strokeWidth="3.5" strokeLinecap="round" opacity="0.85">
          <path d="M100 10v180" />
          <path d="M10 100h180" />
          <path d="M42 31c36 34 36 104 0 138" />
          <path d="M158 31c-36 34-36 104 0 138" />
        </g>
      </svg>

      <p className="font-condensed relative text-[11.5px] font-bold uppercase tracking-[0.18em] text-amber-300">
        Family code
      </p>

      <div className="relative mt-3 flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="min-w-0">
          {loading ? (
            <p className="text-white/60">Checking...</p>
          ) : active ? (
            <p className="font-mono text-[34px] font-black leading-none tracking-[0.28em] text-amber-200 sm:text-[40px]">
              {active.code}
            </p>
          ) : (
            <p className="text-[15px] leading-6 text-white/80">
              No code yet. Make one and read it out.
            </p>
          )}
          {active && (
            <p className="mt-2 text-[13px] text-white/70">
              Works for 7 days
              {active.expiresAt ? ` · until ${formatDay(active.expiresAt)}` : ""}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void mint()}
          disabled={busy}
          className="min-h-[44px] cursor-pointer rounded-2xl bg-amber-500 px-5 py-2.5 text-[15px] font-bold text-amber-950 shadow-md transition-colors duration-200 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101c36] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy ? "Making..." : active ? "New code" : "Make a code"}
        </button>
      </div>

      {error && <p className="relative mt-3 text-sm font-semibold text-amber-200">{error}</p>}

      <p className="relative mt-4 text-[13.5px] leading-6 text-white/75">
        {forChild
          ? "Your child enters this when they sign up and your accounts link right away."
          : "Your parent enters this and your accounts link right away."}
      </p>
    </div>
  )
}
