"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ImageUploadField } from "@/components/club-page/image-upload-field"

interface Initial {
  description: string
  logoUrl: string | null
  bannerUrl: string | null
  tagline: string
  primaryColor: string
  socials: Record<string, string>
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

export function LeagueBrandEditor({ leagueId, initial }: { leagueId: string; initial: Initial }) {
  const router = useRouter()
  const [f, setF] = useState({ ...initial })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: keyof Initial, v: any) => setF((p) => ({ ...p, [k]: v }))

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
