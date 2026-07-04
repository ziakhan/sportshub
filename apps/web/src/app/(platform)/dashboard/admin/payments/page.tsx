"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Platform payments console (admin only).
 * Top: the platform-wide policy every merchant inherits — which collection
 * modes exist, the default mode, the default fee.
 * Bottom: per-club overrides — force a club through the platform, force them
 * onto their own Stripe account, allow a choice, ban offline, override fees.
 */

type OnlineMode = "NONE" | "CONNECT_DIRECT" | "PLATFORM_COLLECT"

interface PolicyForm {
  payOfflineAllowed: boolean
  payConnectAllowed: boolean
  payPlatformCollectAllowed: boolean
  payDefaultOnlineMode: OnlineMode
  payPlatformFeeBps: number
  payPlatformFeeFlat: number
}

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
  NONE: "No online payments",
  CONNECT_DIRECT: "Club's own Stripe account",
  PLATFORM_COLLECT: "Platform collects (instant transfer to club)",
}

function TriState({
  label,
  hint,
  value,
  inheritedValue,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean | null
  inheritedValue: boolean
  onChange: (v: boolean | null) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <div className="text-ink-900 text-sm font-medium">{label}</div>
        {hint && <div className="text-ink-500 text-xs">{hint}</div>}
      </div>
      <select
        value={value === null ? "inherit" : value ? "yes" : "no"}
        onChange={(e) =>
          onChange(e.target.value === "inherit" ? null : e.target.value === "yes")
        }
        className="border-ink-200 rounded-md border px-2 py-1.5 text-sm"
      >
        <option value="inherit">Platform default ({inheritedValue ? "yes" : "no"})</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  )
}

