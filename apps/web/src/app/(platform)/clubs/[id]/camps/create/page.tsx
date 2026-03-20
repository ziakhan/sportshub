"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

export default function CreateCampPage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [campType, setCampType] = useState("SUMMER")
  const [description, setDescription] = useState("")
  const [details, setDetails] = useState("")
  const [ageGroup, setAgeGroup] = useState("")
  const [gender, setGender] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dailyStartTime, setDailyStartTime] = useState("09:00")
  const [dailyEndTime, setDailyEndTime] = useState("16:00")
  const [location, setLocation] = useState("")
  const [numberOfWeeks, setNumberOfWeeks] = useState("1")
  const [weeklyFee, setWeeklyFee] = useState("0")
  const [fullCampFee, setFullCampFee] = useState("")
  const [maxParticipants, setMaxParticipants] = useState("")
  const [includesLunch, setIncludesLunch] = useState(false)
  const [includesSnacks, setIncludesSnacks] = useState(false)
  const [includesJersey, setIncludesJersey] = useState(false)
  const [includesBall, setIncludesBall] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/camps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: clubId,
          name,
          campType,
          description: description || undefined,
          details: details || undefined,
          ageGroup,
          gender: gender || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          dailyStartTime,
          dailyEndTime,
          location,
          numberOfWeeks: parseInt(numberOfWeeks),
          weeklyFee: parseFloat(weeklyFee),
          fullCampFee: fullCampFee ? parseFloat(fullCampFee) : undefined,
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : undefined,
          includesLunch,
          includesSnacks,
          includesJersey,
          includesBall,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create")
      }

      router.push(`/clubs/${clubId}/camps`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const weeks = parseInt(numberOfWeeks) || 1

  return (
    <div>
      <div className="mb-6">
        <Link href={`/clubs/${clubId}/camps`} className="text-sm text-orange-600 hover:underline">
          &larr; Back to Camps
        </Link>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Create Camp</h2>

        {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Camp Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Camp Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. Summer Basketball Camp 2026"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Camp Type *</label>
                <select value={campType} onChange={(e) => setCampType(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="SUMMER">Summer Camp</option>
                  <option value="MARCH_BREAK">March Break</option>
                  <option value="HOLIDAY">Holiday Camp</option>
                  <option value="WEEKLY">Weekly Camp</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Age Group *</label>
                <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select...</option>
                  {["U6", "U8", "U10", "U12", "U14", "U16", "U18", "All Ages"].map((ag) => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Co-ed</option>
                  <option value="MALE">Boys</option>
                  <option value="FEMALE">Girls</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                placeholder="Brief overview..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">What&apos;s Included (Details)</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4}
                placeholder="Daily activities, coaching, skills focus, what to bring, etc."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Schedule</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Daily Start *</label>
                <input type="time" value={dailyStartTime} onChange={(e) => setDailyStartTime(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Daily End *</label>
                <input type="time" value={dailyEndTime} onChange={(e) => setDailyEndTime(e.target.value)} required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Number of Weeks *</label>
                <input type="number" min="1" max="12" value={numberOfWeeks} onChange={(e) => setNumberOfWeeks(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location *</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required
                placeholder="Gym name or address"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Pricing</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Per Week ($) *</label>
                <input type="number" min="0" step="0.01" value={weeklyFee} onChange={(e) => setWeeklyFee(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              {weeks > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">All {weeks} Weeks ($)</label>
                  <input type="number" min="0" step="0.01" value={fullCampFee} onChange={(e) => setFullCampFee(e.target.value)}
                    placeholder={`${(parseFloat(weeklyFee) * weeks).toFixed(2)} (no discount)`}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  {fullCampFee && parseFloat(fullCampFee) < parseFloat(weeklyFee) * weeks && (
                    <p className="mt-1 text-xs text-green-600">
                      Save {((1 - parseFloat(fullCampFee) / (parseFloat(weeklyFee) * weeks)) * 100).toFixed(0)}% vs weekly
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Participants</label>
                <input type="number" min="1" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="Unlimited"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Includes</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "lunch", label: "Lunch", checked: includesLunch, set: setIncludesLunch },
                  { key: "snacks", label: "Snacks", checked: includesSnacks, set: setIncludesSnacks },
                  { key: "jersey", label: "Jersey/T-Shirt", checked: includesJersey, set: setIncludesJersey },
                  { key: "ball", label: "Basketball", checked: includesBall, set: setIncludesBall },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 rounded-md border border-gray-200 p-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={item.checked} onChange={(e) => item.set(e.target.checked)}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                    <span className="text-sm text-gray-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href={`/clubs/${clubId}/camps`}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              {isSubmitting ? "Creating..." : "Create Camp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
