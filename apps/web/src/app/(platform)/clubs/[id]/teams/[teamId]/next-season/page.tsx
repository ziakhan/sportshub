"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { Badge, Button, PanelHeader, SmartBack } from "@/components/ui"

/**
 * "Start next season" wizard (docs/season-continuity-plan.md §2).
 * Archive the old team + create its continuation in one flow:
 *   1. New team (name age-up prefilled) → 2. Staff carry-over →
 *   3. Returning players (staged offers) → 4. Review → create & archive →
 *   one-click "Send all" mints the carry-over offers via the offer rail.
 */

// ——— Age-up helpers ———————————————————————————————————————————————

const AGE_GROUPS = [
  "U5", "U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14",
  "U15", "U16", "U17", "U18",
  // Grade-based programs (several clubs run grade cohorts, not U-ages)
  "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10",
  "Grade 11", "Grade 12",
  "Adult",
]

/** "Huskies U13" → "Huskies U14", "Grade 9 Prep" → "Grade 10 Prep"; else unchanged. */
function ageUpLabel(value: string): string {
  return value
    .replace(/\bU(\d{1,2})\b/gi, (_m, n) => `U${Number(n) + 1}`)
    .replace(/\bGrade\s*(\d{1,2})\b/gi, (_m, n) => `Grade ${Number(n) + 1}`)
}

/** "U13" → "U14", "Grade 11" → "Grade 12" (only within the known options);
 *  anything else stays as-is. */
function ageUpAgeGroup(ageGroup: string): string {
  const next = ageUpLabel(ageGroup.trim())
  if (AGE_GROUPS.includes(next)) return next
  return ageGroup
}

/** "2026-27" → "2027-28", "2026/27" → "2027/28", "Spring 2026" → "Spring 2027". */
function nextSeasonLabel(season: string | null): string {
  if (!season) return ""
  const range = /^(.*?)(\d{4})([-/])(\d{2})(.*)$/.exec(season)
  if (range) {
    const start = Number(range[2]) + 1
    const end = String((Number(range[4]) + 1) % 100).padStart(2, "0")
    return `${range[1]}${start}${range[3]}${end}${range[5]}`
  }
  const year = /^(.*?)(\d{4})(.*)$/.exec(season)
  if (year) return `${year[1]}${Number(year[2]) + 1}${year[3]}`
  return season
}

// ——— Data shapes ——————————————————————————————————————————————————

interface Bootstrap {
  team: {
    id: string
    tenantId: string
    name: string
    ageGroup: string
    gender: string | null
    season: string | null
    archived: boolean
  }
  staff: Array<{ id: string; role: string; designation: string | null; name: string }>
  roster: Array<{ playerId: string; jerseyNumber: number | null; name: string }>
  practiceSlots: Array<{
    dayOfWeek: number
    startTime: string
    durationMinutes: number
    location: string | null
  }>
}