export default function AdminPaymentsPage() {
  const [policy, setPolicy] = useState<PolicyForm | null>(null)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Club override editor
  const [search, setSearch] = useState("")
  const [hits, setHits] = useState<ClubHit[]>([])
  const [club, setClub] = useState<ClubHit | null>(null)
  const [overrides, setOverrides] = useState<Overrides | null>(null)
  const [resolved, setResolved] = useState<ResolvedConfig | null>(null)
  const [savingClub, setSavingClub] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) =>
        setPolicy({
          payOfflineAllowed: data.payOfflineAllowed ?? true,
          payConnectAllowed: data.payConnectAllowed ?? true,
          payPlatformCollectAllowed: data.payPlatformCollectAllowed ?? false,
          payDefaultOnlineMode: data.payDefaultOnlineMode ?? "NONE",
          payPlatformFeeBps: data.payPlatformFeeBps ?? 0,
          payPlatformFeeFlat: data.payPlatformFeeFlat ?? 0,
        })
      )
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
          setHits(
            (data.clubs || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))
          )
        )
        .catch(() => setHits([]))
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const loadClub = useCallback(async (hit: ClubHit) => {
    setClub(hit)
    setHits([])
    setSearch("")
    setOverrides(null)
    setResolved(null)
    const res = await fetch(`/api/clubs/${hit.id}/payment-config`)
    const data = await res.json()
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to load club config" })
      return
    }
    setResolved(data.config)
    setOverrides(
      data.overrides ?? {
        offlineAllowed: null,
        connectAllowed: null,
        platformCollectAllowed: null,
        platformFeeBps: null,
        platformFeeFlat: null,
      }
    )
  }, [])

  async function savePolicy() {
    if (!policy) return
    setSavingPolicy(true)
    setMessage(null)
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policy),
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
    if (!club || !overrides) return
    setSavingClub(true)
    setMessage(null)
    const res = await fetch(`/api/clubs/${club.id}/payment-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(overrides),
    })
    const data = await res.json().catch(() => ({}))
    setSavingClub(false)
    if (!res.ok) {
      setMessage({ type: "error", text: data.error || "Failed to save club overrides" })
      return
    }
    setResolved(data.config)
    setMessage({ type: "success", text: `Saved payment overrides for ${club.name}` })
  }

  if (!policy) {
    return <div className="text-ink-500 py-12 text-center">Loading payment policy...</div>
  }

  const feePreview = (bps: number, flat: number) =>
    `${(bps / 100).toFixed(2)}% + $${flat.toFixed(2)}`

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Payments</h2>
        <p className="text-ink-500 mt-1 text-sm">
          The platform-wide policy every club inherits, and per-club overrides.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${message.type === "success" ? "border-court-200 bg-court-50 text-court-700" : "border-hoop-200 bg-hoop-50 text-hoop-700"}`}
        >
          {message.text}
        </div>
      )}

      {/* Platform defaults */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 text-lg font-semibold">Platform defaults</h3>
        <p className="text-ink-500 mb-4 mt-1 text-sm">
          Applies to every club unless overridden below. Turning a mode off here turns it off for
          all clubs without an explicit override.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={policy.payOfflineAllowed}
                onChange={(e) => setPolicy({ ...policy, payOfflineAllowed: e.target.checked })}
              />
              Allow offline payments (cash / e-transfer / pay later)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={policy.payConnectAllowed}
                onChange={(e) => setPolicy({ ...policy, payConnectAllowed: e.target.checked })}
              />
              Allow clubs to use their own Stripe account
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={policy.payPlatformCollectAllowed}
                onChange={(e) =>
                  setPolicy({ ...policy, payPlatformCollectAllowed: e.target.checked })
                }
              />
              Allow platform-collected payments (instant transfer to club)
            </label>

            <div className="pt-2">
              <label className="text-ink-700 text-sm font-medium">Default online mode</label>
              <select
                value={policy.payDefaultOnlineMode}
                onChange={(e) =>
                  setPolicy({ ...policy, payDefaultOnlineMode: e.target.value as OnlineMode })
                }
                className="border-ink-200 mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {(Object.keys(MODE_LABELS) as OnlineMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABELS[m]}
                  </option>
                ))}
              </select>
              <p className="text-ink-500 mt-1 text-xs">
                What a club starts on before making a choice. If the mode isn&apos;t allowed above,
                it falls back automatically.
              </p>
            </div>
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
                value={policy.payPlatformFeeBps / 100}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    payPlatformFeeBps: Math.round(Number(e.target.value || 0) * 100),
                  })
                }
                className="border-ink-200 w-24 rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-ink-500 text-sm">% +</span>
              <input
                type="number"
                min={0}
                step={0.25}
                value={policy.payPlatformFeeFlat}
                onChange={(e) =>
                  setPolicy({ ...policy, payPlatformFeeFlat: Number(e.target.value || 0) })
                }
                className="border-ink-200 w-24 rounded-md border px-3 py-2 text-sm"
              />
              <span className="text-ink-500 text-sm">$ per charge</span>
            </div>
            <p className="text-ink-500 mt-1 text-xs">
              Current default: {feePreview(policy.payPlatformFeeBps, policy.payPlatformFeeFlat)}.
              Applied in both online modes — skimmed from direct charges, withheld from
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
            {savingPolicy ? "Saving..." : "Save platform defaults"}
          </button>
        </div>
      </div>

      {/* Per-club overrides */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 text-lg font-semibold">Per-club overrides</h3>
        <p className="text-ink-500 mb-4 mt-1 text-sm">
          Force a club through the platform, force them onto their own Stripe account, give them
          the choice, ban offline, or set a custom fee. &ldquo;Platform default&rdquo; means the
          club follows the settings above.
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

        {club && overrides && resolved && (
          <div className="border-ink-100 bg-ink-50 mt-4 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-ink-950 font-semibold">{club.name}</h4>
              <div className="text-ink-500 text-xs">
                Effective mode: <span className="font-medium">{MODE_LABELS[resolved.onlineMode]}</span>
                {" · "}Stripe account:{" "}
                <span className="font-medium">
                  {resolved.stripeAccountStatus === "active"
                    ? "active"
                    : resolved.stripeAccountId
                      ? "onboarding incomplete"
                      : "none"}
                </span>
              </div>
            </div>

            <div className="divide-ink-100 mt-2 divide-y">
              <TriState
                label="Offline payments allowed"
                hint="No = every payment to this club must go through the online rail"
                value={overrides.offlineAllowed}
                inheritedValue={policy.payOfflineAllowed}
                onChange={(v) => setOverrides({ ...overrides, offlineAllowed: v })}
              />
              <TriState
                label="Own Stripe account allowed"
                hint="No + platform-collect yes = club is forced through the platform"
                value={overrides.connectAllowed}
                inheritedValue={policy.payConnectAllowed}
                onChange={(v) => setOverrides({ ...overrides, connectAllowed: v })}
              />
              <TriState
                label="Platform-collect allowed"
                hint="Yes + own-account no = forced; both yes = the club picks"
                value={overrides.platformCollectAllowed}
                inheritedValue={policy.payPlatformCollectAllowed}
                onChange={(v) => setOverrides({ ...overrides, platformCollectAllowed: v })}
              />

              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-ink-900 text-sm font-medium">Platform fee override</div>
                  <div className="text-ink-500 text-xs">
                    Blank = platform default (
                    {feePreview(policy.payPlatformFeeBps, policy.payPlatformFeeFlat)})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.05}
                    placeholder="%"
                    value={overrides.platformFeeBps === null ? "" : overrides.platformFeeBps / 100}
                    onChange={(e) =>
                      setOverrides({
                        ...overrides,
                        platformFeeBps:
                          e.target.value === "" ? null : Math.round(Number(e.target.value) * 100),
                      })
                    }
                    className="border-ink-200 w-20 rounded-md border px-2 py-1.5 text-sm"
                  />
                  <span className="text-ink-500 text-xs">% +</span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    placeholder="$"
                    value={overrides.platformFeeFlat === null ? "" : overrides.platformFeeFlat}
                    onChange={(e) =>
                      setOverrides({
                        ...overrides,
                        platformFeeFlat: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="border-ink-200 w-20 rounded-md border px-2 py-1.5 text-sm"
                  />
                  <span className="text-ink-500 text-xs">$</span>
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                onClick={saveClub}
                disabled={savingClub}
                className="bg-ink-900 hover:bg-ink-800 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingClub ? "Saving..." : "Save club overrides"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
