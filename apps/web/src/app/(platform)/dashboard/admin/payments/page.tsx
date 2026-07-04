"use client"

import { useState, useEffect, useCallback } from "react"
import { POSTURES, postureByKey, postureFromFlags } from "@/lib/payments/postures"

/**
 * Platform payments console (admin only).
 * One "collection posture" dropdown per level replaces the raw allow-flags —
 * only the 7 coherent combinations are offerable, so conflicting states
 * (nothing allowed, dead-end defaults) can't be configured at all.
 * Top: the platform-wide posture + fee every club inherits.
 * Bottom: per-club posture override (or "Platform default") + fee override.
 */

type OnlineMode = "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT"

interface ClubHit {
  id: string
  name: string
  slug: string
}

interface Overrides {
  offlineAllowed: boolean | null
  connectAllowed: boolean | null
  platformCollectAllowed: boolean | null
  platformFeeBps: number | null
  platformFeeFlat: number | null
}

interface ResolvedConfig {
  offlineAllowed: boolean
  connectAllowed: boolean
  platformCollectAllowed: boolean
  offlineEnabled: boolean
  onlineMode: OnlineMode
  chosenOnlineMode: OnlineMode | null
  platformFeeBps: number
  platformFeeFlat: number
  stripeAccountId: string | null
  stripeAccountStatus: string | null
}

const MODE_LABELS: Record<OnlineMode, string> = {
  NONE: "no online payments",
  CONNECT_DIRECT: "club's own Stripe account",
  PLATFORM_COLLECT: "through the platform (instant transfer)",
}

const INHERIT = "INHERIT"

