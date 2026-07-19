"use client"

import { useState, useEffect } from "react"

interface Country {
  code: string
  name: string
  currency: string
  currencySymbol: string
}

export default function AdminSettingsPage() {
  const [availableCountries, setAvailableCountries] = useState<Country[]>([])
  const [enabledCodes, setEnabledCodes] = useState<string[]>([])
  const [seoIndexing, setSeoIndexing] = useState(false)
  const [savingSeo, setSavingSeo] = useState(false)
  const [palette, setPalette] = useState("hardwood")
  const [savingPalette, setSavingPalette] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reviewPolicy, setReviewPolicy] = useState<"AUTO" | "OFF">("AUTO")
  const [reviewDays, setReviewDays] = useState(30)
  const [savingReviews, setSavingReviews] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        setAvailableCountries(data.availableCountries || [])
        setEnabledCodes(data.enabledCountries || ["US"])
        setSeoIndexing(!!data.seoIndexingEnabled)
        setPalette(data.themePalette || "hardwood")
        setReviewPolicy(data.reviewInvitePolicy === "OFF" ? "OFF" : "AUTO")
        setReviewDays(data.reviewWindowDays || 30)
      })
      .catch(() => setMessage({ type: "error", text: "Failed to load settings" }))
      .finally(() => setLoading(false))
  }, [])

  const toggleSeoIndexing = async () => {
    const next = !seoIndexing
    setSavingSeo(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seoIndexingEnabled: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setSeoIndexing(next)
      setMessage({
        type: "success",
        text: next
          ? "Search engine indexing ENABLED — robots.txt, sitemap and meta tags now allow crawling."
          : "Search engine indexing disabled — the whole site is noindex again.",
      })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" })
    } finally {
      setSavingSeo(false)
    }
  }

  const choosePalette = async (id: string) => {
    if (id === palette) return
    setSavingPalette(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePalette: id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setPalette(id)
      // The palette is stamped on <html> by the server layout — reload so the
      // admin sees the change everywhere immediately.
      window.location.reload()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" })
      setSavingPalette(false)
    }
  }

  const toggleCountry = (code: string) => {
    setEnabledCodes((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev // Can't disable the last country
        return prev.filter((c) => c !== code)
      }
      return [...prev, code]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledCountries: enabledCodes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setMessage({ type: "success", text: "Settings saved successfully" })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-ink-500 py-12 text-center">Loading settings...</div>
  }

  return (
    <div className="space-y-5">
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <div className="border-play-100 bg-play-50 text-play-600 mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">
          Admin
        </div>
        <h2 className="font-display text-ink-950 text-2xl font-bold">Platform settings</h2>
        <p className="text-ink-500 mt-1 text-sm">Configure platform-wide settings</p>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${message.type === "success" ? "border-court-200 bg-court-50 text-court-700" : "border-hoop-200 bg-hoop-50 text-hoop-700"}`}
        >
          {message.text}
        </div>
      )}

      {/* Search engine indexing (SEO go-live switch) */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">
          Search engine indexing
        </h3>
        <p className="text-ink-500 mb-4 text-sm">
          Master switch for Google &amp; friends. While OFF, every page carries a noindex tag,
          robots.txt disallows all crawling, and the sitemap is empty — regardless of per-page
          rules. Flip it ON at go-live (see docs/roadmap/seo-strategy.md).
        </p>
        <div className="flex items-center justify-between rounded-lg border border-ink-200 p-4">
          <div>
            <div className="text-ink-900 font-medium">
              {seoIndexing ? "Indexing is ON" : "Indexing is OFF"}
            </div>
            <div className="text-ink-500 text-xs">
              {seoIndexing
                ? "Search engines can crawl and index the public site."
                : "Site is invisible to search engines until you enable this."}
            </div>
          </div>
          <button
            onClick={toggleSeoIndexing}
            disabled={savingSeo}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              seoIndexing ? "bg-ink-500 hover:bg-ink-600" : "bg-court-600 hover:bg-court-700"
            }`}
          >
            {savingSeo ? "Saving..." : seoIndexing ? "Turn OFF" : "Turn ON"}
          </button>
        </div>
      </div>

      {/* Review invitations (owner 2026-07-18) */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">Season-end review invitations</h3>
        <p className="text-ink-500 mb-4 text-sm">
          When a season concludes, every participating family is invited to review their club.
          Platform default below; individual clubs can hold admin-granted overrides.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              checked={reviewPolicy === "AUTO"}
              onChange={() => setReviewPolicy("AUTO")}
            />
            Automatic on season conclude
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              checked={reviewPolicy === "OFF"}
              onChange={() => setReviewPolicy("OFF")}
            />
            Off
          </label>
          <label className="flex items-center gap-2 text-sm">
            Window
            <input
              type="number"
              min={7}
              max={90}
              value={reviewDays}
              onChange={(e) => setReviewDays(parseInt(e.target.value) || 30)}
              className="border-ink-200 w-20 rounded-lg border px-2 py-1"
            />
            days
          </label>
          <button
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={savingReviews}
            onClick={async () => {
              setSavingReviews(true)
              setMessage(null)
              try {
                const res = await fetch("/api/admin/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ reviewInvitePolicy: reviewPolicy, reviewWindowDays: reviewDays }),
                })
                if (!res.ok) throw new Error()
                setMessage({ type: "success", text: "Review invitation settings saved" })
              } catch {
                setMessage({ type: "error", text: "Failed to save review settings" })
              } finally {
                setSavingReviews(false)
              }
            }}
          >
            {savingReviews ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Theme palette (Energy Pass) */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">Theme palette</h3>
        <p className="text-ink-500 mb-4 text-sm">
          Site-wide color direction — applies instantly to every visitor, no deploy needed. Club
          and team colors are never affected; this changes the chrome around them.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              id: "hardwood",
              label: "Hardwood",
              blurb: "Indigo brand, hot orange energy, navy score surfaces",
              chips: ["#4f46e5", "#f24e1e", "#0b1628", "#fbbf24"],
            },
            {
              id: "fastbreak",
              label: "Fastbreak",
              blurb: "Violet brand, volt-lime energy, deep-violet surfaces",
              chips: ["#6d28d9", "#a3e635", "#190a2e", "#22d3ee"],
            },
            {
              id: "primetime",
              label: "Prime Time",
              blurb: "Scarlet brand, gold energy, broadcast-black surfaces",
              chips: ["#dc2626", "#f59e0b", "#0c0f13", "#f59e0b"],
            },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => void choosePalette(p.id)}
              disabled={savingPalette}
              className={`rounded-xl border-2 p-4 text-left transition disabled:opacity-60 ${
                palette === p.id
                  ? "border-play-500 bg-play-50"
                  : "border-ink-200 hover:border-ink-300 bg-white"
              }`}
            >
              <div className="mb-2 flex gap-1.5">
                {p.chips.map((c) => (
                  <span key={c} className="h-5 w-5 rounded-md" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="text-ink-900 text-sm font-bold">
                {p.label}
                {palette === p.id && <span className="text-play-600 ml-2 text-xs">Active</span>}
              </div>
              <div className="text-ink-500 mt-0.5 text-xs">{p.blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Enabled Countries */}
      <div className="border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
        <h3 className="font-display text-ink-950 mb-2 text-lg font-semibold">Enabled countries</h3>
        <p className="text-ink-500 mb-4 text-sm">
          Select which countries are active on the platform. When only one country is enabled,
          country selectors are hidden and that country is used as the default everywhere.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {availableCountries.map((country) => {
            const isEnabled = enabledCodes.includes(country.code)
            const isOnly = isEnabled && enabledCodes.length === 1

            return (
              <label
                key={country.code}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                  isEnabled
                    ? "border-play-300 bg-play-50"
                    : "border-ink-200 hover:border-ink-300 hover:bg-ink-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleCountry(country.code)}
                  disabled={isOnly}
                  className="border-ink-300 text-play-600 focus:ring-play-500 rounded disabled:opacity-50"
                />
                <div>
                  <div className="text-ink-900 font-medium">{country.name}</div>
                  <div className="text-ink-500 text-xs">
                    {country.code} &middot; {country.currency} ({country.currencySymbol})
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-ink-500 text-xs">
            {enabledCodes.length === 1
              ? "Single-country mode: country selectors will be hidden across the platform"
              : `${enabledCodes.length} countries enabled: users will see country selectors`}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-play-600 hover:bg-play-700 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
