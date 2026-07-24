"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/countries"
import { Button } from "@/components/ui"
import { WaiverSignGate, type GateWaiver } from "@/components/waivers/waiver-sign-gate"
import { computeCampFee } from "@/lib/registration/camp-pricing"
import { campFeeFor, sessionDatesFor, type CampScheduleKind } from "@/lib/registration/camp-schedule"

/**
 * THE program registration panel — one component for camps, house leagues,
 * tryouts, and training sessions, web-wide (owner 2026-07-23):
 *  - multi-kid: checkboxes, every kid registered in ONE submit
 *  - camps: per-kid week picker (which weeks, not just how many)
 *  - eligibility BEFORE the button: blocked kids greyed out with the reason
 *    (STRICT), mismatches warned but allowed (PREFERRED)
 *  - already-registered kids shown as such, never a post-submit error
 *  - payment copy that reflects the club's ACTUAL rails (online / offline
 *    methods / nothing configured), no more unconditional "pay via the club"
 */

export interface SignupKid {
  id: string
  firstName: string
  lastName: string
  birthYear: number
  eligibility: { status: "ok" | "warn" | "block"; reason: string | null }
  alreadyRegistered: boolean
}

export interface SignupPayment {
  online: boolean
  offlineMethods: string[]
}

interface CampWeeks {
  /** Program flexibility (owner 2026-07-24). CONSECUTIVE keeps the week
   * picker below; DAILY/WEEKDAY_PATTERN render session-date chips instead. */
  scheduleKind: CampScheduleKind
  numberOfWeeks: number
  weeklyFee: number
  fullCampFee: number | null
  pricePerSession: number | null
  daysOfWeek: number[]
  /** ISO — week N spans startDate + (N-1)*7 days (CONSECUTIVE only). */
  startDate: string
  /** ISO — DAILY/WEEKDAY_PATTERN session-date range. */
  endDate: string
}

interface ProgramSignupFormProps {
  programName: string
  /** POST target, e.g. /api/camps/xyz/signup */
  endpoint: string
  currency: string
  kids: SignupKid[]
  payment: SignupPayment
  /** Flat fee per kid (tryout / house league / training). */
  flatFee?: number
  /** Camp week model — renders the per-kid week picker. */
  camp?: CampWeeks
  /** Where "Add a player" returns to. */
  returnPath: string
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "cash",
  ETRANSFER: "e-transfer",
  CHEQUE: "cheque",
  CARD_AT_DOOR: "card at the door",
}

function methodsText(methods: string[]): string {
  const labels = methods.map((m) => METHOD_LABELS[m] ?? m.toLowerCase())
  if (labels.length <= 1) return labels[0] ?? ""
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
}

