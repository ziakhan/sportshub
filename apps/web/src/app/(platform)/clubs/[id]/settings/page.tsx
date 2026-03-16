"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"

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
  const clubId = params.id as string

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
        <p className="text-gray-500">Loading settings...</p>
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
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">
          Club Settings
        </h2>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Club Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Slug (URL)
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
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
                className="block w-full rounded-r-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary Color
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="block w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                placeholder="#1a73e8"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700 disabled:bg-gray-400"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
