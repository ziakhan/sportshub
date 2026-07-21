"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Badge, Button, Card, PanelHeader, DateTimePicker } from "@/components/ui"
import { VenueSelector } from "@/components/venue-selector"
import { VenueConflictNotice } from "@/components/venues/venue-conflict-notice"

const createTryoutSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().optional(),
  location: z.string().min(3, "Enter a location"),
  scheduledAt: z.string().min(1, "Select a date and time"),
  duration: z.coerce.number().min(1).optional(),
  fee: z.coerce.number().min(0, "Fee must be 0 or more"),
  maxParticipants: z.coerce.number().min(1).optional(),
  isPublic: z.boolean().default(true),
})

type CreateTryoutFormData = z.infer<typeof createTryoutSchema>

interface Team {
  id: string
  name: string
  ageGroup: string
  gender: string | null
}

const inputCls =
  "mt-1 block w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:border-play-500 focus:outline-none focus:ring-1 focus:ring-play-500/20"

export default function CreateTryoutPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-ink-500">Loading...</div>}>
      <CreateTryoutForm />
    </Suspense>
  )
}

function CreateTryoutForm() {
  const params = useParams()
  const searchParams = useSearchParams()
  const clubId = params?.id as string
  const preselectedTeamId = searchParams?.get("teamId") || ""

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTryout, setCreatedTryout] = useState<{ title: string } | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId)
  const [loadingTeams, setLoadingTeams] = useState(true)
  const [venueId, setVenueId] = useState("")
  const [venueName, setVenueName] = useState("")

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch(`/api/teams?tenantId=${clubId}`)
        if (res.ok) {
          const data = await res.json()
          setTeams(data.teams || [])
        }
      } catch {
        // silently fail
      } finally {
        setLoadingTeams(false)
      }
    }
    fetchTeams()
  }, [clubId])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTryoutFormData>({
    resolver: zodResolver(createTryoutSchema),
    defaultValues: {
      fee: 0,
      isPublic: true,
    },
  })

  const onSubmit = async (data: CreateTryoutFormData) => {
    if (!selectedTeamId) {
      setError("Please select a team")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description || undefined,
        ageGroup: selectedTeam?.ageGroup,
        location: data.location,
        venueId: venueId || undefined,
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        fee: data.fee,
        isPublic: data.isPublic,
        tenantId: clubId,
        teamId: selectedTeamId,
      }
      if (selectedTeam?.gender) payload.gender = selectedTeam.gender
      if (data.duration) payload.duration = data.duration
      if (data.maxParticipants) payload.maxParticipants = data.maxParticipants

      const res = await fetch("/api/tryouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let errorMsg = "Failed to create tryout"
        try {
          const errorData = await res.json()
          errorMsg = errorData.error || errorMsg
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMsg)
      }

      setCreatedTryout({ title: data.title })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsSubmitting(false)
    }
  }

  if (createdTryout) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="reveal text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-court-50">
            <svg className="h-6 w-6 text-court-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-condensed text-ink-950 mb-2 text-2xl font-bold uppercase tracking-wide">
            Tryout Created!
          </h2>
          <p className="mb-1 text-ink-600">
            <span className="font-semibold">{createdTryout.title}</span> has been created as a draft.
          </p>
          <p className="mb-6 text-sm text-ink-500">
            You can publish it to the marketplace from the tryouts list.
          </p>
          <div className="flex gap-3">
            <Button href={`/clubs/${clubId}/tryouts`} className="flex-1">
              View Tryouts
            </Button>
            <Button
              variant="subtle"
              className="flex-1"
              onClick={() => {
                setCreatedTryout(null)
                setError(null)
                setIsSubmitting(false)
                setSelectedTeamId("")
                reset()
              }}
            >
              Create Another Tryout
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const genderLabel = (g: string | null) => {
    if (g === "MALE") return "Boys"
    if (g === "FEMALE") return "Girls"
    if (g === "COED") return "Co-ed"
    return "Any"
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clubs/${clubId}/tryouts`}
          className="mb-2 inline-flex items-center text-sm text-ink-500 hover:text-ink-700"
        >
          &larr; Back to Tryouts
        </Link>
        <h2 className="font-condensed text-ink-950 text-2xl font-bold uppercase tracking-wide">
          Create Tryout
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Set up a tryout for your club. You can publish it to the marketplace
          after creation.
        </p>
      </div>

      <Card className="reveal">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {error && (
            <div className="rounded-xl border border-hoop-200 bg-hoop-50 p-3 text-sm text-hoop-700">
              {error}
            </div>
          )}

          {/* Tryout details */}
          <section>
            <PanelHeader title="Tryout details" />
            <div className="space-y-4">
              {/* Team Selection (mandatory) */}
              <div>
                <label htmlFor="teamId" className="block text-sm font-medium text-ink-700">
                  Team <span className="text-red-500">*</span>
                </label>
                {loadingTeams ? (
                  <p className="mt-1 text-sm text-ink-500">Loading teams...</p>
                ) : teams.length === 0 ? (
                  <div className="mt-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    No teams found. <Link href={`/clubs/${clubId}/teams/create`} className="font-medium underline">Create a team</Link> first.
                  </div>
                ) : (
                  <select
                    id="teamId"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.ageGroup}{team.gender ? ` / ${genderLabel(team.gender)}` : ""})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Show age group & gender from team */}
              {selectedTeam && (
                <div className="flex flex-wrap gap-2">
                  <Badge tone="play">Age group · {selectedTeam.ageGroup}</Badge>
                  <Badge tone="play">{genderLabel(selectedTeam.gender)}</Badge>
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium text-ink-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  {...register("title")}
                  type="text"
                  id="title"
                  className={inputCls}
                  placeholder="Spring 2026 U12 Boys Tryout"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-ink-700">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  id="description"
                  rows={3}
                  className={inputCls}
                  placeholder="What to expect, what to bring..."
                />
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
                <p className="mt-1 text-xs text-ink-400">
                  Search an existing venue or add one from Google Maps.
                </p>
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">Please choose a venue.</p>
                )}
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <PanelHeader title="Schedule" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="scheduledAt" className="block text-sm font-medium text-ink-700">
                  Date & Time <span className="text-red-500">*</span>
                </label>
                <DateTimePicker
                  id="scheduledAt"
                  mode="datetime"
                  value={watch("scheduledAt") || ""}
                  onChange={(v) => setValue("scheduledAt", v, { shouldValidate: true })}
                  placeholder="Pick a date & time"
                />
                {errors.scheduledAt && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduledAt.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="duration" className="block text-sm font-medium text-ink-700">
                  Duration (minutes)
                </label>
                <input
                  {...register("duration")}
                  type="number"
                  id="duration"
                  className={inputCls}
                  placeholder="90"
                />
              </div>
            </div>
          </section>

          {/* Fee & capacity */}
          <section>
            <PanelHeader title="Fee & capacity" />
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
                    className={inputCls}
                    placeholder="0.00"
                  />
                  {errors.fee && (
                    <p className="mt-1 text-sm text-red-600">{errors.fee.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="maxParticipants" className="block text-sm font-medium text-ink-700">
                    Max Participants
                  </label>
                  <input
                    {...register("maxParticipants")}
                    type="number"
                    id="maxParticipants"
                    min="1"
                    className={inputCls}
                    placeholder="No limit"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  {...register("isPublic")}
                  type="checkbox"
                  id="isPublic"
                  className="h-4 w-4 rounded border-ink-200 text-play-700 focus:ring-play-500/20"
                />
                <label htmlFor="isPublic" className="text-sm text-ink-700">
                  Public tryout (visible on marketplace when published)
                </label>
              </div>

              <p className="rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Tryouts are saved as drafts. You can publish them to the marketplace
                from the tryouts list.
              </p>
            </div>
          </section>

          <VenueConflictNotice
            venueId={venueId}
            startAt={watch("scheduledAt")}
            durationMinutes={Number(watch("duration")) || undefined}
            tenantId={clubId}
          />

          <div className="flex gap-3 pt-2">
            <Button variant="subtle" href={`/clubs/${clubId}/tryouts`}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedTeamId} className="flex-1">
              {isSubmitting ? "Creating..." : "Create Tryout"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
