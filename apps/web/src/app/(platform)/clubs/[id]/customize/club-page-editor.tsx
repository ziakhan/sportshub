"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ImageUploadField } from "@/components/club-page/image-upload-field"
import { resolveLayout, type BlockConfig } from "@/lib/club-page/blocks"
import { LayoutEditor } from "./layout-editor"

interface Initial {
  tagline: string
  description: string
  bannerUrl: string | null
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  phoneNumber: string
  address: string
  city: string
  state: string
  zipCode: string
  contactEmail: string
  website: string
  socials: Record<string, string>
  pageLayout: unknown
}
interface Announcement {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-ink-100 shadow-soft rounded-3xl border bg-white p-6">
      <h3 className="text-ink-950 font-bold">{title}</h3>
      {hint && <p className="text-ink-500 mb-4 mt-0.5 text-sm">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </div>
  )
}

export function ClubPageEditor({
  clubId,
  slug,
  initial,
  initialAnnouncements,
}: {
  clubId: string
  slug: string
  initial: Initial
  initialAnnouncements: Announcement[]
}) {
  const router = useRouter()
  const [f, setF] = useState({ ...initial })
  const [layout, setLayout] = useState<BlockConfig[]>(resolveLayout(initial.pageLayout))
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (k: keyof Initial, v: any) => setF((p) => ({ ...p, [k]: v }))
  const setSocial = (k: string, v: string) => setF((p) => ({ ...p, socials: { ...p.socials, [k]: v } }))

  async function save() {
    setSaving(true)
    setMsg(null)
    const socials = Object.fromEntries(
      Object.entries(f.socials || {}).filter(([, v]) => (v || "").trim())
    )
    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagline: f.tagline || null,
          description: f.description || null,
          primaryColor: f.primaryColor,
          secondaryColor: f.secondaryColor,
          accentColor: f.accentColor,
          phoneNumber: f.phoneNumber || null,
          address: f.address || null,
          city: f.city || null,
          state: f.state || null,
          zipCode: f.zipCode || null,
          contactEmail: f.contactEmail || null,
          website: f.website || null,
          logoUrl: f.logoUrl,
          bannerUrl: f.bannerUrl,
          socials,
          pageLayout: layout,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Couldn't save." })
      } else {
        setMsg({ ok: true, text: "Saved — your public page is updated." })
        router.refresh()
      }
    } catch {
      setMsg({ ok: false, text: "Network error." })
    } finally {
      setSaving(false)
    }
  }

  // Announcements
  const [aTitle, setATitle] = useState("")
  const [aContent, setAContent] = useState("")
  const [aBusy, setABusy] = useState(false)
  // Inline edit of an existing announcement
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eTitle, setETitle] = useState("")
  const [eContent, setEContent] = useState("")
  const [eBusy, setEBusy] = useState(false)

  async function addAnnouncement() {
    if (!aTitle.trim() || !aContent.trim()) return
    setABusy(true)
    const res = await fetch(`/api/clubs/${clubId}/announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: aTitle, content: aContent }),
    })
    if (res.ok) {
      const { announcement } = await res.json()
      setAnnouncements((p) => [announcement, ...p])
      setATitle("")
      setAContent("")
    }
    setABusy(false)
  }
  async function delAnnouncement(id: string) {
    const res = await fetch(`/api/clubs/${clubId}/announcements/${id}`, { method: "DELETE" })
    if (res.ok) setAnnouncements((p) => p.filter((a) => a.id !== id))
  }
  async function pinAnnouncement(id: string) {
    const res = await fetch(`/api/clubs/${clubId}/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "togglePin" }),
    })
    if (res.ok) {
      const { announcement } = await res.json()
      setAnnouncements((p) => p.map((a) => (a.id === id ? { ...a, isPinned: announcement.isPinned } : a)))
    }
  }
  function startEditAnnouncement(a: Announcement) {
    setEditingId(a.id)
    setETitle(a.title)
    setEContent(a.content)
  }
  async function saveAnnouncementEdit() {
    if (!editingId || !eTitle.trim() || !eContent.trim()) return
    setEBusy(true)
    const res = await fetch(`/api/clubs/${clubId}/announcements/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: eTitle.trim(), content: eContent.trim() }),
    })
    if (res.ok) {
      const { announcement } = await res.json()
      setAnnouncements((p) =>
        p.map((a) =>
          a.id === editingId ? { ...a, title: announcement.title, content: announcement.content } : a
        )
      )
      setEditingId(null)
    }
    setEBusy(false)
  }

  return (
    <div className="space-y-6 pb-24">
      {/* BRAND */}
      <Section title="Brand" hint="Your banner, logo, colors, and the words at the top of the page.">
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
              placeholder="e.g. Developing players since 2009"
              onChange={(e) => set("tagline", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea
              className={input}
              rows={5}
              value={f.description}
              placeholder="A paragraph about your club — who you are, your philosophy, what families can expect."
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-5">
            {(
              [
                ["primaryColor", "Primary"],
                ["secondaryColor", "Secondary"],
                ["accentColor", "Accent"],
              ] as const
            ).map(([k, lbl]) => (
              <div key={k}>
                <label className={label}>{lbl} color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={(f as any)[k]}
                    onChange={(e) => set(k, e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-ink-200"
                  />
                  <input
                    className="w-24 rounded-lg border border-ink-200 px-2 py-1 text-xs"
                    value={(f as any)[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CONTACT */}
      <Section title="Contact info" hint="Shown in the Contact section. Leave blanks empty and they won't appear.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Phone</label>
            <input className={input} value={f.phoneNumber} onChange={(e) => set("phoneNumber", e.target.value)} />
          </div>
          <div>
            <label className={label}>Email</label>
            <input className={input} value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Street address</label>
            <input className={input} value={f.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div>
            <label className={label}>City</label>
            <input className={input} value={f.city} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Province/State</label>
              <input className={input} value={f.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div>
              <label className={label}>Postal/Zip</label>
              <input className={input} value={f.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Website</label>
            <input className={input} value={f.website} placeholder="https://…" onChange={(e) => set("website", e.target.value)} />
          </div>
        </div>
      </Section>

      {/* SOCIALS */}
      <Section title="Follow us" hint="Your social handles or full URLs.">
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map(([k, lbl, ph]) => (
            <div key={k}>
              <label className={label}>{lbl}</label>
              <input
                className={input}
                value={f.socials?.[k] || ""}
                placeholder={ph}
                onChange={(e) => setSocial(k, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* LAYOUT */}
      <Section
        title="Page layout"
        hint="Drag to reorder within a column, use → to move a block between the wide Main column and the compact Rail, and toggle what's visible. Pin a rail widget to show it at the top on phones."
      >
        <LayoutEditor value={layout} onChange={setLayout} />
      </Section>

      {/* ANNOUNCEMENTS */}
      <Section title="Announcements" hint="Short updates that show in your Announcements block.">
        <div className="space-y-4">
          <div className="border-ink-100 rounded-2xl border p-4">
            <input
              className={input}
              placeholder="Announcement title"
              value={aTitle}
              maxLength={160}
              onChange={(e) => setATitle(e.target.value)}
            />
            <textarea
              className={`${input} mt-2`}
              rows={2}
              placeholder="What's happening?"
              value={aContent}
              onChange={(e) => setAContent(e.target.value)}
            />
            <button
              type="button"
              onClick={addAnnouncement}
              disabled={aBusy || !aTitle.trim() || !aContent.trim()}
              className="bg-play-600 hover:bg-play-700 mt-2 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {aBusy ? "Posting…" : "Post announcement"}
            </button>
          </div>
          {announcements.length > 0 && (
            <div className="space-y-2">
              {announcements.map((a) =>
                editingId === a.id ? (
                  <div key={a.id} className="border-play-200 rounded-xl border p-3">
                    <input
                      className={input}
                      value={eTitle}
                      maxLength={160}
                      placeholder="Announcement title"
                      onChange={(e) => setETitle(e.target.value)}
                    />
                    <textarea
                      className={`${input} mt-2`}
                      rows={3}
                      value={eContent}
                      placeholder="What&apos;s happening?"
                      onChange={(e) => setEContent(e.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={saveAnnouncementEdit}
                        disabled={eBusy || !eTitle.trim() || !eContent.trim()}
                        className="bg-play-600 hover:bg-play-700 cursor-pointer rounded-xl px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
                      >
                        {eBusy ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={eBusy}
                        className="border-ink-200 text-ink-600 hover:bg-ink-50 cursor-pointer rounded-xl border px-4 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={a.id} className="border-ink-100 flex items-start justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {a.isPinned && (
                          <span className="bg-hoop-50 text-hoop-700 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Pinned
                          </span>
                        )}
                        <span className="text-ink-900 text-sm font-semibold">{a.title}</span>
                      </div>
                      <p className="text-ink-600 mt-0.5 line-clamp-2 text-sm">{a.content}</p>
                    </div>
                    <div className="flex flex-shrink-0 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => pinAnnouncement(a.id)}
                        className="text-ink-500 hover:text-ink-900 cursor-pointer font-medium"
                      >
                        {a.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditAnnouncement(a)}
                        className="text-play-600 hover:text-play-800 cursor-pointer font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => delAnnouncement(a.id)}
                        className="cursor-pointer font-medium text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </Section>

      {/* STICKY SAVE BAR */}
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
