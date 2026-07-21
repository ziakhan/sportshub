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
  "All Ages",
]

const editCampSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(200),
  campType: z.string().min(1, "Select a camp type"),
  description: z.string().optional(),
  details: z.string().optional(),
  ageGroup: z.string().min(1, "Select an age group"),
  gender: z.string().optional(),
  startDate: z.string().min(1, "Select a start date"),
  endDate: z.string().min(1, "Select an end date"),
  dailyStartTime: z.string().min(1, "Set a daily start time"),
  dailyEndTime: z.string().min(1, "Set a daily end time"),
  location: z.string().min(3, "Enter a location"),
  numberOfWeeks: z.coerce.number().min(1, "At least 1 week"),
  weeklyFee: z.coerce.number().min(0, "Fee must be 0 or more"),
  // Optional numerics stay strings so an empty input means "clear", not 0.
  fullCampFee: z.string().optional(),
  maxParticipants: z.string().optional(),
})

type EditCampFormData = z.infer<typeof editCampSchema>

interface LoadedCamp {
  id: string
  isPublished: boolean
  startDate: string
  endDate: string
  ageGroup: string | null
  maxParticipants: number | null
  includesLunch: boolean
  includesSnacks: boolean
  includesJersey: boolean
  includesBall: boolean
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

export default function EditCampPage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params?.id as string
  const campId = params?.campId as string
  const listHref = `/clubs/${clubId}/camps`

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [camp, setCamp] = useState<LoadedCamp | null>(null)
  const [includesLunch, setIncludesLunch] = useState(false)
  const [includesSnacks, setIncludesSnacks] = useState(false)
  const [includesJersey, setIncludesJersey] = useState(false)
  const [includesBall, setIncludesBall] = useState(false)
  const [venueId, setVenueId] = useState("")
  const [venueName, setVenueName] = useState("")

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditCampFormData>({
    resolver: zodResolver(editCampSchema),
  })

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/camps/${campId}`)
        if (!res.ok) throw new Error("Failed to load camp")
        const data = await res.json()
        setCamp(data)
        setIncludesLunch(!!data.includesLunch)
        setIncludesSnacks(!!data.includesSnacks)
        setIncludesJersey(!!data.includesJersey)
        setIncludesBall(!!data.includesBall)
        setVenueId(data.venueId || "")
        setVenueName(data.venue?.name || "")
        reset({
          name: data.name,
          campType: data.campType,
          description: data.description || "",
          details: data.details || "",
          ageGroup: data.ageGroup || "",
          gender: data.gender || "",
          startDate: toDateInputValue(data.startDate),
          endDate: toDateInputValue(data.endDate),
          dailyStartTime: data.dailyStartTime || "",
          dailyEndTime: data.dailyEndTime || "",
          location: data.location || "",
          numberOfWeeks: data.numberOfWeeks || 1,
          weeklyFee: Number(data.weeklyFee) || 0,
          fullCampFee: data.fullCampFee != null ? String(data.fullCampFee) : "",
          maxParticipants: data.maxParticipants != null ? String(data.maxParticipants) : "",
        })
      } catch {
        setError("Failed to load camp")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [campId, reset])

  const signupCount = camp?._count?.signups ?? 0
  const lifecycle = camp
    ? programLifecycle({
        isPublished: camp.isPublished,
        startAt: camp.startDate,
        endAt: camp.endDate,
        maxParticipants: camp.maxParticipants,
        signupCount,
      })
    : null
  const feesLocked = lifecycle ? !lifecycle.can.editFee : false

  const weeks = Number(watch("numberOfWeeks")) || 1
  const weeklyFeeValue = Number(watch("weeklyFee")) || 0
  const fullCampFeeValue = watch("fullCampFee") || ""

  const onSubmit = async (data: EditCampFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        campType: data.campType,
        description: data.description || null,
        details: data.details || null,
        ageGroup: data.ageGroup,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        dailyStartTime: data.dailyStartTime,
        dailyEndTime: data.dailyEndTime,
        location: data.location,
        venueId: venueId || undefined,
        numberOfWeeks: data.numberOfWeeks,
        maxParticipants: data.maxParticipants ? parseInt(data.maxParticipants, 10) : null,
        includesLunch,
        includesSnacks,
        includesJersey,
        includesBall,
      }
      // Gender is a Prisma enum — omit rather than sending "" (empty select).
      if (data.gender) payload.gender = data.gender
      // Money is locked once the program starts — never send fee fields then.
      if (!feesLocked) {
        payload.weeklyFee = data.weeklyFee
        payload.fullCampFee =
          weeks > 1 && data.fullCampFee ? parseFloat(data.fullCampFee) : null
      }

      const res = await fetch(`/api/camps/${campId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to update camp"
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
        <p className="text-ink-500">Loading camp...</p>
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
          &larr; Back to Camps
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
            Edit Camp
          </h2>
          {lifecycle && (
            <Badge tone={lifecycle.badge.tone} dot={lifecycle.badge.dot}>
              {lifecycle.label}
            </Badge>
          )}
        </div>
      </div>

      {!camp || !lifecycle ? (
        <Card className="reveal">
          <p className="text-sm text-hoop-700">{error || "Failed to load camp"}</p>
          <div className="mt-4">
            <Button variant="subtle" href={listHref}>
              Back to Camps
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
              Back to Camps
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

            {/* Camp details */}
            <section>
              <PanelHeader title="Camp details" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-ink-700">
                      Camp Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("name")}
                      type="text"
                      id="name"
                      placeholder="e.g. Summer Basketball Camp 2026"
                      className={inputCls}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="campType" className="block text-sm font-medium text-ink-700">
                      Camp Type <span className="text-red-500">*</span>
                    </label>
                    <select {...register("campType")} id="campType" className={inputCls}>
                      <option value="SUMMER">Summer Camp</option>
                      <option value="MARCH_BREAK">March Break</option>
                      <option value="HOLIDAY">Holiday Camp</option>
                      <option value="WEEKLY">Weekly Camp</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ageGroup" className="block text-sm font-medium text-ink-700">
                      Age Group <span className="text-red-500">*</span>
                    </label>
                    <select {...register("ageGroup")} id="ageGroup" className={inputCls}>
                      <option value="">Select...</option>
                      {/* Older/imported camps can hold a free-text age group (e.g.
                          "Ages 9-14") — keep it selectable so loading the form
                          doesn't blank the field and force a re-pick. */}
                      {camp?.ageGroup && !AGE_GROUPS.includes(camp.ageGroup) && (
                        <option value={camp.ageGroup}>{camp.ageGroup}</option>
                      )}
                      {AGE_GROUPS.map((ag) => (
                        <option key={ag} value={ag}>
                          {ag}
                        </option>
                      ))}
                    </select>
                    {errors.ageGroup && (
                      <p className="mt-1 text-sm text-red-600">{errors.ageGroup.message}</p>
                    )}
                  </div>
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
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-ink-700">
                    Description
                  </label>
                  <textarea
                    {...register("description")}
                    id="description"
                    rows={2}
                    placeholder="Brief overview..."
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
                    placeholder="Daily activities, coaching, skills focus, what to bring, etc."
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="dailyStartTime"
                      className="block text-sm font-medium text-ink-700"
                    >
                      Daily Start <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="dailyStartTime"
                      mode="time"
                      value={watch("dailyStartTime") || ""}
                      onChange={(v) => setValue("dailyStartTime", v, { shouldValidate: true })}
                      placeholder="Start time"
                    />
                  </div>
                  <div>
                    <label htmlFor="dailyEndTime" className="block text-sm font-medium text-ink-700">
                      Daily End <span className="text-red-500">*</span>
                    </label>
                    <DateTimePicker
                      id="dailyEndTime"
                      mode="time"
                      value={watch("dailyEndTime") || ""}
                      onChange={(v) => setValue("dailyEndTime", v, { shouldValidate: true })}
                      placeholder="End time"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="numberOfWeeks"
                      className="block text-sm font-medium text-ink-700"
                    >
                      Number of Weeks <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("numberOfWeeks")}
                      type="number"
                      id="numberOfWeeks"
                      min="1"
                      max="12"
                      className={inputCls}
                    />
                    {errors.numberOfWeeks && (
                      <p className="mt-1 text-sm text-red-600">{errors.numberOfWeeks.message}</p>
                    )}
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

            {/* Pricing */}
            <section>
              <PanelHeader title="Pricing" />
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="weeklyFee" className="block text-sm font-medium text-ink-700">
                      Per Week ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      {...register("weeklyFee")}
                      type="number"
                      id="weeklyFee"
                      min="0"
                      step="0.01"
                      disabled={feesLocked}
                      className={inputCls}
                    />
                    {errors.weeklyFee && (
                      <p className="mt-1 text-sm text-red-600">{errors.weeklyFee.message}</p>
                    )}
                  </div>
                  {weeks > 1 && (
                    <div>
                      <label
                        htmlFor="fullCampFee"
                        className="block text-sm font-medium text-ink-700"
                      >
                        All {weeks} Weeks ($)
                      </label>
                      <input
                        {...register("fullCampFee")}
                        type="number"
                        id="fullCampFee"
                        min="0"
                        step="0.01"
                        disabled={feesLocked}
                        placeholder={`${(weeklyFeeValue * weeks).toFixed(2)} (no discount)`}
                        className={inputCls}
                      />
                      {!feesLocked &&
                        fullCampFeeValue &&
                        parseFloat(fullCampFeeValue) < weeklyFeeValue * weeks && (
                          <p className="mt-1 text-xs text-green-600">
                            Save{" "}
                            {((1 - parseFloat(fullCampFeeValue) / (weeklyFeeValue * weeks)) * 100).toFixed(0)}
                            % vs weekly
                          </p>
                        )}
                    </div>
                  )}
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
                      { key: "lunch", label: "Lunch", checked: includesLunch, set: setIncludesLunch },
                      { key: "snacks", label: "Snacks", checked: includesSnacks, set: setIncludesSnacks },
                      { key: "jersey", label: "Jersey/T-Shirt", checked: includesJersey, set: setIncludesJersey },
                      { key: "ball", label: "Basketball", checked: includesBall, set: setIncludesBall },
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

      {camp && (
        <div className="mt-6">
          <ProgramStaffPanel programType="camp" programId={campId} clubId={clubId} />
        </div>
      )}
    </div>
  )
}
