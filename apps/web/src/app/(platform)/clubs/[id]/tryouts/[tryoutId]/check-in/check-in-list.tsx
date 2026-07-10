"use client"

import { useState } from "react"
import { format } from "date-fns"

interface CheckInSignup {
  id: string
  playerName: string
  playerAge: number | null
  playerGender: string | null
  status: string
  checkedInAt: string | null
  parentName: string
}

export function CheckInList({
  tryoutId,
  signups: initialSignups,
}: {
  tryoutId: string
  signups: CheckInSignup[]
}) {
  const [signups, setSignups] = useState(initialSignups)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  const checkedInCount = signups.filter((s) => s.checkedInAt).length

  async function toggle(signup: CheckInSignup) {
    if (pending.has(signup.id)) return
    const checkingIn = !signup.checkedInAt
    setError(null)
    setPending((p) => new Set(p).add(signup.id))
    // Optimistic — roll-call needs to feel instant on a phone in a gym
    setSignups((list) =>
      list.map((s) =>
        s.id === signup.id
          ? { ...s, checkedInAt: checkingIn ? new Date().toISOString() : null }
          : s
      )
    )
    try {
      const res = await fetch(`/api/tryouts/${tryoutId}/signups/${signup.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn: checkingIn }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setSignups((list) =>
        list.map((s) => (s.id === signup.id ? { ...s, checkedInAt: updated.checkedInAt } : s))
      )
    } catch {
      setSignups((list) =>
        list.map((s) => (s.id === signup.id ? { ...s, checkedInAt: signup.checkedInAt } : s))
      )
      setError(`Couldn't update ${signup.playerName} — check your connection and try again.`)
    } finally {
      setPending((p) => {
        const next = new Set(p)
        next.delete(signup.id)
        return next
      })
    }
  }

  const q = query.trim().toLowerCase()
  const visible = q
    ? signups.filter(
        (s) => s.playerName.toLowerCase().includes(q) || s.parentName.toLowerCase().includes(q)
      )
    : signups

  return (
    <div>
      {/* Progress — sticky so the count stays visible while scrolling the list */}
      <div className="bg-ink-50/95 sticky top-0 z-10 -mx-1 mb-4 px-1 py-2 backdrop-blur-sm">
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-condensed text-ink-950 text-4xl font-bold leading-none">
              {checkedInCount}
              <span className="text-ink-400 font-barlow text-base font-medium">
                {" "}
                / {signups.length}
              </span>
            </span>
            <span className="text-ink-500 text-sm font-medium">checked in</span>
          </div>
          <div className="bg-ink-100 mt-3 h-2 overflow-hidden rounded-full">
            <div
              className="grow-x h-full rounded-full bg-[var(--brand)] transition-all"
              style={{
                width: signups.length ? `${(checkedInCount / signups.length) * 100}%` : "0%",
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-3 rounded-xl border px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {signups.length > 7 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search player or parent…"
          className="border-ink-200 mb-3 w-full rounded-xl border bg-white px-4 py-2.5 text-sm transition-colors focus:border-[color:var(--brand)] focus:outline-none"
        />
      )}

      {signups.length === 0 ? (
        <div className="border-ink-300 shadow-soft rounded-3xl border border-dashed bg-white p-10 text-center">
          <p className="text-ink-600">No signups for this tryout yet.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-ink-500 py-6 text-center text-sm">No players match “{query}”.</p>
      ) : (
        <div className="reveal space-y-2" style={{ animationDelay: "80ms" }}>
          {visible.map((signup) => {
            const isIn = !!signup.checkedInAt
            const isPending = pending.has(signup.id)
            return (
              <button
                key={signup.id}
                onClick={() => toggle(signup)}
                disabled={isPending}
                className={`shadow-soft flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 active:scale-[0.99] ${
                  isIn
                    ? "border-court-300 bg-court-50"
                    : "border-ink-100 hover:bg-court-50 hover:border-court-200 bg-white"
                } ${isPending ? "opacity-60" : ""}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold transition-colors ${
                    isIn
                      ? "border-court-600 bg-court-600 text-white"
                      : "border-ink-200 text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-900 block truncate font-semibold">
                    {signup.playerName}
                  </span>
                  <span className="text-ink-500 block truncate text-xs">
                    {signup.playerAge != null ? `${signup.playerAge}` : ""}
                    {signup.playerGender ? ` • ${signup.playerGender.toLowerCase()}` : ""}
                    {signup.parentName ? ` • ${signup.parentName}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {isIn ? (
                    <span className="text-court-700 text-xs font-semibold">
                      {format(new Date(signup.checkedInAt as string), "h:mm a")}
                    </span>
                  ) : (
                    <span className="text-ink-400 text-xs">Tap to check in</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
