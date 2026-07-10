"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button, Card } from "@/components/ui"

const inputCls =
  "mt-1 block w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"

interface ClubData {
  id: string
  name: string
  slug: string
  timezone: string
  branding: {
    primaryColor: string
  } | null
}

export default function SettingsPage() {
  const params = useParams()
  const clubId = params?.id as string

  const [club, setClub] = useState<ClubData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState("America/New_York")
  const [primaryColor, setPrimaryColor] = useState("#1a73e8")

  useEffect(() => {
    async function loadClub() {
      try {
        const res = await fetch(`/api/clubs/${clubId}`)
        if (!res.ok) throw new Error("Failed to load club")
        const data = await res.json()
        setClub(data.club)
        setName(data.club.name)
        setSlug(data.club.slug)
        setTimezone(data.club.timezone || "America/New_York")
        setPrimaryColor(data.club.branding?.primaryColor || "#1a73e8")
      } catch {
        setError("Failed to load club settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadClub()
  }, [clubId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/clubs/${clubId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, timezone, primaryColor }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      setSuccess("Settings saved successfully")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading settings...</p>
      </div>
    )
  }

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="reveal">
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Club Settings
        </h2>
        <p className="text-ink-500 mt-1 text-sm">
          Your club&apos;s name, public URL, timezone, and brand color.
        </p>
      </div>

      <Card className="reveal">
        {error && (
          <div className="mb-4 rounded-xl border border-hoop-200 bg-hoop-50 p-3 text-sm text-hoop-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-xl border border-court-200 bg-court-50 p-3 text-sm text-court-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink-700">
              Club Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">
              Slug (URL)
            </label>
            <div className="mt-1 flex">
              <span className="border-ink-200 bg-ink-50 text-ink-500 inline-flex items-center rounded-l-xl border border-r-0 px-3 text-sm">
                youthbasketballhub.com/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                  )
                }
                required
                className="border-ink-200 block w-full rounded-r-xl border px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={inputCls}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700">
              Primary Color
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="border-ink-200 h-10 w-14 cursor-pointer rounded-lg border"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="border-ink-200 block w-32 rounded-xl border px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"
                placeholder="#1a73e8"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
