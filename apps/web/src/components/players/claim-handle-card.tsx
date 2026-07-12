"use client"

import { useEffect, useState } from "react"

/**
 * Claim-your-handle card (player-handles-plan.md P0): every player gets a
 * marketable /p/<handle> URL, first-come-first-served. Mounted on the
 * player edit page; the page itself grows into the player-owned hub in P1.
 */
export function ClaimHandleCard({ playerId }: { playerId: string }) {
  const [current, setCurrent] = useState<string | null>(null)
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/players/${playerId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.handle) {
          setCurrent(data.handle)
          setValue(data.handle)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [playerId])

  async function claim() {
    if (busy || !value.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/players/${playerId}/handle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't claim that handle.")
      setCurrent(data.handle)
      setValue(data.handle)
    } catch (e: any) {
      setError(e?.message || "Couldn't claim that handle.")
    } finally {
      setBusy(false)
    }
  }

  const url = current && typeof window !== "undefined" ? `${window.location.origin}/p/${current}` : null

  return (
    <div className="border-ink-100 rounded-2xl border bg-white p-5">
      <h2 className="text-ink-950 text-base font-bold">Player handle</h2>
      <p className="text-ink-500 mt-1 text-sm">
        Claim a unique handle — it becomes this player&apos;s shareable page link.
        First come, first served.
      </p>
      {loaded && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="border-ink-200 focus-within:border-play-500 flex items-center rounded-xl border px-3 py-2">
            <span className="text-ink-400 text-sm">/p/</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.toLowerCase())}
              placeholder="trey-reyes"
              maxLength={20}
              className="text-ink-900 ml-0.5 w-40 text-sm focus:outline-none"
            />
          </div>
          <button
            onClick={claim}
            disabled={busy || !value.trim() || value === current}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : current ? "Change" : "Claim handle"}
          </button>
        </div>
      )}
      {url && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <a href={`/p/${current}`} className="text-play-600 hover:text-play-700 font-semibold">
            {url.replace(/^https?:\/\//, "")}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              })
            }}
            className="text-ink-400 hover:text-ink-700 text-xs font-semibold"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