interface OfferTemplate {
  id: string
  name: string
  seasonFee: number
  installments: number
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const STEPS = ["New team", "Staff", "Returning players", "Review"]

function staffLabel(s: Bootstrap["staff"][number]): string {
  if (s.designation === "HeadCoach") return "Head Coach"
  if (s.designation === "AssistantCoach") return "Assistant Coach"
  if (s.role === "TeamManager") return "Team Manager"
  return s.role
}

const INPUT_CLS =
  "border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border px-3 py-2 text-sm focus:outline-none"

// ——— Page ———————————————————————————————————————————————————————————

export default function NextSeasonWizardPage() {
  const params = useParams()
  const clubId = params?.id as string
  const oldTeamId = params?.teamId as string

  const [data, setData] = useState<Bootstrap | null>(null)
  const [templates, setTemplates] = useState<OfferTemplate[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [step, setStep] = useState(1)
  const [phase, setPhase] = useState<"form" | "created" | "done">("form")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — new team
  const [name, setName] = useState("")
  const [ageGroup, setAgeGroup] = useState("")
  const [gender, setGender] = useState("")
  const [season, setSeason] = useState("")

  // Step 2 — staff carry-over
  const [staffSel, setStaffSel] = useState<Set<string>>(new Set())
  const [copySlots, setCopySlots] = useState(false)

  // Step 3 — returning players + staged offer terms
  const [playerSel, setPlayerSel] = useState<Set<string>>(new Set())
  const [offerMode, setOfferMode] = useState<"template" | "manual">("manual")
  const [templateId, setTemplateId] = useState("")
  const [feeInput, setFeeInput] = useState("")
  const [installments, setInstallments] = useState(1)
  const [expiresInDays, setExpiresInDays] = useState(14)

  // Outcome
  const [newTeamId, setNewTeamId] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{
    created: number
    skipped: Array<{ playerId: string; reason: string }>
  } | null>(null)

  // Bootstrap: old team + club offer templates
  useEffect(() => {
    if (!clubId || !oldTeamId) return
    let cancelled = false
    ;(async () => {
      try {
        const [teamRes, tplRes] = await Promise.all([
          fetch(`/api/teams/${oldTeamId}/rollover`),
          fetch(`/api/clubs/${clubId}/offer-templates`),
        ])
        if (!teamRes.ok) {
          const body = await teamRes.json().catch(() => ({}))
          throw new Error(body.error || "Couldn't load the team")
        }
        const boot: Bootstrap = await teamRes.json()
        const tplBody = tplRes.ok ? await tplRes.json() : { templates: [] }
        if (cancelled) return

        setData(boot)
        setTemplates(tplBody.templates || [])
        // Prefill with age-up applied; fall back to the same values
        setName(ageUpLabel(boot.team.name))
        setAgeGroup(ageUpAgeGroup(boot.team.ageGroup))
        setGender(boot.team.gender || "")
        setSeason(nextSeasonLabel(boot.team.season))
        // Head coach usually stays — default checked
        setStaffSel(
          new Set(boot.staff.filter((s) => s.designation === "HeadCoach").map((s) => s.id))
        )
        setCopySlots(boot.practiceSlots.length > 0)
        if ((tplBody.templates || []).length > 0) {
          setOfferMode("template")
          setTemplateId(tplBody.templates[0].id)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Couldn't load the team")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clubId, oldTeamId])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  )

  const stagedFee =
    offerMode === "template" ? (selectedTemplate?.seasonFee ?? null) : Number(feeInput || 0)
  const stagedInstallments =
    offerMode === "template" ? (selectedTemplate?.installments ?? 1) : installments

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of data?.roster ?? []) m.set(p.playerId, p.name)
    return m
  }, [data])

  const step1Valid = name.trim().length >= 3 && ageGroup.length > 0
  const offerTermsValid =
    playerSel.size === 0 ||
    (offerMode === "template" ? !!templateId : feeInput !== "" && Number(feeInput) >= 0)

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

  async function createTeam() {
    if (!data || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      // Entered from an already-archived team (manual archive, no rollover
      // yet): lift the archive first — the rollover re-archives it.
      if (data.team.archived) {
        const un = await fetch(`/api/teams/${oldTeamId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: false }),
        })
        if (!un.ok) {
          const body = await un.json().catch(() => ({}))
          throw new Error(body.error || "Couldn't reopen the archived team")
        }
      }

      const payload: Record<string, unknown> = {
        name: name.trim(),
        ageGroup,
        season: season.trim() || undefined,
        staffRoleIds: [...staffSel],
        copyPracticeSlots: copySlots && (data.practiceSlots.length > 0),
      }
      if (gender) payload.gender = gender

      const res = await fetch(`/api/teams/${oldTeamId}/rollover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Couldn't create the team")

      setNewTeamId(body.newTeamId)
      // 0 returning players → nothing to send; skip the send step gracefully
      setPhase(playerSel.size > 0 ? "created" : "done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the team")
    } finally {
      setSubmitting(false)
    }
  }

  async function sendAllOffers() {
    if (!newTeamId || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        playerIds: [...playerSel],
        expiresInDays,
      }
      if (offerMode === "template") payload.templateId = templateId
      else {
        payload.seasonFee = Number(feeInput || 0)
        payload.installments = installments
      }
      const res = await fetch(`/api/teams/${newTeamId}/rollover-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || "Couldn't send the offers")
      setSendResult({ created: body.created ?? 0, skipped: body.skipped ?? [] })
      setPhase("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the offers")
    } finally {
      setSubmitting(false)
    }
  }

  // ——— Loading / error shells ———

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-2xl border p-6 text-sm">
          {loadError}
        </div>
        <div className="mt-4">
          <Button href={`/clubs/${clubId}/teams`} variant="subtle">
            Back to teams
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-ink-400 text-sm">Loading team…</p>
      </div>
    )
  }

  // ——— Success states ———

  if (phase === "created") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-8 text-center">
          <div className="bg-court-100 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <svg className="text-court-600 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-condensed text-ink-950 mb-1 text-2xl font-bold uppercase tracking-wide">
            Team created
          </h2>
          <p className="text-ink-600 mb-1">
            <span className="font-semibold">{name.trim()}</span> is ready and{" "}
            <span className="font-semibold">{data.team.name}</span> is archived.
          </p>
          <p className="text-ink-600 mb-6">
            <span className="font-semibold">{playerSel.size}</span> offer
            {playerSel.size !== 1 ? "s" : ""} staged
            {stagedFee !== null ? (
              <>
                {" "}at <span className="font-semibold">${stagedFee.toLocaleString()}</span>
                {stagedInstallments > 1 ? ` (${stagedInstallments} installments)` : ""}
              </>
            ) : null}
            . Nothing has been sent yet — families are emailed when you send.
          </p>
          {error && (
            <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
              {error}
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <Button onClick={sendAllOffers} disabled={submitting} size="lg">
              {submitting
                ? "Sending…"
                : `Send all ${playerSel.size} offer${playerSel.size !== 1 ? "s" : ""}`}
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                setSendResult(null)
                setPhase("done")
              }}
            >
              Skip for now — send offers later
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-8">
          <div className="text-center">
            <div className="bg-court-100 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
              <svg className="text-court-600 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="font-condensed text-ink-950 mb-1 text-2xl font-bold uppercase tracking-wide">
              {name.trim()} is ready
            </h2>
            <p className="text-ink-600">
              {data.team.name} is archived — its games, stats and chat stay as read-only history.
            </p>
            {sendResult ? (
              <p className="text-ink-700 mt-2 text-sm font-medium">
                {sendResult.created} offer{sendResult.created !== 1 ? "s" : ""} sent to returning
                families
                {sendResult.skipped.length > 0
                  ? ` · ${sendResult.skipped.length} skipped`
                  : ""}
                .
              </p>
            ) : playerSel.size > 0 ? (
              <p className="text-ink-500 mt-2 text-sm">
                No offers were sent — you can send them any time from the team&apos;s offers page.
              </p>
            ) : null}
          </div>

          {sendResult && sendResult.skipped.length > 0 && (
            <div className="border-ink-100 bg-court-50 mt-5 rounded-xl border p-4">
              <p className="text-ink-700 mb-2 text-xs font-bold uppercase tracking-wide">
                Skipped
              </p>
              <ul className="space-y-1">
                {sendResult.skipped.map((s) => (
                  <li key={s.playerId} className="text-ink-600 text-sm">
                    <span className="font-medium">{nameById.get(s.playerId) || s.playerId}</span>
                    {" — "}
                    {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button href={`/clubs/${clubId}/tryouts/create?teamId=${newTeamId}`}>
              Create tryout for remaining spots
            </Button>
            <Button href={`/clubs/${clubId}/teams/${newTeamId}/dashboard`} variant="secondary">
              Open team dashboard
            </Button>
            <Button href={`/clubs/${clubId}/teams`} variant="subtle">
              Back to teams
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ——— The 4-step form ———

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <SmartBack
          fallback={`/clubs/${clubId}/teams/${oldTeamId}/dashboard`}
          fallbackLabel={data.team.name}
          className="-ml-1 mb-1"
        />
        <h2 className="font-condensed text-ink-950 flex items-center gap-2.5 text-2xl font-bold uppercase tracking-wide">
          <span className="h-6 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" aria-hidden />
          Start next season
        </h2>
        <p className="text-ink-600 mt-1 text-sm">
          Roll {data.team.name} over: the old team is archived (history stays), a new team is
          created, and returning families get offers through the normal offer flow.
        </p>
        {data.team.archived && (
          <div className="mt-3">
            <Badge tone="neutral" dot>
              This team is already archived — rolling it over creates its next season
            </Badge>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        {STEPS.map((label, i) => {
          const n = i + 1
          const state = n < step ? "done" : n === step ? "current" : "todo"
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={n >= step}
                onClick={() => setStep(n)}
                className={`flex items-center gap-2 ${n < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    state === "current"
                      ? "text-[color:var(--brand-on)]"
                      : state === "done"
                        ? "bg-court-100 text-court-700"
                        : "bg-ink-100 text-ink-400"
                  }`}
                  style={state === "current" ? { backgroundColor: "var(--brand)" } : undefined}
                >
                  {state === "done" ? "✓" : n}
                </span>
                <span
                  className={`font-condensed text-sm font-bold uppercase tracking-wide ${
                    state === "current"
                      ? "text-ink-950"
                      : state === "done"
                        ? "text-ink-600"
                        : "text-ink-400"
                  }`}
                >
                  {label}
                </span>
              </button>
              {n < STEPS.length && <span className="bg-ink-200 h-px w-4" aria-hidden />}
            </li>
          )
        })}
      </ol>

      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 mb-4 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      {/* Step 1 — New team */}
      {step === 1 && (
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <PanelHeader
            title="New team"
            action={
              (name !== data.team.name || ageGroup !== data.team.ageGroup) && (
                <Badge tone="court">Aged up from {data.team.ageGroup}</Badge>
              )
            }
          />
          <div className="space-y-4">
            <div>
              <label htmlFor="ns-name" className="text-ink-700 block text-sm font-medium">
                Team name
              </label>
              <input
                id="ns-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className={INPUT_CLS}
              />
              {name.trim().length > 0 && name.trim().length < 3 && (
                <p className="mt-1 text-sm text-red-600">Name must be at least 3 characters</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ns-age" className="text-ink-700 block text-sm font-medium">
                  Age group
                </label>
                <select
                  id="ns-age"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">Select age group</option>
                  {ageGroup && !AGE_GROUPS.includes(ageGroup) && (
                    <option value={ageGroup}>{ageGroup}</option>
                  )}
                  {AGE_GROUPS.map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ns-gender" className="text-ink-700 block text-sm font-medium">
                  Gender
                </label>
                <select
                  id="ns-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="COED">Co-ed</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ns-season" className="text-ink-700 block text-sm font-medium">
                Season label
              </label>
              <input
                id="ns-season"
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                maxLength={100}
                placeholder={nextSeasonLabel(data.team.season) || "e.g. 2027-28"}
                className={INPUT_CLS}
              />
              {data.team.season && (
                <p className="text-ink-500 mt-1 text-xs">
                  Previous season: {data.team.season}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-between">
            <Button href={`/clubs/${clubId}/teams/${oldTeamId}/dashboard`} variant="subtle">
              Cancel
            </Button>
            <Button onClick={() => setStep(2)} disabled={!step1Valid}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 — Staff carry-over */}
      {step === 2 && (
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <PanelHeader
            title="Staff"
            action={
              <span className="text-ink-500 text-xs font-medium">
                {staffSel.size} of {data.staff.length} carried over
              </span>
            }
          />
          {data.staff.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No staff assigned to {data.team.name}. You can add coaches to the new team later
              from Edit Team.
            </p>
          ) : (
            <div className="space-y-2">
              {data.staff.map((s) => (
                <label
                  key={s.id}
                  className="border-ink-200 hover:bg-court-50 flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={staffSel.has(s.id)}
                      onChange={() => toggle(staffSel, s.id, setStaffSel)}
                      className="h-4 w-4"
                    />
                    <span className="text-ink-900 text-sm font-medium">{s.name}</span>
                  </span>
                  <Badge tone={s.designation === "HeadCoach" ? "play" : "neutral"}>
                    {staffLabel(s)}
                  </Badge>
                </label>
              ))}
            </div>
          )}

          {data.practiceSlots.length > 0 && (
            <div className="border-ink-100 mt-5 border-t pt-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={copySlots}
                  onChange={(e) => setCopySlots(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="text-ink-900 block text-sm font-medium">
                    Copy weekly practice pattern
                  </span>
                  <span className="text-ink-500 mt-0.5 block text-xs">
                    {data.practiceSlots
                      .map(
                        (s) =>
                          `${DAY_NAMES[s.dayOfWeek]} ${s.startTime} · ${s.durationMinutes} min${s.location ? ` @ ${s.location}` : ""}`
                      )
                      .join("  ·  ")}
                    {" — "}pattern only; families are notified when you announce next
                    season&apos;s schedule.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button onClick={() => setStep(1)} variant="subtle">
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Returning players */}
      {step === 3 && (
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <PanelHeader
            title="Returning players"
            action={
              data.roster.length > 0 && (
                <span className="flex items-center gap-3 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPlayerSel(new Set(data.roster.map((p) => p.playerId)))}
                    className="text-play-700 hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerSel(new Set())}
                    className="text-ink-500 hover:underline"
                  >
                    Clear
                  </button>
                </span>
              )
            }
          />
          <p className="text-ink-600 -mt-2 mb-4 text-sm">
            Pick who gets an offer to return. Offers are staged now and sent in one click after
            the team is created — everyone else can still come through tryouts.
          </p>

          {data.roster.length === 0 ? (
            <p className="text-ink-500 text-sm">
              No active players on the {data.team.name} roster — skip ahead to review.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.roster.map((p) => (
                <label
                  key={p.playerId}
                  className="border-ink-200 hover:bg-court-50 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={playerSel.has(p.playerId)}
                    onChange={() => toggle(playerSel, p.playerId, setPlayerSel)}
                    className="h-4 w-4"
                  />
                  {p.jerseyNumber !== null && (
                    <span className="bg-play-100 text-play-700 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {p.jerseyNumber}
                    </span>
                  )}
                  <span className="text-ink-900 truncate text-sm font-medium">{p.name}</span>
                </label>
              ))}
            </div>
          )}

          {playerSel.size > 0 && (
            <div className="border-ink-100 bg-court-50/60 mt-5 rounded-xl border p-4">
              <p className="text-ink-700 mb-3 text-xs font-bold uppercase tracking-wide">
                Offer terms — {playerSel.size} player{playerSel.size !== 1 ? "s" : ""}
              </p>
              <div className="mb-3 flex gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="offer-mode"
                    checked={offerMode === "template"}
                    onChange={() => setOfferMode("template")}
                    disabled={templates.length === 0}
                  />
                  <span className={templates.length === 0 ? "text-ink-400" : "text-ink-700"}>
                    Club template
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="offer-mode"
                    checked={offerMode === "manual"}
                    onChange={() => setOfferMode("manual")}
                  />
                  <span className="text-ink-700">Set fee manually</span>
                </label>
              </div>

              {offerMode === "template" ? (
                templates.length === 0 ? (
                  <p className="text-ink-500 text-sm">
                    No active offer templates — set the fee manually or create a template first.
                  </p>
                ) : (
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="border-ink-200 focus:border-play-500 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — ${t.seasonFee.toLocaleString()}
                        {t.installments > 1 ? ` (${t.installments} installments)` : ""}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ns-fee" className="text-ink-700 block text-xs font-medium">
                      Season fee ($)
                    </label>
                    <input
                      id="ns-fee"
                      type="number"
                      min={0}
                      step="0.01"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      placeholder="e.g. 950"
                      className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="ns-inst" className="text-ink-700 block text-xs font-medium">
                      Installments
                    </label>
                    <select
                      id="ns-inst"
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
                    >
                      {[1, 2, 3, 4, 6, 12].map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? "Pay in full" : `${n} installments`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="mt-3">
                <label htmlFor="ns-exp" className="text-ink-700 block text-xs font-medium">
                  Offers expire in
                </label>
                <select
                  id="ns-exp"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="border-ink-200 focus:border-play-500 mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none"
                >
                  {[7, 14, 21, 30].map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button onClick={() => setStep(2)} variant="subtle">
              Back
            </Button>
            <Button onClick={() => setStep(4)} disabled={!offerTermsValid}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 — Review */}
      {step === 4 && (
        <div className="reveal border-ink-100 shadow-soft rounded-2xl border bg-white p-6">
          <PanelHeader title="Review" />
          <dl className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-500">New team</dt>
              <dd className="text-ink-900 text-right font-semibold">
                {name.trim()} · {ageGroup}
                {gender ? ` · ${gender}` : ""}
                {season.trim() ? ` · ${season.trim()}` : ""}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-500">Staff carried over</dt>
              <dd className="text-ink-900 text-right font-semibold">
                {staffSel.size === 0
                  ? "None"
                  : data.staff
                      .filter((s) => staffSel.has(s.id))
                      .map((s) => s.name)
                      .join(", ")}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-500">Practice pattern</dt>
              <dd className="text-ink-900 text-right font-semibold">
                {copySlots && data.practiceSlots.length > 0
                  ? `Copied (${data.practiceSlots.length} weekly slot${data.practiceSlots.length !== 1 ? "s" : ""})`
                  : "Not copied"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ink-500">Offers to stage</dt>
              <dd className="text-ink-900 text-right font-semibold">
                {playerSel.size === 0 ? (
                  "None"
                ) : (
                  <>
                    {playerSel.size} player{playerSel.size !== 1 ? "s" : ""}
                    {offerMode === "template" && selectedTemplate
                      ? ` · ${selectedTemplate.name} ($${selectedTemplate.seasonFee.toLocaleString()})`
                      : ` · $${Number(feeInput || 0).toLocaleString()}${installments > 1 ? ` × ${installments}` : ""}`}
                    {` · expires in ${expiresInDays} days`}
                  </>
                )}
              </dd>
            </div>
          </dl>

          <div className="border-ink-100 bg-court-50/60 mt-5 rounded-xl border p-3">
            <p className="text-ink-600 text-xs">
              Creating the team archives <span className="font-semibold">{data.team.name}</span>{" "}
              immediately — it keeps its games, stats and chat as read-only history.
              {playerSel.size > 0 &&
                " Offers are staged, not sent: you get one final Send-all click next."}
            </p>
          </div>

          <div className="mt-6 flex justify-between">
            <Button onClick={() => setStep(3)} variant="subtle">
              Back
            </Button>
            <Button onClick={createTeam} disabled={submitting}>
              {submitting ? "Creating…" : "Create team & archive old"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