function weekLabel(startDate: string, week: number): string {
  const start = new Date(startDate)
  start.setDate(start.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(end.getDate() + 4)
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
  return `${fmt(start)} – ${fmt(end)}`
}

export function ProgramSignupForm({
  programName,
  endpoint,
  currency,
  kids,
  payment,
  flatFee = 0,
  camp,
  returnPath,
}: ProgramSignupFormProps) {
  const router = useRouter()
  const selectable = useMemo(
    () => kids.filter((k) => !k.alreadyRegistered && k.eligibility.status !== "block"),
    [kids]
  )
  const [selected, setSelected] = useState<string[]>(selectable.length === 1 ? [selectable[0].id] : [])
  const isConsecutive = !camp || camp.scheduleKind === "CONSECUTIVE"
  const allWeeks = camp && isConsecutive ? Array.from({ length: camp.numberOfWeeks }, (_, i) => i + 1) : []
  const allSessionDates = useMemo(
    () => (camp && !isConsecutive ? sessionDatesFor(camp) : []),
    [camp, isConsecutive]
  )
  const [weeksByKid, setWeeksByKid] = useState<Record<string, number[]>>({})
  const [datesByKid, setDatesByKid] = useState<Record<string, string[]>>({})
  const [notes, setNotes] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ names: string[]; total: number } | null>(null)
  // Multi-kid waiver gating: the API 409s with waiversByPlayer; kids sign in
  // sequence, then the registration retries.
  const [waiverQueue, setWaiverQueue] = useState<
    Array<{ playerId: string; playerName: string; waivers: GateWaiver[] }>
  >([])

  const kidWeeks = (kidId: string) => weeksByKid[kidId] ?? allWeeks
  const kidDates = (kidId: string) => datesByKid[kidId] ?? allSessionDates.map((d) => d.toISOString())

  const totalFor = (kidId: string): number => {
    if (!camp) return flatFee
    if (isConsecutive) return computeCampFee(camp, kidWeeks(kidId).length).total
    return campFeeFor(camp, { sessionCount: kidDates(kidId).length })
  }
  const total = selected.reduce((sum, id) => sum + totalFor(id), 0)

  const toggleKid = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]))

  const toggleWeek = (kidId: string, week: number) =>
    setWeeksByKid((prev) => {
      const current = prev[kidId] ?? allWeeks
      const next = current.includes(week) ? current.filter((w) => w !== week) : [...current, week].sort((a, b) => a - b)
      return { ...prev, [kidId]: next.length === 0 ? current : next }
    })

  const toggleDate = (kidId: string, iso: string) =>
    setDatesByKid((prev) => {
      const current = prev[kidId] ?? allSessionDates.map((d) => d.toISOString())
      const next = current.includes(iso) ? current.filter((d) => d !== iso) : [...current, iso].sort()
      return { ...prev, [kidId]: next.length === 0 ? current : next }
    })

  const labelClass = "block text-sm font-medium text-ink-800"
  const inputClass =
    "mt-1 block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-ink-900 shadow-sm focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-line)]"

  async function submitSignup() {
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrations: selected.map((playerId) => ({
            playerId,
            ...(camp
              ? isConsecutive
                ? { weekNumbers: kidWeeks(playerId) }
                : { sessionDates: kidDates(playerId) }
              : {}),
          })),
          notes: notes || undefined,
          marketingConsent,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        if (e.code === "WAIVERS_REQUIRED" && Array.isArray(e.waiversByPlayer) && e.waiversByPlayer.length > 0) {
          setWaiverQueue(e.waiversByPlayer)
          return
        }
        if (e.code === "WAIVERS_REQUIRED" && Array.isArray(e.waivers) && selected.length === 1) {
          const kid = kids.find((k) => k.id === selected[0])
          setWaiverQueue([
            {
              playerId: selected[0],
              playerName: kid ? `${kid.firstName} ${kid.lastName}` : "",
              waivers: e.waivers,
            },
          ])
          return
        }
        throw new Error(e.error || "Failed to register")
      }
      const names = selected.map((id) => {
        const k = kids.find((kid) => kid.id === id)
        return k ? `${k.firstName} ${k.lastName}` : "Your player"
      })
      setSuccess({ names, total })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (selected.length === 0) {
      setError("Select at least one player.")
      return
    }
    await submitSignup()
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <h3 className="mb-1 font-semibold text-green-800">
            {success.names.length > 1 ? "All registered!" : "Registered!"}
          </h3>
          <p className="text-court-700 text-sm">
            <strong>{success.names.join(" and ")}</strong> {success.names.length > 1 ? "are" : "is"}{" "}
            registered for {programName}.
          </p>
          {success.total > 0 ? (
            <p className="text-court-700 mt-2 text-sm">
              {payment.online ? (
                <>
                  Total <strong>{formatCurrency(success.total, currency)}</strong> — you can pay
                  online from your Payments page.
                </>
              ) : payment.offlineMethods.length > 0 ? (
                <>
                  Total <strong>{formatCurrency(success.total, currency)}</strong> — the club
                  accepts {methodsText(payment.offlineMethods)}; pay them directly and they&apos;ll
                  mark it received. Offline payments are arranged directly with the organizer — the
                  platform can&apos;t refund them.
                </>
              ) : (
                <>
                  Total <strong>{formatCurrency(success.total, currency)}</strong> — the club will
                  contact you about payment.
                </>
              )}
            </p>
          ) : null}
        </div>
        {success.total > 0 && payment.online ? (
          <Button href="/payments" block>
            Pay now
          </Button>
        ) : null}
        <Link
          href={returnPath}
          className="block text-center text-sm font-semibold text-[color:var(--brand-ink)] hover:underline"
        >
          Done
        </Link>
      </div>
    )
  }

  if (kids.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-1 font-semibold text-yellow-800">Add a player first</h3>
          <p className="text-hoop-700 text-sm">Add your child before registering.</p>
        </div>
        <Button
          href={`/players/add?redirect=${encodeURIComponent(returnPath)}`}
          block
          size="lg"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>}
        >
          Add a player
        </Button>
      </div>
    )
  }

  if (selectable.length === 0 && kids.every((k) => k.alreadyRegistered || k.eligibility.status === "block")) {
    const allRegistered = kids.every((k) => k.alreadyRegistered)
    return (
      <div className="space-y-3">
        {kids.map((k) => (
          <KidRow key={k.id} kid={k} checked={false} disabled onToggle={() => {}} />
        ))}
        <div className="rounded-2xl border border-court-200 bg-court-50 p-4 text-center text-sm text-court-700">
          {allRegistered
            ? "All your players are already registered."
            : "None of your players are eligible for this program."}
        </div>
      </div>
    )
  }

  const gate = waiverQueue[0]

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {gate ? (
        <WaiverSignGate
          waivers={gate.waivers}
          playerId={gate.playerId}
          playerName={gate.playerName}
          onComplete={() => {
            const rest = waiverQueue.slice(1)
            setWaiverQueue(rest)
            if (rest.length === 0) void submitSignup()
          }}
          onCancel={() => setWaiverQueue([])}
        />
      ) : null}
      {error && (
        <div className="border-hoop-200 bg-hoop-50 text-hoop-700 rounded-xl border p-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <span className={labelClass}>
          Who&apos;s playing? <span className="text-red-500">*</span>
        </span>
        <div className="mt-2 space-y-2">
          {kids.map((kid) => {
            const checked = selected.includes(kid.id)
            const disabled = kid.alreadyRegistered || kid.eligibility.status === "block"
            return (
              <div key={kid.id}>
                <KidRow kid={kid} checked={checked} disabled={disabled} onToggle={() => toggleKid(kid.id)} />
                {camp && checked && isConsecutive && camp.numberOfWeeks > 1 ? (
                  <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                    {allWeeks.map((w) => {
                      const on = kidWeeks(kid.id).includes(w)
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => toggleWeek(kid.id, w)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            on
                              ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                              : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                          }`}
                        >
                          Week {w} · {weekLabel(camp.startDate, w)}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {camp && checked && isConsecutive && camp.numberOfWeeks > 1 ? (
                  <p className="ml-8 mt-1.5 text-xs text-ink-500">
                    {kidWeeks(kid.id).length === camp.numberOfWeeks
                      ? computeCampFee(camp, camp.numberOfWeeks).usedFullCampFee &&
                        computeCampFee(camp, camp.numberOfWeeks).hasDiscount
                        ? `All ${camp.numberOfWeeks} weeks — full-camp price (save ${computeCampFee(camp, camp.numberOfWeeks).savingsPercent}%)`
                        : `All ${camp.numberOfWeeks} weeks`
                      : `${kidWeeks(kid.id).length} of ${camp.numberOfWeeks} weeks`}
                    {" · "}
                    {formatCurrency(totalFor(kid.id), currency)}
                  </p>
                ) : null}
                {camp && checked && !isConsecutive ? (
                  <div className="ml-8 mt-2 flex flex-wrap gap-1.5">
                    {allSessionDates.map((d) => {
                      const iso = d.toISOString()
                      const on = kidDates(kid.id).includes(iso)
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => toggleDate(kid.id, iso)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            on
                              ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white"
                              : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
                          }`}
                        >
                          {format(d, "EEE MMM d")}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                {camp && checked && !isConsecutive ? (
                  <p className="ml-8 mt-1.5 text-xs text-ink-500">
                    {kidDates(kid.id).length === allSessionDates.length
                      ? `All ${allSessionDates.length} session${allSessionDates.length !== 1 ? "s" : ""}`
                      : `${kidDates(kid.id).length} of ${allSessionDates.length} sessions`}
                    {" · "}
                    {formatCurrency(totalFor(kid.id), currency)}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label htmlFor="signup-notes" className={labelClass}>
          Notes <span className="text-ink-400">(optional)</span>
        </label>
        <textarea
          id="signup-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="Allergies, level, anything the organizer should know..."
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-ink-300"
        />
        <span>Email me about future programs from this organizer</span>
      </label>

      <Button
        type="submit"
        block
        size="lg"
        disabled={isSubmitting || selected.length === 0}
        icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      >
        {isSubmitting
          ? "Registering..."
          : total > 0
            ? `Register${selected.length > 1 ? ` ${selected.length} players` : ""} · ${formatCurrency(total, currency)}`
            : `Register${selected.length > 1 ? ` ${selected.length} players` : ""} (Free)`}
      </Button>

      {total > 0 ? (
        <p className="text-center text-xs text-ink-500">
          {payment.online
            ? "Pay online after registering — no charge until you do."
            : payment.offlineMethods.length > 0
              ? `This organizer accepts ${methodsText(payment.offlineMethods)} — pay them directly after registering. Offline payments are arranged directly with the organizer — the platform can't refund them.`
              : "The organizer will contact you about payment after registering."}
        </p>
      ) : null}
    </form>
  )
}

function KidRow({
  kid,
  checked,
  disabled,
  onToggle,
}: {
  kid: SignupKid
  checked: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
        disabled
          ? "cursor-default border-ink-100 bg-ink-50/60"
          : checked
            ? "cursor-pointer border-[color:var(--brand)] bg-[color:var(--brand-wash,#faf7f2)]"
            : "cursor-pointer border-ink-200 bg-white hover:border-ink-300"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-ink-300"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${disabled ? "text-ink-400" : "text-ink-900"}`}>
            {kid.firstName} {kid.lastName}
          </span>
          <span className="text-xs text-ink-400">b. {kid.birthYear}</span>
          {kid.alreadyRegistered ? (
            <span className="rounded-full bg-court-100 px-2 py-0.5 text-[11px] font-bold text-court-700">
              ✓ Registered
            </span>
          ) : kid.eligibility.status === "block" ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
              Not eligible
            </span>
          ) : kid.eligibility.status === "warn" ? (
            <span className="bg-hoop-100 text-hoop-700 rounded-full px-2 py-0.5 text-[11px] font-bold">
              Outside age group
            </span>
          ) : null}
        </span>
        {!kid.alreadyRegistered && kid.eligibility.reason ? (
          <span className="mt-0.5 block text-xs text-ink-500">
            {kid.firstName} is {kid.eligibility.reason}
            {kid.eligibility.status === "warn" ? " — you can still register if the organizer allows it." : "."}
          </span>
        ) : null}
      </span>
    </label>
  )
}