function PostureSelect({
  value,
  onChange,
  includeInherit,
  inheritLabel,
}: {
  value: string
  onChange: (key: string) => void
  includeInherit?: boolean
  inheritLabel?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border-ink-200 w-full rounded-md border px-3 py-2 text-sm"
    >
      {includeInherit && <option value={INHERIT}>{inheritLabel ?? "Platform default"}</option>}
      {POSTURES.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </select>
  )
}

function feePreview(bps: number, flat: number) {
  return `${(bps / 100).toFixed(2)}% + $${flat.toFixed(2)}`
}

export default function AdminPaymentsPage() {
  const [postureKey, setPostureKey] = useState<string | null>(null)
  const [feeBps, setFeeBps] = useState(0)
  const [feeFlat, setFeeFlat] = useState(0)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Club override editor
  const [search, setSearch] = useState("")
  const [hits, setHits] = useState<ClubHit[]>([])
  const [club, setClub] = useState<ClubHit | null>(null)
  const [clubPosture, setClubPosture] = useState<string>(INHERIT)
  const [clubFeeBps, setClubFeeBps] = useState<number | null>(null)
  const [clubFeeFlat, setClubFeeFlat] = useState<number | null>(null)
  const [resolved, setResolved] = useState<ResolvedConfig | null>(null)
  const [savingClub, setSavingClub] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        const posture = postureFromFlags({
          offlineAllowed: data.payOfflineAllowed ?? true,
          connectAllowed: data.payConnectAllowed ?? true,
          platformCollectAllowed: data.payPlatformCollectAllowed ?? false,
        })
        setPostureKey(posture?.key ?? "OFFLINE_CONNECT")
        setFeeBps(data.payPlatformFeeBps ?? 0)
        setFeeFlat(data.payPlatformFeeFlat ?? 0)
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load payment policy" }))
  }, [])

  useEffect(() => {
    if (search.trim().length < 2) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/clubs?search=${encodeURIComponent(search.trim())}`)
        .then((res) => res.json())
        .then((data) =>
          setHits((data.clubs || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })))
        )
        .catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadClub = useCallback(async (hit: ClubHit) => {
    setClub(hit)
    setHits([])
    setSearch("")
    setResolved(null)
    const res = await fetch(`/api/clubs/${hit.id}/payment-config`)
    const data = await res.json()
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to load club config" })
      return
    }
    setResolved(data.config)
    const o: Overrides | null = data.overrides
    const hasFlagOverride =
      o &&
      (o.offlineAllowed !== null || o.connectAllowed !== null || o.platformCollectAllowed !== null)
    if (hasFlagOverride && o) {
      // Partially-overridden rows (possible via the raw API) resolve against
      // the platform policy before matching a posture.
      const posture = postureFromFlags({
        offlineAllowed: o.offlineAllowed ?? data.policy.payOfflineAllowed,
        connectAllowed: o.connectAllowed ?? data.policy.payConnectAllowed,
        platformCollectAllowed: o.platformCollectAllowed ?? data.policy.payPlatformCollectAllowed,
      })
      setClubPosture(posture?.key ?? INHERIT)
    } else {
      setClubPosture(INHERIT)
    }
    setClubFeeBps(o?.platformFeeBps ?? null)
    setClubFeeFlat(o?.platformFeeFlat ?? null)
  }, [])

  async function savePolicy() {
    const posture = postureKey ? postureByKey(postureKey) : null
    if (!posture) return
    setSavingPolicy(true)
    setMessage(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payOfflineAllowed: posture.offlineAllowed,
        payConnectAllowed: posture.connectAllowed,
        payPlatformCollectAllowed: posture.platformCollectAllowed,
        payDefaultOnlineMode: posture.defaultOnlineMode,
        payPlatformFeeBps: feeBps,
        payPlatformFeeFlat: feeFlat,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingPolicy(false)
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to save policy" })
      return
    }
    setMessage({ type: "success", text: "Platform payment policy saved" })
    if (club) loadClub(club) // effective values may have changed
  }

  async function saveClub() {
    if (!club) return
    const posture = clubPosture === INHERIT ? null : postureByKey(clubPosture)
    setSavingClub(true)
    setMessage(null)
    const res = await fetch(`/api/clubs/${club.id}/payment-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offlineAllowed: posture ? posture.offlineAllowed : null,
        connectAllowed: posture ? posture.connectAllowed : null,
        platformCollectAllowed: posture ? posture.platformCollectAllowed : null,
        platformFeeBps: clubFeeBps,
        platformFeeFlat: clubFeeFlat,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSavingClub(false)
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to save club override" })
      return
    }
    setResolved(data.config)
    setMessage({ type: "success", text: `Saved payment policy for ${club.name}` })
  }

  if (!postureKey) {
    return <div className="text-ink-500 py-12 text-center">Loading payment policy...</div>
  }

  const platformPosture = postureByKey(postureKey)
  const selectedClubPosture = clubPosture === INHERIT ? null : postureByKey(clubPosture)

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Payments</h2>
        <p className="text-ink-500 mt-1 text-sm">
          How money is collected — one policy every club inherits, overridable per club.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${message.type === "success" ? "border-court-200 bg-court-50 text-court-700" : "border-hoop-200 bg-hoop-50 text-hoop-700"}`}
        >
          {message.text}
        </div>
      )}

      {/* Platform posture */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 text-lg font-semibold">Platform policy</h3>
        <p className="text-ink-500 mb-4 mt-1 text-sm">
          Applies to every club without an override below.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-ink-700 text-sm font-medium">Collection posture</label>
            <div className="mt-1">
              <PostureSelect value={postureKey} onChange={setPostureKey} />
            </div>
            {platformPosture && (
              <p className="text-ink-500 mt-1 text-xs">{platformPosture.hint}</p>
            )}
            {platformPosture && !platformPosture.offlineAllowed && (
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                Online required: clubs cannot collect anything until they finish Stripe
                onboarding{platformPosture.defaultOnlineMode === "NONE" ? " and pick a rail" : ""}.
              </p>
            )}
          </div>

          <div>
            <label className="text-ink-700 text-sm font-medium">
              Platform fee on online payments
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={50}
                step={0.05}
                value={feeBps / 100}
                onChange={(e) => setFeeBps(Math.round(Number(e.target.value || 0) * 100))}
                className="border-ink-200 w-24 rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-ink-500 text-sm">% +</span>
              <input
                type="number"
                min={0}
                step={0.25}
                value={feeFlat}
                onChange={(e) => setFeeFlat(Number(e.target.value || 0))}
                className="border-ink-200 w-24 rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-ink-500 text-sm">$ per charge</span>
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              Current: {feePreview(feeBps, feeFlat)}. Skimmed from direct charges, withheld from
              platform-collected transfers.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={savePolicy}
            disabled={savingPolicy}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingPolicy ? "Saving..." : "Save platform policy"}
          </button>
        </div>
      </div>

      {/* Per-club override */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 text-lg font-semibold">Per-club policy</h3>
        <p className="text-ink-500 mb-4 mt-1 text-sm">
          Give one club a different posture — force them through the platform, require their own
          Stripe account, or hand them the choice. &ldquo;Platform default&rdquo; follows the
          policy above.
        </p>

        <div className="relative max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clubs by name or slug…"
            className="border-ink-200 w-full rounded-md border px-3 py-2 text-sm"
          />
          {hits.length > 0 && (
            <div className="border-ink-200 absolute z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
              {hits.slice(0, 8).map((h) => (
                <button
                  key={h.id}
                  onClick={() => loadClub(h)}
                  className="hover:bg-ink-50 block w-full px-3 py-2 text-left text-sm"
                >
                  <span className="text-ink-900 font-medium">{h.name}</span>{" "}
                  <span className="text-ink-400">({h.slug})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {club && resolved && (
          <div className="border-ink-100 bg-ink-50 mt-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-ink-950 font-semibold">{club.name}</h4>
              <div className="text-ink-500 text-xs">
                Currently: <span className="font-medium">{MODE_LABELS[resolved.onlineMode]}</span>
                {resolved.offlineAllowed && resolved.offlineEnabled ? " + offline" : ""}
                {" · "}Stripe:{" "}
                <span className="font-medium">
                  {resolved.stripeAccountStatus === "active"
                    ? "connected"
                    : resolved.stripeAccountId
                      ? "onboarding incomplete"
                      : "not set up"}
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-ink-700 text-sm font-medium">Posture for this club</label>
                <div className="mt-1">
                  <PostureSelect
                    value={clubPosture}
                    onChange={setClubPosture}
                    includeInherit
                    inheritLabel={`Platform default (${platformPosture?.label ?? "…"})`}
                  />
                </div>
                {selectedClubPosture && (
                  <p className="text-ink-500 mt-1 text-xs">{selectedClubPosture.hint}</p>
                )}
                {selectedClubPosture &&
                  !selectedClubPosture.offlineAllowed &&
                  resolved.stripeAccountStatus !== "active" && (
                    <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                      This club hasn&apos;t finished Stripe onboarding — with offline banned,
                      nobody can pay them until they do.
                    </p>
                  )}
              </div>

              <div>
                <label className="text-ink-700 text-sm font-medium">Fee override</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.05}
                    placeholder="%"
                    value={clubFeeBps === null ? "" : clubFeeBps / 100}
                    onChange={(e) =>
                      setClubFeeBps(
                        e.target.value === "" ? null : Math.round(Number(e.target.value) * 100)
                      )
                    }
                    className="border-ink-200 w-20 rounded-md border px-2 py-1.5 text-sm"
                  />
                  <span className="text-ink-500 text-xs">% +</span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    placeholder="$"
                    value={clubFeeFlat === null ? "" : clubFeeFlat}
                    onChange={(e) =>
                      setClubFeeFlat(e.target.value === "" ? null : Number(e.target.value))
                    }
                    className="border-ink-200 w-20 rounded-md border px-2 py-1.5 text-sm"
                  />
                  <span className="text-ink-500 text-xs">$</span>
                </div>
                <p className="text-ink-500 mt-1 text-xs">
                  Blank = platform default ({feePreview(feeBps, feeFlat)})
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={saveClub}
                disabled={savingClub}
                className="bg-ink-900 hover:bg-ink-800 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingClub ? "Saving..." : "Save club policy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
