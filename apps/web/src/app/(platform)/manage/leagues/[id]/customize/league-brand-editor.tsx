"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ImageUploadField } from "@/components/club-page/image-upload-field"
import { PREDEFINED_PERKS, perkLabel } from "@/lib/leagues/perks"

interface Initial {
  description: string
  logoUrl: string | null
  bannerUrl: string | null
  tagline: string
  primaryColor: string
  socials: Record<string, string>
  perks: string[]
  perksNote: string
}

const input =
  "mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
const label = "text-sm font-medium text-ink-700"
const SOCIALS = [
  ["instagram", "Instagram", "@handle"],
  ["facebook", "Facebook", "page or URL"],
  ["x", "X (Twitter)", "@handle"],
  ["youtube", "YouTube", "channel URL"],
  ["tiktok", "TikTok", "@handle"],
] as const

const PREDEFINED_KEYS = new Set(PREDEFINED_PERKS.map((p) => p.key))

export function LeagueBrandEditor({ leagueId, initial }: { leagueId: string; initial: Initial }) {
  const router = useRouter()
  const [f, setF] = useState({ ...initial })
  const [customPerk, setCustomPerk] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof Initial, v: any) => setF((p) => ({ ...p, [k]: v }))

  const customPerks = f.perks.filter((p) => !PREDEFINED_KEYS.has(p))

  function togglePredefinedPerk(key: string) {
    setF((p) => ({
      ...p,
      perks: p.perks.includes(key) ? p.perks.filter((x) => x !== key) : [...p.perks, key],
    }))
  }

  function addCustomPerk() {
    const value = customPerk.trim()
    if (!value || f.perks.includes(value)) return
    if (f.perks.length >= 24) return
    setF((p) => ({ ...p, perks: [...p.perks, value] }))
    setCustomPerk("")
  }

  function removePerk(entry: string) {
    setF((p) => ({ ...p, perks: p.perks.filter((x) => x !== entry) }))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const socials = Object.fromEntries(
      Object.entries(f.socials || {}).filter(([, v]) => (v || "").trim())
    )
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: f.description || null,
          logoUrl: f.logoUrl,
          bannerUrl: f.bannerUrl,
          tagline: f.tagline || null,
          primaryColor: f.primaryColor,
          socials,
          perks: f.perks,
          perksNote: f.perksNote || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMsg({ ok: false, text: data.error || "Couldn't save." })
      else {
        setMsg({ ok: true, text: "Saved — your league page is updated." })
        router.refresh()
      }
    } catch {
      setMsg({ ok: false, text: "Network error." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="border-ink-100 shadow-soft rounded-3xl border bg-white p-6">
        <h3 className="text-ink-950 font-bold">Brand</h3>
        <p className="text-ink-500 mb-4 mt-0.5 text-sm">
          Banner, logo, color, and the words at the top of your league page.
        </p>
        <div className="space-y-5">
          <ImageUploadField
            label="Banner image"
            value={f.bannerUrl}
            onChange={(v) => set("bannerUrl", v)}
            aspect="wide"
            maxSize={1600}
            hint="Wide hero image. No image = a gradient in your primary color."
          />
          <ImageUploadField
            label="Logo"
            value={f.logoUrl}
            onChange={(v) => set("logoUrl", v)}
            aspect="square"
            maxSize={512}
          />
          <div>
            <label className={label}>Tagline</label>
            <input
              className={input}
              value={f.tagline}
              maxLength={200}
              placeholder="e.g. Ontario's premier youth circuit"
              onChange={(e) => set("tagline", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea
              className={input}
              rows={4}
              value={f.description}
              placeholder="A short paragraph about the league."
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Primary color</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={f.primaryColor}
                onChange={(e) => set("primaryColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-ink-200"
              />
              <input
                className="w-24 rounded-lg border border-ink-200 px-2 py-1 text-xs"
                value={f.primaryColor}
                onChange={(e) => set("primaryColor", e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-ink-100 shadow-soft rounded-3xl border bg-white p-6">
        <h3 className="text-ink-950 mb-4 font-bold">Follow us</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map(([k, lbl, ph]) => (
            <div key={k}>
              <label className={label}>{lbl}</label>
              <input
                className={input}
                value={f.socials?.[k] || ""}
                placeholder={ph}
                onChange={(e) => setF((p) => ({ ...p, socials: { ...p.socials, [k]: e.target.value } }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-ink-100 shadow-soft rounded-3xl border bg-white p-6">
        <h3 className="text-ink-950 font-bold">What&apos;s included</h3>
        <p className="text-ink-500 mb-4 mt-0.5 text-sm">
          Show clubs what they get by joining. These perks appear on your league page and
          anywhere clubs browse leagues.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PREDEFINED_PERKS.map((perk) => (
            <label
              key={perk.key}
              className="border-ink-100 hover:bg-ink-50 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={f.perks.includes(perk.key)}
                onChange={() => togglePredefinedPerk(perk.key)}
                className="accent-play-600"
              />
              <span className="text-ink-800">{perk.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-5">
          <label className={label}>Add a custom perk</label>
          <div className="mt-1 flex gap-2">
            <input
              className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm text-ink-900 focus:border-play-500 focus:outline-none focus:ring-2 focus:ring-play-500/20"
              value={customPerk}
              maxLength={60}
              placeholder="e.g. Championship banner"
              onChange={(e) => setCustomPerk(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addCustomPerk()
                }
              }}
            />
            <button
              type="button"
              onClick={addCustomPerk}
              disabled={!customPerk.trim()}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {customPerks.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {customPerks.map((entry) => (
                <span
                  key={entry}
                  className="bg-ink-100 text-ink-700 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                >
                  {perkLabel(entry)}
                  <button
                    type="button"
                    onClick={() => removePerk(entry)}
                    aria-label={`Remove ${entry}`}
                    className="text-ink-400 hover:text-ink-700 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5">
          <label className={label}>Why join this league (optional)</label>
          <textarea
            className={input}
            rows={3}
            value={f.perksNote}
            maxLength={400}
            placeholder="2-3 lines on what makes this league worth joining."
            onChange={(e) => set("perksNote", e.target.value)}
          />
        </div>
      </div>

      <div className="border-ink-100 shadow-panel sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border bg-white px-5 py-3">
        <div className="text-sm">
          {msg && <span className={msg.ok ? "text-court-700" : "text-red-600"}>{msg.text}</span>}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-hoop-500 hover:bg-hoop-600 cursor-pointer rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}
