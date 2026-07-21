"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Badge, Button, Card, PanelHeader, DateTimePicker } from "@/components/ui"
import { ProgramStaffPanel } from "@/components/programs/program-staff-panel"
import { programLifecycle } from "@/lib/lifecycle"
import { VenueSelector } from "@/components/venue-selector"

const AGE_GROUPS = [
  "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14", "U15", "U16", "U17", "U18",
]
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const editHouseLeagueSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(200),
  description: z.string().optional(),
  details: z.string().optional(),
  gender: z.string().optional(),
  season: z.string().optional(),
  startDate: z.string().min(1, "Select a start date"),
  endDate: z.string().min(1, "Select an end date"),
  startTime: z.string().min(1, "Set a start time"),
  endTime: z.string().min(1, "Set an end time"),
  location: z.string().min(3, "Enter a location"),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
  // Optional numeric stays a string so an empty input means "clear", not 0.
  maxParticipants: z.string().optional(),
})

type EditHouseLeagueFormData = z.infer<typeof editHouseLeagueSchema>

interface LoadedHouseLeague {
  id: string
  isPublished: boolean
  startDate: string
  endDate: string
  maxParticipants: number | null
  _count?: { signups: number }
}

// Program dates are stored as UTC midnights (the create form submits
// `new Date("YYYY-MM-DD").toISOString()`), so slice the ISO date part rather
// than converting to local time — that could shift the day.
function toDateInputValue(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

const inputCls =
  "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400"

export default function EditHouseLeaguePage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string
  const houseLeagueId = params?.houseLeagueId as string
  const listHref = `/clubs/${clubId}/house-leagues`

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [league, setLeague] = useState<LoadedHouseLeague | null>(null)
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [includesUniform, setIncludesUniform] = useState(false)
  const [includesJersey, setIncludesJersey] = useState(false)
  const [includesBall, setIncludesBall] = useState(false)
  const [includesMedal, setIncludesMedal] = useState(false)
  const [venueId, setVenueId] = useState("")
  const [venueName, setVenueName] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditHouseLeagueFormData>({
    resolver: zodResolver(editHouseLeagueSchema),
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/house-leagues/${houseLeagueId}`)
        if (!res.ok) throw new Error("Failed to load house league")
        const data = await res.json()
        setLeague(data)
        setSelectedAgeGroups(
          data.ageGroups
            ? String(data.ageGroups)
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : []
        )
        setSelectedDays(
          data.daysOfWeek
            ? String(data.daysOfWeek)
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : []
        )
        setIncludesUniform(!!data.includesUniform)
        setIncludesJersey(!!data.includesJersey)
        setIncludesBall(!!data.includesBall)
        setIncludesMedal(!!data.includesMedal)
        setVenueId(data.venueId || "")
        setVenueName(data.venue?.name || "")
        reset({
          name: data.name,
          description: data.description || "",
          details: data.details || "",
          gender: data.gender || "",
          season: data.season || "",
          startDate: toDateInputValue(data.startDate),
          endDate: toDateInputValue(data.endDate),
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          location: data.location || "",
          fee: Number(data.fee) || 0,
          maxParticipants: data.maxParticipants != null ? String(data.maxParticipants) : "",
        })
      } catch {
        setError("Failed to load house league")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [houseLeagueId, reset])

  const signupCount = league?._count?.signups ?? 0
  const lifecycle = league
    ? programLifecycle({
        isPublished: league.isPublished,
        startAt: league.startDate,
        endAt: league.endDate,
        maxParticipants: league.maxParticipants,
        signupCount,
      })
    : null
  const feesLocked = lifecycle ? !lifecycle.can.editFee : false

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const onSubmit = async (data: EditHouseLeagueFormData) => {
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
      const payload: Record<string, unknown> = {
        name: data.name,
        description: data.description || null,
        details: data.details || null,
        ageGroups: selectedAgeGroups.join(","),
        season: data.season || null,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        daysOfWeek: selectedDays.join(","),
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        venueId: venueId || undefined,
        maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants, 10) : null,
        includesUniform,
        includesJersey,
        includesBall,
        includesMedal,
      }
      // Gender is a Prisma enum — omit rather than sending "" (empty select).
      if (data.gender) payload.gender = data.gender
      // Money is locked once the program starts — never send the fee then.
      if (!feesLocked) {
        payload.fee = data.fee
      }

      const res = await fetch(`/api/house-leagues/${houseLeagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to update house league"
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      router.push(listHref)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-ink-500">Loading house league...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={listHref}
          className="mb-2 inline-flex items-center text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; Back to House Leagues
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Edit House League Program
          </h2>
          {lifecycle && (
            <Badge tone={lifecycle.badge.tone} dot={lifecycle.badge.dot}>
              {lifecycle.label}
            </Badge>
          )}
        </div>
      </div>

      {!league || !lifecycle ? (
        <Card className="reveal">
          <p className="text-sm text-hoop-700">{error || "Failed to load house league"}</p>
          <div className="mt-4">
            <Button variant="subtle" href={listHref}>
              Back to House Leagues
            </Button>
          </div>
        </Card>
      ) : !lifecycle.can.edit ? (
        <Card className="reveal">
          <PanelHeader title="Program ended" />
          <p className="text-sm text-ink-600">
            This program has ended and is now a historical record. Its details can no longer be
            edited.
          </p>
          <div className="mt-6">
            <Button variant="subtle" href={listHref}>
              Back to House Leagues
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="reveal">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {error && (
              <div className="rounded-xl border border-hoop-200 bg-hoop-50 p-3 text-sm text-hoop-700">
                {error}
              </div>
            )}

            {/* Program details */}
            <section>
              <PanelHeader title="Program details" />
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-ink-700">
                    Program Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...register("name")}
                    type="text"
                    id="name"
                    placeholder="e.g. Fall House League, Saturday Skills Program"
                    className={inputCls}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-700">
                    Age Groups <span className="text-red-500">*</span>{" "}
                    <span className="text-xs font-normal text-ink-400">(select all that apply)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((ag) => (
                      <button
                        key={ag}
                        type="button"
                        onClick={() =>
                          setSelectedAgeGroups((prev) =>
                            prev.includes(ag) ? prev.filter((a) => a !== ag) : [...prev, ag]
                          )
                        }
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          selectedAgeGroups.includes(ag)
                            ? "bg-play-600 text-white"
                            : "bg-court-100 text-ink-700 hover:bg-court-200"
                        }`}
                      >
                        {ag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-ink-700">
                      Gender
                    </label>
                    <select {...register("gender")} id="gender" className={inputCls}>
                      <option value="">Co-ed</option>
                      <option value="MALE">Boys</option>
                      <option value="FEMALE">Girls</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="season" className="block text-sm font-medium text-ink-700">
                      Season
                    </label>
                    <input
                      {...register("season")}
                      type="text"
                      id="season"
                      placeholder="Fall 2026"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-ink-700">
                    Description
                  </label>
                  <textarea
                    {...register("description")}
                    id="description"
                    rows={2}
                    placeholder="Brief overview of the program..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="details" className="block text-sm font-medium text-ink-700">
                    What&apos;s Included (Details)
                  </label>
                  <textarea
                    {...register("details")}
                    id="details"
                    rows={4}
                    placeholder="Detailed description: number of games, practices, coaching style, skill focus areas, etc."
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* Schedule */}
            <section>
              <PanelHeader title="Schedule" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-ink-700">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="startDate"
                      mode="date"
                      value={watch("startDate") || ""}
                      onChange={(v) => setValue("startDate", v, { shouldValidate: true })}
                      placeholder="Pick a start date"
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-ink-700">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="endDate"
                      mode="date"
                      value={watch("endDate") || ""}
                      onChange={(v) => setValue("endDate", v, { shouldValidate: true })}
                      placeholder="Pick an end date"
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-700">
                    Days of Week <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`rounded-full px-3 py-1 text-sm font-medium ${
                          selectedDays.includes(day)
                            ? "bg-play-600 text-white"
                            : "bg-court-100 text-ink-700 hover:bg-court-200"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-ink-700">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="startTime"
                      mode="time"
                      value={watch("startTime") || ""}
                      onChange={(v) => setValue("startTime", v, { shouldValidate: true })}
                      placeholder="Start time"
                    />
                  </div>
                  <div>
                    <label htmlFor="endTime" className="block text-sm font-medium text-ink-700">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="endTime"
                      mode="time"
                      value={watch("endTime") || ""}
                      onChange={(v) => setValue("endTime", v, { shouldValidate: true })}
                      placeholder="End time"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-ink-700">
                    Venue <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1">
                    <VenueSelector
                      value={venueId}
                      venueName={venueName}
                      onSelect={(v) => {
                        setVenueId(v.id)
                        setVenueName(v.name)
                        setValue("location", `${v.name}, ${v.address}`, { shouldValidate: true })
                      }}
                      onClear={() => {
                        setVenueId("")
                        setVenueName("")
                        setValue("location", "", { shouldValidate: true })
                      }}
                    />
                  </div>
                  <input type="hidden" {...register("location")} />
                  {errors.location && (
                    <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Pricing & capacity */}
            <section>
              <PanelHeader title="Pricing & capacity" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="fee" className="block text-sm font-medium text-ink-700">
                      Fee ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("fee")}
                      type="number"
                      id="fee"
                      min="0"
                      step="0.01"
                      disabled={feesLocked}
                      className={inputCls}
                    />
                    {errors.fee && (
                      <p className="mt-1 text-sm text-red-600">{errors.fee.message}</p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="maxParticipants"
                      className="block text-sm font-medium text-ink-700"
                    >
                      Max Participants
                    </label>
                    <input
                      {...register("maxParticipants")}
                      type="number"
                      id="maxParticipants"
                      min="1"
                      placeholder="Unlimited"
                      className={inputCls}
                    />
                  </div>
                </div>

                {feesLocked && (
                  <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                    Fees are locked once the program starts.
                  </p>
                )}
                {!feesLocked && signupCount > 0 && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Families have already registered — fee changes only apply to new registrations.
                  </p>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-ink-700">Includes</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "uniform", label: "Uniform (Shirt+Shorts)", checked: includesUniform, set: setIncludesUniform },
                      { key: "jersey", label: "Jersey", checked: includesJersey, set: setIncludesJersey },
                      { key: "ball", label: "Basketball", checked: includesBall, set: setIncludesBall },
                      { key: "medal", label: "Medal/Trophy", checked: includesMedal, set: setIncludesMedal },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-ink-200 p-2 hover:bg-court-50"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => item.set(e.target.checked)}
                          className="rounded border-ink-200 text-play-700 focus:ring-play-500/20"
                        />
                        <span className="text-sm text-ink-700">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="flex gap-3 pt-2">
              <Button variant="subtle" href={listHref}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {league && (
        <div className="mt-6">
          <ProgramStaffPanel
            programType="house-league"
            programId={houseLeagueId}
            clubId={clubId}
          />
        </div>
      )}
    </div>
  )
}
