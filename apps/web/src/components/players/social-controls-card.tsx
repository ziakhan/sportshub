"use client"

import { useCallback, useEffect, useState } from "react"

interface SocialState {
  socialVisibility: "PUBLIC" | "PRIVATE"
  followerCount: number
  pendingRequests: Array<{ id: string; name: string; createdAt: string }>
  moments: Array<{
    id: string
    gameId: string
    cardType: "STAT_CARD" | "POTG"
    visibility: string
    createdAt: string
    expiresAt: string
    active: boolean
    views: number
  }>
}

/**
 * Parent controls for a player's social layer (social-feed-plan P3/P4):
 * public/private toggle, pending follow-request approvals, follower count,
 * and the 24h-story "Moments" archive with view counts.
 */
export function SocialControlsCard({ playerId }: { playerId: string }) {
  const [state, setState] = useState<SocialState | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/players/${playerId}/social`)
      if (res.ok) setState(await res.json())
    } catch {
      /* card is best-effort */
    }
  }, [playerId])

  useEffect(() => {
    void load()
  }, [load])

  if (!state) return null

  const setVisibility = async (socialVisibility: "PUBLIC" | "PRIVATE") => {
    if (busy || socialVisibility === state.socialVisibility) return
    setBusy(true)
    setState((s) => (s ? { ...s, socialVisibility } : s))
    try {
      await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialVisibility }),
      })
    } finally {
      setBusy(false)
    }
  }

  const decide = async (followId: string, action: "approve" | "decline") => {
    setState((s) =>
      s ? { ...s, pendingRequests: s.pendingRequests.filter((r) => r.id !== followId) } : s
    )
    await fetch(`/api/follows/${followId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    void load()
  }

  return (
    <div className="border-ink-100 shadow-soft mt-6 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-ink-950 text-lg font-semibold">Social &amp; followers</h2>
        <span className="text-ink-500 text-sm font-medium">
          {state.followerCount} follower{state.followerCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <label className="border-ink-200 hover:bg-ink-50 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
          <input
            type="radio"
            name="socialVisibility"
            checked={state.socialVisibility === "PRIVATE"}
            onChange={() => setVisibility("PRIVATE")}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="text-ink-900 font-semibold">Private (recommended)</span>
            <span className="text-ink-500 block">
              You approve every follower. Shared moments reach approved followers only.
            </span>
          </span>
        </label>
        <label className="border-ink-200 hover:bg-ink-50 flex cursor-pointer items-start gap-3 rounded-xl border p-3">
          <input
            type="radio"
            name="socialVisibility"
            checked={state.socialVisibility === "PUBLIC"}
            onChange={() => setVisibility("PUBLIC")}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="text-ink-900 font-semibold">Public</span>
            <span className="text-ink-500 block">
              Anyone can follow instantly, and moments can be shared publicly.
            </span>
          </span>
        </label>
      </div>

      {state.pendingRequests.length > 0 && (
        <div className="mt-5">
          <h3 className="text-ink-900 text-sm font-semibold">Follow requests</h3>
          <div className="mt-2 space-y-2">
            {state.pendingRequests.map((r) => (
              <div
                key={r.id}
                className="border-ink-100 bg-ink-50/50 flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <span className="text-ink-800 text-sm font-medium">{r.name}</span>
                <span className="flex gap-2">
                  <button
                    onClick={() => decide(r.id, "approve")}
                    className="bg-court-600 hover:bg-court-700 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(r.id, "decline")}
                    className="border-ink-200 text-ink-600 hover:bg-ink-100 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    Decline
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {state.moments.length > 0 && (
        <div className="mt-5">
          <h3 className="text-ink-900 text-sm font-semibold">Moments</h3>
          <p className="text-ink-500 mt-0.5 text-xs">
            Shared stories stay here for your family after they leave feeds at 24 hours.
          </p>
          <div className="mt-2 space-y-1.5">
            {state.moments.map((m) => (
              <a
                key={m.id}
                href={
                  m.cardType === "POTG"
                    ? `/api/live/${m.gameId}/card?src=story:${m.id}&v=2`
                    : `/api/live/${m.gameId}/card/${playerId}?src=story:${m.id}&v=2`
                }
                target="_blank"
                rel="noreferrer"
                className="border-ink-100 hover:bg-ink-50 flex items-center justify-between rounded-xl border px-3 py-2"
              >
                <span className="text-ink-800 text-sm font-medium">
                  {m.cardType === "POTG" ? "🏀 Player of the Game" : "📊 Game stats"} ·{" "}
                  {new Date(m.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-ink-500 text-xs font-semibold">
                  {m.active ? "Live · " : ""}
                  {m.views} view{m.views === 1 ? "" : "s"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
