"use client"

import { useEffect, useState } from "react"

/**
 * Account handle card (owner 2026-07-23: every account owns a handle — a
 * generated default reserved at signup, changeable here, first come first
 * served). Lives on the /account hub.
 */
export function HandleCard() {
  const [handle, setHandle] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/account/handle")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setHandle(d?.handle ?? null)
        setDraft(d?.handle ?? "")
      })
      .catch(() => {})
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/account/handle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't save that handle")
      setHandle(data.handle)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that handle")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border-ink-100 mt-6 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink-950 text-[15px] font-semibold">Your handle</p>
          <p className="text-ink-600 mt-0.5 text-[13px]">
            {handle ? (
              <>
                <span className="text-play-700 font-semibold">@{handle}</span> — your name across
                SportsHub. First come, first served.
              </>
            ) : (
              "Reserve your name across SportsHub. First come, first served."
            )}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="border-ink-200 text-ink-700 hover:bg-ink-50 cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors duration-200"
          >
            {handle ? "Change" : "Claim"}
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-3">
          <div className="flex gap-2">
            <div className="border-ink-200 focus-within:border-play-500 flex w-full items-center rounded-xl border bg-white px-3 shadow-sm">
              <span className="text-ink-400 text-sm">@</span>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.toLowerCase())}
                className="text-ink-900 w-full border-0 bg-transparent px-1 py-2 text-sm focus:outline-none focus:ring-0"
                placeholder="yourname"
                maxLength={20}
              />
            </div>
            <button
              type="button"
              onClick={save}
              disabled={busy || draft.length < 3}
              className="bg-play-600 hover:bg-play-700 disabled:bg-ink-300 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed"
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setDraft(handle ?? "")
                setError(null)
              }}
              className="text-ink-500 hover:text-ink-800 cursor-pointer px-2 text-sm font-semibold"
            >
              Cancel
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
