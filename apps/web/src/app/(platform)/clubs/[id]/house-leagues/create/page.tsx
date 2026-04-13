"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export default function CreateHouseLeaguePage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [details, setDetails] = useState("")
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([])
  const [gender, setGender] = useState("")
  const [season, setSeason] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState("10:00")
  const [endTime, setEndTime] = useState("12:00")
  const [location, setLocation] = useState("")
  const [fee, setFee] = useState("0")
  const [maxParticipants, setMaxParticipants] = useState("")
  const [includesUniform, setIncludesUniform] = useState(false)
  const [includesJersey, setIncludesJersey] = useState(false)
  const [includesBall, setIncludesBall] = useState(false)
  const [includesMedal, setIncludesMedal] = useState(false)

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedAgeGroups.length === 0) {
      setError("Select at least one age group")
      return
    }
    if (selectedDays.length === 0) {
      setError("Select at least one day of the week")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/house-leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: clubId,
          name,
          description: description || undefined,
          details: details || undefined,
          ageGroups: selectedAgeGroups.join(","),
          gender: gender || undefined,
          season: season || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          daysOfWeek: selectedDays.join(","),
          startTime,
          endTime,
          location,
          fee: parseFloat(fee),
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
          includesUniform,
          includesJersey,
          includesBall,
          includesMedal,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }

      router.push(`/clubs/${clubId}/house-leagues`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/clubs/${clubId}/house-leagues`} className="text-sm text-play-700 hover:underline">
          &larr; Back to House Leagues
        </Link>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-bold text-ink-900 mb-6">Create House League Program</h2>

        {error && (
          <div className="mb-4 rounded-md bg-hoop-50 p-3 text-sm text-hoop-700 border border-hoop-200">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Program Info */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Program Details</h3>

            <div>
              <label className="block text-sm font-medium text-ink-700">Program Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. Fall House League, Saturday Skills Program"
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm shadow-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20" />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">Age Groups * <span className="text-xs text-ink-400 font-normal">(select all that apply)</span></label>
              <div className="flex flex-wrap gap-2">
                {["U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18"].map((ag) => (
                  <button key={ag} type="button"
                    onClick={() => setSelectedAgeGroups((prev) =>
                      prev.includes(ag) ? prev.filter((a) => a !== ag) : [...prev, ag]
                    )}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      selectedAgeGroups.includes(ag)
                        ? "bg-play-600 text-white"
                        : "bg-court-100 text-ink-700 hover:bg-court-200"
                    }`}>
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink-700">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm">
                  <option value="">Co-ed</option>
                  <option value="MALE">Boys</option>
                  <option value="FEMALE">Girls</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">Season</label>
                <input type="text" value={season} onChange={(e) => setSeason(e.target.value)}
                  placeholder="Fall 2026"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                placeholder="Brief overview of the program..."
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700">What&apos;s Included (Details)</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4}
                placeholder="Detailed description: number of games, practices, coaching style, skill focus areas, etc."
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Schedule</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink-700">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">Days of Week *</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button key={day} type="button" onClick={() => toggleDay(day)}
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      selectedDays.includes(day)
                        ? "bg-play-600 text-white"
                        : "bg-court-100 text-ink-700 hover:bg-court-200"
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink-700">Start Time *</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">End Time *</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700">Location *</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required
                placeholder="Gym name or address"
                className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Pricing & Capacity */}
          <div className="rounded-lg border border-ink-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-ink-900">Pricing & Capacity</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-ink-700">Fee ($) *</label>
                <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700">Max Participants</label>
                <input type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Unlimited"
                  className="mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">Includes</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "uniform", label: "Uniform (Shirt+Shorts)", checked: includesUniform, set: setIncludesUniform },
                  { key: "jersey", label: "Jersey", checked: includesJersey, set: setIncludesJersey },
                  { key: "ball", label: "Basketball", checked: includesBall, set: setIncludesBall },
                  { key: "medal", label: "Medal/Trophy", checked: includesMedal, set: setIncludesMedal },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-md border border-ink-200 p-2 cursor-pointer hover:bg-court-50">
                    <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)}
                      className="rounded border-ink-200 text-play-700 focus:ring-play-500/20" />
                    <span className="text-sm text-ink-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href={`/clubs/${clubId}/house-leagues`}
              className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-court-50">
              Cancel
            </Link>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-xl bg-play-600 px-4 py-2 text-sm font-semibold text-white hover:bg-play-700 disabled:opacity-50">
              {isSubmitting ? "Creating..." : "Create Program"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
